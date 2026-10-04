import { test, expect } from '@playwright/test';

/* The demo's chrome is reached the way the app's is: the top bar carries only the scope button
   and the overflow (⋯) button, so #scopeBtn and #moreBtn are the entry points, and every screen
   below them hangs off `data-a` actions. */
const app = (page, sel) => page.locator(`#app ${sel}`);
const openActions = async (page, i) => {
  await app(page, '#scopeBtn').click();
  await app(page, `[data-a="sacts"][data-i="${i}"]`).click();
};

/* A closed sheet is `opacity:0` with `pointer-events:none`, not `display:none`, so Playwright still
   reports it as visible. Assert the state the demo actually controls: the `open` class, the scrim,
   and whether the sheet would swallow a click. */
const sheetOpen = (page, id) =>
  page.locator(`#app #${id}`).evaluate((el) => ({
    open: el.classList.contains('open'),
    hittable: getComputedStyle(el).pointerEvents !== 'none',
  }));

/* The demo is a 1280x800 frame part-way down a long marketing page, so a default 1280x720 viewport
   leaves most of it below the fold — and clicks land on whatever is actually at those coordinates.
   Every test scrolls the element it is about to interact with into view first. */
const ready = async (page, sel) => {
  const el = app(page, sel);
  await el.scrollIntoViewIfNeeded();
  return el;
};

test.describe('Demo Interactions & End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Tall enough that the whole frame fits once scrolled to, so sheets never open off-screen.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.locator('#app').scrollIntoViewIfNeeded();
  });

  test('the board renders on load', async ({ page }) => {
    // Regression guard: `labels()` once queried `.coords-r` from inside `.board`, where it does not
    // exist, so setup() threw and the board stayed empty. A blank frame looks like a design choice
    // rather than a crash, which is why this is asserted explicitly.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();

    await expect(app(page, '#bd .pc-wrap')).toHaveCount(32);
    await expect(app(page, '.coords-r span')).toHaveCount(8);
    await expect(app(page, '.coords-f span')).toHaveCount(8);
    await expect(app(page, '.coords-in span')).toHaveCount(16);
    // The hatched dark squares are drawn into the background SVG's path.
    await expect(app(page, '#bd .sq-d')).toHaveAttribute('d', /M/);
    expect(errors).toEqual([]);
  });

  /** Clicks a square by file/rank (file 0 = a, rank 1 = white's back rank). */
  const mover = async (page) => {
    const box = await (await ready(page, '#bd')).boundingBox();
    const sq = box.width / 8;
    const click = async (file, rank) => {
      await page.mouse.click(box.x + sq * (file + 0.5), box.y + sq * (8 - rank + 0.5));
    };
    return click;
  };

  test('a correct move is graded, and the line advances on its own', async ({ page }) => {
    const click = await mover(page);
    await expect(app(page, '#due')).toContainText('16');

    await click(4, 2); // e2
    await click(4, 4); // e4 — the repertoire move

    // The verdict is carried by the visually hidden live region; the app puts nothing on screen.
    await expect(app(page, '#live')).toHaveText('Correct. e4.');
    await expect(app(page, '#due')).toContainText('15');

    // A remembered move does not wait for Continue — only a lapse does. The session moves on by
    // itself once the opponent's reply has been played, so the line reads "1. e4 e6".
    await expect(app(page, '#contBtn')).toBeHidden();
    await expect(app(page, '#line')).toContainText('1.');
    await expect(app(page, '#line')).toContainText('e4');
    await expect(app(page, '#line')).toContainText('e6');
  });

  test('a lapse reveals the repertoire move and then waits for Continue', async ({ page }) => {
    const click = await mover(page);

    await click(4, 2); // e2
    await click(4, 4); // e4
    // Wait for the session to move on before playing again: the board is inert while the opponent's
    // reply is being animated.
    await expect(app(page, '#line')).toContainText('e6');

    // Cards are only created for the side under review, so the next card is d2-d4.
    await click(0, 2); // a2
    await click(0, 3); // a3 — not in the repertoire

    await expect(app(page, '#answer')).toBeVisible();
    await expect(app(page, '#ansMove')).toHaveText('d4');
    await expect(app(page, '#live')).toHaveText('Not this move. The repertoire move is d4.');
    // A lapse stays due until it is actually recalled.
    await expect(app(page, '#due')).toContainText('15');

    await click(3, 2); // d2
    await click(3, 4); // d4 — now recalled
    await expect(app(page, '#contBtn')).toBeVisible();

    await page.keyboard.press(' ');
    await expect(app(page, '#contBtn')).toBeHidden();
  });

  test('scope picker switches study to the Sicilian repertoire', async ({ page }) => {
    await app(page, '#scopeBtn').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: true, hittable: true });

    await app(page, '[data-a="pick"][data-i="1"]').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: false, hittable: false });
    await expect(app(page, '#scopeName')).toHaveText('Sicilian Defense Repertoire');
    await expect(app(page, '#due')).toContainText('7');
  });

  test('Escape dismisses an open sheet', async ({ page }) => {
    await app(page, '#scopeBtn').click();
    await expect(app(page, '#scrim')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(app(page, '#scrim')).not.toHaveClass(/open/);
  });

  test('Analyze renders into the settings shell without destroying it', async ({ page }) => {
    // Regression guard: `drawAn` used to replace .view-settings' innerHTML outright, which
    // detached #backBtn (losing its startup listener) and #settingsBody (so every later screen
    // rendered into nothing and threw). Assert the shell survives a round trip.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openActions(page, 1);
    await app(page, '[data-a="analyze"]').click();

    await expect(app(page, '#setTitle')).toHaveText('Game 1');
    await app(page, '[data-a="ply"][data-i="3"]').click();
    await expect(app(page, '.t-san .ply.on')).toHaveText('d4');

    await app(page, '#backBtn').click();
    await expect(page.locator('#app')).toHaveAttribute('data-screen', 'review');
    await expect(app(page, '#bd')).toBeVisible();

    // Settings must still be reachable afterwards — this is what the old bug broke.
    await app(page, '#moreBtn').click();
    await app(page, '[data-a="settings"]').click();
    await expect(app(page, '#setTitle')).toHaveText('Settings');
    await expect(app(page, '#settingsBody')).toContainText('Review');

    expect(errors).toEqual([]);
  });

  test('Export PGN shows the study and dismisses its sheet', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openActions(page, 1);
    await app(page, '[data-a="export"]').click();

    // Leaving the scrim up would put a modal barrier over the screen that replaced the sheet.
    await expect(app(page, '#scrim')).not.toHaveClass(/open/);
    await expect(app(page, '#x-pgn')).toContainText('[Event "Sicilian Defense Repertoire"]');
    expect(errors).toEqual([]);
  });

  test('settings rebuilds from state when a segmented control is tapped', async ({ page }) => {
    // SrsSettingsScreen is a ConsumerStatefulWidget: a tap writes to the preferences provider and
    // the widget rebuilds from it, so the whole row group re-renders with the new aria-pressed.
    await app(page, '#moreBtn').click();
    await app(page, '[data-a="settings"]').click();

    await expect(app(page, '#settingsBody')).toContainText('Review & Spaced Repetition');
    await expect(app(page, '#settingsBody')).toContainText('Appearance & Theme');

    await app(page, '[data-a="retention"][data-v="0.85"]').click();
    await expect(app(page, '[data-a="retention"][data-v="0.85"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(app(page, '[data-a="retention"][data-v="0.88"]')).toHaveAttribute('aria-pressed', 'false');

    // Theme and accent are written as data attributes on the demo root, because sync-design.js
    // re-anchors the app's tokens from `:root` onto `.app`. The theme is normalised to the tokens'
    // own vocabulary; the accent ids come from tokens.json.
    await app(page, '[data-a="theme"][data-v="true"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-theme', 'dark');

    await app(page, '[data-a="accent"][data-v="ochre"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-accent', 'ochre');
    await expect(app(page, '[data-a="accent"][data-v="ochre"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(app(page, '[data-a="accent"][data-v="ultramarine"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('import sheet handles valid PGN and invalid PGN', async ({ page }) => {
    // Import PGN sits at the foot of the scope list, not in the Library sheet: the app's library
    // sheet carries only Settings and About (library_sheet.dart).
    await app(page, '#scopeBtn').click();
    await app(page, '[data-a="import"]').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: false, hittable: false });

    await app(page, '#i-pgn').fill('1. e4 e5 2. Qh8');
    await app(page, '[data-a="doimport"]').click();
    await expect(app(page, '#i-err')).toBeVisible();
    await expect(app(page, '#i-err')).toContainText(/could not read/i);

    const pgn = `[Event "Test Repertoire"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 *`;
    await app(page, '#i-pgn').fill(pgn);
    await app(page, '[data-a="doimport"]').click();

    await expect(app(page, '#scopeName')).toHaveText('Test Repertoire');
  });

  test('pausing keeps the due count and marks the row', async ({ page }) => {
    // Pausing removes a study from the pool without resetting its schedule, so the scope row keeps
    // its numeral and is recoloured `.paused` (review_scope_drawer.dart `_ScopeRow`).
    await app(page, '#scopeBtn').click();
    const row = app(page, '[data-a="pick"][data-i="0"]');
    await expect(row).not.toHaveClass(/paused/);

    await app(page, '[data-a="sacts"][data-i="0"]').click();
    await app(page, '[data-a="pause"]').click();

    await app(page, '#scopeBtn').click();
    await expect(row).toHaveClass(/paused/);
    await expect(row).toContainText('16');
  });

  test('reduced-motion preference is respected without broken animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#demo')).toBeVisible();
    await expect(app(page, '#bd .pc-wrap')).toHaveCount(32);
  });
});
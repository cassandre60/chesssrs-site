import { test, expect } from '@playwright/test';

/* The demo's chrome is reached the way the app's is: the top bar carries only the two colour
   squares and the overflow (⋯) button, so #sqW/#sqB and #moreBtn are the entry points. A square
   both selects its colour's scope and opens that colour's drawer, and every screen below them
   hangs off `data-a` actions. */
const app = (page, sel) => page.locator(`#app ${sel}`);
const openActions = async (page, sq, i) => {
  await app(page, sq).click();
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
    await expect(app(page, '#live')).toHaveText('Not this move. The study move is d4.');
    await expect(app(page, '#skipBtn')).toContainText('Reveal answer');
    // A lapse stays due until it is actually recalled.
    await expect(app(page, '#due')).toContainText('15');

    await click(3, 2); // d2
    await click(3, 4); // d4 — now recalled
    await expect(app(page, '#contBtn')).toBeVisible();

    await page.keyboard.press(' ');
    await expect(app(page, '#contBtn')).toBeHidden();
    // ...and Space continues without the board hijacking the key. The board used to bind Space as
    // select-and-move, so with the board focused (i.e. after any click on it) Space moved the cursor
    // and overwrote the verdict here instead of continuing.
    await expect(app(page, '#live')).toHaveText('Correct. d4.');
  });

  test('a dragged piece follows the pointer and is lifted above the others', async ({ page }) => {
    // Regression guard: `place()` parks a piece with translate(<col*100>%, <row*100>%), but the drag
    // handler wrote its offset in pixels. The piece therefore sat on a8 with a few pixels of travel
    // while the destination highlight tracked the cursor — the move still resolved on pointerup, so
    // click-to-move tests passed and the bug shipped. It is only observable mid-drag.
    const board = await (await ready(page, '#bd')).boundingBox();
    const sq = board.width / 8;
    const at = (file, rank) => ({
      x: board.x + sq * (file + 0.5),
      y: board.y + sq * (8 - rank + 0.5),
    });

    const e2 = at(4, 2);
    const e4 = at(4, 4);
    await page.mouse.move(e2.x, e2.y);
    await page.mouse.down();
    await page.mouse.move((e2.x + e4.x) / 2, (e2.y + e4.y) / 2, { steps: 4 });
    await page.mouse.move(e4.x, e4.y, { steps: 4 });

    // `.drag` is what lifts the piece and raises it above its neighbours; demo-reference.css has
    // always defined it and nothing was adding it, so the dragged piece painted underneath the rest.
    const dragging = await app(page, '#bd .pc-wrap.drag').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        z: getComputedStyle(el).zIndex,
        cursor: getComputedStyle(el).cursor,
        scale: getComputedStyle(el.querySelector('.pc')).transform,
      };
    });
    expect(Math.abs(dragging.cx - e4.x)).toBeLessThan(2);
    expect(Math.abs(dragging.cy - e4.y)).toBeLessThan(2);
    expect(dragging.z).toBe('6');
    expect(dragging.cursor).toBe('grabbing');
    expect(dragging.scale).toContain('1.08');

    await page.mouse.up();
    await expect(app(page, '#live')).toHaveText('Correct. e4.');
    // The pick-up class must not survive the drop.
    await expect(app(page, '#bd .pc-wrap.drag')).toHaveCount(0);
  });

  test('a drag dropped on a square it cannot reach changes nothing', async ({ page }) => {
    const board = await (await ready(page, '#bd')).boundingBox();
    const sq = board.width / 8;
    const a1 = { x: board.x + sq * 0.5, y: board.y + sq * 7.5 };
    const a3 = { x: board.x + sq * 0.5, y: board.y + sq * 5.5 };

    await page.mouse.move(a1.x, a1.y);
    await page.mouse.down();
    await page.mouse.move((a1.x + a3.x) / 2, (a1.y + a3.y) / 2, { steps: 3 });
    await page.mouse.move(a3.x, a3.y, { steps: 3 });
    await page.mouse.up();

    // The rook snaps home and the card stays on the prompt.
    await expect(app(page, '#due')).toContainText('16');
    await expect(app(page, '#live')).not.toContainText('Correct');
  });

  test('Space is Continue everywhere, never a board key', async ({ page }) => {
    const click = await mover(page);

    await click(4, 2);
    await click(4, 4);
    await expect(app(page, '#live')).toHaveText('Correct. e4.');
    await expect(app(page, '#bd')).toBeFocused();

    // Press Space once the next card is on the board and accepting input again. The board used to
    // bind Space as select-and-move, so from here it announced the cursor square ("e2, empty. Not
    // one of your pieces.") and destroyed the verdict — while Continue, which is what the app binds
    // Space to, did nothing because no verdict was waiting.
    await expect(app(page, '#line')).toContainText('e6');
    await page.keyboard.press(' ');
    await expect(app(page, '#live')).not.toContainText('Not one of your pieces');
    await expect(app(page, '#live')).toHaveText('Correct. e4.');

    // And with no verdict waiting Space is a no-op: the session must not advance a card.
    const line = await app(page, '#line').innerText();
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    expect(await app(page, '#line').innerText()).toBe(line);
  });

  test('Space cannot re-activate a button that still holds focus', async ({ page }) => {
    // Regression guard: a focused <button> is a click on Space, so after Escape closed the scope
    // drawer, Space re-opened it instead of continuing — the session looked frozen. The app's
    // CallbackShortcuts sit above the whole screen, so nothing under them can consume the key.
    await app(page, '#sqW').click();
    await expect(app(page, '#scrim')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(app(page, '#scrim')).not.toHaveClass(/open/);
    await expect(app(page, '#sqW')).toBeFocused();

    await page.keyboard.press(' ');
    await page.waitForTimeout(250);
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: false, hittable: false });
  });

  test('scope picker switches study to the Sicilian repertoire', async ({ page }) => {
    // The Black square selects the Black scope and opens its drawer; picking the study starts a
    // Black session. There is no scope name in the top bar any more — the pressed square says
    // which colour is live — so assert the session instead: Black to play, 7 due.
    await app(page, '#sqB').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: true, hittable: true });

    await app(page, '[data-a="pick"][data-i="1"]').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: false, hittable: false });
    await expect(app(page, '#sqB')).toHaveAttribute('aria-pressed', 'true');
    await expect(app(page, '#turnTxt')).toHaveText(/Black to play/);
    await expect(app(page, '#due')).toContainText('7');
  });

  test('Escape dismisses an open sheet', async ({ page }) => {
    await app(page, '#sqW').click();
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

    await openActions(page, '#sqB', 1);
    await app(page, '[data-a="analyze"]').click();

    await expect(app(page, '#setTitle')).toHaveText('Game 1');
    await app(page, '[data-a="ply"][data-i="3"]').click();
    await expect(app(page, '.t-san .ply.on')).toHaveText('Nf3');

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

    await openActions(page, '#sqB', 1);
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
    await expect(app(page, '#settingsBody')).toContainText('Appearance');

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
    // Import PGN is the full-width pill at the foot of the scope drawer, not in the Library
    // sheet: the app's library sheet carries only Settings and About (library_sheet.dart).
    await app(page, '#sqW').click();
    await app(page, '[data-a="import"]').click();
    expect(await sheetOpen(page, 'sheetScope')).toEqual({ open: false, hittable: false });

    await app(page, '#i-pgn').fill('1. e4 e5 2. Qh8');
    await app(page, '[data-a="doimport"]').click();
    await expect(app(page, '#i-err')).toBeVisible();
    await expect(app(page, '#i-err')).toContainText(/could not read/i);

    const pgn = `[Event "Test Repertoire"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 *`;
    await app(page, '#i-pgn').fill(pgn);
    await app(page, '[data-a="doimport"]').click();

    // No orientation header means a White study: it lands in the White drawer's Studies group.
    await app(page, '#sqW').click();
    await expect(app(page, '#scopeList .row .row-name')).toContainText(['Test Repertoire']);
  });

  test('pausing keeps the due count and marks the row', async ({ page }) => {
    // Pausing removes a study from the pool without resetting its schedule, so the scope row keeps
    // its numeral and is recoloured `.paused` (review_scope_drawer.dart `_ScopeRow`).
    await app(page, '#sqW').click();
    const row = app(page, '[data-a="pick"][data-i="0"]');
    await expect(row).not.toHaveClass(/paused/);

    await app(page, '[data-a="sacts"][data-i="0"]').click();
    await app(page, '[data-a="pause"]').click();

    await app(page, '#sqW').click();
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
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/* App parity: the demo's screens against the manifest the app's Dart produced.
 *
 *   scripts/sync-strings.js   app Dart        -> design/app-ui.json   (--check: fails if stale)
 *   tests/e2e/app-parity.spec.js  design/app-ui.json vs the running demo  (this file)
 *
 * The first catches "the app changed and nobody re-derived it". This catches "the demo no longer
 * matches the app". Neither alone is enough, and before this existed neither existed at all:
 * renaming `Daily limit` in srs_settings_screen.dart left every other gate green.
 *
 * Rows listed in KNOWN_GAPS are work the demo has not done, not drift. They are asserted to *stay*
 * present in the manifest — so the day the app drops one, this file is forced to say so — while not
 * failing the build. Anything outside that list is drift and fails.
 */
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../design/app-ui.json'), 'utf8')
);

const KNOWN_GAPS = new Set([
  // The app's whole settings screen is 33 rows across 8 sections. The demo ports the 10 that
  // affect the review screen a visitor can actually see in the demo. The rest navigate to screens
  // this demo does not port, so rendering them would be inventing UI.
  'Lichess account',
  'Review order',
  'Transposed moves',
  'Initial ease factor',
  'Interval scaling',
  'Collapsible list groups',
  'Board theme',
  'Piece set',
  'Board coordinates',
  'Piece animation',
  'Board highlights',
  'Shape drawing',
  'Premoves',
  'How you move pieces',
  'Move on release',
  'Castling method',
  'Volume',
  'Chess engine',
  'Local database size',
  'HTTP network logs',
  'App diagnostics logs',
  'Rate this app',
  'Licences & open source',
]);

const app = (page, sel) => page.locator(`#app ${sel}`);
const openSettings = async (page) => {
  await app(page, '#moreBtn').click();
  await app(page, '[data-a="settings"]').click();
  await expect(app(page, '#settingsBody')).toBeVisible();
};

test.describe('App parity (design/app-ui.json vs the running demo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#app').scrollIntoViewIfNeeded();
  });

  test('the manifest still contains everything the demo treats as a known gap', () => {
    // If the app drops a row the demo was excused for, the excuse has to be revisited rather than
    // silently kept.
    const present = new Set(manifest.settings.flatMap((s) => s.rows.map((r) => r.label)));
    const stale = [...KNOWN_GAPS].filter((g) => !present.has(g));
    expect(stale, 'KNOWN_GAPS entries the app no longer has — remove them or implement them').toEqual([]);
  });

  test('settings: every implemented row matches the app, in the app\'s order', async ({ page }) => {
    await openSettings(page);
    const rendered = await page
      .locator('#app #settingsBody .set-row')
      .evaluateAll((rows) => rows.map((r) => r.querySelector('.set-label')?.textContent?.trim() ?? ''));
    const labels = new Set(manifest.settings.flatMap((s) => s.rows.map((r) => r.label)));

    for (const row of rendered) {
      expect(labels.has(row), `"${row}" is in the demo but not in the app's settings screen`).toBe(true);
      expect(KNOWN_GAPS.has(row), `"${row}" is a new row the demo implements but KNOWN_GAPS forgots about`).toBe(false);
    }
  });

  test('settings: no app row has been implemented out of order', async ({ page }) => {
    await openSettings(page);
    const appOrder = manifest.settings
      .flatMap((s) => s.rows)
      .map((r) => r.label)
      .filter((l) => !KNOWN_GAPS.has(l));

    // The demo shows its rows under section headers, so compare within the sections it does render
    // rather than across gaps it skips.
    const rendered = await page
      .locator('#app #settingsBody .set-group')
      .evaluateAll((groups) =>
        groups.map((g) => [...g.querySelectorAll('.set-row .set-label')].map((l) => l.textContent.trim()))
      );
    const demoOrder = rendered.flat();

    expect(demoOrder, 'the demo implements a different set of rows than expected').toEqual(appOrder);
  });

  test('settings: section headers match the app, uppercased as the app renders them', async ({ page }) => {
    await openSettings(page);
    const headers = await page.locator('#app #settingsBody h2').allInnerTexts();
    const appHeaders = manifest.settings.map((s) => s.header.toUpperCase());

    for (const h of headers) {
      expect(appHeaders, `"${h}" is a section the app does not have`).toContain(h);
    }
    expect(headers).toEqual(appHeaders.filter((h) => headers.includes(h)));
  });

  test('library sheet: the Preferences group and its rows match the app', async ({ page }) => {
    await app(page, '#moreBtn').click();
    const sheet = page.locator('#app #sheetLib');
    await expect(sheet).toHaveClass(/open/);

    const headers = await sheet.locator('.group-title').allInnerTexts();
    const rows = await sheet.locator('.lib-row > span').evaluateAll((els) =>
      els.map((e) => ({ label: e.childNodes[0]?.textContent?.trim(), subtitle: e.querySelector('small')?.textContent ?? null }))
    );

    const lib = manifest.librarySheet[0];
    expect(headers.map((h) => h.toUpperCase())).toContain(lib.header.toUpperCase());
    for (const row of lib.rows) {
      expect(rows.map((r) => r.label), `library row "${row.label}" missing or renamed`).toContain(row.label);
      if (row.subtitle) {
        const got = rows.find((r) => r.label === row.label);
        expect(got.subtitle, `subtitle for "${row.label}" changed`).toBe(row.subtitle);
      }
    }
  });

  test('study actions sheet: rows match the app, in order', async ({ page }) => {
    // Opened from the Black drawer's Sicilian row, so Create names the other drawer.
    await app(page, '#sqB').click();
    await app(page, '[data-a="sacts"][data-i="1"]').click();
    const labels = await page
      .locator('#app #sheetScope .lib-row > span')
      .evaluateAll((els) => els.map((e) => e.childNodes[0]?.textContent?.trim()));

    const expected = manifest.studyActionsSheet.rows.map((r) =>
      r.label.replace('{other}', manifest.scopeDrawer.sideLabels.white)
    );
    // Pause/Resume is one row whose label depends on the study's state; this study starts active,
    // so the manifest's `Pause` is what the demo must show.
    expect(labels).toEqual(expected);

    // Subtitles ride along on every row but Rename/Delete, which carry none.
    const subs = await page
      .locator('#app #sheetScope .lib-row > span')
      .evaluateAll((els) => els.map((e) => e.querySelector('small')?.textContent ?? null));
    const expectedSubs = manifest.studyActionsSheet.rows.map((r) => r.subtitle);
    expect(subs).toEqual(expectedSubs);
  });

  test("the nothing-due screen uses the app's copy", async ({ page }) => {
    // Suspending the active study is the app's own route to this screen, and it is the case that
    // used to be wrong: an earlier version rendered a `Paused` headline with its own Resume button,
    // a state the app cannot produce. `Nothing due.` is all it shows.
    await app(page, '#sqW').click();
    await app(page, '[data-a="sacts"][data-i="0"]').click();
    await app(page, '[data-a="pause"]').click();

    const idle = app(page, '.idle');
    await expect(idle.locator('h1')).toHaveText(manifest.idle.nothingDue);
    await expect(idle.locator('h1')).not.toHaveText(/paused/i);
    await expect(idle.locator('.next')).toContainText(manifest.idle.nextReviewPrefix.trim());
    await expect(idle.locator('.pill')).toHaveText(manifest.idle.practice);
    await expect(idle.locator('.link')).toHaveText(manifest.idle.chooseRepertoire);
    await expect(idle.locator('.foot')).toHaveText(manifest.idle.practiceFootnote);
  });

  test('with no studies at all the demo uses the app first-run copy', async ({ page }) => {
    // The app answers this on a separate first-run screen the demo does not port. It borrows that
    // screen's words and keeps the import affordance, and this pins both. Each colour's drawer
    // holds only its own studies, so delete from each in turn (the survivor always sits at index 0).
    for (const sq of ['#sqW', '#sqB']) {
      await app(page, sq).click();
      await app(page, '[data-a="sacts"][data-i="0"]').click();
      await app(page, '[data-a="delete"]').click();
      await app(page, '[data-a="dodelete"]').click();
    }
    const idle = app(page, '.idle');
    await expect(idle.locator('h1')).toHaveText(manifest.idle.noStudies.headline);
    await expect(idle.locator('.next')).toHaveText(manifest.idle.noStudies.subtext);
    await expect(idle.locator('[data-a="import"]')).toBeVisible();
  });

  test('scope drawer: one drawer per colour, groups and paused sub-label match the app', async ({ page }) => {
    // The top bar is two colour squares, not a scope button: each carries its side's label and the
    // live side is pressed.
    for (const [id, key] of [['#sqW', 'white'], ['#sqB', 'black']]) {
      await expect(app(page, id)).toHaveAttribute('aria-label', manifest.scopeDrawer.sideLabels[key]);
    }
    await expect(app(page, '#sqW')).toHaveAttribute('aria-pressed', 'true');
    await expect(app(page, '#sqB')).toHaveAttribute('aria-pressed', 'false');

    // The White drawer lists only White studies. The demo ports no openings, so the Openings group
    // stays hidden the way the app hides an empty group — every other manifest group must be there.
    await app(page, '#sqW').click();
    await expect(page.locator('#app #scopeSearch')).toHaveAttribute('placeholder', manifest.scopeDrawer.searchHint);
    const groups = await page.locator('#app #scopeList .group-title').allInnerTexts();
    for (const g of manifest.scopeDrawer.groups.filter((name) => name !== 'Openings')) {
      expect(groups).toContain(g);
    }
    expect(groups).not.toContain('Openings');
    const names = await page.locator('#app #scopeList .row .row-name').allInnerTexts();
    expect(names).toEqual(['Queen Pawn Repertoire']);

    // And the Black drawer lists only Black studies. One drawer at a time: the open drawer is
    // modal, so the White one has to go away first — exactly as a visitor must dismiss it.
    await page.keyboard.press('Escape');
    await app(page, '#sqB').click();
    const black = await page.locator('#app #scopeList .row .row-name').allInnerTexts();
    expect(black).toEqual(['Sicilian Defense Repertoire']);

    await app(page, '[data-a="sacts"][data-i="1"]').click();
    await app(page, '[data-a="pause"]').click();
    await app(page, '#sqB').click();

    const paused = page.locator('#app #scopeList .row.paused').first();
    await expect(paused).toHaveClass(/paused/);
    // The app replaces the position count with `Paused` on a suspended study.
    await expect(paused.locator('.row-sub')).toContainText(manifest.scopeDrawer.pausedSub);
  });

  test('scope search filters studies and uses the app empty state', async ({ page }) => {
    await app(page, '#sqW').click();
    await page.locator('#app #scopeSearch').fill('queen');
    await expect(page.locator('#app #scopeList .row .row-name')).toHaveText(['Queen Pawn Repertoire']);

    const missing = 'zzz-no-such-study';
    await page.locator('#app #scopeSearch').fill(missing);
    await expect(page.locator('#app .no-results')).toHaveText(
      manifest.scopeDrawer.noResults.replace('{query}', missing)
    );
  });

  test('Create copies a study into the other drawer without moving the session', async ({ page }) => {
    // From the Black drawer's Sicilian row: the copy lands in White's drawer under the same name,
    // freshly scheduled, while the session stays Black.
    await app(page, '#sqB').click();
    await expect(app(page, '#sqB')).toHaveAttribute('aria-pressed', 'true');
    await app(page, '[data-a="sacts"][data-i="1"]').click();
    await app(page, '[data-a="create"]').click();
    await expect(app(page, '#sqB')).toHaveAttribute('aria-pressed', 'true');

    await app(page, '#sqW').click();
    const names = await page.locator('#app #scopeList .row .row-name').allInnerTexts();
    expect(names).toEqual(['Queen Pawn Repertoire', 'Sicilian Defense Repertoire']);

    // Re-running is a no-op, not a second copy.
    await page.keyboard.press('Escape');
    await app(page, '#sqB').click();
    await app(page, '[data-a="sacts"][data-i="1"]').click();
    await app(page, '[data-a="create"]').click();
    await app(page, '#sqW').click();
    const again = await page.locator('#app #scopeList .row .row-name').allInnerTexts();
    expect(again).toEqual(['Queen Pawn Repertoire', 'Sicilian Defense Repertoire']);
  });
});
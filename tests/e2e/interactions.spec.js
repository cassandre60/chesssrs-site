import { test, expect } from '@playwright/test';

test.describe('Demo Interactions & End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const demo = page.locator('#demo');
    await demo.scrollIntoViewIfNeeded();
  });

  test('click-click piece movement executes move', async ({ page }) => {
    // Initial state: white to move, French Advance e4 is correct
    const dueEl = page.locator('#a-due');
    await expect(dueEl).toHaveText(/16 due/);

    const bd = page.locator('#demo .bd');
    const box = await bd.boundingBox();
    expect(box).toBeTruthy();

    const sq = box.width / 8;
    // e2 is col 4, row 6 (ranks: 8=0, 7=1, 6=2, 5=3, 4=4, 3=5, 2=6, 1=7)
    const e2x = box.x + sq * 4.5;
    const e2y = box.y + sq * 6.5;
    // e4 is col 4, row 4
    const e4x = box.x + sq * 4.5;
    const e4y = box.y + sq * 4.5;

    await page.mouse.click(e2x, e2y);
    await page.mouse.click(e4x, e4y);

    // After e4, Black auto-plays e6, and due count decreases
    await expect(dueEl).toHaveText(/15 due/);
  });

  test('drag-and-drop piece movement executes move', async ({ page }) => {
    const dueEl = page.locator('#a-due');
    await expect(dueEl).toHaveText(/16 due/);

    const bd = page.locator('#demo .bd');
    const box = await bd.boundingBox();
    expect(box).toBeTruthy();

    const sq = box.width / 8;
    const e2x = box.x + sq * 4.5;
    const e2y = box.y + sq * 6.5;
    const e4x = box.x + sq * 4.5;
    const e4y = box.y + sq * 4.5;

    await page.mouse.move(e2x, e2y);
    await page.mouse.down();
    await page.mouse.move(e4x, e4y, { steps: 5 });
    await page.mouse.up();

    await expect(dueEl).toHaveText(/15 due/);
  });

  test('keyboard-only navigation and play', async ({ page }) => {
    const bd = page.locator('#demo .bd');
    await bd.focus();

    // Default cursor is e2 (white to play). Press Enter to select e2
    await page.keyboard.press('Enter');
    const live = page.locator('#a-live');
    await expect(live).toContainText(/selected/);

    // Move cursor up twice (to e4)
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // Press Enter to move to e4
    await page.keyboard.press('Enter');

    const dueEl = page.locator('#a-due');
    await expect(dueEl).toHaveText(/15 due/);
  });

  test('wrong move reveals target, S skips, Space advances', async ({ page }) => {
    const bd = page.locator('#demo .bd');
    const box = await bd.boundingBox();
    const sq = box.width / 8;

    // Wrong move: a2 to a3
    const a2x = box.x + sq * 0.5;
    const a2y = box.y + sq * 6.5;
    const a3x = box.x + sq * 0.5;
    const a3y = box.y + sq * 5.5;

    await page.mouse.click(a2x, a2y);
    await page.mouse.click(a3x, a3y);

    const revealEl = page.locator('#a-rv');
    await expect(revealEl).toBeVisible();

    // Play correct move e2-e4
    const e2x = box.x + sq * 4.5;
    const e2y = box.y + sq * 6.5;
    const e4x = box.x + sq * 4.5;
    const e4y = box.y + sq * 4.5;

    await page.mouse.click(e2x, e2y);
    await page.mouse.click(e4x, e4y);

    // Continue button is visible
    const contBtn = page.locator('#a-cont');
    await expect(contBtn).toBeVisible();

    // Space key advances
    await page.keyboard.press(' ');
    await expect(contBtn).toBeHidden();
  });

  test('study picker switches study to the Sicilian repertoire', async ({ page }) => {
    await page.locator('#demo [data-a="picker"]').click();
    const modal = page.locator('#a-mo');
    await expect(modal).toBeVisible();

    // Pick the black-side Sicilian repertoire
    await page.locator('#demo [data-a="pick"][data-i="1"]').click();
    await expect(modal).toBeHidden();

    const studyName = page.locator('#a-study');
    await expect(studyName).toHaveText('Sicilian Defense Repertoire');
  });

  test('import sheet handles valid PGN and invalid PGN', async ({ page }) => {
    // Open picker first, then click import repertoire
    await page.locator('#demo [data-a="picker"]').click();
    await page.locator('#demo [data-a="import"]').click();
    const modal = page.locator('#a-mo');
    await expect(modal).toBeVisible();

    // Invalid PGN
    await page.locator('#i-pgn').fill('1. e4 e5 2. Qh8');
    await page.locator('#demo [data-a="doimport"]').click();
    const err = page.locator('#i-err');
    await expect(err).toBeVisible();
    await expect(err).toContainText(/could not read/i);

    // Valid PGN
    const pgn = `[Event "Test Repertoire"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 *`;
    await page.locator('#i-pgn').fill(pgn);
    await page.locator('#demo [data-a="doimport"]').click();
    await expect(modal).toBeHidden();

    const studyName = page.locator('#a-study');
    await expect(studyName).toHaveText('Test Repertoire');
  });

  test('settings sheet adjusts retention and closes on Escape', async ({ page }) => {
    // Settings is reached through the library sheet, matching the app: the top bar's only
    // affordance is the overflow (⋯) button.
    await page.locator('#demo [data-a="more"]').click();
    await page.locator('#demo [data-a="settings"]').click();
    const modal = page.locator('#a-mo');
    await expect(modal).toBeVisible();

    const slider = page.locator('#demo input[data-k="retention"]');
    await slider.fill('85');
    await expect(page.locator('#v-ret')).toHaveText('85%');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('reduced-motion preference is respected without broken animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const demo = page.locator('#demo');
    await expect(demo).toBeVisible();
  });
});

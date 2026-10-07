import { test, expect } from '@playwright/test';

/* The marketing page and the demo share one stylesheet chain:
     assets/demo-reference.css + assets/demo-tokens.css  (generated from the app repo, loaded first)
     styles.css                                          (hand-written marketing, loaded last)
   Both sides use short class names, so a marketing rule for `.meta` silently restyled the app's
   meta row: the review screen's meta line came out in the page's muted brown, measured against the
   app's surface. That reads as a design choice rather than a bug, so it is pinned here.

   sync-design.js re-anchors the app's tokens from `:root` onto `.app` precisely so the two
   palettes cannot bleed; these assert that separation actually holds at runtime. */
const app = (page, sel) => page.locator(`#app ${sel}`);

test.describe('Style namespace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#app').scrollIntoViewIfNeeded();
  });

  test("the demo's meta row uses the app's tokens, not the page's", async ({ page }) => {
    // `--ink2` in the app's dark theme. The marketing page's equivalent is `--mu` (#5F584D).
    await expect(app(page, '.meta').first()).toHaveCSS('color', 'rgb(155, 162, 174)');
    await expect(app(page, '.meta').first()).toHaveCSS('margin-bottom', '0px');
  });

  test('no element in the demo is painted with the marketing palette', async ({ page }) => {
    // The marketing page's --mu and --ac. The app has its own --ink2 and --accent, and the two
    // must never meet inside #app.
    const BANNED = ['rgb(95, 88, 77)', 'rgb(154, 95, 11)'];

    // Walk every screen the demo renders, so a collision on a screen the landing view never
    // reaches (settings, the sheets) still fails.
    const screens = [
      async () => {},
      async (p) => p.locator('#app #sqW').click(),
      async (p) => {
        await p.locator('#app #sqB').click();
        await p.locator('#app [data-a="sacts"][data-i="1"]').click();
      },
      async (p) => {
        await p.locator('#app #sqB').click();
        await p.locator('#app [data-a="sacts"][data-i="1"]').click();
        await p.locator('#app [data-a="export"]').click();
      },
      async (p) => {
        // Back to review first: the top bar is hidden while a secondary screen is up.
        await p.locator('#app #backBtn').click();
        await p.locator('#app #moreBtn').click();
        await p.locator('#app [data-a="settings"]').click();
      },
    ];

    for (const [i, open] of screens.entries()) {
      if (i) await page.keyboard.press('Escape'); // leave any sheet the previous screen opened
      await open(page);
      await page.waitForTimeout(350); // let the sheet finish animating before reading styles
      const leaks = await page.evaluate((banned) => {
        const bad = [];
        for (const el of document.querySelectorAll('#app, #app *')) {
          for (const prop of ['color', 'background-color', 'border-top-color']) {
            const v = getComputedStyle(el).getPropertyValue(prop);
            if (banned.includes(v)) bad.push(`${el.className || el.tagName} ${prop}=${v}`);
          }
        }
        return [...new Set(bad)].slice(0, 8);
      }, BANNED);
      expect(leaks, `marketing colours inside the demo on screen ${i}`).toEqual([]);
    }
  });

  test('the demo root carries its own theme tokens', async ({ page }) => {
    // A theme attribute on <html> would never match `.app[data-theme=…]`, leaving the demo
    // permanently light no matter what the app's own settings said.
    await expect(page.locator('#app')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(13, 15, 19)');
  });

  test('switching the demo theme repaints the demo, not the page', async ({ page }) => {
    const pageBg = () => page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);

    const before = await pageBg();
    await app(page, '#moreBtn').click();
    await app(page, '[data-a="settings"]').click();
    await app(page, '[data-a="theme"][data-v="false"]').click();

    await expect(page.locator('#app')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(241, 243, 244)');
    // The demo's own theme control must not drag the marketing page with it.
    expect(await pageBg()).toBe(before);
  });
});
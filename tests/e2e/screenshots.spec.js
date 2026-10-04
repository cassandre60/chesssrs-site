import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { width: 375, height: 812, name: '375' },
  { width: 768, height: 1024, name: '768' },
  { width: 1280, height: 800, name: '1280' },
  { width: 1920, height: 1080, name: '1920' },
];

const THEMES = ['dark', 'light'];

test.describe('Responsive & State Screenshots', () => {
  test.beforeAll(async () => {
    const dir = path.resolve('tests/screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`capture page full ${vp.name}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto('/');
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);
        await page.waitForTimeout(300);

        await page.screenshot({
          path: `tests/screenshots/page-${vp.name}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }

  for (const theme of THEMES) {
    test(`capture demo states ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(300);

      const demo = page.locator('#demo');
      await demo.scrollIntoViewIfNeeded();

      // 1. Initial state
      await demo.screenshot({ path: `tests/screenshots/demo-initial-${theme}.png` });

      // 2. Mistake / reveal state: click wrong square or trigger move
      // Playing a2a3 is wrong for white vs french
      // Click a2, then click a3
      const bd = page.locator('#demo #bd');
      const box = await bd.boundingBox();
      if (box) {
        const sq = box.width / 8;
        // a2 is col 0, row 6 (0-indexed from top: row 0 is 8, row 6 is 2)
        const a2x = box.x + sq * 0.5;
        const a2y = box.y + sq * 6.5;
        // a3 is col 0, row 5
        const a3x = box.x + sq * 0.5;
        const a3y = box.y + sq * 5.5;

        await page.mouse.click(a2x, a2y);
        await page.mouse.click(a3x, a3y);
        await page.waitForTimeout(300);
        await demo.screenshot({ path: `tests/screenshots/demo-reveal-${theme}.png` });
      }

      // 3. Sheets: settings
      const settingsBtn = page.locator('#demo [data-a="settings"]');
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(200);
        await demo.screenshot({ path: `tests/screenshots/demo-sheet-settings-${theme}.png` });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // 4. Sheets: study picker
      const pickerBtn = page.locator('#demo [data-a="picker"]');
      if (await pickerBtn.isVisible()) {
        await pickerBtn.click();
        await page.waitForTimeout(200);
        await demo.screenshot({ path: `tests/screenshots/demo-sheet-picker-${theme}.png` });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // 5. Sheets: more menu
      const moreBtn = page.locator('#demo [data-a="more"]');
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(200);
        await demo.screenshot({ path: `tests/screenshots/demo-sheet-more-${theme}.png` });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // 6. Sheets: import
      const pickerForImport = page.locator('#demo [data-a="picker"]');
      if (await pickerForImport.isVisible()) {
        await pickerForImport.click();
        await page.waitForTimeout(200);
        const importBtn = page.locator('#demo [data-a="import"]');
        if (await importBtn.isVisible()) {
          await importBtn.click();
          await page.waitForTimeout(200);
          await demo.screenshot({ path: `tests/screenshots/demo-sheet-import-${theme}.png` });
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      }
    });
  }
});

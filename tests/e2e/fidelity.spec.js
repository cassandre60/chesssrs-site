import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/* Side-by-side reference captures for review against the app's own screenshots.

   The demo's theme is its own setting, applied as data-theme on #app — sync-design.js re-anchors
   the app's tokens from `:root` onto `.app`, so setting data-theme on <html> (as this spec used to)
   changed the marketing page and left the demo dark. Switching the demo means using the demo's own
   control, so these captures exercise the same path a visitor would. */
const app = (page, sel) => page.locator(`#app ${sel}`);

const setDemoTheme = async (page, dark) => {
  await app(page, '#moreBtn').scrollIntoViewIfNeeded();
  await app(page, '#moreBtn').click();
  await app(page, '[data-a="settings"]').click();
  await app(page, `[data-a="theme"][data-v="${dark}"]`).click();
  await expect(page.locator('#app')).toHaveAttribute('data-theme', dark ? 'dark' : 'light');
  await app(page, '#backBtn').click();
};

const setDevice = (page, device) =>
  page.evaluate((d) => document.querySelector('#demo .frame').setAttribute('data-device', d), device);

test.describe('Side-by-side Fidelity Verification Screenshots', () => {
  const fidelityDir = path.resolve('docs/fidelity');

  test.beforeAll(() => {
    if (!fs.existsSync(fidelityDir)) fs.mkdirSync(fidelityDir, { recursive: true });
  });

  for (const [device, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['phone', { width: 900, height: 1000 }],
  ]) {
    for (const theme of ['dark', 'light']) {
      test(`capture ${device} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.locator('#demo').scrollIntoViewIfNeeded();
        await setDevice(page, device);
        await setDemoTheme(page, theme === 'dark');
        await page.waitForTimeout(300);

        await page.locator('#demo').screenshot({ path: path.join(fidelityDir, `demo-${device}-${theme}.png`) });
      });
    }
  }

  test('every capture is a non-blank image', async ({ page }) => {
    // A thrown demo renders an empty frame that looks like a design choice in a screenshot diff.
    // Guard it: the board must have all 32 pieces and the due count must be populated.
    await page.goto('/');
    await page.locator('#demo').scrollIntoViewIfNeeded();
    await expect(app(page, '#bd .pc-wrap')).toHaveCount(32);
    await expect(app(page, '#due')).toContainText('due');
    for (const f of fs.readdirSync(fidelityDir).filter((f) => f.endsWith('.png'))) {
      expect(fs.statSync(path.join(fidelityDir, f)).size, `${f} is suspiciously small`).toBeGreaterThan(5000);
    }
  });
});
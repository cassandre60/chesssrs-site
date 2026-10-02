import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Side-by-side Fidelity Verification Screenshots', () => {
  const fidelityDir = path.resolve('docs/fidelity');

  test.beforeAll(() => {
    if (!fs.existsSync(fidelityDir)) {
      fs.mkdirSync(fidelityDir, { recursive: true });
    }
  });

  test('capture wide and narrow demo states in dark and light', async ({ page }) => {
    // 1. Wide Desktop Dark
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(300);

    const demo = page.locator('#demo');
    await demo.scrollIntoViewIfNeeded();
    await demo.screenshot({ path: path.join(fidelityDir, 'demo-desktop-dark.png') });

    // 2. Wide Desktop Light
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const demoLightBtn = page.locator('#demo button[data-a="settings"]');
    await page.waitForTimeout(300);
    await demo.screenshot({ path: path.join(fidelityDir, 'demo-desktop-light.png') });

    // 3. Narrow Phone Dark
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(300);
    await demo.scrollIntoViewIfNeeded();
    await demo.screenshot({ path: path.join(fidelityDir, 'demo-phone-dark.png') });

    // 4. Narrow Phone Light
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(300);
    await demo.screenshot({ path: path.join(fidelityDir, 'demo-phone-light.png') });
  });
});

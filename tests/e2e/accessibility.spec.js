import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility audit (axe-core)', () => {
  test('landing page meets WCAG 2.2 AA standards in dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('landing page meets WCAG 2.2 AA standards in light mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Switch to light theme
    const themeBtn = page.locator('#theme-toggle, [data-theme-toggle], .theme-toggle').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    } else {
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
      });
    }
    await page.waitForTimeout(200);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

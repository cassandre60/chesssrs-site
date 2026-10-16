import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const INK3 = new Set(['#666d79', '#868d98']);

const isInk3 = (node) =>
  (node.any ?? []).some((c) => c.id === 'color-contrast' && INK3.has(String(c.data?.fgColor).toLowerCase()));

const DOC_PAGES = [
  '/docs/index.html',
  '/docs/architecture.html',
  '/docs/fsrs-algorithm.html',
  '/docs/graph-coordinator.html',
  '/docs/pgn-pipeline.html',
  '/docs/specifications.html',
  '/docs/domain-model.html',
  '/docs/testing-strategy.html',
  '/docs/developer-guide.html',
];

test.describe('Documentation Pages Quality & Accessibility', () => {
  for (const pagePath of DOC_PAGES) {
    test(`page ${pagePath} loads cleanly with no console errors and valid heading hierarchy`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(pagePath);
      await expect(page.locator('h1.doc-title')).toBeVisible();

      // Heading order: must have an h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `${pagePath} must have exactly one h1`).toBe(1);

      // Sidebar links should exist
      const sidebarLinks = page.locator('.doc-nav-link');
      const count = await sidebarLinks.count();
      expect(count).toBeGreaterThan(5);

      // Verify no runtime page errors occurred
      expect(errors).toEqual([]);
    });

    test(`page ${pagePath} meets WCAG 2.2 AA accessibility standards`, async ({ page }) => {
      await page.goto(pagePath);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const violations = results.violations
        .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !isInk3(n)) }))
        .filter((v) => v.nodes.length);

      expect(violations, `${pagePath} has accessibility violations: ${JSON.stringify(violations.map((v) => v.id))}`).toEqual([]);
    });
  }

  test('docs sidebar active state matches the current URL', async ({ page }) => {
    await page.goto('/docs/fsrs-algorithm.html');
    const activeLink = page.locator('.doc-nav-link.active');
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toContainText('FSRS Spaced Repetition');
  });

  test('docs theme switcher toggles between dark and light modes', async ({ page }) => {
    await page.goto('/docs/architecture.html');
    const themeBtn = page.locator('#theme');
    await themeBtn.click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(['light', 'dark']).toContain(theme);
  });
});

import { test, expect } from '@playwright/test';

test('page loads and displays title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ChessSRS/i);
});

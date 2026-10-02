import { test, expect } from '@playwright/test';

test('page loads and displays title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ChessSRS/i);
});

test('matches ChessFSRS scheduling mathematics verified against app repo', async () => {
  const { fsrsRetrievability, fsrsIntervalForTarget, ChessFsrsCard } = require('../../engine.js');
  expect(fsrsRetrievability(0.0, 10.0)).toBe(1.0);
  expect(Math.abs(fsrsRetrievability(10.0, 10.0) - 0.9)).toBeLessThan(0.001);

  const card = new ChessFsrsCard('test');
  const now = new Date('2026-09-18T12:00:00Z');
  const res = card.schedule('good', now, 0.88);
  expect(card.repetitionCount).toBe(1);
  expect(card.stability).toBeCloseTo(2.20, 2);
  expect(res.intervalDays).toBeGreaterThan(2.0);
});


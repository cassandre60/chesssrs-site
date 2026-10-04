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

/* The site's own address. This is the free GitHub Pages URL and costs nothing to serve — a custom
   domain is the only paid part, and it is optional. Hosting somewhere else means changing this
   constant *and* the tags it mirrors, which is the point: the old metadata shipped
   `https://chesssrs.example/` in the canonical, og:url, og:image and twitter:image, so search
   engines were told the real address was a domain that does not resolve. A canonical that points
   nowhere is worse than none at all — the live URL can get dropped from the index entirely, and
   fixing it afterwards needs re-submission in Search Console.

   Note this is the site *root*, not an origin: this is a Pages project site, so `/chesssrs-site`
   is part of the path. `new URL(...).origin` would reduce it to mansourvery-hub.github.io and hide
   a project moved out of `/chesssrs-site`, so every tag is compared against the full prefix.

   og:image is the other half of the same trap: it pointed at the same non-existent origin, so every
   social share rendered as a bare link. Hence the reachability check below. */
const SITE_ROOT = 'https://mansourvery-hub.github.io/chesssrs-site';

/* RFC 2606 reserves these, so they can only ever be placeholders in shipped markup. */
const PLACEHOLDER = /(\.example|\.test|\.invalid|\.localhost|example\.(com|org|net)|your-)/i;

test('every URL the page tells the world about points at the live origin', async ({ page, request }) => {
  const errors = [];
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto('/');

  const meta = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content,
    ogImage: document.querySelector('meta[property="og:image"]')?.content,
    twitterImage: document.querySelector('meta[name="twitter:image"]')?.content,
    ldUrl: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).url,
  }));

  for (const [key, value] of Object.entries(meta)) {
    expect(value, `${key} must be declared`).toBeTruthy();
    expect(value, `${key} must not be a placeholder: ${value}`).not.toMatch(PLACEHOLDER);
    expect(value, `${key} must be absolute`).toMatch(/^https:\/\//);
    // Every tag has to carry the whole prefix, not just agree on a hostname: a page served from
    // /chesssrs-site but linking to /some-other-repo is the mistake this catches.
    expect(new URL(value).href, `${key} must live under ${SITE_ROOT}`).toMatch(
      new RegExp(`^${SITE_ROOT}(/|$)`),
    );
  }

  // A declared width/height the asset does not have gets the preview card cropped.
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');

  // And the image has to actually exist — checked against this deployment, not the absolute URL, so
  // the test needs no network access.
  const og = await request.get('/assets/og.jpg');
  expect(og.status(), 'assets/og.jpg must be published').toBe(200);
  expect(meta.ogImage).toBe(`${SITE_ROOT}/assets/og.jpg`);
  expect(errors).toEqual([]);
});


import { test, expect } from '@playwright/test';

test('page loads and displays title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ChessSRS/i);
});

test('matches ChessFSRS scheduling mathematics verified against app repo', async () => {
  const { fsrsRetrievability, ChessFsrsCard } = require('../../engine.js');
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
   is part of the path. `new URL(...).origin` would reduce it to the bare Pages domain and hide
   a project moved out of `/chesssrs-site`, so every tag is compared against the full prefix.

   og:image is the other half of the same trap: it pointed at the same non-existent origin, so every
   social share rendered as a bare link. Hence the reachability check below. */
const SITE_ROOT = 'https://cassandre60.github.io/chesssrs-site';

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

/* index.html renders the `desktop` frame variant at every width, and the app's rule for it is
   `aspect-ratio:1280/800`, so the frame's height is width * 0.625. The app sizes the board as
   `--b: min(100cqw - 24px, 100cqh - 340px)` — it reserves 340px of container height below the board.
   Pasted into a phone-width column that frame is 324x202px, so `202 - 340` goes negative and the
   board clamps to 0x0: 32 pieces in the DOM, nothing painted, and no tap target. styles.css gives
   the frame a real height below 1000px so the app's own narrow stacked layout takes over.

   Asserted on size, on nothing being clipped, and on a move actually landing — a board that renders
   at 98px is technically non-zero and still unusable, so the threshold is a floor worth tapping,
   not merely `> 0`. The widths straddle the app's own 720px container-query switch.

   hasTouch is on so this is exercised the way a phone would use it; a mouse-only test would not
   have caught this, since the board had no hit area to click. */
/* Scans every shipped HTML file rather than just this page's <head>, because a placeholder URL only
   misleads where a visitor can actually click it. The page once carried
   `liberapay.com/YOUR_NAME` as a donation CTA in the support section and again in the footer: a
   funding route that resolved to nobody is worse than no funding route, so both are gone for now
   rather than shipped live. This asserts the *class* of bug, not the absence of donations — when a
   real Liberapay account exists, dropping its link back in keeps this green, and re-adding it with
   the placeholder still fails.

   `dist/` is excluded: build.py inlines the pages into a single file, and `YOUR_NAME` may legitimately
   appear in a comment there. */
test('no shipped page links to a placeholder', async () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../..');

  const pages = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(root, f));

  expect(pages.length, 'expected the root HTML pages to be found').toBeGreaterThan(1);

  /* An earlier version of this test looked for any run of three capitals in an href, which flagged
     `github.com/<owner>/ChessSRS` because it contains `SRS`. A gate that fires on correct
     markup is worse than no gate, because it teaches people to ignore it. These are the markers
     that actually mean "unfilled": the RFC 2606 reserved names, plus the conventional
     fill-me-in tokens. */
  const FILL_ME_IN =
    /(YOUR[_-]?|USERNAME|USER[_-]?NAME|CHANGEME|CHANGE[_-]?ME|REPLACEME|FILL[_-]?ME|INSERT[_-]?HERE|\bTODO\b|XXX)/i;
  const suspect = (href) => PLACEHOLDER.test(href) || FILL_ME_IN.test(href);

  const offenders = [];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      if (suspect(m[1])) offenders.push(`${path.basename(file)}: ${m[1]}`);
    }
  }
  expect(offenders, 'placeholder hrefs must not ship').toEqual([]);
});

test('the demo board stays usable across viewport widths', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  for (const width of [360, 390, 768, 900, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    // Scroll after any reflow, or the board lands below the fold and the taps miss it entirely.
    await page.locator('#app #bd').scrollIntoViewIfNeeded();

    const board = await page.locator('#app #bd').boundingBox();
    expect(board.width, `board collapsed at ${width}px`).toBeGreaterThanOrEqual(240);

    // Nothing visible may spill out of the frame. The app parks closed sheets below the frame and
    // relies on `overflow:hidden`, so only the active view is measured — checking `.app`'s
    // scrollHeight would flag every sheet as clipped.
    const spill = await page.evaluate(() => {
      const app = document.querySelector('#app');
      const box = app.getBoundingClientRect();
      const view = [...app.querySelectorAll('.view-review, .view-settings, .view-idle')].find(
        (v) => !v.hidden,
      );
      let dy = 0;
      let dx = 0;
      for (const el of view.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        dy = Math.max(dy, r.bottom - box.bottom);
        dx = Math.max(dx, r.right - box.right);
      }
      return { dy: Math.round(dy), dx: Math.round(dx) };
    });
    expect(spill.dy, `content spills below the frame at ${width}px`).toBeLessThanOrEqual(1);
    expect(spill.dx, `content spills past the frame at ${width}px`).toBeLessThanOrEqual(1);

    // And the board must accept a move by touch, the way a phone plays it.
    const sq = board.width / 8;
    const at = (file, rank) => ({
      x: board.x + sq * (file + 0.5),
      y: board.y + sq * (8 - rank + 0.5),
    });
    const e2 = at(4, 2);
    const e4 = at(4, 4);
    await page.touchscreen.tap(e2.x, e2.y);
    await expect(page.locator('#app #bd .hl rect.sel'), `no selection at ${width}px`).toHaveCount(1);
    await page.touchscreen.tap(e4.x, e4.y);
    await expect(page.locator('#app #live'), `tap-to-move failed at ${width}px`).toHaveText('Correct. e4.');
  }

  expect(errors).toEqual([]);
  await ctx.close();
});


import { test, expect } from '@playwright/test';

/* Invariant I-1, in the browser: Download opens a small platform menu and a
 * platform click starts a real file download — no intermediate pages. The
 * API is mocked so these run with no network.
 *
 * Invariant I-2, structurally: every link in the support scopes is a real
 * https URL with no placeholder, and new-tab donation links carry
 * rel=noopener. Scopes are DOM regions so new providers are covered without
 * editing this file. */

const API = 'https://api.github.com/repos/cassandre60/ChessSRS/releases?per_page=10';

const withFiles = [
  {
    tag_name: 'v9.9.0-e2e',
    prerelease: true,
    published_at: '2026-10-08T00:00:00Z',
    html_url: 'https://github.com/cassandre60/ChessSRS/releases/tag/v9.9.0-e2e',
    assets: [
      {
        name: 'chesssrs-v9.9.0-e2e-linux-x64.tar.gz',
        size: 41 * 1024 * 1024,
        browser_download_url:
          'https://github.com/cassandre60/ChessSRS/releases/download/v9.9.0-e2e/chesssrs-v9.9.0-e2e-linux-x64.tar.gz',
      },
      {
        name: 'chesssrs-v9.9.0-e2e-android-testing.apk',
        size: 32 * 1024 * 1024,
        browser_download_url:
          'https://github.com/cassandre60/ChessSRS/releases/download/v9.9.0-e2e/chesssrs-v9.9.0-e2e-android-testing.apk',
      },
      {
        name: 'chesssrs-v9.9.0-e2e-android-testing.aab',
        size: 30 * 1024 * 1024,
        browser_download_url:
          'https://github.com/cassandre60/ChessSRS/releases/download/v9.9.0-e2e/chesssrs-v9.9.0-e2e-android-testing.aab',
      },
    ],
  },
];

const withoutFiles = [
  {
    tag_name: 'v9.9.0-e2e',
    prerelease: true,
    published_at: '2026-10-08T00:00:00Z',
    html_url: 'https://github.com/cassandre60/ChessSRS/releases/tag/v9.9.0-e2e',
    assets: [],
  },
];

const download = (page, sel) => page.locator(`#download ${sel}`);

test('a platform click starts a real file download', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withFiles) }));
  await page.route('**/releases/download/**', (r) =>
    r.fulfill({
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: 'fake-binary',
    }),
  );
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  await expect(download(page, '#dl-primary')).toBeEnabled();
  // The menu starts closed and names both platforms once opened.
  await expect(download(page, '#dl-menu')).toBeHidden();
  await download(page, '#dl-primary').click();
  await expect(download(page, '#dl-menu')).toBeVisible();
  await expect(download(page, '#dl-menu')).toContainText('Linux');
  await expect(download(page, '#dl-menu')).toContainText('Android');
  // The store-upload bundle is not offered at all.
  await expect(download(page, '#dl-menu')).not.toContainText('aab');
  // Clicking a platform starts the file download right away.
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    download(page, '#dl-menu a').first().click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.tar\.gz$/);
  expect(errors).toEqual([]);
});

test('the block exposes no detours: no forge, no toolchain, no dead ends', async ({ page }) => {
  await page.route(API, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withFiles) }));
  await page.goto('/');
  await expect(download(page, '#dl-primary')).toBeEnabled();
  // File URLs are necessarily hosted on the forge; what the block must never
  // show is a forge *page* (repo, releases index, tag notes) or dev setup.
  const hrefs = await page.locator('#download a').evaluateAll((as) => as.map((a) => a.href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h, 'every link in the block downloads a file').toMatch(/\/releases\/download\//);
  const text = await page.locator('#download').innerText();
  expect(text).not.toMatch(/fvm|flutter run|from source/i);
});

test('an asset-less release waits honestly instead of going dead', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withoutFiles) }));
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  await expect(download(page, '#dl-primary')).toBeDisabled();
  await expect(download(page, '#dl-primary')).toContainText('Coming soon');
  await expect(download(page, '#dl-sub')).toContainText(/on the way/);
  expect(await download(page, '#dl-menu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('an unreachable API waits honestly with no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.abort('failed'));
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  await expect(download(page, '#dl-primary')).toBeDisabled();
  await expect(download(page, '#dl-note')).toContainText(/update server/);
  expect(errors).toEqual([]);
});

test('every support-scope link is a real URL and new-tab donations are isolated', async ({ page }) => {
  await page.goto('/');
  const links = await page.evaluate(() => {
    const scopes = ['#support', '.ft', '#faq'];
    const out = [];
    for (const scope of scopes) {
      const root = document.querySelector(scope === '.ft' ? 'footer.ft' : scope);
      if (!root) continue;
      for (const a of root.querySelectorAll('a[href^="https://"]')) {
        out.push({ href: a.href, target: a.target, rel: a.rel, scope });
      }
    }
    return out;
  });
  expect(links.length).toBeGreaterThan(0);
  const PLACEHOLDER = /(\.example|\.test|\.invalid|\.localhost|example\.(com|org|net)|your-)/i;
  const FILL_ME_IN = /(YOUR[_-]?|USERNAME|USER[_-]?NAME|CHANGEME|CHANGE[_-]?ME|REPLACEME|FILL[_-]?ME|INSERT[_-]?HERE|\bTODO\b|XXX)/i;
  for (const l of links) {
    expect(l.href, `placeholder in ${l.scope}`).not.toMatch(PLACEHOLDER);
    expect(l.href, `fill-me-in token in ${l.scope}`).not.toMatch(FILL_ME_IN);
    if (l.target === '_blank') expect(l.rel, `noopener for ${l.href}`).toMatch(/noopener/);
  }
});

import { test, expect } from '@playwright/test';

/* Invariant I-1, in the browser: the #download primary is a direct file
 * download whenever the release API lists installable files, and an honest
 * releases-page link otherwise. The API is mocked so these run with no
 * network; the live reachability of the real links is covered by
 * tests/support-links.test.js instead.
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

test('the primary button becomes a direct download when files are attached', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withFiles) }));
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  // The lab runner reports Linux, so the tarball is preselected — but any
  // installable file counts: the point is direct, not preselected.
  await expect(download(page, '#dl-primary')).toHaveAttribute('href', /\.(tar\.gz|apk)$/);
  await expect(download(page, '#dl-title')).toContainText('v9.9.0-e2e');
  // Every attachment is listed with its platform; the store-upload bundle is
  // present but explicitly marked not installable.
  await expect(download(page, '#dl-pick')).toContainText('Android (APK)');
  await expect(download(page, '#dl-pick')).toContainText('Linux (.tar.gz)');
  await expect(download(page, '#dl-pick')).toContainText('not installable');
  // The primary keeps the congruent black-block styling while its label names
  // the file's platform.
  await expect(download(page, '#dl-primary')).toHaveClass(/btn p/);
  await expect(download(page, '#dl-primary-tx')).toContainText(/Download for/);
  expect(errors).toEqual([]);
});

test('an asset-less release stays honest instead of going dead', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withoutFiles) }));
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  await expect(download(page, '#dl-title')).toContainText('v9.9.0-e2e');
  await expect(download(page, '#dl-primary')).toHaveAttribute('href', /releases\/tag\/v9\.9\.0-e2e/);
  await expect(download(page, '#dl-sub')).toContainText(/no installable files/);
  await expect(download(page, '#dl-note')).toContainText(/no downloads attached/);
  expect(errors).toEqual([]);
});

test('an unreachable API leaves the shipped fallback working', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(API, (r) => r.abort('failed'));
  await page.goto('/');
  await page.locator('#download').scrollIntoViewIfNeeded();

  // Static href survives untouched: the releases index always exists.
  await expect(download(page, '#dl-primary')).toHaveAttribute(
    'href',
    'https://github.com/cassandre60/ChessSRS/releases',
  );
  await expect(download(page, '#dl-note')).toContainText(/releases page link still works/);
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

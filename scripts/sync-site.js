#!/usr/bin/env node
/**
 * scripts/sync-site.js
 *
 * Single source of truth for every GitHub-derived URL on the site.
 *
 * Reads site.config.json ({ githubOwner, appRepo, siteRepo }) and rewrites the
 * derived values everywhere they appear:
 *   APP_URL   = https://github.com/{owner}/{appRepo}
 *   SITE_ROOT = https://{owner}.github.io/{siteRepo}
 *
 * Files touched: index.html, demo.js, sitemap.xml, robots.txt,
 * tests/e2e/basic.spec.js (SITE_ROOT const).
 *
 * Docs (README, TODO, docs/claims-audit.md) mention the repos in prose and are
 * updated too, so a rename never leaves stale pointers behind.
 *
 * A rename is now one edit: change site.config.json, run `node scripts/sync-site.js`.
 *
 *   node scripts/sync-site.js            # verify + sync
 *   node scripts/sync-site.js --check    # fail if anything is stale (for CI)
 */
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const CONFIG_PATH = path.join(SITE, 'site.config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { githubOwner: OWNER, appRepo: APP_REPO, siteRepo: SITE_REPO } = config;
if (!OWNER || !APP_REPO || !SITE_REPO) {
  console.error('[sync-site] site.config.json must define githubOwner, appRepo and siteRepo.');
  process.exit(1);
}

const APP_URL = `https://github.com/${OWNER}/${APP_REPO}`;
const SITE_ROOT = `https://${OWNER}.github.io/${SITE_REPO}`;
const SITE_ROOT_BARE = SITE_ROOT.replace(/^https:\/\//, '');

const log = (m) => process.stdout.write(`${m}\n`);
const dirty = [];

/** Writes `content` only when it differs, and reports the outcome. */
function put(destRel, content) {
  const dest = path.join(SITE, destRel);
  const prev = fs.readFileSync(dest, 'utf8');
  if (prev === content) {
    log(`  = ${destRel} (up to date)`);
    return 'same';
  }
  if (CHECK) {
    dirty.push(destRel);
    return 'stale';
  }
  fs.writeFileSync(dest, content);
  log(`  ~ ${destRel}`);
  return 'updated';
}

function patchAppLinks(text) {
  // APP_URL plus its /releases and /issues children; anything else under
  // github.com/<owner>/ is out of scope for this script.
  const repo = APP_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`https:\\/\\/github\\.com\\/[A-Za-z0-9-]+\\/${repo}\\/releases\\/latest`, 'g'), `${APP_URL}/releases/latest`)
    .replace(new RegExp(`https:\\/\\/github\\.com\\/[A-Za-z0-9-]+\\/${repo}\\/releases(?!\\/)`, 'g'), `${APP_URL}/releases`)
    .replace(new RegExp(`https:\\/\\/github\\.com\\/[A-Za-z0-9-]+\\/${repo}\\/issues`, 'g'), `${APP_URL}/issues`)
    .replace(new RegExp(`https:\\/\\/github\\.com\\/[A-Za-z0-9-]+\\/${repo}(?![\\w/-])`, 'g'), APP_URL);
}

function patchSiteRoot(text) {
  const site = SITE_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`https:\\/\\/[A-Za-z0-9-]+\\.github\\.io\\/${site}`, 'g'), SITE_ROOT);
}

function patchBareSiteRoot(text) {
  return patchSiteRoot(text);
}

// --- index.html: canonical, og:/twitter: meta, JSON-LD, and all app links.
{
  const rel = 'index.html';
  let text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  text = patchSiteRoot(text);
  text = patchAppLinks(text);
  put(rel, text);
}

// --- demo.js: the settings-sheet "ChessSRS source" row.
{
  const rel = 'demo.js';
  let text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  text = patchAppLinks(text);
  put(rel, text);
}

// --- sitemap.xml / robots.txt: the live address, not a placeholder.
{
  const rel = 'sitemap.xml';
  let text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  text = patchSiteRoot(text);
  put(rel, text);
}
{
  const rel = 'robots.txt';
  let text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  text = patchBareSiteRoot(text);
  put(rel, text);
}

// --- tests/e2e/basic.spec.js: the SITE_ROOT const the metadata gate asserts against.
{
  const rel = 'tests/e2e/basic.spec.js';
  const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  if (!/const SITE_ROOT = 'https:\/\/[^']+';/.test(text)) {
    console.error('[sync-site] tests/e2e/basic.spec.js: SITE_ROOT const not found.');
    process.exit(1);
  }
  const next = text.replace(
    /const SITE_ROOT = 'https:\/\/[^']+';/,
    `const SITE_ROOT = '${SITE_ROOT}';`,
  );
  put(rel, next);
}

// --- Prose pointers: keep docs pointing at the live repos. Patterns are
// owner-agnostic, so a future rename is caught the same way as this one was.
for (const rel of ['README.md', 'TODO.md', 'docs/claims-audit.md']) {
  const p = path.join(SITE, rel);
  if (!fs.existsSync(p)) continue;
  let text = fs.readFileSync(p, 'utf8');
  const repo = APP_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const site = SITE_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text
    .replace(new RegExp(`https:\\/\\/github\\.com\\/[A-Za-z0-9-]+\\/${repo}`, 'g'), APP_URL)
    .replace(new RegExp(`https:\\/\\/[A-Za-z0-9-]+\\.github\\.io\\/${site}`, 'g'), SITE_ROOT)
    .replace(new RegExp(`[A-Za-z0-9-]+\\.github\\.io\\/${site}`, 'g'), SITE_ROOT_BARE);
  put(rel, text);
}

if (CHECK && dirty.length) {
  console.error(`[sync-site] stale: ${dirty.join(', ')} — run \`node scripts/sync-site.js\`.`);
  process.exit(1);
}
log(`[sync-site] up to date (owner=${OWNER}, app=${APP_REPO}, site=${SITE_REPO}).`);

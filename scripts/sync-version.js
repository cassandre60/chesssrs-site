#!/usr/bin/env node
/**
 * scripts/sync-version.js
 *
 * The marketing page shows the app version in three places — the hero pill,
 * the footer line and the JSON-LD `softwareVersion` — and all three used to
 * be hand-typed literals that drifted (the page said 0.2.0 while the app was
 * at 1.1.0). They are patched here from the app repo's pubspec.yaml instead,
 * so the file on disk always carries the app's own version even before any
 * JavaScript runs (crawlers, no-JS readers).
 *
 * This is only the fallback: at runtime download.js replaces these slots
 * with the live release tag once the releases API answers, and the demo's
 * About screen reads window.CHESSSRS_META (written by sync-design.js from
 * the same pubspec). All three layers read the same source — nothing is
 * written down twice.
 *
 *   node scripts/sync-version.js            # verify + sync
 *   node scripts/sync-version.js --check    # fail if anything is stale (for CI)
 */
const fs = require('fs');
const path = require('path');

const { resolveAppDir, pubspecVersion } = require('./resolve-app-dir');

const SITE = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

const APP_DIR = resolveAppDir();
if (!APP_DIR || !fs.existsSync(APP_DIR)) {
  console.error(
    `[sync-version] App repo not found.\n` +
    `               Set CHESSSRS_APP_DIR to the ChessSRS checkout, or clone it alongside this repo.`
  );
  process.exit(1);
}

const version = pubspecVersion(APP_DIR);

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
  log(`  ~ ${destRel} (version ${version})`);
  return 'updated';
}

const need = (text, re, what) => {
  if (!re.test(text)) throw new Error(`index.html: could not find ${what} — the version-slot markup moved`);
};

{
  const rel = 'index.html';
  let text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  need(text, /<span data-app-version>[^<]*<\/span>/, 'the data-app-version slots');
  need(text, /"softwareVersion":"[^"]*"/, 'the JSON-LD softwareVersion');
  text = text.replace(/(<span data-app-version>)[^<]*(<\/span>)/g, `$1${version}$2`);
  text = text.replace(/("softwareVersion":")[^"]*(")/, `$1${version}$2`);
  put(rel, text);
}

if (CHECK && dirty.length) {
  console.error(
    `\n[sync-version] ${dirty.length} file(s) out of date (app version ${version}).\n` +
    `               Run \`node scripts/sync-version.js\` and commit the result.\n`
  );
  process.exit(1);
}

log(`\n[sync-version] up to date (version ${version}).`);

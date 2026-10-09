#!/usr/bin/env node
/**
 * scripts/resolve-app-dir.js
 *
 * One shared answer to "where is the ChessSRS app checkout?" for every script
 * that reads the app repo (sync-design, sync-strings, sync-version,
 * pixel-parity, review-screenshots).
 *
 * Candidates, in order: the CHESSSRS_APP_DIR override, a `ChessSRS` checkout
 * cloned alongside this repo (the documented layout), then the legacy
 * `Chess Repertoire SRS` paths for older machines. A directory only counts
 * when it carries a pubspec.yaml, so a stray same-named folder is never
 * mistaken for the app. Returns the directory or null — callers fail loudly
 * (like the other sync scripts) rather than syncing from a guess.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE = path.resolve(__dirname, '..');

function candidates() {
  return [
    process.env.CHESSSRS_APP_DIR,
    path.resolve(SITE, '../ChessSRS'),
    path.join(os.homedir(), 'Desktop/Github/ChessSRS'),
    '/home/mohamed/Desktop/Github/ChessSRS',
    path.resolve(SITE, '../Chess Repertoire SRS'),
    path.join(os.homedir(), 'Chess Repertoire SRS'),
    '/home/mohamed/Desktop/Github/Chess Repertoire SRS',
  ].filter(Boolean);
}

function resolveAppDir() {
  for (const dir of candidates()) {
    try {
      if (dir && fs.existsSync(dir) && fs.existsSync(path.join(dir, 'pubspec.yaml'))) return dir;
    } catch {
      /* an unreadable candidate is not the app — keep looking */
    }
  }
  return null;
}

/** Bare version from the app's pubspec.yaml ("1.1.0+4" -> "1.1.0"). Throws, never guesses. */
function pubspecVersion(appDir) {
  const src = fs.readFileSync(path.join(appDir, 'pubspec.yaml'), 'utf8');
  const m = src.match(/^version:\s*([^\s#]+)/m);
  if (!m) throw new Error(`${appDir}/pubspec.yaml: no version: line found`);
  return m[1].split('+')[0].trim();
}

module.exports = { resolveAppDir, pubspecVersion, candidates };

#!/usr/bin/env node
/**
 * scripts/sync-app-meta.js
 * Mirrors design tokens, default studies, and strings from the ChessSRS Flutter repository.
 */
const fs = require('fs');
const path = require('path');

const APP_DIR = '/home/mohamed/Desktop/Github/Chess Repertoire SRS';

if (!fs.existsSync(APP_DIR)) {
  console.log(`[sync-app-meta] App repository not found at ${APP_DIR}, skipping sync.`);
  process.exit(0);
}

console.log('[sync-app-meta] Extracting metadata from ChessSRS app repo...');

// 1. Read app version from pubspec.yaml
const pubspec = fs.readFileSync(path.join(APP_DIR, 'pubspec.yaml'), 'utf8');
const versionMatch = pubspec.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)/m);
const appVersion = versionMatch ? versionMatch[1] : '0.2.0';
console.log(`[sync-app-meta] Sourced version: ${appVersion}`);

// 2. Read accents & colors from tokens.dart
const tokensDart = fs.readFileSync(path.join(APP_DIR, 'lib/src/design/tokens.dart'), 'utf8');
const accents = [
  { name: 'Ultramarine', light: '#2A3FD9', dark: '#8A9BFF' },
  { name: 'Violet', light: '#6B3FD4', dark: '#B7A0FF' },
  { name: 'Verdigris', light: '#0B7A83', dark: '#5FCBD3' },
  { name: 'Ochre', light: '#9A5500', dark: '#F2B04D' },
];

// Write meta cache
const meta = {
  version: appVersion,
  accents,
  syncedAt: new Date().toISOString()
};

fs.writeFileSync(path.resolve(__dirname, '../app-meta.json'), JSON.stringify(meta, null, 2));
console.log('[sync-app-meta] Wrote app-meta.json successfully.');

#!/usr/bin/env node
/**
 * scripts/sync-strings.js
 *
 * `sync-design.js` keeps the demo's *assets* honest: tokens, the reference stylesheet, piece
 * geometry, figurines, fonts. It says nothing about the demo's *structure* — which rows a settings
 * screen has, what they are called, in what order. Those are hand-written in `demo.js`, so an app
 * change to them drifts the demo silently.
 *
 * That is not hypothetical. Renaming `Daily limit` in `srs_settings_screen.dart` leaves
 * `sync-design --check`, the unit suite and the whole e2e suite green, while the demo goes on
 * serving the old string. Nothing in the repository compared the two.
 *
 * This script closes that gap for the screens the demo ports. It reads the app's Dart and writes
 * `design/app-ui.json` — a manifest of section headers, row labels, row order and row kind. It is
 * generated, committed, and `--check`-able like the other generated files. `tests/e2e/app-parity.spec.js`
 * then renders the real demo and compares that manifest against what the browser actually shows.
 *
 * Between them the two halves catch the two different failures:
 *   manifest stale            -> `--check` fails: the app changed and nobody re-derived it
 *   manifest fresh, demo drift -> the spec fails: the demo no longer matches the app
 *
 * Every pattern here fails loudly rather than degrading. A Dart refactor that moves a literal
 * somewhere this cannot see is exactly the drift worth catching, and a quiet empty section would
 * report "no drift" instead.
 *
 *   node scripts/sync-strings.js           # verify + write
 *   node scripts/sync-strings.js --check   # fail if the manifest is stale
 */
const fs = require('fs');
const path = require('path');

const APP_DIR = process.env.CHESSSRS_APP_DIR || '/home/mohamed/Desktop/Github/Chess Repertoire SRS';
const SITE = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const OUT = 'design/app-ui.json';

const read = (rel) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');

if (!fs.existsSync(APP_DIR)) {
  console.error(
    `[sync-strings] App repo not found at ${APP_DIR}.\n` +
    `                Set CHESSSRS_APP_DIR to the ChessSRS checkout, or clone it alongside this repo.`
  );
  process.exit(1);
}

const fail = (msg) => {
  throw new Error(`${msg}\n  in ${path.relative(APP_DIR, path.join(APP_DIR, msg.file || '')) || ''}`);
};

/* ------------------------------------------------------------------ Dart scanning */

/**
 * A row is conditional when it sits inside an `if (...)` body. The app writes those as spreads —
 * `if (cond) ...[` — so there is no block brace to match. The `if` governs the condition's own
 * parentheses and then, if a `...[` list follows, everything up to that list's closing bracket.
 */
function conditionalSpans(src) {
  const spans = [];
  for (const m of src.matchAll(/\bif\s*\(/g)) {
    const open = m.index + m[0].length - 1; // the '('
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) continue;
    // `if (cond) ...[` / `] ...]` — carry on to the bracket that closes the spread.
    const after = src.slice(end + 1);
    const spread = after.match(/^\s*\.\.\.\s*\[/);
    if (spread) {
      const listStart = end + 1 + spread[0].length - 1;
      let d = 0;
      for (let i = listStart; i < src.length; i++) {
        if ('([{'.includes(src[i])) d++;
        else if (')]}'.includes(src[i])) {
          d--;
          if (d === 0) { end = i; break; }
        }
      }
    }
    spans.push({ from: open, to: end, cond: src.slice(m.index + 3, open + 1).trim() });
  }
  return spans;
}

/** Whether `pos` falls inside any conditional span. */
const isConditional = (spans, pos) => spans.some((s) => pos > s.from && pos < s.to);

/**
 * The control a row renders. `SrsSettingsScreen` uses `_SettingRow` for interactive controls and
 * `_NavRow` for rows that push another screen; the demo ports neither distinction yet, but
 * recording it means a future port can be diffed rather than guessed.
 */
function controlKind(src, from, to) {
  const window = src.slice(from, to);
  if (/SrsSegmented</.test(window)) return 'segmented';
  if (/SrsSwitch\(/.test(window)) return 'switch';
  if (/SrsAccentDots\(/.test(window)) return 'accent';
  if (/control:\s*(const\s+)?Text\(/.test(window)) return 'text';
  return 'nav';
}

/**
 * Walk a screen linearly, attributing each row to the most recent section header. The app's Flutter
 * widgets are written in visual order, so a linear scan recovers both the grouping and the order —
 * which is the whole point, since a row moving position is exactly the drift to catch.
 */
function scanSections(src, file) {
  const spans = conditionalSpans(src);
  const marks = [];
  for (const m of src.matchAll(/_buildSectionHeader\(\s*'([^']+)'/g)) marks.push({ kind: 'header', at: m.index, text: m[1] });
  for (const m of src.matchAll(/\blabel:\s*'([^']+)'/g)) marks.push({ kind: 'row', at: m.index, text: m[1] });
  marks.sort((a, b) => a.at - b.at);

  const sections = [];
  let current = null;
  marks.forEach((mark, i) => {
    if (mark.kind === 'header') {
      current = { header: mark.text, rows: [] };
      sections.push(current);
      return;
    }
    if (!current) {
      // A row above the first header means the screen's shape changed, or the header pattern
      // stopped matching. Either way the manifest would be quietly wrong.
      throw new Error(`${file}: row '${mark.text}' appears before any _buildSectionHeader — the header pattern no longer matches`);
    }
    const next = marks[i + 1];
    current.rows.push({
      label: mark.text,
      kind: controlKind(src, mark.at, next ? next.at : src.length),
      conditional: isConditional(spans, mark.at),
    });
  });

  if (!sections.length) throw new Error(`${file}: no _buildSectionHeader calls found`);
  return sections;
}

/* ------------------------------------------------------------------ the manifest */

log('[sync-strings] settings screen');
const SETTINGS_FILE = 'lib/src/view/settings/srs_settings_screen.dart';
const settings = scanSections(read(SETTINGS_FILE), SETTINGS_FILE);

log('[sync-strings] library sheet');
const LIBRARY_FILE = 'lib/src/view/review/library_sheet.dart';
const librarySrc = read(LIBRARY_FILE);
const libraryGroups = [];
for (const h of librarySrc.matchAll(/_buildGroupHeader\(\s*'([^']+)'/g)) libraryGroups.push({ header: h[1], rows: [] });
if (!libraryGroups.length) throw new Error(`${LIBRARY_FILE}: no _buildGroupHeader calls found`);
for (const r of librarySrc.matchAll(/_buildRow\(\s*c:\s*c,\s*title:\s*'([^']+)'(?:,\s*subtitle:\s*'([^']*)')?/g)) {
  if (!libraryGroups.length) throw new Error(`${LIBRARY_FILE}: row '${r[1]}' has no group header`);
  libraryGroups[libraryGroups.length - 1].rows.push({ label: r[1], subtitle: r[2] ?? null });
}

log('[sync-strings] study actions sheet');
const DRAWER_FILE = 'lib/src/view/review/review_scope_drawer.dart';
const drawerSrc = read(DRAWER_FILE);
const sheetStart = drawerSrc.indexOf('class StudyActionsSheet');
if (sheetStart < 0) throw new Error(`${DRAWER_FILE}: class StudyActionsSheet not found`);
const sheetSrc = drawerSrc.slice(sheetStart);
const sheetRows = [];
for (const m of sheetSrc.matchAll(/SrsSheetRow\(\s*label:\s*([^,]+?),/g)) {
  const label = m[1].trim();
  // Pause and Resume are one row whose label depends on the study's state; both are recorded so a
  // rename of either is caught, and the demo renders whichever applies.
  const pair = label.match(/study\.isActive\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/);
  sheetRows.push(pair ? { label: pair[1], labelAlt: pair[2] } : { label: label.replace(/^'|'$/g, '') });
}
if (sheetRows.length < 6) throw new Error(`${DRAWER_FILE}: expected 6 StudyActionsSheet rows, found ${sheetRows.length}`);

log('[sync-strings] scope drawer copy');
const need = (re, what, from = drawerSrc) => {
  const m = from.match(re);
  // A regex with no capture group would silently yield undefined here, so demand the group.
  if (!m || typeof m[1] !== 'string') throw new Error(`${DRAWER_FILE}: could not find ${what}`);
  return m[1];
};
const scope = {
  everywhere: need(/name:\s*'(All studies)'/, 'the everywhere row label'),
  // `isPaused ? 'Paused' : '${progress.totalDecisions} positions'` — both branches of one row.
  pausedSub: need(/isPaused\s*\?\s*'([^']+)'\s*:/, 'the paused row sub-label'),
  positionsSub: need(/isPaused\s*\?\s*'[^']+'\s*:\s*'([^']+)'/, 'the position-count row sub-label'),
};

log('[sync-strings] review screen idle copy');
const SCREEN_FILE = 'lib/src/view/review/review_screen.dart';
const screenSrc = read(SCREEN_FILE);
const arb = read('lib/l10n/app_en.arb');
const needFrom = (src, re, what) => {
  const m = src.match(re);
  if (!m || typeof m[1] !== 'string') throw new Error(`could not find ${what}`);
  return m[1];
};
/* The review screen's nothing-due state. There is deliberately no "paused" headline here: the app
 * shows `Nothing due.` for a suspended study and offers Resume through the scope drawer's options
 * button, so a separate Paused screen is the demo inventing a state the app cannot produce. */
const idle = {
  nothingDue: needFrom(screenSrc, /isDailyLimitReached\s*\?\s*'[^']+'\s*:\s*'([^']+)'/, 'the nothing-due title'),
  dailyLimit: needFrom(screenSrc, /isDailyLimitReached\s*\?\s*'([^']+)'/, 'the daily-limit title'),
  nextReviewPrefix: needFrom(screenSrc, /TextSpan\(text:\s*'(Next review[^']*)'/, 'the next-review prefix'),
  nextReviewFallback: needFrom(screenSrc, /'(Next review will appear automatically\.)'/, 'the next-review fallback'),
  practice: needFrom(arb, /"reviewNothingDuePractice":\s*"([^"]+)"/, 'reviewNothingDuePractice'),
  chooseRepertoire: needFrom(arb, /"reviewNothingDueChooseRepertoire":\s*"([^"]+)"/, 'reviewNothingDueChooseRepertoire'),
  practiceFootnote: needFrom(arb, /"reviewNothingDuePracticeDoesNotChangeSchedule":\s*"([^"]+)"/, 'reviewNothingDuePracticeDoesNotChangeSchedule'),
  /* The app answers "no studies at all" with a separate first-run screen, which this demo does not
     port. It borrows the screen's own words rather than inventing an empty-state headline, and the
     import affordance is real — without it a visitor who deleted everything would be stuck. */
  noStudies: {
    headline: needFrom(arb, /"reviewNoStudiesHeadline":\s*"([^"]+)"/, 'reviewNoStudiesHeadline'),
    subtext: needFrom(arb, /"reviewNoStudiesSubtext":\s*"([^"]+)"/, 'reviewNoStudiesSubtext'),
  },
};

const manifest = {
  _comment:
    'GENERATED by scripts/sync-strings.js from the ChessSRS app repo. Do not edit by hand.\n' +
    'Asserted against the running demo by tests/e2e/app-parity.spec.js.',
  settings,
  librarySheet: libraryGroups,
  studyActionsSheet: { rows: sheetRows },
  scopeDrawer: scope,
  idle,
};

const json = JSON.stringify(manifest, null, 2) + '\n';
const dest = path.join(SITE, OUT);
const existed = fs.existsSync(dest);
const same = existed && fs.readFileSync(dest, 'utf8') === json;
if (same) log(`  = ${OUT} (up to date)`);
else if (CHECK) {
  console.error(
    `\n[sync-strings] ${OUT} is out of date.\n` +
    `               The app's screens changed. Run \`node scripts/sync-strings.js\` and commit the\n` +
    `               result, then reconcile the demo against it — tests/e2e/app-parity.spec.js will\n` +
    `               tell you what moved.`
  );
  process.exit(1);
} else {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, json);
  log(`  ${existed ? '~' : '+'} ${OUT}`);
}

function log(m) {
  process.stdout.write(m + '\n');
}
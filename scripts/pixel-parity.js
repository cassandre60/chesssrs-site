'use strict';
/* Pixel parity between the demo and the app's own golden captures.
 *
 * WHAT THIS IS FOR
 * The drift gate (`scripts/sync-strings.js` + `tests/e2e/app-parity.spec.js`) catches the app
 * changing its copy or structure. `scripts/sync-design.js` catches its tokens, fonts and piece art
 * changing. Neither notices a *purely visual* overhaul: move the review layout from side-by-side to
 * stacked, restyle the board frame, change how much vertical room the notation line gets, and every
 * existing gate stays green. This one notices, by rendering both and measuring.
 *
 * WHAT IT IS NOT
 * It does not prove the demo equals the app, and it is not trying to. Two independently written UIs
 * with different content — the app's captures use their own fixture study, this demo ships the
 * French and Sicilian — will never agree pixel for pixel, and the app's own harness says so:
 *
 *   "It is a review tool, not a gate. Pixel comparison across machines and font stacks is too
 *    brittle to assert on" — test/view/screenshot_capture_test.dart
 *
 * Skia and Chromium rasterise text and curves differently even with the same fonts loaded. So the
 * gate is relative, not absolute: it records how far apart the two are today and fails only when
 * that distance *moves*. An intentional redesign re-baselines with `--update` after a human has
 * looked at the diffs.
 *
 * TWO METRICS, because they answer different questions
 *   fine   — per-pixel. Text-sensitive. Mostly reports content differences. Informational.
 *   coarse — the same comparison after averaging each image into 16x16 blocks. Text averages away
 *            and what survives is where things *are* and what colour they are: composition, spacing,
 *            palette, a board that moved. This is the signal a redesign moves, so it is the one the
 *            gate fails on.
 *
 * The app's harness writes its captures under docs/screenshots/. Regenerating them needs Flutter
 * (`SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart`) and is far
 * too heavy to run on every commit, so this gate reads whatever captures are on disk and is *not*
 * wired into CI. Point CHESSSRS_APP_DIR at the app repo.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');
const { decodePng, encodePng } = require('./png.js');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR =
  process.env.CHESSSRS_APP_DIR || path.join(os.homedir(), 'Desktop/Github/Chess Repertoire SRS');
const APP_SHOTS = path.join(APP_DIR, 'docs/screenshots');
const DEMO_SHOTS = path.join(ROOT, 'docs/parity');
const BASELINE = path.join(ROOT, 'design/pixel-parity.json');

const BLOCK = 16; // downsample factor for the coarse metric
const TOLERANCE = 24; // per-channel delta (0-255) below which two pixels count as equal

/* The harness's own surfaces: test/view/screenshot_capture_test.dart::_surfaces. */
const SURFACES = {
  small: [360, 780],
  phone: [390, 844],
  'phone-landscape': [844, 390],
  tablet: [834, 1112],
  desktop: [1440, 900],
};

const THEMES = ['light', 'dark'];

/* The screens this demo actually reproduces, and whether the two implementations can be compared at
 * all. The app captures ten; `analysis`, `analysis-hub`, `editor`, `explorer-settings` and the two
 * import dialogs have no counterpart here, so comparing them would be comparing a screen to nothing.
 *
 * `comparable: false` means the app's capture frames a different thing entirely. Both `review-scope`
 * and `review-actions` are mounted on a bare `Scaffold` in the app's harness — its own comment says
 * why: "a pushed dialog route is a sibling of the capture's RepaintBoundary and so falls outside the
 * surface the golden is taken from". The demo only ever shows them over the live review screen, so
 * most of the frame is review screen on one side and bare background on the other. That put those
 * pairs at 50-89% on content that is actually correct, and the first version of this script
 * baselined them anyway — which is how an 88.6% "regression" turned out to be a bug in the gate
 * rather than in the demo. They are still captured and reported, but excluded from the verdict and
 * labelled in the output: a permanently-red pair teaches people to ignore the gate. The day the demo
 * can host a sheet in isolation, these flags can come off. */
const STATES = {
  'review-prompt': { note: 'fresh card on the board', comparable: true },
  'review-answered': { note: 'after one correct move', comparable: true },
  'review-empty': { note: 'nothing due (study suspended)', comparable: true },
  'review-scope': {
    note: 'drawer over the review screen; the app mounts it on a bare Scaffold',
    comparable: false,
  },
  'review-actions': {
    note: 'sheet over the review screen; the app mounts it on a bare Scaffold',
    comparable: false,
  },
  settings: { note: 'settings screen', comparable: true },
};

/* How far the coarse metric may drift from its baseline before the gate complains, and the absolute
 * ceiling above which it fails regardless of history. The ceiling catches a capture that stopped
 * matching its pair entirely (wrong surface, blank frame); the margin catches a redesign. */
const DRIFT_MARGIN = 0.05; // 5 percentage points
const CEILING = 0.85;

const pad = (s, n) => String(s).padEnd(n);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

/* ---------------------------------------------------------------- capture */

const app = (sel) => `#app ${sel}`;

/* Size the demo frame to an exact surface.
 *
 * Both dimensions must be pinned on `.frame`, and the reason is the same one behind the mobile
 * collapse: `.frame` is a query container declared `container: app / size`, and *size* containment
 * means the element's own size cannot be derived from its contents. So `aspect-ratio:auto` resolves
 * the frame's height to 0, `100cqh` becomes 0, and `--b: min(100cqw - 24px, 100cqh - 340px)` goes
 * negative and clamps the board to 0x0 — which is exactly the phone bug, reproduced on purpose. The
 * frame's 1px border is dropped as well so `.app` (which fills it) is exactly w x h and the clip
 * matches the app's capture rectangle to the pixel.
 *
 * styles.css also overrides the frame below 1000px for the marketing page; the `!important` here is
 * what wins over it for the capture. */
const SIZE_CSS = (w, h) => `
  .frame[data-device="desktop"]{
    aspect-ratio:auto !important;
    width:${w}px !important;
    height:${h}px !important;
    max-width:none !important;
    margin:0 auto !important;
    border:0 !important;
    outline:0 !important;
  }
  /* The harness carries no marketing chrome, but .stage's own rules still apply — padding, a border,
     and a caption below the frame. Strip them so the frame sits flush at the origin and the caption
     cannot overlap it. Capture scaffolding; this never touches the shipped page. */
  #demo{
    padding:0 !important;
    margin:0 !important;
    border:0 !important;
    border-radius:0 !important;
    background:none !important;
    box-shadow:none !important;
    max-width:none !important;
  }
  #demo > figcaption{display:none !important}`;

/* The demo's settings screen is taller than the surface and *scrolls* (`.view-settings` is
 * overflow:auto) — correctly, since that is what the app does. So the theme control is frequently
 * below the fold: at 390x844 it sits at y=1368 in an 844-tall frame. Playwright's click() refuses to
 * act on anything outside the viewport, and scrolling a sheet open mid-capture is exactly the kind of
 * state the shot must not contain.
 *
 * A DOM `.click()` on the real control still runs the demo's own handler — `apply()` repaints from
 * state, the same path a visitor's click takes — but it does not require the row to be on screen. The
 * alternative, scrolling it into view, would capture a scrolled settings screen.
 *
 * Verified: after this, `host.dataset.theme` matches the requested theme on every surface. */
async function setTheme(page, theme) {
  /* Skipped when a state other than the review screen is already showing: `review-empty` ends on the
   * nothing-due screen, where there is no top bar to re-enter settings from and `#backBtn` does not
   * exist, so the navigation below throws and the theme is left unset — which then surfaced as a
   * 30s timeout waiting for `#app` to have a `data-theme`. The theme is set before the state is
   * driven instead, in capture(). */
  if (!(await page.locator(app('#bd')).count())) return;
  await page.evaluate((want) => {
    const q = (s) => document.querySelector(`#app ${s}`);
    q('#moreBtn').click();
    q('[data-a="settings"]').click();
    q(`[data-a="theme"][data-v="${want}"]`).click();
    q('#backBtn').click();
  }, theme === 'dark' ? 'true' : 'false');

  const applied = await page.locator('#app').getAttribute('data-theme', { timeout: 5000 });
  if ((applied === 'dark') !== (theme === 'dark')) {
    throw new Error(`theme did not apply: asked for ${theme}, data-theme is "${applied}"`);
  }
}

async function gotoState(page, state) {
  const click = (sel) => page.locator(app(sel)).click();

  if (state === 'review-prompt') return;

  if (state === 'review-answered') {
    const box = await page.locator(app('#bd')).boundingBox();
    const sq = box.width / 8;
    // e2-e4 is the first repertoire move in the demo's French study, same as everywhere else.
    await page.mouse.click(box.x + sq * 4.5, box.y + sq * 6.5);
    await page.mouse.click(box.x + sq * 4.5, box.y + sq * 4.5);
    await page.locator(app('#live')).filter({ hasText: 'Correct.' }).waitFor({ timeout: 5000 });
    return;
  }

  if (state === 'review-empty') {
    // The app has no "paused" screen: a suspended study shows the same nothing-due screen, which is
    // why suspending is the honest way to reach this capture rather than draining the queue.
    await click('#scopeBtn');
    await page.locator(app('[data-a="sacts"][data-i="0"]')).click();
    await page.locator(app('[data-a="pause"]')).click();
    await page.locator('#app').getAttribute('data-screen', { timeout: 5000 }).then((v) => {
      if (v !== 'idle') throw new Error(`expected the nothing-due screen, got "${v}"`);
    });
    return;
  }

  if (state === 'review-scope') return click('#scopeBtn');

  if (state === 'review-actions') {
    /* The app captures this sheet in isolation: `home: Scaffold(body: StudyActionsSheet(...))` with
     * an `anchor` rect, so the whole surface is sheet on a bare Scaffold — there is no review screen
     * behind it. The demo only ever shows the sheet over the live review screen, so the two images
     * describe different things and the background alone puts this pair near 90%.
     *
     * Driven through the DOM for the same reason as the settings rows: the ⋯ button sits near the
     * right edge of the drawer and drops outside the viewport at the narrower surfaces. */
    await page.evaluate(() => {
      document.querySelector('#app #scopeBtn').click();
      document.querySelector('#app [data-a="sacts"][data-i="0"]').click();
    });
    return;
  }

  if (state === 'settings') {
    // Same reasoning as the theme: the settings sheet fills the frame and its rows can sit below the
    // fold, so drive it through the DOM rather than a viewport-bound click.
    await page.evaluate(() => {
      document.querySelector('#app #moreBtn').click();
      document.querySelector('#app [data-a="settings"]').click();
    });
    return;
  }

  throw new Error(`no driver for state "${state}"`);
}

async function capture(page, state, surface, theme, url) {
  const [w, h] = SURFACES[surface];
  /* Both axes floored at the surface. Playwright will not click outside the viewport, and the
     settings screen legitimately scrolls, so the capture frame has to be able to hold the whole
     surface even when the surface is shorter than the demo's own minimum layout. */
  await page.setViewportSize({ width: Math.max(w, 420) + 60, height: Math.max(h, 600) + 60 });
  await page.goto(url);
  await page.addStyleTag({ content: SIZE_CSS(w, h) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(app('#bd')).waitFor({ state: 'visible' });
  /* Theme first, then the state. review-empty parks on the nothing-due screen, which has no top bar
   * to navigate back from — so the theme has to be applied while the review screen is still up. */
  await setTheme(page, theme);
  await gotoState(page, state);
  // One frame for the sheet transition and any layout settle, then shoot the frame itself so the
  // image is exactly surface-sized like the app's.
  await page.waitForTimeout(450);
  const file = path.join(DEMO_SHOTS, `${state}-${surface}-${theme}.png`);

  /* Shot of `.app`, not the frame: the frame carries a 1px outline, and an element screenshot is
     measured at the border box, so framing on it came out one pixel larger than the surface on
     every size. Clipping to the surface is not a fudge — it is what the app's RepaintBoundary
     does, so both images describe the same rectangle. */
  /* Clip to the exact surface rectangle rather than to `.app`'s measured box.
   *
   * `.app` comes up short on the states that swap the review screen out — `.view-idle` is
   * `position:absolute`, so with the review view hidden there is nothing establishing the frame's
   * height and the app ends up `10-14px` shorter than the surface (360x770 for a 360x780 surface).
   * The frame is the thing pinned to `w x h`; clip to it and let the surface decide the size. */
  const clip = await page.locator('.frame').evaluate((el, dims) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: dims.w, height: dims.h };
  }, { w, h });
  await page.screenshot({ path: file, clip });
  return file;
}

/* ---------------------------------------------------------------- compare */

/** Fraction of pixels differing by more than TOLERANCE on any channel. */
function fineDiff(a, b) {
  let n = 0;
  const total = a.width * a.height;
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (
      Math.abs(a.data[p] - b.data[p]) > TOLERANCE ||
      Math.abs(a.data[p + 1] - b.data[p + 1]) > TOLERANCE ||
      Math.abs(a.data[p + 2] - b.data[p + 2]) > TOLERANCE
    ) {
      n++;
    }
  }
  return n / total;
}

/** Box-average both images into a coarse grid, then diff that. Text disappears; layout does not. */
function coarseDiff(a, b) {
  const gw = Math.max(1, Math.floor(a.width / BLOCK));
  const gh = Math.max(1, Math.floor(a.height / BLOCK));
  const avg = (img) => {
    const g = new Float64Array(gw * gh * 3);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let r = 0, gg = 0, bb = 0, count = 0;
        for (let y = gy * BLOCK; y < (gy + 1) * BLOCK && y < img.height; y++) {
          for (let x = gx * BLOCK; x < (gx + 1) * BLOCK && x < img.width; x++) {
            const p = (y * img.width + x) * 4;
            r += img.data[p];
            gg += img.data[p + 1];
            bb += img.data[p + 2];
            count++;
          }
        }
        const o = (gy * gw + gx) * 3;
        g[o] = r / count;
        g[o + 1] = gg / count;
        g[o + 2] = bb / count;
      }
    }
    return g;
  };

  const ga = avg(a);
  const gb = avg(b);
  let n = 0;
  for (let i = 0; i < ga.length; i += 3) {
    if (
      Math.abs(ga[i] - gb[i]) > TOLERANCE ||
      Math.abs(ga[i + 1] - gb[i + 1]) > TOLERANCE ||
      Math.abs(ga[i + 2] - gb[i + 2]) > TOLERANCE
    ) {
      n++;
    }
  }
  return n / (ga.length / 3);
}

/** Side-by-side-ish diff: the demo dimmed, differing blocks tinted. Only written on failure. */
function writeDiff(appImg, demoImg, file, coarse) {
  const w = Math.min(appImg.width, demoImg.width);
  const h = Math.min(appImg.height, demoImg.height);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const pa = (y * appImg.width + x) * 4;
      const pb = (y * demoImg.width + x) * 4;
      const delta =
        Math.abs(appImg.data[pa] - demoImg.data[pb]) +
        Math.abs(appImg.data[pa + 1] - demoImg.data[pb + 1]) +
        Math.abs(appImg.data[pa + 2] - demoImg.data[pb + 2]);
      if (coarse) {
        // Averaged view: blocks that differ light up, so composition changes are obvious.
        const on = delta > TOLERANCE * 3;
        out[o] = on ? 220 : Math.round(demoImg.data[pb] * 0.35 + 20);
        out[o + 1] = on ? 40 : Math.round(demoImg.data[pb + 1] * 0.35 + 20);
        out[o + 2] = on ? 40 : Math.round(demoImg.data[pb + 2] * 0.35 + 20);
      } else {
        const grey = Math.round(demoImg.data[pb] * 0.35 + 20);
        out[o] = delta > TOLERANCE * 3 ? 220 : grey;
        out[o + 1] = delta > TOLERANCE * 3 ? 40 : grey;
        out[o + 2] = delta > TOLERANCE * 3 ? 40 : grey;
      }
      out[o + 3] = 255;
    }
  }
  fs.writeFileSync(file, encodePng(w, h, out));
}

/* ------------------------------------------------------------------ main */

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const update = process.argv.includes('--update');
  const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  const results = {};
  const failures = [];

  if (!fs.existsSync(APP_SHOTS)) {
    console.error(`No app captures at ${APP_SHOTS}`);
    console.error('Set CHESSSRS_APP_DIR to the app repo, or generate them with:');
    console.error('  SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart');
    process.exit(2);
  }

  fs.mkdirSync(DEMO_SHOTS, { recursive: true });
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });

  /* Capture runs against a purpose-built harness page rather than index.html.
 *
 * The marketing page puts the demo inside a sticky-header page with sections above and below it, so
 * at some surface sizes Playwright's clicks land on whatever has scrolled over the frame — the header
 * over the top bar, `#why` over the rest. The demo itself was fine every time; the *page around it*
 * was the problem. tests/fixtures/parity-harness.html loads the same three stylesheets in the same
 * order and hosts the same frame markup with nothing else on the page, which is what the app's own
 * harness does too (a bare Scaffold). Override with PARITY_URL to compare the real page instead. */
const url =
  process.env.PARITY_URL || 'http://127.0.0.1:4321/tests/fixtures/parity-harness.html';

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: Math.max(...Object.values(SURFACES).map((s) => s[0])) + 60, height: 1100 },
  });
  /* Read by scripts/pixel-parity.js --self-test to prove the comparator can see a change at all. */
  globalThis.__parityInternals = { fineDiff, coarseDiff };
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
  const wanted = only ? only.split(',') : Object.keys(STATES);

  console.log(`demo  ${url}`);
  console.log(`app   ${APP_SHOTS}`);
  console.log(`mode  ${update ? 're-baseline' : 'compare against ' + path.relative(ROOT, BASELINE)}`);
  console.log(
    '\n  Regenerating the app captures? The command in that harness\'s own header cannot do it:\n' +
      '  it captures through matchesGoldenFile, which fails on a differing golden and never\n' +
      '  overwrites. Use --update-goldens:\n' +
      '    SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart --update-goldens\n' +
      '  then run `npm run parity:pixels:update` once, and expect every dark pair to move.\n'
  );

  /* One page for the whole run, resized and reloaded per capture. Neither a fresh context nor a
   * fresh page per pair worked: Chromium tears the previous one down as soon as the next `newPage()`
   * lands, so an explicit close() raced it and threw `Target.disposeBrowserContext` every iteration.
   * Reusing a single page and never closing it is what Playwright supports here; the browser goes at
   * the end. */
  const page = await ctx.newPage();

  const skipped = [];
  for (const state of wanted) {
    if (!STATES[state]) throw new Error(`unknown state "${state}"`);
    for (const surface of Object.keys(SURFACES)) {
      for (const theme of THEMES) {
        const key = `${state}-${surface}-${theme}`;
        const appFile = path.join(APP_SHOTS, `${key}.png`);
        if (!fs.existsSync(appFile)) {
          failures.push(`${key}: no app capture (${path.relative(APP_DIR, appFile)})`);
          continue;
        }

        /* One page for the whole run, resized and reloaded per capture. Neither a fresh context nor a
         * fresh page per pair worked: Chromium tears the previous one down as soon as the next
         * `newPage()` lands, so the explicit close() then raced it and threw
         * `Target.disposeBrowserContext` on every iteration. Reusing a single page and never closing
         * it is the arrangement Playwright actually supports here; the browser is closed at the end. */
      const errors = [];
        page.removeAllListeners('pageerror');
        page.on('pageerror', (e) => errors.push(e.message));
        let demoFile;
        try {
          demoFile = await capture(page, state, surface, theme, url);
          if (errors.length) throw new Error(`page error: ${errors[0]}`);
        } catch (e) {
          failures.push(`${key}: capture failed — ${e.message}`);
          continue;
        }

        const a = decodePng(fs.readFileSync(appFile), `app:${key}`);
        const d = decodePng(fs.readFileSync(demoFile), `demo:${key}`);
        if (a.width !== d.width || a.height !== d.height) {
          failures.push(
            `${key}: size mismatch — app ${a.width}x${a.height}, demo ${d.width}x${d.height}`
          );
          continue;
        }

        const fine = fineDiff(a, d);
        const coarse = coarseDiff(a, d);
        const prev = base[key];
        results[key] = { fine: +fine.toFixed(4), coarse: +coarse.toFixed(4) };

        let verdict = '';
        if (update) {
          verdict = 're-baselined';
        } else if (!STATES[state].comparable) {
          verdict = 'not comparable — reported only';
        } else if (coarse > CEILING) {
          verdict = `FAIL coarse ${pct(coarse)} over the ${pct(CEILING)} ceiling`;
        } else if (prev && coarse - prev.coarse > DRIFT_MARGIN) {
          verdict = `FAIL coarse ${pct(coarse)} vs baseline ${pct(prev.coarse)} (+${pct(coarse - prev.coarse)})`;
        } else if (!prev) {
          verdict = 'NEW — no baseline, run with --update to accept';
        } else {
          verdict = `ok (${coarse >= prev.coarse ? '+' : ''}${pct(coarse - prev.coarse)} vs baseline)`;
        }

        console.log(`${pad(key, 38)} fine ${pad(pct(fine), 8)} coarse ${pad(pct(coarse), 8)} ${verdict}`);
        if (!STATES[state].comparable) skipped.push(`${state}: ${STATES[state].note}`);

        if (verdict.startsWith('FAIL')) {
          const dir = path.join(ROOT, 'docs/parity/diffs');
          fs.mkdirSync(dir, { recursive: true });
          writeDiff(a, d, path.join(dir, `${key}-fine.png`), false);
          writeDiff(a, d, path.join(dir, `${key}-coarse.png`), true);
          failures.push(`${key}: ${verdict}`);
        }
      }
    }
  }

  /* Only the browser is closed. Explicitly closing the context raced Chromium's own teardown once the
   last page was gone, and threw `Target.disposeBrowserContext` instead of exiting cleanly — the
   process then carried on and printed a stack trace *after* a passing run. */
  await browser.close();

  if (update) {
    fs.writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
    console.log(`\nbaseline written: ${Object.keys(results).length} pairs -> ${path.relative(ROOT, BASELINE)}`);
  }

  console.log('');
  if (skipped.length) {
    console.log('Not comparable (the app frames a different thing):');
    for (const s of [...new Set(skipped)]) console.log(`  - ${s}`);
    console.log('');
  }
  if (failures.length) {
    console.error(`${failures.length} problem(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    if (failures.some((f) => f.includes('FAIL'))) {
      console.error('\nLook at docs/parity/diffs/*.png before re-baselining --update.');
      console.error('If the change is intentional, that is the moment to accept it.');
    }
    process.exit(1);
  }
  console.log('pixel parity: no drift beyond the baseline.');
}

async function selfTest() {
  /* A relative gate is only meaningful if it has teeth: if coarseDiff returned a constant, every
   * future redesign would sail through green. So this edits a real design token, re-captures the
   * affected screen, and asserts the coarse metric moves far enough to fail the gate.
   *
   * `assets/demo-tokens.css` is the file to perturb, and that choice is load-bearing. It and
   * `assets/demo-reference.css` declare the same custom properties, and index.html loads the tokens
   * sheet *last*, so it wins the cascade — an edit to demo-reference.css is silently overridden and
   * the gate correctly reports "no drift" on a page that never changed. That cost an hour and three
   * perturbations, each of which "passed" only because the browser never saw them.
   *
   * Needs a written baseline but not a fresh set of app captures, so it can run anywhere the demo
   * does. Run: npm run parity:pixels:self-test */
  const TOKENS = path.join(ROOT, 'assets/demo-tokens.css');
  const key = 'review-prompt-desktop-dark';
  const original = fs.readFileSync(TOKENS, 'utf8');

  /* The dark squares, shifted far enough to be a real visual change rather than an invisible nudge.
   *
   * This is also the honest boundary of the gate, and it is worth stating plainly: #10141B -> #1A2030
   * moves the coarse metric by 0.7pp and is NOT caught, because the 5pp drift margin is wider than
   * the change. That is the intended trade — the gate exists to catch a layout or palette overhaul,
   * not a 10/255 nudge that nobody reviewing the page would notice either. Lowering the tolerance to
   * see it was tried and rejected: at tolerance 8 instead of 24 the phone-dark pair jumps from 7.9%
   * to 83%, so the metric stops measuring design and starts measuring Skia-versus-Chromium
   * rasterisation noise. Sensitivity is bought with false positives, and a gate that cries wolf is
   * ignored. */
  const perturbed = original.split('--sq-d:#10141B;').join('--sq-d:#3A4256;');
  if (perturbed === original) {
    console.error('FAIL: --sq-d:#10141B is not in assets/demo-tokens.css, so nothing was perturbed.');
    console.error('If the app changed its dark square colour, update this self-test along with it.');
    process.exit(1);
  }

  /* The perturbation is expressed as the app's *current* dark square. If the app changes that
   * colour, this fails loudly rather than silently testing nothing — a self-test that stops
   * perturbing anything is worse than no self-test. */
  if (!fs.existsSync(BASELINE) || !JSON.parse(fs.readFileSync(BASELINE, 'utf8'))[key]) {
    console.error(`Self-test needs a baseline entry for ${key}.`);
    console.error('Run `npm run parity:pixels:update` first.');
    process.exit(2);
  }
  const before = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))[key].coarse;
  const url = process.env.PARITY_URL || 'http://127.0.0.1:4321/tests/fixtures/parity-harness.html';

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const page = await ctx.newPage();
  let after;
  try {
    fs.writeFileSync(TOKENS, perturbed);
    await capture(page, 'review-prompt', 'desktop', 'dark', url);
    const demoImg = decodePng(fs.readFileSync(path.join(DEMO_SHOTS, `${key}.png`)), key);
    const appImg = decodePng(fs.readFileSync(path.join(APP_SHOTS, `${key}.png`)), `app:${key}`);
    after = coarseDiff(appImg, demoImg);
  } finally {
    fs.writeFileSync(TOKENS, original);
    await browser.close();
  }

  const delta = after - before;
  console.log(`self-test: coarse vs baseline        ${pct(before)}`);
  console.log(`self-test: --sq-d #10141B -> #3A4256 ${pct(after)}  (${delta >= 0 ? '+' : ''}${pct(delta)})`);
  console.log(`self-test: DRIFT_MARGIN              ${pct(DRIFT_MARGIN)}`);

  if (!(delta > DRIFT_MARGIN)) {
    console.error(
      `\nFAIL: a real token change moved the coarse metric by ${pct(delta)}, inside the` +
        `\n${pct(DRIFT_MARGIN)} drift margin. The gate would call this redesign fine, which is worse` +
        '\nthan not having a gate. Either the tokens sheet is being overridden again, or the margin' +
        '\nis too wide to notice a change of this size.'
    );
    process.exit(1);
  }
  console.log('\nself-test passed: a token change this small would fail the gate.');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
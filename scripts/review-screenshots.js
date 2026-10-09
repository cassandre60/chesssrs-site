/* Side-by-side reviewer for the app's golden screenshots.
 *
 * WHY THIS EXISTS
 * `SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test .../screenshot_capture_test.dart --update-goldens`
 * rewrites the app's captures, and the only way to judge that is to look at 81 PNGs. `git diff` on
 * binaries shows nothing, and opening them one at a time does not scale. This pulls the committed
 * version out of git, pairs it with the regenerated file, and writes one page to read top to bottom:
 * before on the left, after on the right, sorted so the largest visual change is first.
 *
 * It answers the only question that matters — "did the app change, or did something break?" — and it
 * exists because on 2026-10-05 the regeneration turned out to hide real copy drift: the old captures
 * said `REPERTOIRES` / `Chapters of a study` where the current app says `STUDIES` / `Explore study`.
 * Nobody noticed for two days because nothing ever put the two versions side by side.
 *
 * Requires only git and Node. No Flutter, no image library.
 *
 *   node scripts/review-screenshots.js                 # serve on :4777 and print the URL
 *   node scripts/review-screenshots.js --port 5000
 *   node scripts/review-screenshots.js --build-only     # write the files, do not serve
 *   node scripts/review-screenshots.js --against <ref> # compare against a ref other than HEAD
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const APP_DIR =
  require('./resolve-app-dir').resolveAppDir() ||
  process.env.CHESSSRS_APP_DIR ||
  path.join(os.homedir(), 'Desktop/Github/ChessSRS');
const SHOTS_REL = 'docs/screenshots';
const OUT = path.join(os.homedir(), '.cache/chesssrs-screenshot-review');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(arg('port', 4777));
const REF = arg('against', 'HEAD');
const BUILD_ONLY = argv.includes('--build-only');

const git = (...args) =>
  execFileSync('git', args, { cwd: APP_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Screens whose change is noise rather than design, so the reviewer can say so out loud. */
const NOT_A_DEMO_SCREEN = /^(analysis|analysis-hub|editor|explorer-settings|import-dialog)/;

function main() {
  if (!fs.existsSync(path.join(APP_DIR, '.git'))) {
    console.error(`${APP_DIR} is not a git repository. Set CHESSSRS_APP_DIR.`);
    process.exit(2);
  }

  const changed = git('diff', '--name-only', REF, '--', SHOTS_REL).trim().split('\n').filter(Boolean);
  if (!changed.length) {
    console.log(`No screenshots differ from ${REF}. Nothing to review.`);
    console.log(`(If you just regenerated them, the change is uncommitted — compare against the`);
    console.log(` branch tip with:  node scripts/review-screenshots.js --against HEAD`);
    process.exit(0);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'old'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'new'), { recursive: true });

  const cards = [];
  let demoChanged = 0;

  for (const rel of changed) {
    const name = path.basename(rel);
    const live = path.join(APP_DIR, rel);
    if (!fs.existsSync(live)) continue;

    // The committed version, as a blob rather than a checkout — the app tree is left untouched.
    let before = 0;
    try {
      const buf = execFileSync('git', ['show', `${REF}:${rel}`], {
        cwd: APP_DIR,
        maxBuffer: 64 * 1024 * 1024,
      });
      fs.writeFileSync(path.join(OUT, 'old', name), buf);
      before = buf.length;
    } catch {
      /* new file, no "before" */
    }
    fs.copyFileSync(live, path.join(OUT, 'new', name));

    const after = fs.statSync(live).size;
    const pct = before ? ((after - before) / before) * 100 : 0;
    const isDemo = !NOT_A_DEMO_SCREEN.test(name);
    if (isDemo) demoChanged++;
    cards.push({ name, rel, before, after, pct, isDemo, flag: kind(pct) });
  }

  /* Biggest first: file size is a crude proxy for how much of the frame changed, and it reliably
     surfaces the captures worth a human's attention at the top of a long page. */
  cards.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.name.localeCompare(b.name));

  fs.writeFileSync(path.join(OUT, 'index.html'), page(cards, REF));
  console.log(`${cards.length} screenshot(s) differ from ${REF} -> ${OUT}/index.html`);
  console.log(`  of which ${demoChanged} are screens this site demos`);

  if (BUILD_ONLY) return;
  serve();
}

function kind(pct) {
  const a = Math.abs(pct);
  return a > 12 ? 'big' : a > 4 ? 'mid' : 'small';
}

function page(cards, ref) {
  const body = cards
    .map(
      (c) => `<figure class="card ${c.flag} ${c.isDemo ? 'demo' : 'other'}">
<figcaption><b>${esc(c.name.replace(/-[a-z-]*\.png$/, ''))}</b>
<span class="w">${esc(c.name.replace(/\.png$/, '').replace(/^[a-z-]+-/, ''))}</span>
<span class="d ${c.flag}">${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(0)}%</span></figcaption>
<div class="pair">
  <figure><img loading="lazy" src="old/${esc(c.name)}" alt="before"><figcaption>BEFORE &middot; ${esc(ref)}</figcaption></figure>
  <span class="arrow">&rarr;</span>
  <figure><img loading="lazy" src="new/${esc(c.name)}" alt="after"><figcaption>AFTER &middot; regenerated</figcaption></figure>
</div>
${c.isDemo ? '' : '<p class="note">Not a screen this site demos.</p>'}
</figure>`
    )
    .join('');

  return `<!doctype html><meta charset="utf-8">
<title>Screenshot review — ${cards.length} changed</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0d0f13;color:#e6e8eb;font:15px/1.55 system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:#0d0f13f2;backdrop-filter:blur(12px);
  padding:18px 24px;border-bottom:1px solid #ffffff1f}
h1{margin:0 0 6px;font-size:20px}
header p{margin:0 0 10px;color:#9ba2ae;font-size:14px;max-width:78ch}
header b{color:#e6e8eb}
.tools{display:flex;gap:8px;flex-wrap:wrap}
button{background:#1b1f27;color:#e6e8eb;border:1px solid #ffffff2e;border-radius:8px;
  padding:6px 12px;cursor:pointer;font:inherit;font-size:13px}
button:hover{background:#262c37}
.wrap{padding:24px;display:grid;gap:26px}
.card{background:#151920;border:1px solid #ffffff17;border-radius:14px;padding:16px;margin:0}
.card.demo{border-left:3px solid #3b82f6}
.card>figcaption{display:flex;gap:10px;align-items:baseline;margin-bottom:12px;font-size:15px}
.w{color:#9ba2ae;font-size:13px}
.d{margin-left:auto;font-variant-numeric:tabular-nums;font-size:13px;padding:2px 9px;border-radius:99px}
.d.big{background:#7f1d1d;color:#fecaca}.d.mid{background:#78350f;color:#fde68a}.d.small{background:#14532d;color:#bbf7d0}
.pair{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center}
.pair figure{margin:0}
.pair img{width:100%;border-radius:8px;background:#000;display:block}
.pair figcaption{color:#9ba2ae;font-size:12px;margin-top:6px;text-align:center}
.arrow{color:#6b7280;font-size:20px}
.note{margin:10px 0 0;color:#6b7280;font-size:12px}
body.only-demo .card.other{display:none}
body.only-big .card:not(.big){display:none}
@media(max-width:820px){.pair{grid-template-columns:1fr}.arrow{display:none}}
</style>
<header>
<h1>App screenshots — ${cards.length} changed vs <code>${esc(ref)}</code></h1>
<p>Left is what is committed. Right is what the app renders now. Biggest file-size change first, because
that is the cheapest proxy for "how much of this frame moved". Regenerate with
<b>fvm flutter test test/view/screenshot_capture_test.dart --update-goldens</b> — the command in that
harness's own header cannot do it, since <b>matchesGoldenFile</b> fails on a differing golden instead
of overwriting it.</p>
<div class="tools">
<button onclick="document.body.classList.toggle('only-demo')">Only screens this site demos</button>
<button onclick="document.body.classList.toggle('only-big')">Biggest changes only (&gt;12%)</button>
<button onclick="document.body.classList.remove('only-demo','only-big')">Show all</button>
</div>
</header>
<div class="wrap">${body}</div>
`;
}

function serve() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const file = path.join(OUT, rel === '' ? 'index.html' : rel);
    // Never serve outside the output directory.
    if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\nReview at:  http://127.0.0.1:${PORT}/`);
    console.log('Ctrl-C to stop.');
  });
}

main();
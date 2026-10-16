#!/usr/bin/env node
/**
 * scripts/sync-docs.js
 *
 * Dynamically reads the ChessSRS app repository's Markdown documents
 * (ARCHITECTURE.md, SPEC.md, QUALITY.md, TEST_STRATEGY.md, PRODUCT.md,
 * ChessSRS Scheduling Architecture.md, docs/review-*, docs/domain-model.md,
 * docs/pgn-import.md, docs/setting_dev_env.md)
 * and generates comprehensive, rich, fully styled documentation pages for the website.
 *
 * Flags:
 *   node scripts/sync-docs.js          # generates / updates doc pages in docs/
 *   node scripts/sync-docs.js --check  # asserts zero documentation drift against app repo
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveAppDir, pubspecVersion } = require('./resolve-app-dir.js');

const SITE = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const CONFIG_PATH = path.join(SITE, 'site.config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { githubOwner: OWNER, appRepo: APP_REPO, siteRepo: SITE_REPO } = config;

const APP_URL = `https://github.com/${OWNER}/${APP_REPO}`;
const SITE_ROOT = `https://${OWNER}.github.io/${SITE_REPO}`;

const appDir = resolveAppDir();
if (!appDir) {
  if (CHECK) {
    console.warn('[sync-docs] App repo not found — skipping sync-docs --check. Set CHESSSRS_APP_DIR to enable.');
    process.exit(0);
  } else {
    console.error('[sync-docs] Could not resolve app directory. Please set CHESSSRS_APP_DIR or place ChessSRS alongside this repository.');
    process.exit(1);
  }
}

const appVersion = pubspecVersion(appDir);

function readAppFile(rel) {
  const p = path.join(appDir, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/* ------------------------------------------------------------------ Docs Navigation Tree */
const DOC_SECTIONS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'index', title: 'Documentation Hub', path: 'index.html', kicker: 'Overview', desc: 'Complete technical documentation, architecture specs, and algorithms for ChessSRS.' },
      { id: 'domain-model', title: 'Domain Model & Schemas', path: 'domain-model.html', kicker: 'Domain', desc: 'Studies, Chapters, Variations, MoveNodes, RepertoireDecisions, and SQLite schemas.' },
    ],
  },
  {
    group: 'Architecture & Engineering',
    items: [
      { id: 'architecture', title: 'System Architecture', path: 'architecture.html', kicker: 'Foundations', desc: 'Lichess Mobile GPL-3.0 base, pure domain boundaries, Riverpod 3.x, and local persistence.' },
      { id: 'specifications', title: 'System Invariants (SPEC)', path: 'specifications.html', kicker: 'Invariants', desc: 'The 30+ non-negotiable formal system invariants governing correctness and zero-loss operations.' },
      { id: 'testing-strategy', title: 'Testing & Quality Gates', path: 'testing-strategy.html', kicker: 'Quality', desc: 'Deterministic gate hierarchy, anti-weakening tripwires (G08), and mutation verification.' },
    ],
  },
  {
    group: 'Algorithms & Training Engine',
    items: [
      { id: 'fsrs-algorithm', title: 'FSRS Spaced Repetition', path: 'fsrs-algorithm.html', kicker: 'Algorithms', desc: 'FSRS-4.5/5 DSR power-law forgetting curve, pure binary recall grading, and target retention math.' },
      { id: 'graph-coordinator', title: 'Graph-Aware Coordinator', path: 'graph-coordinator.html', kicker: 'Algorithms', desc: 'DAG tree traversal, transposition state sharing, lapse contagion decay, and intra-session loops.' },
      { id: 'pgn-pipeline', title: 'PGN & Study Ingestion', path: 'pgn-pipeline.html', kicker: 'Pipeline', desc: 'AST parsing of recursive variations, NAG annotations, move normalization, and error quarantine.' },
    ],
  },
  {
    group: 'Development & Operations',
    items: [
      { id: 'developer-guide', title: 'Developer Guide', path: 'developer-guide.html', kicker: 'Operations', desc: 'Local environment setup, FVM, build_runner codegen, testing budgets, and runtime validation.' },
    ],
  },
];

const ALL_DOC_ITEMS = DOC_SECTIONS.flatMap((g) => g.items);

/* ------------------------------------------------------------------ HTML Page Shell */
function renderDocShell({ id, title, kicker, desc, sourceRel, bodyHtml, tocList = [] }) {
  const currentIndex = ALL_DOC_ITEMS.findIndex((item) => item.id === id);
  const prevItem = currentIndex > 0 ? ALL_DOC_ITEMS[currentIndex - 1] : null;
  const nextItem = currentIndex < ALL_DOC_ITEMS.length - 1 ? ALL_DOC_ITEMS[currentIndex + 1] : null;

  const sidebarNavHtml = DOC_SECTIONS.map((g) => `
    <div>
      <div class="doc-nav-group-title">${g.group}</div>
      <div class="doc-nav-list">
        ${g.items
          .map(
            (item) => `
          <a class="doc-nav-link ${item.id === id ? 'active' : ''}" href="${item.path}">
            <span>${item.title}</span>
            ${item.id === id ? '<span class="doc-nav-badge">Current</span>' : ''}
          </a>`
          )
          .join('\n')}
      </div>
    </div>
  `).join('\n');

  const tocHtml = tocList.length
    ? `
    <aside class="doc-toc-aside" aria-label="Table of contents">
      <div class="doc-toc-title">On This Page</div>
      <div class="doc-toc-list">
        ${tocList.map((t) => `<div class="doc-toc-item"><a href="#${t.id}">${t.title}</a></div>`).join('\n')}
      </div>
    </aside>`
    : '';

  const sourceMetaHtml = sourceRel
    ? `
    <div class="doc-meta-bar">
      <div class="doc-meta-item">
        <strong>Source in app repo:</strong>
        <a href="${APP_URL}/blob/main/${sourceRel}" target="_blank" rel="noopener"><code>${sourceRel}</code></a>
      </div>
      <div class="doc-meta-item">
        <strong>App version:</strong> <code>v${appVersion}</code>
      </div>
      <div class="doc-meta-item">
        <strong>Licence:</strong> <code>GPL-3.0</code>
      </div>
    </div>`
    : `
    <div class="doc-meta-bar">
      <div class="doc-meta-item">
        <strong>App version:</strong> <code>v${appVersion}</code>
      </div>
      <div class="doc-meta-item">
        <strong>Source repo:</strong>
        <a href="${APP_URL}" target="_blank" rel="noopener"><code>ChessSRS</code></a>
      </div>
      <div class="doc-meta-item">
        <strong>Licence:</strong> <code>GPL-3.0</code>
      </div>
    </div>`;

  const paginationHtml = `
    <nav class="doc-pagination" aria-label="Document pagination">
      ${
        prevItem
          ? `<a class="doc-page-card prev" href="${prevItem.path}">
              <span class="doc-page-dir">← Previous</span>
              <span class="doc-page-label">${prevItem.title}</span>
            </a>`
          : '<div></div>'
      }
      ${
        nextItem
          ? `<a class="doc-page-card next" href="${nextItem.path}">
              <span class="doc-page-dir">Next →</span>
              <span class="doc-page-label">${nextItem.title}</span>
            </a>`
          : '<div></div>'
      }
    </nav>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} — ChessSRS Documentation</title>
<meta name="description" content="${desc}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F5F3EF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F0D0B" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${SITE_ROOT}/docs/${id === 'index' ? '' : id + '.html'}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<meta property="og:type" content="article">
<meta property="og:title" content="${title} — ChessSRS Documentation">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE_ROOT}/docs/${id === 'index' ? '' : id + '.html'}">
<meta property="og:image" content="${SITE_ROOT}/assets/og.jpg">
<link rel="stylesheet" href="../assets/demo-tokens.css">
<link rel="stylesheet" href="../assets/demo-reference.css">
<link rel="stylesheet" href="../styles.css">
<link rel="stylesheet" href="docs.css">
<script>document.documentElement.classList.add("js");try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body class="doc-page">
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-dl" viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/></symbol>
<symbol id="i-th" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.900 4.900l1.400 1.400m11.400 11.400 1.400 1.400M2 12h2m16 0h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/></symbol>
<symbol id="i-mn" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-lg" viewBox="0 0 22 22">
  <defs><pattern id="h-brand-doc" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".9" height="2.4" fill="currentColor"/></pattern></defs>
  <rect x=".75" y=".75" width="20.5" height="20.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="11" y="1.5" width="9.5" height="9.5" fill="url(#h-brand-doc)"/>
  <rect x="1.5" y="11" width="9.5" height="9.5" fill="url(#h-brand-doc)"/>
</symbol>
</defs></svg>
<a class="mk-sr" href="#main">Skip to main content</a>

<header class="hd" id="top"><div class="c">
  <a class="logo" href="../index.html" aria-label="ChessSRS home"><svg class="ic" aria-hidden="true" style="width:22px;height:22px"><use href="#i-lg"/></svg>ChessSRS</a>
  <nav class="nv" aria-label="Primary">
    <a href="../index.html">Home</a>
    <a href="index.html" style="font-weight:600;color:var(--ac)">Docs</a>
    <a href="../index.html#demo">Live Demo</a>
    <a href="../index.html#how">How it works</a>
    <a href="${APP_URL}" target="_blank" rel="noopener">GitHub</a>
    <button class="ib" id="theme" type="button" aria-label="Switch colour theme"><svg class="ic" aria-hidden="true"><use href="#i-th"/></svg></button>
    <a class="btn p sm" href="../index.html#download">Download</a>
    <details class="mm"><summary class="ib" aria-label="Menu"><svg class="ic" aria-hidden="true"><use href="#i-mn"/></svg></summary><div>
      <a href="../index.html">Home</a>
      <a href="index.html">Documentation Hub</a>
      <a href="architecture.html">Architecture</a>
      <a href="fsrs-algorithm.html">FSRS Algorithm</a>
      <a href="graph-coordinator.html">Graph Coordinator</a>
      <a href="specifications.html">Specifications & Invariants</a>
      <a href="${APP_URL}" target="_blank" rel="noopener">Source Code</a>
      <a href="../index.html#download">Download</a>
    </div></details>
  </nav>
</div></header>

<div class="doc-wrap">
  <nav class="doc-sidebar" aria-label="Documentation navigation">
    <div class="doc-sidebar-nav">
      ${sidebarNavHtml}
    </div>
  </nav>

  <main class="doc-article" id="main">
    <div class="doc-breadcrumb">
      <a href="../index.html">Home</a> / <a href="index.html">Documentation</a> / <span>${title}</span>
    </div>
    <span class="doc-kicker">${kicker}</span>
    <h1 class="doc-title">${title}</h1>
    <p class="doc-lede">${desc}</p>
    ${sourceMetaHtml}
    ${bodyHtml}
    ${paginationHtml}
  </main>

  ${tocHtml}
</div>

<footer class="ft" id="footer"><div class="c fb">
  <span>© 2026 ChessSRS. Free & open-source under GPL-3.0. Built on the Lichess Mobile foundation.</span>
  <div style="display:flex;gap:18px">
    <a href="index.html">Documentation</a>
    <a href="../credits.html">Credits & Licences</a>
    <a href="../privacy.html">Privacy Policy</a>
  </div>
</div></footer>
<script>
(() => {
  const root = document.documentElement;
  const themeBtn = document.getElementById("theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    });
  }
})();
</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ Page Content Builders */

function buildIndexPage() {
  const toc = [
    { id: 'why-chesssrs', title: 'Why ChessSRS' },
    { id: 'documentation-matrix', title: 'Documentation Matrix' },
    { id: 'core-principles', title: 'Engineering Principles' },
    { id: 'learning-paths', title: 'Reading Paths' },
  ];

  const cardsHtml = DOC_SECTIONS.flatMap((g) => g.items)
    .filter((item) => item.id !== 'index')
    .map(
      (item) => `
    <a class="doc-hub-card" href="${item.path}">
      <div>
        <div class="doc-hub-card-kicker">${item.kicker}</div>
        <div class="doc-hub-card-title">${item.title}</div>
        <div class="doc-hub-card-desc">${item.desc}</div>
      </div>
      <div class="doc-hub-card-footer">Read documentation →</div>
    </a>`
    )
    .join('\n');

  const bodyHtml = `
    <section id="why-chesssrs">
      <h2>Why ChessSRS?</h2>
      <p>
        Most chess opening trainers query an engine evaluation bar to decide if your move was acceptable.
        <strong>ChessSRS asks what you prepared.</strong> Your repertoire is the authoritative answer key,
        including intentional sidelines, gambits, and traps set for natural opponent mistakes.
      </p>
      <p>
        Standard flashcard algorithms (such as SM-2 or naive Leitner boxes) were designed for isolated vocabulary cards.
        When applied to chess move trees, they fail catastrophically: moves depend strictly on prior moves,
        transpositions reconnect different lines to the same board state, and an opponent blunder branches into new opportunities.
        ChessSRS bridges this gap by combining the empirical <strong>FSRS (Free Spaced Repetition Scheduler)</strong>
        with a custom <strong>Graph-Aware Review Coordinator</strong>.
      </p>

      <div class="callout spec">
        <div class="callout-title">Architectural Guarantee (INV-LOCAL-FIRST)</div>
        <p>The entire critical path—from move input, dartchess validation, repertoire lookup, SRS schedule update,
        to board animation—executes 100% locally in-memory and in SQLite on your device. Zero servers, zero telemetry, zero account required.</p>
      </div>
    </section>

    <section id="documentation-matrix">
      <h2>Documentation Matrix</h2>
      <p>Explore the complete architectural and mathematical specifications of ChessSRS:</p>
      <div class="doc-hub-grid">
        ${cardsHtml}
      </div>
    </section>

    <section id="core-principles">
      <h2>Engineering & Architectural Principles</h2>
      <p>ChessSRS is engineered under strict invariants designed to ensure software longevity and correctness:</p>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Principle</th>
              <th>Rule</th>
              <th>Implementation Mechanism</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Pure Domain</strong></td>
              <td>Zero UI or database dependencies in chess logic.</td>
              <td>Isolated in <code>lib/src/domain/</code>, verified by automated banned-API gate G03.</td>
            </tr>
            <tr>
              <td><strong>Single Chess Representation</strong></td>
              <td><code>dartchess</code> is the sole chess geometry engine.</td>
              <td>Never introduce competing chess parsers or custom move representations.</td>
            </tr>
            <tr>
              <td><strong>Variation Preservation</strong></td>
              <td>User variations are never flattened or pruned on import.</td>
              <td>Multi-chapter PGN tree parser with recursive annotation branches (RAV).</td>
            </tr>
            <tr>
              <td><strong>Deterministic Clocks</strong></td>
              <td>Scheduling calculations must never read wall-clock time directly.</td>
              <td>Injected <code>Clock</code> interfaces ensure 100% reproducible time tests.</td>
            </tr>
            <tr>
              <td><strong>Anti-Weakening Tripwires</strong></td>
              <td>No deleted assertions, skipped tests, or loosened tolerances.</td>
              <td>Gate G08 diffs git commits to reject test-weakening patterns before merge.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="learning-paths">
      <h2>Recommended Reading Paths</h2>
      <p>Select the path best aligned with your exploration goals:</p>
      <ul>
        <li><strong>For Chess Learners & Players:</strong> Start with <a href="fsrs-algorithm.html">FSRS Spaced Repetition</a> to understand review intervals, and <a href="graph-coordinator.html">Graph-Aware Coordinator</a> to see how transpositions and mistakes are handled.</li>
        <li><strong>For Software Architects:</strong> Read <a href="architecture.html">System Architecture</a> to inspect layer boundaries and Lichess mobile fork mechanics, followed by <a href="domain-model.html">Domain Model & Schemas</a>.</li>
        <li><strong>For Contributors & Developers:</strong> Follow the <a href="developer-guide.html">Developer Guide</a> to set up the FVM toolchain, run codegen, and pass the <a href="testing-strategy.html">Testing & Quality Gates</a>.</li>
      </ul>
    </section>
  `;

  return renderDocShell({
    id: 'index',
    title: 'ChessSRS Knowledge Base',
    kicker: 'Documentation Hub',
    desc: 'The complete technical reference manual for ChessSRS: architecture, spaced repetition mathematics, graph traversal, and formal specifications.',
    sourceRel: 'ARCHITECTURE.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildArchitecturePage() {
  const toc = [
    { id: 'foundation', title: 'The Foundation Reset' },
    { id: 'layer-boundaries', title: 'Layer Boundaries' },
    { id: 'boundary-invariants', title: 'Boundary Invariants' },
    { id: 'subsystem-cuts', title: 'Subsystem Cuts & Retentions' },
    { id: 'persistence', title: 'Local Persistence (SQLite)' },
  ];

  const bodyHtml = `
    <section id="foundation">
      <h2>1. The Foundation Reset</h2>
      <p>
        ChessSRS is built on a direct fork of <strong>Lichess Mobile</strong> (<a href="https://github.com/lichess-org/mobile" target="_blank" rel="noopener">lichess-org/mobile</a>), licensed under <strong>GNU General Public License v3.0 (GPL-3.0)</strong>.
      </p>
      <p>
        The previous standalone Flutter prototype was permanently archived at git tag <code>legacy/pre-reset</code>. It serves as reference material only: the product contracts and domain behavior are implemented cleanly within the Lichess Mobile architectural patterns.
      </p>
      <p>
        Lichess Mobile provides a battle-tested foundation: high-performance <code>chessground</code> board rendering with 60fps animations, rock-solid move legality validation via <code>dartchess</code>, native audio synthesis, and proven Riverpod state-management patterns. On top of this foundation, ChessSRS replaces online multiplayer with a local-first spaced repetition repertoire engine.
      </p>
    </section>

    <section id="layer-boundaries">
      <h2>2. Layer Boundaries & Component Responsibilities</h2>
      <p>The codebase is structured into four strict architectural tiers:</p>

      <div class="code-block">
        <div class="code-header"><span>Architectural Layer Dependency Flow</span><span>ASCII Diagram</span></div>
        <pre tabindex="0"><code>┌────────────────────────────────────────────────────────────┐
│ Presentation — Lichess Mobile shell (Flutter + Riverpod)    │
│   Review screen · Scope drawer · Library sheet · Settings  │
└──────────────────────────┬─────────────────────────────────┘
                           │ talks only to application providers
┌──────────────────────────▼─────────────────────────────────┐
│ Application — Riverpod providers/services orchestrating    │
│   use-cases (import study, start review, submit move)      │
└──────────────────────────┬─────────────────────────────────┘
                           │ repository interfaces only
┌──────────────────────────▼─────────────────────────────────┐
│ DOMAIN (pure Dart, zero Flutter/chessground imports)        │
│   Study · Chapter · RepertoireDecision · ReviewState       │
│   ReviewSession engine · FSRS Scheduler contract           │
└──────────────────────────┬─────────────────────────────────┘
                           │ adapters only
┌──────────────────────────▼─────────────────────────────────┐
│ Infrastructure — Lichess-derived:                          │
│   dartchess (rules, FEN, SAN, PGN) · chessground widgets   │
│   sqflite local DB · settings/preferences · file import   │
│   (no network on any critical path)                        │
└────────────────────────────────────────────────────────────┘</code></pre>
      </div>

      <h3>Detailed Responsibilities</h3>
      <ul>
        <li><strong>Domain Layer (Pure Dart):</strong> Resides in <code>lib/src/domain/</code>. Encapsulates all chess repertoire tree logic, decision scheduling, memory models, and state transitions. Absolutely zero imports of Flutter UI widgets, Riverpod, or SQLite. Testable without starting a Flutter widget engine.</li>
        <li><strong>Application Layer:</strong> Riverpod controllers and services (such as <code>ReviewController</code>, <code>StudyController</code>). Orchestrates user actions, translates domain states into view-ready models, and coordinates local storage writes.</li>
        <li><strong>Presentation Layer:</strong> Flutter widgets implementing the custom "Diagram" aesthetic. Clean typographic hierarchy, zero distraction, responsive layouts adapting seamlessly from mobile phones to tablets and desktops.</li>
        <li><strong>Infrastructure Layer:</strong> Platform adapters, SQLite database drivers via <code>sqflite</code>, file system I/O, and the Stockfish UCI engine integration.</li>
      </ul>
    </section>

    <section id="boundary-invariants">
      <h2>3. Non-Negotiable Boundary Invariants</h2>
      <div class="callout spec">
        <div class="callout-title">INV-PURE-DOMAIN</div>
        <p>Our domain code contains pure Dart entities and business algorithms. Zero imports of <code>package:flutter/...</code>, <code>chessground</code>, or <code>sqflite</code>. Mechanically enforced by automated static analysis in gate G03 (<code>scripts/gates/banned_apis_check.py</code>).</p>
      </div>

      <div class="callout spec">
        <div class="callout-title">INV-SINGLE-CHESS-REP</div>
        <p><code>dartchess</code> is the sole chess rules and position engine. Do not introduce competing chess libraries or re-implement move generation. The domain consumes dartchess core types (<code>Position</code>, <code>Move</code>, <code>San</code>) through thin adapters; presentation consumes <code>chessground</code>.</p>
      </div>

      <div class="callout spec">
        <div class="callout-title">INV-LOCAL-FIRST</div>
        <p>The entire critical user loop—making a move, validating legality, checking repertoire expectations, updating FSRS memory states, and updating the board—executes in memory and local SQLite. Network access is completely absent from this path.</p>
      </div>
    </section>

    <section id="subsystem-cuts">
      <h2>4. Subsystem Cuts & Retentions</h2>
      <p>
        To transform Lichess Mobile into a quiet, focused training sanctuary, non-repertoire systems were cleanly removed per <code>CUT_PROPOSALS.md</code>:
      </p>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Subsystem</th>
              <th>Status</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Online multiplayer / matchmaking / lobby</td>
              <td><strong>Removed</strong></td>
              <td>Offline repertoire recall does not require real-time games.</td>
            </tr>
            <tr>
              <td>TV, streaming, chat & social feed</td>
              <td><strong>Removed</strong></td>
              <td>Eliminates distraction and social anxiety; reinforces calm training.</td>
            </tr>
            <tr>
              <td>Leaderboards, badges & XP gamification</td>
              <td><strong>Removed</strong></td>
              <td>Promotes intrinsic recall habit over artificial streak inflation.</td>
            </tr>
            <tr>
              <td>Lichess Puzzles & Puzzle Storm</td>
              <td><strong>Removed</strong></td>
              <td>App focuses exclusively on user-curated opening repertoires.</td>
            </tr>
            <tr>
              <td>Chessground board renderer & animations</td>
              <td><strong>Retained & Adapted</strong></td>
              <td>World-class touch responsiveness, piece gestures, and board visuals.</td>
            </tr>
            <tr>
              <td>dartchess rules & move validator</td>
              <td><strong>Retained</strong></td>
              <td>High-performance, memory-safe chess representation.</td>
            </tr>
            <tr>
              <td>Audio synthesizer & piece sound effects</td>
              <td><strong>Retained</strong></td>
              <td>Provides immediate tactile feedback on move recall.</td>
            </tr>
            <tr>
              <td>Stockfish engine integration</td>
              <td><strong>Retained (Local Analysis)</strong></td>
              <td>Enables on-device deep exploration without network dependency.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="persistence">
      <h2>5. Local Persistence (SQLite / Drift)</h2>
      <p>
        Repertoire content and review histories are persisted in a local SQLite database (managed via <code>sqflite</code> and drift schema migrations):
      </p>
      <ul>
        <li><strong>Incremental writes (INV-002):</strong> Answering a move writes the updated <code>ReviewState</code> and records a <code>ReviewEvent</code> row only. The repertoire move tree is never serialized or rewritten on every move.</li>
        <li><strong>Crash consistency (INV-001):</strong> A graded review answer is committed within an atomic database transaction. Closing or killing the process immediately after a move preserves the exact review state.</li>
        <li><strong>Deduplication on import (INV-003):</strong> PGN trees are hashed canonically. Re-importing the same study updates metadata without duplicating decisions or corrupting existing intervals.</li>
      </ul>
    </section>
  `;

  return renderDocShell({
    id: 'architecture',
    title: 'System Architecture & Foundation',
    kicker: 'Architecture',
    desc: 'The technical design of ChessSRS: Lichess Mobile GPL-3.0 base, pure domain boundaries, Riverpod 3.x, and local persistence.',
    sourceRel: 'ARCHITECTURE.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildFsrsAlgorithmPage() {
  const toc = [
    { id: 'why-fsrs', title: 'Why FSRS for Chess' },
    { id: 'dsr-model', title: 'The DSR Memory Model' },
    { id: 'equations', title: 'Mathematical Formulation' },
    { id: 'binary-grading', title: 'Pure Binary Rating (D015)' },
    { id: 'stability-transitions', title: 'Stability & Difficulty Updates' },
  ];

  const bodyHtml = `
    <section id="why-fsrs">
      <h2>1. Why FSRS for Chess Openings?</h2>
      <p>
        Traditional spaced repetition software relies on <strong>SM-2</strong> (developed by SuperMemo in 1987) or basic exponential ladders. In flashcard vocabulary learning, SM-2 treats each word as an independent card with a single "ease factor".
      </p>
      <p>
        In chess openings, SM-2 fails due to three fundamental flaws:
      </p>
      <ol>
        <li><strong>Conflation of Difficulty and Stability:</strong> A move can be intrinsically difficult (counter-intuitive quiet move) while currently being very stable in your memory. SM-2's single scalar collapses these dimensions.</li>
        <li><strong>Catastrophic Lapse Resets:</strong> If you forget move 8 of a sharp Sicilian line, SM-2 resets the interval to 1 day. In reality, your brain does not suffer total amnesia; with modern memory models, previous exposures provide residual stability.</li>
        <li><strong>Arbitrary Target Retention:</strong> SM-2 cannot answer: <em>"How frequently must I review this line so that I have a 95% probability of remembering it in tomorrow's tournament game?"</em></li>
      </ol>
      <p>
        ChessSRS solves this by adopting the <strong>Free Spaced Repetition Scheduler (FSRS-4.5 / FSRS-5)</strong> continuous power-law model.
      </p>
    </section>

    <section id="dsr-model">
      <h2>2. The DSR (Difficulty, Stability, Retrievability) Model</h2>
      <p>
        FSRS models human memory using three continuous variables:
      </p>
      <ul>
        <li><strong>Retrievability ($R \\in [0, 1]$):</strong> The probability that you will successfully recall the correct repertoire move right now. Immediately after reviewing a move, $R = 1.0$. Over time $t$ (days), $R$ decays following a power-law curve.</li>
        <li><strong>Stability ($S \\ge 0.1$):</strong> The durability of memory, defined as the time in days required for Retrievability to decay from 100% to 90% ($R(S) = 0.90$). Higher stability means slower memory decay.</li>
        <li><strong>Difficulty ($D \\in [1, 10]$):</strong> The intrinsic complexity of the chess decision. Tactically natural moves have lower difficulty ($D \\approx 2$); subtle positional moves or pawn breaks have higher difficulty ($D \\approx 8$).</li>
      </ul>
    </section>

    <section id="equations">
      <h2>3. Mathematical Formulation</h2>
      <p>
        FSRS uses a continuous power-law forgetting curve derived from empirical cognitive memory datasets (>700M reviews):
      </p>

      <div class="math-card">
        <div class="callout-title" style="color:var(--ac)">Power-Law Retrievability Equation</div>
        <div class="math-display" tabindex="0">
          R(t, S) = (1 + FACTOR · (t / S))^(-w)
        </div>
        <div class="math-legend">
          Where:
          <br>• <strong>t</strong> = elapsed time in days since last active recall review
          <br>• <strong>S</strong> = memory stability in days
          <br>• <strong>FACTOR</strong> = (0.9^(-1/w) - 1), ensuring that R(S, S) ≡ 0.90
          <br>• <strong>w</strong> = power-law decay parameter (canonical default = 0.5)
        </div>
      </div>

      <h3>Dynamic Interval Calculation for Target Retention</h3>
      <p>
        Given a player's desired retention $r_{\text{target}}$ (configured in Settings, bounded between 0.70 and 0.97 per <code>INV-RETENTION-BOUNDS</code>), the exact due interval $I$ in days is solved analytically:
      </p>

      <div class="math-card">
        <div class="callout-title" style="color:var(--ac)">Optimal Review Interval Equation</div>
        <div class="math-display" tabindex="0">
          I(r, S) = (S / FACTOR) · (r^(-1/w) - 1)
        </div>
        <div class="math-legend">
          For target retention <strong>r = 0.90</strong>, the interval is exactly equal to stability: <strong>I(0.90, S) = S</strong>.
          <br>For target retention <strong>r = 0.95</strong>, reviews occur earlier: <strong>I(0.95, S) ≈ 0.47 · S</strong>.
        </div>
      </div>
    </section>

    <section id="binary-grading">
      <h2>4. Pure Binary Rating (Decision D015)</h2>
      <p>
        Canonical FSRS uses four buttons: <code>Again (1)</code>, <code>Hard (2)</code>, <code>Good (3)</code>, <code>Easy (4)</code>. In vocabulary flashcards, answer latency is often used to approximate ease.
      </p>
      <div class="callout warning">
        <div class="callout-title">The Chess Latency Fallacy</div>
        <p>In chess, long think times represent <strong>disciplined tournament verification</strong>, double-checking tactical lines and avoiding blunders. Penalizing think time creates timer anxiety and trains reckless blitzing habits!</p>
      </div>
      <p>
        Therefore, ChessSRS strictly uses <strong>Pure Binary FSRS</strong>:
      </p>
      <ul>
        <li><strong>Again (Rating 1):</strong> Incorrect move played, hint requested, or pass. The position is registered as a lapse, stability undergoes a controlled haircut, and the card is re-queued in the intra-session buffer.</li>
        <li><strong>Good (Rating 3):</strong> Correct move played on first commit, regardless of whether it took 2 seconds or 60 seconds of calculation.</li>
      </ul>
      <p>
        Think latency (<code>latencyEmaMs</code>) is tracked strictly for retrospective analytics and is completely firewalled from scheduling math.
      </p>
    </section>

    <section id="stability-transitions">
      <h2>5. Stability & Difficulty Updates</h2>
      <h3>On Successful Recall (Good, G = 3)</h3>
      <p>Stability grows proportionally to difficulty, current stability, and retrieval effort:</p>
      <div class="math-card">
        <div class="math-display" tabindex="0">
          S'(D, S, R) = S · (1 + e^(w8) · (11 - D) · S^(-w9) · (e^(w10 · (1 - R)) - 1))
        </div>
        <div class="math-legend">
          Notice the term <strong>(1 - R)</strong>: retrieving a move when Retrievability is low (high retrieval effort) yields a substantially larger stability increase than reviewing a move you just saw a few hours ago!
        </div>
      </div>

      <h3>On Recall Lapse (Again, G = 1)</h3>
      <p>When a move is forgotten, stability does not collapse to zero; it resets to a controlled lower baseline:</p>
      <div class="math-card">
        <div class="math-display" tabindex="0">
          S'(D, S, R) = w11 · D^(-w12) · ((S + 1)^w13 - 1) · e^(w14 · (1 - R))
        </div>
      </div>

      <h3>Difficulty Mean Reversion</h3>
      <p>Difficulty adjusts smoothly with mean reversion to prevent extreme outliers:</p>
      <div class="math-card">
        <div class="math-display" tabindex="0">
          D' = clip(w7 · D0(3) + (1 - w7) · (D - w6 · (G - 3)), 1.0, 10.0)
        </div>
      </div>
    </section>
  `;

  return renderDocShell({
    id: 'fsrs-algorithm',
    title: 'FSRS Spaced Repetition for Chess',
    kicker: 'Memory Model',
    desc: 'The mathematical formulation of FSRS-4.5/5 DSR power-law forgetting curves adapted for chess opening recall.',
    sourceRel: 'ChessSRS Scheduling Architecture.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildGraphCoordinatorPage() {
  const toc = [
    { id: 'dag-model', title: 'Repertoire as a DAG' },
    { id: 'transpositions', title: 'Transpositions & State Sharing' },
    { id: 'lapse-contagion', title: 'Upstream Lapse Contagion' },
    { id: 'auto-traversal', title: 'Auto-Traversal Exposure' },
    { id: 'intra-session', title: 'Intra-Session Fail-Forward' },
    { id: 'scoping', title: 'Review Scopes & Queues' },
  ];

  const bodyHtml = `
    <section id="dag-model">
      <h2>1. The Repertoire as a Directed Acyclic Graph (DAG)</h2>
      <p>
        Individual games are trees, but an entire chess opening repertoire is a <strong>Directed Acyclic Graph (DAG)</strong>.
        Different move orders frequently converge to identical board positions (transpositions).
      </p>
      <p>
        Generic flashcard engines treat every node independently. If a player practices <code>1.d4 Nf6 2.c4 e6 3.Nc3 Bb4</code>,
        and separately reaches the same Nimzo-Indian through an English move order <code>1.c4 e6 2.d4 Nf6 3.Nc3 Bb4</code>,
        a naive system would schedule them as two separate cards. The user would be tested twice on the identical position!
      </p>
      <p>
        ChessSRS bridges this gap with its <strong>Graph-Aware Review Coordinator</strong> (<code>lib/src/domain/review/graph_coordinator.dart</code>).
      </p>
    </section>

    <section id="transpositions">
      <h2>2. Transpositions & Canonical Position Identity</h2>
      <p>
        Every <code>RepertoireDecision</code> is canonicalized on <strong>FEN4</strong> (piece placement, active color, castling availability, and en-passant target) combined with the expected repertoire move in UCI notation:
      </p>
      <div class="code-block">
        <div class="code-header"><span>Canonical Key Calculation</span><span>Dart</span></div>
        <pre tabindex="0"><code>// Half-move clock and full-move counter are stripped: they do not alter legal moves or tactical patterns.
final canonicalKey = sha1('$fen4|$expectedMoveUci');</code></pre>
      </div>
      <h3>State Sharing Mechanics</h3>
      <ul>
        <li><strong>Single Shared Knowledge State:</strong> If two tree nodes across different chapters share the same <code>canonicalKey</code>, they map to the exact same <code>ReviewState</code> record in SQLite.</li>
        <li><strong>Bi-directional Updates:</strong> Answering the move correctly in Chapter A updates the stability and due date for that position across Chapter B and Chapter C automatically.</li>
        <li><strong>Contradiction Detection:</strong> If the same FEN4 occurs in two studies with <em>conflicting</em> expected moves, ChessSRS flags this as a repertoire contradiction rather than training interfering habits.</li>
      </ul>
    </section>

    <section id="lapse-contagion">
      <h2>3. Upstream Lapse Contagion Decay</h2>
      <p>
        What should happen to descendant moves when you make a mistake on move 4?
      </p>
      <ul>
        <li><strong>Naive Approach 1:</strong> Reset the entire branch to Day 1. (Demoralizing; produces giant review backlogs from a single slip).</li>
        <li><strong>Naive Approach 2:</strong> Leave child nodes untouched. (Dangerous; if you forgot move 4, you cannot reach move 8 in a real game).</li>
      </ul>
      <p>
        ChessSRS implements <strong>exponentially decaying lapse contagion</strong>, softly nudging descendant nodes without resetting their repetition history:
      </p>

      <div class="math-card">
        <div class="callout-title" style="color:var(--ac)">Lapse Contagion Equation</div>
        <div class="math-display" tabindex="0">
          S_child' = S_child · (1 - λ0 · e^(-(depth - 1) / τ))
          D_child' = clip(D_child + β · λ0 · e^(-(depth - 1) / τ), 1.0, 10.0)
        </div>
        <div class="math-legend">
          Defaults: <strong>λ0 = 0.18</strong> (max 18% stability haircut on immediate child), <strong>τ = 1.5</strong> plies (contagion dissipates rapidly with depth), <strong>β = 0.6</strong> (small difficulty nudge).
        </div>
      </div>
      <p>
        The child's <code>nextDueAt</code> is pulled forward proportionally, bringing the downstream line back into review sooner while leaving its active repetition count intact.
      </p>
    </section>

    <section id="auto-traversal">
      <h2>4. Auto-Traversal Exposure Credit (INV-024)</h2>
      <p>
        When testing a deep variation at move 12, the player is guided through the initial moves 1 through 11. Passive exposure reinforces visual familiarity, but is not active recall.
      </p>
      <p>
        ChessSRS grants prefix moves an <strong>auto-traversal exposure bump</strong>:
      </p>
      <div class="math-card">
        <div class="math-display" tabindex="0">
          S' = S · (1 + ε),   where ε = 0.08 (+8% stability)
        </div>
        <div class="math-legend">
          Strict guardrails prevent abuse:
          <br>• Capped to <strong>once per calendar day</strong> per decision (prevents farming stability by repeatedly opening lines).
          <br>• <strong>lastReviewedAt</strong> is NOT updated (it was not active retrieval).
          <br>• <strong>Never applied to already-due positions</strong> (if a prefix move is due, it must be actively tested).
        </div>
      </div>
    </section>

    <section id="intra-session">
      <h2>5. The Intra-Session Fail-Forward Loop</h2>
      <p>
        In traditional apps, if you get a move wrong, you see the answer and move on. By tomorrow, that line is forgotten again.
      </p>
      <p>
        ChessSRS enforces an <strong>intra-session retry queue</strong>:
      </p>
      <ol>
        <li>When you play an incorrect move, the board displays the correct move and highlights the expected square.</li>
        <li>The card is immediately appended to the end of your current session's queue.</li>
        <li>After you complete the regular due cards, all failed positions re-appear for fresh recall.</li>
        <li>A session is not marked "Nothing due" until every lapsed move is recalled cleanly from memory!</li>
      </ol>
    </section>

    <section id="scoping">
      <h2>6. Review Scopes & Prioritization</h2>
      <p>
        The review queue adapts dynamically to user focus:
      </p>
      <ul>
        <li><strong>Color Isolation:</strong> Top-bar square buttons toggle between White repertoire drawer and Black repertoire drawer. White and Black lines are never mixed in the same session.</li>
        <li><strong>Opening Scopes:</strong> Drill an entire opening family (e.g. "French Defense") or drill a single specific study chapter.</li>
        <li><strong>Practice Mode:</strong> Drill variations freely without modifying your FSRS due dates or stability schedules.</li>
      </ul>
    </section>
  `;

  return renderDocShell({
    id: 'graph-coordinator',
    title: 'Graph-Aware Review Coordinator',
    kicker: 'Traversal Engine',
    desc: 'How ChessSRS traverses repertoires as DAGs, manages transpositions, applies lapse contagion, and schedules review queues.',
    sourceRel: 'docs/review-2-graph-aware-coordinator.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildPgnPipelinePage() {
  const toc = [
    { id: 'sources', title: 'Input Sources' },
    { id: 'ast-parsing', title: 'AST & Variation Tree Parsing' },
    { id: 'canonicalization', title: 'Move Validation & FEN Normalization' },
    { id: 'quarantine', title: 'Quality Gates & Error Quarantine' },
  ];

  const bodyHtml = `
    <section id="sources">
      <h2>1. Input Sources & Ingestion</h2>
      <p>
        ChessSRS accepts opening material through two primary avenues:
      </p>
      <ul>
        <li><strong>Standard PGN Files & Text:</strong> Direct file picker (<code>.pgn</code>) or clipboard paste supporting multi-game collections, extensive comments, and deeply nested sub-variations.</li>
        <li><strong>Lichess Study Import:</strong> Enter any public Lichess study URL or 8-character study ID (e.g. <code>https://lichess.org/study/Gg4E2sIS</code>). For private or unlisted studies, users can sign in with their Lichess account via OAuth Bearer token to import their private repertoires.</li>
      </ul>
    </section>

    <section id="ast-parsing">
      <h2>2. AST & Recursive Variation Tree Parsing</h2>
      <p>
        A PGN study is parsed into an Abstract Syntax Tree (AST) using <code>dartchess</code>'s streaming parser:
      </p>
      <ul>
        <li><strong>Multi-Game Streams:</strong> Each PGN game block (separated by standard PGN header tags) is mapped to an independent <code>Chapter</code> within the parent <code>Study</code>.</li>
        <li><strong>Recursive Annotation Variations (RAV - INV-010):</strong> Sibling variations wrapped in parentheses <code>( ... )</code> are preserved down to arbitrary depth. Branches are never flattened or pruned.</li>
        <li><strong>Numeric Annotation Glyphs (NAGs):</strong> Evaluative symbols ($1 = !, $2 = ?, $3 = !!, $4 = ??, etc.) are parsed into node metadata.</li>
        <li><strong>Author Annotations:</strong> Explanatory text comments embedded in curly braces <code>{ ... }</code> are stored with the position node and displayed to the user after recall attempts (configurable in Settings).</li>
      </ul>
    </section>

    <section id="canonicalization">
      <h2>3. Move Validation & FEN Normalization</h2>
      <p>
        Imported moves must undergo rigorous geometric validation:
      </p>
      <ol>
        <li><strong>Legality Verification:</strong> Every move is executed on an internal <code>dartchess.Position</code> instance. Illegal moves, ambiguous algebraic notation, or invalid castling rights trigger immediate quarantine.</li>
        <li><strong>Coordinate Conversion:</strong> Standard Algebraic Notation (SAN: e.g. <code>Nf3</code>, <code>O-O</code>) is resolved into canonical UCI coordinates (e.g. <code>g1f3</code>, <code>e1g1</code>).</li>
        <li><strong>Side Determination:</strong> The parser analyzes branch structures to automatically detect whether the chapter trains White or Black lines.</li>
      </ol>
    </section>

    <section id="quarantine">
      <h2>4. Quality Gates & Error Quarantine</h2>
      <div class="callout spec">
        <div class="callout-title">INV-011 Malformed Input Quarantine</div>
        <p>If a PGN file contains syntax corruption, illegal moves, or truncated bodies, the invalid chapters are quarantined with specific line and character error diagnostics. Valid chapters are cleanly imported; an import is never left in a corrupt, half-applied state.</p>
      </div>

      <div class="callout spec">
        <div class="callout-title">INV-003 Duplicate Import Rejection</div>
        <p>Importing a PGN whose canonical tree hash matches an already imported study switches directly to that study. It never inserts duplicate studies, chapters, or duplicate decision cards in SQLite.</p>
      </div>
    </section>
  `;

  return renderDocShell({
    id: 'pgn-pipeline',
    title: 'PGN & Study Ingestion Pipeline',
    kicker: 'Data Pipeline',
    desc: 'Multi-chapter PGN parsing, recursive annotation variation (RAV) preservation, move canonicalization, and quality quarantine.',
    sourceRel: 'docs/pgn-import.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildSpecificationsPage() {
  const toc = [
    { id: 'spec-philosophy', title: 'The SPEC Contract' },
    { id: 'tier-0', title: 'Tier 0: Persistence & Security' },
    { id: 'tier-1', title: 'Tier 1: Behavioral Correctness' },
    { id: 'tier-2', title: 'Tier 2: UX & Performance' },
  ];

  const specSrc = readAppFile('SPEC.md') || '';

  // Extract all invariants from SPEC.md
  const invRegex = /###\s+(INV-\d+)\s+([^\n]+)\n([\s\S]*?)(?=(?:###\s+INV-|\n##\s+|$))/g;
  const invariants = [];
  for (const m of specSrc.matchAll(invRegex)) {
    const id = m[1];
    const title = m[2];
    const body = m[3].trim();
    const tierMatch = body.match(/Tier:\s*(T[012])/);
    const tier = tierMatch ? tierMatch[1] : 'T1';
    invariants.push({ id, title, body, tier });
  }

  const renderInvCard = (inv) => `
    <article class="inv-card" id="${inv.id.toLowerCase()}">
      <div class="inv-header">
        <span class="inv-id">${inv.id}</span>
        <span class="inv-badge ${inv.tier.toLowerCase()}">${inv.tier === 'T0' ? 'Tier 0 (Integrity)' : inv.tier === 'T1' ? 'Tier 1 (Behavior)' : 'Tier 2 (UX/Perf)'}</span>
      </div>
      <div class="inv-statement">${inv.title}</div>
      <div class="doc-article" style="font-size:14.5px;color:var(--mu);margin-bottom:12px">
        ${inv.body.split('\n-')[0].trim()}
      </div>
      <div class="inv-meta">
        ${inv.body
          .split('\n')
          .filter((line) => line.startsWith('-'))
          .map((line) => `<span>${line.replace(/^-/, '•')}</span>`)
          .join('\n')}
      </div>
    </article>
  `;

  const t0Cards = invariants.filter((i) => i.tier === 'T0').map(renderInvCard).join('\n');
  const t1Cards = invariants.filter((i) => i.tier === 'T1').map(renderInvCard).join('\n');
  const t2Cards = invariants.filter((i) => i.tier === 'T2').map(renderInvCard).join('\n');

  const bodyHtml = `
    <section id="spec-philosophy">
      <h2>1. The SPEC Contract Philosophy</h2>
      <p>
        In ChessSRS, <strong>specifications precede code</strong>. Code is not the specification.
        Every non-negotiable property is recorded in <code>SPEC.md</code> as an invariant with a permanent identifier
        (<code>INV-001</code> through <code>INV-072</code>).
      </p>
      <ul>
        <li><strong>Permanent IDs:</strong> Invariants are never renumbered or silently reused. When an invariant is superseded, it is marked <code>RETIRED (reason, date)</code>.</li>
        <li><strong>Falsifiable Oracles:</strong> Every invariant specifies an oracle: an exact test assertion proving that a violation is caught mechanically.</li>
        <li><strong>Traceability Check (G05):</strong> Automated gate <code>scripts/gates/spec_trace_check.py</code> checks that every active invariant is explicitly referenced in unit and integration test code (<code>// SPEC INV-xxx</code>).</li>
      </ul>
    </section>

    <section id="tier-0">
      <h2>2. Tier 0 Invariants: Data Loss, Corruption & Security</h2>
      <p>Violations of Tier 0 invariants represent catastrophic data loss, silent corruption, or security leaks. They block any merge unconditionally:</p>
      ${t0Cards || '<p>Refer to SPEC.md in repository.</p>'}
    </section>

    <section id="tier-1">
      <h2>3. Tier 1 Invariants: Behavioral & Domain Correctness</h2>
      <p>Violations of Tier 1 invariants represent incorrect chess logic, scheduler drift, or variation loss:</p>
      ${t1Cards || '<p>Refer to SPEC.md in repository.</p>'}
    </section>

    <section id="tier-2">
      <h2>4. Tier 2 Invariants: Presentation, UX & Performance</h2>
      <p>Violations of Tier 2 invariants represent UI clipping, missing accessibility labels, or performance latency regressions:</p>
      ${t2Cards || '<p>Refer to SPEC.md in repository.</p>'}
    </section>
  `;

  return renderDocShell({
    id: 'specifications',
    title: 'Formal System Invariants (SPEC)',
    kicker: 'Specifications',
    desc: 'The complete catalog of 30+ formal system invariants governing persistence, memory models, graph traversal, and UX.',
    sourceRel: 'SPEC.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildDomainModelPage() {
  const toc = [
    { id: 'entities', title: 'Core Domain Entities' },
    { id: 'decision-model', title: 'The RepertoireDecision Unit' },
    { id: 'lifecycle', title: 'Review State Lifecycle' },
    { id: 'database-schema', title: 'SQLite Schema & Tables' },
  ];

  const bodyHtml = `
    <section id="entities">
      <h2>1. Core Domain Entities</h2>
      <p>The domain model resides strictly in <code>lib/src/domain/</code>, modeled as immutable data classes:</p>
      <ul>
        <li><strong>Study:</strong> The top-level repertoire collection imported from a single source (PGN file or Lichess study URL). Contains metadata and one or more Chapters.</li>
        <li><strong>Chapter:</strong> A named logical unit from the PGN, corresponding to a single game header or study chapter. Contains root move node and orientation.</li>
        <li><strong>PositionNode / Variation:</strong> A node in the branching chess tree. Tracks FEN state, parent pointer, incoming move, and child moves (variations).</li>
        <li><strong>RepertoireDecision:</strong> The atomic scheduled unit of spaced repetition. Links a specific position with the expected repertoire move.</li>
        <li><strong>ReviewState:</strong> Spaced repetition tracking data (current stability, difficulty, repetitions, lapse count, next due timestamp).</li>
        <li><strong>ReviewEvent:</strong> Immutable log record of an active recall attempt (rating, timestamp, review duration, stability change).</li>
      </ul>
    </section>

    <section id="decision-model">
      <h2>2. The RepertoireDecision Unit</h2>
      <p>
        In an opening repertoire, you do not review opponent moves—you only review <strong>your own planned replies</strong>!
      </p>
      <div class="code-block">
        <div class="code-header"><span>RepertoireDecision Structure</span><span>Concept</span></div>
        <pre tabindex="0"><code>RepertoireDecision {
  String id;                 // Unique decision identifier
  String studyId;            // Parent study
  String chapterId;          // Parent chapter
  String fen;                // Board position (FEN4)
  Move expectedMove;         // The user-prepared move (UCI)
  String canonicalStateId;   // Pointer to shared ReviewState (for transpositions)
}</code></pre>
      </div>
      <p>
        Opponent choices represent branch forks. Each of your planned responses constitutes a <code>RepertoireDecision</code>.
      </p>
    </section>

    <section id="lifecycle">
      <h2>3. Review State Lifecycle</h2>
      <p>A position transitions across distinct memory stages:</p>
      <ol>
        <li><strong>Fresh / Unseen:</strong> Position has been imported but never reviewed. Positioned in the "Fresh" pool, introduced gradually according to the "New positions per day" limit.</li>
        <li><strong>Learning:</strong> Undergoing initial acquisition. Intervals are measured in hours or single days until basic retention is proven.</li>
        <li><strong>Retained / Active Review:</strong> Governed by continuous FSRS power-law scheduling. Intervals expand geometrically as stability increases.</li>
        <li><strong>Lapsed:</strong> Move was missed during review. Moves into intra-session buffer, receives stability reduction, and resets to short intervals until regained.</li>
      </ol>
    </section>

    <section id="database-schema">
      <h2>4. SQLite Database Schema</h2>
      <p>Persistence uses SQLite tables with indexed keys for fast query execution on mobile devices:</p>
      <div class="code-block">
        <div class="code-header"><span>Core Database Tables</span><span>SQL DDL</span></div>
        <pre tabindex="0"><code>-- Studies table
CREATE TABLE studies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pgn_hash TEXT NOT NULL,
  source_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Repertoire chapters
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  side TEXT NOT NULL, -- 'white' or 'black'
  sort_order INTEGER NOT NULL
);

-- Decisions & review states
CREATE TABLE review_states (
  canonical_id TEXT PRIMARY KEY, -- sha1(fen4 + uci)
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  repetitions INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  last_reviewed_at INTEGER,
  next_due_at INTEGER NOT NULL
);

CREATE INDEX idx_review_states_due ON review_states(next_due_at);</code></pre>
      </div>
    </section>
  `;

  return renderDocShell({
    id: 'domain-model',
    title: 'Domain Model & Schemas',
    kicker: 'Data Architecture',
    desc: 'The domain vocabulary, entity hierarchy, position identity keys, and SQLite database schema.',
    sourceRel: 'docs/domain-model.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildTestingStrategyPage() {
  const toc = [
    { id: 'gate-hierarchy', title: 'Deterministic Quality Gates' },
    { id: 'tripwire-g08', title: 'The G08 Anti-Weakening Tripwire' },
    { id: 'testing-budgets', title: 'Local Testing Budgets' },
    { id: 'escape-flywheel', title: 'The Escape-to-Gate Flywheel' },
  ];

  const bodyHtml = `
    <section id="gate-hierarchy">
      <h2>1. The Deterministic Quality Gate Hierarchy</h2>
      <p>
        ChessSRS enforces an automated referee pipeline that mechanically verifies every pull request before code reaches <code>main</code>:
      </p>
      <div class="doc-table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th>Name</th>
              <th>Description & Enforcement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>G01</strong></td>
              <td>Format Verification</td>
              <td><code>dart format --set-exit-if-changed</code> with strict line width 100.</td>
            </tr>
            <tr>
              <td><strong>G02</strong></td>
              <td>Static Analysis</td>
              <td><code>flutter analyze --fatal-infos</code>. Zero warnings, zero hints allowed.</td>
            </tr>
            <tr>
              <td><strong>G03</strong></td>
              <td>Banned API Gate</td>
              <td><code>scripts/gates/banned_apis_check.py</code> prevents Flutter imports in domain and unclocked <code>DateTime.now</code> in schedulers.</td>
            </tr>
            <tr>
              <td><strong>G05</strong></td>
              <td>Spec Traceability</td>
              <td><code>scripts/gates/spec_trace_check.py</code> asserts that active tests cite every <code>INV-xxx</code> ID from <code>SPEC.md</code>.</td>
            </tr>
            <tr>
              <td><strong>G08</strong></td>
              <td>Anti-Weakening Tripwire</td>
              <td>Diffs commits against <code>origin/main</code> to detect and block deleted assertions, loosened tolerances, or skipped tests.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="tripwire-g08">
      <h2>2. The G08 Anti-Weakening Tripwire</h2>
      <p>
        AI agents and fatigued engineers frequently "fix" failing tests by quietly weakening them: deleting assertions, adding <code>@skip</code> annotations, widening numerical tolerances, or adding blanket lint suppressions.
      </p>
      <p>
        Gate <strong>G08</strong> (<code>scripts/gates/test_weakening_check.py</code>) parses git diffs to detect:
      </p>
      <ul>
        <li>Any deleted <code>expect(...)</code> call without a compensating assertion.</li>
        <li>Introduction of <code>// ignore:</code> or <code>// ignore_for_file:</code> comments.</li>
        <li>Modification of benchmark tolerances or ratchet baselines.</li>
      </ul>
      <p>If any test weakening is discovered, CI halts immediately.</p>
    </section>

    <section id="testing-budgets">
      <h2>3. Local Test Budgets (Preserving Hardware)</h2>
      <div class="callout warning">
        <div class="callout-title">The Local Machine is Not a Build Server</div>
        <p>Running 1,400+ Flutter tests repeatedly saturates laptop CPUs, pins fans at 100%, and throttles battery life. Local development follows strict budget rules:</p>
      </div>
      <ul>
        <li><strong>Inner loop:</strong> Run only the targeted test file using <code>fvm flutter test test/... --plain-name 'test name'</code>.</li>
        <li><strong>Full test suites:</strong> Delegated to GitHub Actions runners on push.</li>
        <li><strong>Release builds:</strong> Release compilation (R8, AOT) is never performed on developer machines; artifacts are built on GitHub Actions runners.</li>
      </ul>
    </section>

    <section id="escape-flywheel">
      <h2>4. The Escape-to-Gate Flywheel</h2>
      <p>
        When a bug slips past existing checks, ChessSRS follows a mandatory remediation flywheel (<code>docs/ESCAPE_TO_GATE.md</code>):
      </p>
      <ol>
        <li><strong>Failing Regression Test:</strong> Write a targeted test that fails 100% reliably on current code.</li>
        <li><strong>SPEC Assignment:</strong> Formulate a new invariant in <code>SPEC.md</code> naming the failure condition.</li>
        <li><strong>Red-Team Corpus Addition:</strong> Add adversarial PGN fixtures or malformed inputs to <code>redteam/</code>.</li>
        <li><strong>Root Cause Fix:</strong> Apply the minimal architectural fix that resolves the issue cleanly.</li>
        <li><strong>Escapes Log Update:</strong> Record the incident in <code>docs/escapes-log.md</code>.</li>
      </ol>
    </section>
  `;

  return renderDocShell({
    id: 'testing-strategy',
    title: 'Deterministic Testing & Quality Gates',
    kicker: 'Verification',
    desc: 'How quality invariants are mechanically enforced through deterministic gates, anti-weakening tripwires, and testing budgets.',
    sourceRel: 'TEST_STRATEGY.md',
    bodyHtml,
    tocList: toc,
  });
}

function buildDeveloperGuidePage() {
  const toc = [
    { id: 'prerequisites', title: 'Prerequisites & FVM' },
    { id: 'worktree-workflow', title: 'Worktree-per-Task Workflow' },
    { id: 'codegen', title: 'Code Generation (build_runner)' },
    { id: 'style-rules', title: 'Coding Conventions' },
    { id: 'running-app', title: 'Running & Validation' },
  ];

  const bodyHtml = `
    <section id="prerequisites">
      <h2>1. Prerequisites & FVM Setup</h2>
      <p>
        ChessSRS requires the exact Flutter toolchain pinned via <strong>Flutter Version Management (FVM)</strong>:
      </p>
      <div class="code-block">
        <div class="code-header"><span>Installing FVM & Flutter SDK</span><span>Bash</span></div>
        <pre tabindex="0"><code># Install fvm (if not already installed)
dart pub global activate fvm

# Inside the ChessSRS repository root:
fvm install
fvm flutter --version</code></pre>
      </div>
      <p>
        Always prefix commands with <code>fvm</code> (e.g. <code>fvm flutter pub get</code>, <code>fvm flutter run</code>).
      </p>
    </section>

    <section id="worktree-workflow">
      <h2>2. Worktree-per-Task Workflow</h2>
      <p>
        To prevent dirty state contamination across agents and branches, every engineering task takes place inside its own Git worktree:
      </p>
      <div class="code-block">
        <div class="code-header"><span>Creating a Task Worktree</span><span>Bash</span></div>
        <pre tabindex="0"><code># Create branch and isolated worktree
git worktree add ../chesssrs-feature-slug -b feat/area-feature-slug origin/main
cd ../chesssrs-feature-slug

# Bootstrap dependencies and codegen
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs</code></pre>
      </div>
      <div class="callout spec">
        <div class="callout-title">Worktree Isolation Invariant</div>
        <p>Never run git commands that write outside your worktree. Never run <code>git add -A</code> blindly. Stage touched files explicitly by name.</p>
      </div>
    </section>

    <section id="codegen">
      <h2>3. Code Generation (build_runner)</h2>
      <p>
        ChessSRS uses <code>Freezed</code> for immutable data classes, <code>Riverpod</code> generators for dependency injection, and <code>drift</code> for SQLite queries. Generated files (<code>*.freezed.dart</code>, <code>*.g.dart</code>) are gitignored:
      </p>
      <div class="code-block">
        <div class="code-header"><span>Running Codegen</span><span>Bash</span></div>
        <pre tabindex="0"><code># Run one-off build
fvm dart run build_runner build --delete-conflicting-outputs

# Format generated l10n files if touched
dart format lib/l10n/</code></pre>
      </div>
    </section>

    <section id="style-rules">
      <h2>4. Coding Conventions</h2>
      <ul>
        <li><strong>Riverpod 3.x:</strong> Prefer <code>.value</code> over <code>valueOrNull</code>. Avoid obsolete <code>ProviderListenable</code> type annotations. Prefer HTTP-layer mocking over global provider overrides.</li>
        <li><strong>Formatting:</strong> Page width 100, single quotes, strict casts and inference (<code>analysis_options.yaml</code>).</li>
        <li><strong>Translations:</strong> Hardcoded English initially during prototyping; migrate to <code>lib/l10n/app_en.arb</code> once stabilized.</li>
      </ul>
    </section>

    <section id="running-app">
      <h2>5. Running & Runtime Validation</h2>
      <p>
        To run the application locally on Linux desktop:
      </p>
      <div class="code-block">
        <div class="code-header"><span>Running Desktop App</span><span>Bash</span></div>
        <pre tabindex="0"><code>fvm flutter run -d linux</code></pre>
      </div>
      <p>
        <strong>Runtime validation is mandatory for user-visible work:</strong> automated unit tests can pass while layout is visually clipped or sound synthesis fails. Exercise the feature interactively before opening a pull request.
      </p>
    </section>
  `;

  return renderDocShell({
    id: 'developer-guide',
    title: 'Developer Guide & Toolchain',
    kicker: 'Development',
    desc: 'Prerequisites, FVM setup, worktree-per-task workflow, code generation, and running ChessSRS locally.',
    sourceRel: 'CLAUDE.md',
    bodyHtml,
    tocList: toc,
  });
}

/* ------------------------------------------------------------------ Main Execution */

const PAGES = [
  { file: 'docs/index.html', generate: buildIndexPage },
  { file: 'docs/architecture.html', generate: buildArchitecturePage },
  { file: 'docs/fsrs-algorithm.html', generate: buildFsrsAlgorithmPage },
  { file: 'docs/graph-coordinator.html', generate: buildGraphCoordinatorPage },
  { file: 'docs/pgn-pipeline.html', generate: buildPgnPipelinePage },
  { file: 'docs/specifications.html', generate: buildSpecificationsPage },
  { file: 'docs/domain-model.html', generate: buildDomainModelPage },
  { file: 'docs/testing-strategy.html', generate: buildTestingStrategyPage },
  { file: 'docs/developer-guide.html', generate: buildDeveloperGuidePage },
];

const dirty = [];
const manifest = {
  _comment: 'GENERATED by scripts/sync-docs.js from the ChessSRS app repo. Do not edit by hand.',
  appVersion,
  appDir: path.relative(SITE, appDir),
  pages: [],
};

for (const { file, generate } of PAGES) {
  const content = generate();
  const dest = path.join(SITE, file);
  const existed = fs.existsSync(dest);
  const current = existed ? fs.readFileSync(dest, 'utf8') : null;
  const hash = sha256(content);

  manifest.pages.push({ file, hash });

  if (current === content) {
    process.stdout.write(`  = ${file} (up to date)\n`);
  } else if (CHECK) {
    dirty.push(file);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    process.stdout.write(`  ${existed ? '~' : '+'} ${file}\n`);
  }
}

// Manifest file
const manifestDest = path.join(SITE, 'docs/docs-manifest.json');
const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
const manifestExisted = fs.existsSync(manifestDest);
const manifestCurrent = manifestExisted ? fs.readFileSync(manifestDest, 'utf8') : null;

if (manifestCurrent === manifestJson) {
  process.stdout.write(`  = docs/docs-manifest.json (up to date)\n`);
} else if (CHECK) {
  dirty.push('docs/docs-manifest.json');
} else {
  fs.writeFileSync(manifestDest, manifestJson);
  process.stdout.write(`  ${manifestExisted ? '~' : '+'} docs/docs-manifest.json\n`);
}

if (CHECK && dirty.length > 0) {
  console.error(`\n[sync-docs] Documentation drift detected in ${dirty.length} file(s):`);
  for (const f of dirty) console.error(`  - ${f}`);
  console.error(`\nRun \`node scripts/sync-docs.js\` to synchronize website documentation with the app repo.`);
  process.exit(1);
}

process.stdout.write('[sync-docs] Documentation pages synchronized successfully.\n');

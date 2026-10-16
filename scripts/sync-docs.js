#!/usr/bin/env node
/**
 * scripts/sync-docs.js
 *
 * Dynamically compiles the ChessSRS app repository's Markdown documents
 * (ARCHITECTURE.md, SPEC.md, QUALITY.md, TEST_STRATEGY.md, PRODUCT.md,
 * MVP.md, ChessSRS Scheduling Architecture.md, GATES.md, CLAUDE.md,
 * docs/domain-model.md, docs/pgn-import.md, docs/setting_dev_env.md, etc.)
 * into comprehensive, rich, fully styled documentation pages for the website.
 *
 * Sourcing strategy:
 *   1. Local app repository checkout (resolved via scripts/resolve-app-dir.js).
 *   2. Remote fallback to GitHub raw content (https://raw.githubusercontent.com/...)
 *      for standalone runner environments without the app repo cloned alongside.
 *
 * Anti-drift gate:
 *   node scripts/sync-docs.js          # generates / updates doc pages in docs/
 *   node scripts/sync-docs.js --check  # asserts zero documentation drift against app repo
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Marked } = require('marked');
const { resolveAppDir, pubspecVersion } = require('./resolve-app-dir.js');

const SITE = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const CONFIG_PATH = path.join(SITE, 'site.config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { githubOwner: OWNER, appRepo: APP_REPO, siteRepo: SITE_REPO } = config;

const APP_URL = `https://github.com/${OWNER}/${APP_REPO}`;
const SITE_ROOT = `https://${OWNER}.github.io/${SITE_REPO}`;

const appDir = resolveAppDir();

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Loads a Markdown file either from the local ChessSRS checkout or via GitHub raw fallback.
 * Returns { content: string, source: 'local'|'remote', path: string, hash: string }
 */
async function loadSource(relPath) {
  if (appDir) {
    const localPath = path.join(appDir, relPath);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      return {
        content,
        source: 'local',
        path: relPath,
        hash: sha256(content),
      };
    }
  }

  // Fallback to GitHub raw content
  const url = `https://raw.githubusercontent.com/${OWNER}/${APP_REPO}/main/${relPath}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ChessSRS-doc-sync' },
  });

  if (!res.ok) {
    throw new Error(`Failed to load source "${relPath}": HTTP ${res.status} ${res.statusText}`);
  }

  const content = await res.text();
  return {
    content,
    source: 'remote',
    path: relPath,
    hash: sha256(content),
  };
}

let appVersion = '1.4.0';
try {
  if (appDir) {
    appVersion = pubspecVersion(appDir);
  }
} catch {
  // Use fallback if pubspec unreadable
}

/* ------------------------------------------------------------------ Documentation Navigation Tree */
const DOC_SECTIONS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'index', title: 'Documentation Hub', path: 'index.html', kicker: 'Overview', desc: 'Complete technical documentation, architecture specs, and algorithms for ChessSRS.' },
      { id: 'product', title: 'Product Definition & Journeys', path: 'product.html', kicker: 'Product', desc: 'Core product vision, competitive personas, 5 core user journeys, and MVP boundaries.' },
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

/* ------------------------------------------------------------------ Markdown Compiler */
function compileMarkdown(md) {
  const headings = [];
  const markedInstance = new Marked();

  markedInstance.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, '').trim();
        const invMatch = plain.match(/^(INV-\d+)\s+(.*)$/);
        let id;
        if (invMatch) {
          id = invMatch[1].toLowerCase();
        } else {
          id = plain.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
        }

        if (depth === 2) {
          headings.push({ id, title: plain });
        }

        if (invMatch) {
          return `<h${depth} id="${id}" class="doc-inv-heading"><span class="inv-id">${invMatch[1]}</span> ${invMatch[2]}</h${depth}>\n`;
        }
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
    hooks: {
      postprocess(html) {
        return html
          .replace(/<table>/g, '<div class="doc-table-wrap" tabindex="0"><table class="doc-table">')
          .replace(/<\/table>/g, '</table></div>')
          .replace(/<pre>/g, '<pre tabindex="0">')
          .replace(/<blockquote>/g, '<div class="callout spec">')
          .replace(/<\/blockquote>/g, '</div>');
      },
    },
  });

  // Ensure all markdown headers are downgraded so h1 is reserved exclusively for the page title
  let processed = md.replace(/^#\s+/gm, '## ');

  // Pre-process math blocks $$ ... $$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
    return `\n\n<div class="math-card"><div class="math-display" tabindex="0">${math.trim()}</div></div>\n\n`;
  });

  // Pre-process inline math $ ... $
  processed = processed.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_m, math) => {
    return `<code class="inline-code inline-math">${math}</code>`;
  });

  // Pre-process callouts > [!WARNING]
  processed = processed.replace(/>\s*\[!WARNING\]\s*\n((?:>.*(?:\n|$))*)/g, (_m, body) => {
    const cleanBody = body.replace(/^>\s?/gm, '').trim();
    return `\n\n<div class="callout warning"><div class="callout-title">Warning</div><p>${cleanBody}</p></div>\n\n`;
  });

  // Pre-process callouts > [!NOTE]
  processed = processed.replace(/>\s*\[!NOTE\]\s*\n((?:>.*(?:\n|$))*)/g, (_m, body) => {
    const cleanBody = body.replace(/^>\s?/gm, '').trim();
    return `\n\n<div class="callout note"><div class="callout-title">Note</div><p>${cleanBody}</p></div>\n\n`;
  });

  // Wrap INV cards in SPEC.md
  processed = processed.replace(/(###\s+INV-\d+[\s\S]*?)(?=(?:\n###\s+INV-|\n##\s+|$))/g, (m) => {
    return `\n\n<div class="inv-card">\n\n${m.trim()}\n\n</div>\n\n`;
  });

  // Strip initial top-level # Title if present (as it is rendered in the doc shell)
  processed = processed.replace(/^#\s+[^\n]+\n+/, '');

  const html = markedInstance.parse(processed);
  return { html, headings };
}

/* ------------------------------------------------------------------ HTML Page Shell */
function renderDocShell({ id, title, kicker, desc, sources = [], bodyHtml, tocList = [] }) {
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

  const sourcesListHtml = sources.length
    ? sources
        .map(
          (s) => `
      <div class="doc-meta-item">
        <strong>Source in app repo:</strong>
        <a href="${APP_URL}/blob/main/${s}" target="_blank" rel="noopener"><code>${s}</code></a>
      </div>`
        )
        .join('\n')
    : `
      <div class="doc-meta-item">
        <strong>Source repo:</strong>
        <a href="${APP_URL}" target="_blank" rel="noopener"><code>ChessSRS</code></a>
      </div>`;

  const sourceMetaHtml = `
    <div class="doc-meta-bar">
      ${sourcesListHtml}
      <div class="doc-meta-item">
        <strong>App version:</strong> <code>v${appVersion}</code>
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
      <a href="product.html">Product Vision</a>
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

/* ------------------------------------------------------------------ Page Definition & Sourcing */

const DOC_DEFINITIONS = [
  {
    id: 'product',
    file: 'docs/product.html',
    title: 'Product Definition & User Journeys',
    kicker: 'Product Vision',
    desc: 'Core premise, target user personas, 5 core user journeys, functional requirements, and MVP boundaries.',
    sources: ['PRODUCT.md', 'MVP.md'],
    async build() {
      const p1 = await loadSource('PRODUCT.md');
      const p2 = await loadSource('MVP.md');
      const combined = `${p1.content}\n\n---\n\n## 5. MVP Scope Boundaries\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'PRODUCT.md': p1.hash, 'MVP.md': p2.hash } };
    },
  },
  {
    id: 'architecture',
    file: 'docs/architecture.html',
    title: 'System Architecture & Foundation',
    kicker: 'Architecture',
    desc: 'Lichess Mobile GPL-3.0 base, 4-tier layer isolation, component boundaries, and SQLite local persistence.',
    sources: ['ARCHITECTURE.md', 'CUT_PROPOSALS.md'],
    async build() {
      const p1 = await loadSource('ARCHITECTURE.md');
      const p2 = await loadSource('CUT_PROPOSALS.md');
      const combined = `${p1.content}\n\n---\n\n## Appendix: Subsystem Cuts & Upstream Discipline\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'ARCHITECTURE.md': p1.hash, 'CUT_PROPOSALS.md': p2.hash } };
    },
  },
  {
    id: 'specifications',
    file: 'docs/specifications.html',
    title: 'Formal System Invariants (SPEC)',
    kicker: 'Specifications',
    desc: 'The complete catalog of 30+ formal system invariants governing persistence, memory models, graph traversal, and UX.',
    sources: ['SPEC.md', 'QUALITY.md'],
    async build() {
      const p1 = await loadSource('SPEC.md');
      const p2 = await loadSource('QUALITY.md');
      const combined = `${p1.content}\n\n---\n\n## Appendix: Quality Invariants Baseline\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'SPEC.md': p1.hash, 'QUALITY.md': p2.hash } };
    },
  },
  {
    id: 'fsrs-algorithm',
    file: 'docs/fsrs-algorithm.html',
    title: 'FSRS Spaced Repetition for Chess',
    kicker: 'Memory Model',
    desc: 'The mathematical formulation of FSRS-4.5/5 DSR power-law forgetting curves adapted for chess opening recall.',
    sources: ['ChessSRS Scheduling Architecture.md', 'docs/review-1-chessfsrs-scheduler.md'],
    async build() {
      const p1 = await loadSource('ChessSRS Scheduling Architecture.md');
      const p2 = await loadSource('docs/review-1-chessfsrs-scheduler.md');
      const combined = `${p1.content}\n\n---\n\n## Implementation Architecture Review\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'ChessSRS Scheduling Architecture.md': p1.hash, 'docs/review-1-chessfsrs-scheduler.md': p2.hash } };
    },
  },
  {
    id: 'graph-coordinator',
    file: 'docs/graph-coordinator.html',
    title: 'Graph-Aware Review Coordinator',
    kicker: 'Traversal Engine',
    desc: 'How ChessSRS traverses repertoires as DAGs, manages transpositions, applies lapse contagion, and schedules review queues.',
    sources: ['docs/review-2-graph-aware-coordinator.md'],
    async build() {
      const p1 = await loadSource('docs/review-2-graph-aware-coordinator.md');
      const { html, headings } = compileMarkdown(p1.content);
      return { html, headings, sourceHashes: { 'docs/review-2-graph-aware-coordinator.md': p1.hash } };
    },
  },
  {
    id: 'domain-model',
    file: 'docs/domain-model.html',
    title: 'Domain Model & Schemas',
    kicker: 'Data Architecture',
    desc: 'The domain vocabulary, entity hierarchy, position identity keys, and SQLite database schema.',
    sources: ['docs/domain-model.md', 'docs/INTEGRATION_MAP.md'],
    async build() {
      const p1 = await loadSource('docs/domain-model.md');
      const p2 = await loadSource('docs/INTEGRATION_MAP.md');
      const combined = `${p1.content}\n\n---\n\n## Repertoire Integration Mapping\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'docs/domain-model.md': p1.hash, 'docs/INTEGRATION_MAP.md': p2.hash } };
    },
  },
  {
    id: 'pgn-pipeline',
    file: 'docs/pgn-pipeline.html',
    title: 'PGN & Study Ingestion Pipeline',
    kicker: 'Data Pipeline',
    desc: 'Multi-chapter PGN parsing, recursive annotation variation (RAV) preservation, move canonicalization, and quality quarantine.',
    sources: ['docs/pgn-import.md', 'docs/game-import-and-quality-gate.md'],
    async build() {
      const p1 = await loadSource('docs/pgn-import.md');
      const p2 = await loadSource('docs/game-import-and-quality-gate.md');
      const combined = `${p1.content}\n\n---\n\n## Game Import & Quality Gate Specification\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'docs/pgn-import.md': p1.hash, 'docs/game-import-and-quality-gate.md': p2.hash } };
    },
  },
  {
    id: 'testing-strategy',
    file: 'docs/testing-strategy.html',
    title: 'Deterministic Testing & Quality Gates',
    kicker: 'Verification',
    desc: 'How quality invariants are mechanically enforced through deterministic gates, anti-weakening tripwires, and testing budgets.',
    sources: ['TEST_STRATEGY.md', 'GATES.md'],
    async build() {
      const p1 = await loadSource('TEST_STRATEGY.md');
      const p2 = await loadSource('GATES.md');
      const combined = `${p1.content}\n\n---\n\n## The Complete Quality Gate Registry\n\n${p2.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'TEST_STRATEGY.md': p1.hash, 'GATES.md': p2.hash } };
    },
  },
  {
    id: 'developer-guide',
    file: 'docs/developer-guide.html',
    title: 'Developer Guide & Toolchain',
    kicker: 'Development',
    desc: 'Prerequisites, FVM setup, worktree-per-task workflow, code generation, and running ChessSRS locally.',
    sources: ['docs/setting_dev_env.md', 'CLAUDE.md', 'AGENTS.md'],
    async build() {
      const p1 = await loadSource('docs/setting_dev_env.md');
      const p2 = await loadSource('CLAUDE.md');
      const p3 = await loadSource('AGENTS.md');
      const combined = `${p1.content}\n\n---\n\n## Repository Conventions & Style (CLAUDE.md)\n\n${p2.content}\n\n---\n\n## Agent Operating Guidelines & Authority Hierarchy (AGENTS.md)\n\n${p3.content}`;
      const { html, headings } = compileMarkdown(combined);
      return { html, headings, sourceHashes: { 'docs/setting_dev_env.md': p1.hash, 'CLAUDE.md': p2.hash, 'AGENTS.md': p3.hash } };
    },
  },
];

/* ------------------------------------------------------------------ Hub Index Generator */
function buildHubIndexPage(_allSourceHashes) {
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
        <li><strong>For Chess Learners & Players:</strong> Start with <a href="product.html">Product Vision</a> and <a href="fsrs-algorithm.html">FSRS Spaced Repetition</a> to understand review intervals, and <a href="graph-coordinator.html">Graph-Aware Coordinator</a> to see how transpositions and mistakes are handled.</li>
        <li><strong>For Software Architects:</strong> Read <a href="architecture.html">System Architecture</a> to inspect layer boundaries and Lichess mobile fork mechanics, followed by <a href="domain-model.html">Domain Model & Schemas</a>.</li>
        <li><strong>For Contributors & Developers:</strong> Follow the <a href="developer-guide.html">Developer Guide</a> to set up the FVM toolchain, run codegen, and pass the <a href="testing-strategy.html">Testing & Quality Gates</a>.</li>
      </ul>
    </section>
  `;

  return {
    bodyHtml,
    tocList: toc,
  };
}

/* ------------------------------------------------------------------ Execution & Anti-Drift Engine */
async function main() {
  process.stdout.write(`[sync-docs] Synchronizing documentation against app repository (${appDir ? 'local: ' + appDir : 'remote: ' + APP_URL})...\n`);

  const manifest = {
    _comment: 'GENERATED by scripts/sync-docs.js from the ChessSRS app repo. Do not edit by hand.',
    appVersion,
    appRepo: `${OWNER}/${APP_REPO}`,
    sources: {},
    pages: [],
  };

  const dirtyFiles = [];
  const allSourceHashes = {};

  // Build all documentation pages dynamically
  for (const def of DOC_DEFINITIONS) {
    const { html, headings, sourceHashes } = await def.build();
    Object.assign(allSourceHashes, sourceHashes);

    const fullPageHtml = renderDocShell({
      id: def.id,
      title: def.title,
      kicker: def.kicker,
      desc: def.desc,
      sources: def.sources,
      bodyHtml: html,
      tocList: headings,
    });

    const dest = path.join(SITE, def.file);
    const existed = fs.existsSync(dest);
    const current = existed ? fs.readFileSync(dest, 'utf8') : null;
    const pageHash = sha256(fullPageHtml);

    manifest.pages.push({ file: def.file, hash: pageHash });

    if (current === fullPageHtml) {
      process.stdout.write(`  = ${def.file} (up to date)\n`);
    } else if (CHECK) {
      dirtyFiles.push(def.file);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, fullPageHtml);
      process.stdout.write(`  ${existed ? '~' : '+'} ${def.file}\n`);
    }
  }

  // Build Documentation Hub (docs/index.html)
  {
    const { bodyHtml, tocList } = buildHubIndexPage(allSourceHashes);
    const indexHtml = renderDocShell({
      id: 'index',
      title: 'ChessSRS Knowledge Base',
      kicker: 'Documentation Hub',
      desc: 'The complete technical reference manual for ChessSRS: architecture, spaced repetition mathematics, graph traversal, and formal specifications.',
      sources: ['ARCHITECTURE.md', 'SPEC.md', 'PRODUCT.md'],
      bodyHtml,
      tocList,
    });

    const dest = path.join(SITE, 'docs/index.html');
    const existed = fs.existsSync(dest);
    const current = existed ? fs.readFileSync(dest, 'utf8') : null;
    const pageHash = sha256(indexHtml);

    manifest.pages.unshift({ file: 'docs/index.html', hash: pageHash });

    if (current === indexHtml) {
      process.stdout.write(`  = docs/index.html (up to date)\n`);
    } else if (CHECK) {
      dirtyFiles.push('docs/index.html');
    } else {
      fs.writeFileSync(dest, indexHtml);
      process.stdout.write(`  ${existed ? '~' : '+'} docs/index.html\n`);
    }
  }

  manifest.sources = allSourceHashes;

  // Manifest write & check
  const manifestPath = path.join(SITE, 'docs/docs-manifest.json');
  const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
  const manifestExisted = fs.existsSync(manifestPath);
  const manifestCurrent = manifestExisted ? fs.readFileSync(manifestPath, 'utf8') : null;

  if (manifestCurrent === manifestJson) {
    process.stdout.write(`  = docs/docs-manifest.json (up to date)\n`);
  } else if (CHECK) {
    dirtyFiles.push('docs/docs-manifest.json');
  } else {
    fs.writeFileSync(manifestPath, manifestJson);
    process.stdout.write(`  ${manifestExisted ? '~' : '+'} docs/docs-manifest.json\n`);
  }

  if (CHECK && dirtyFiles.length > 0) {
    console.error(`\n[sync-docs] Documentation drift detected in ${dirtyFiles.length} file(s):`);
    for (const f of dirtyFiles) console.error(`  - ${f}`);
    console.error(`\nRun \`node scripts/sync-docs.js\` to synchronize website documentation with the app repo.`);
    process.exit(1);
  }

  process.stdout.write('[sync-docs] All documentation pages compiled dynamically and up to date.\n');
}

main().catch((err) => {
  console.error('[sync-docs] Error:', err);
  process.exit(1);
});

# ChessSRS Website — Implementation Tracker

Tracking progress across workstreams for the ChessSRS website and live interactive demo.

## Status Overview

All core milestones are completed and verified:
- [x] **Task 1: Repository Alignment**: Active repo pointers configured to `https://github.com/cassandre60/ChessSRS`.
- [x] **Task 2: Review Screen Fidelity**: Authentic pieces, fonts, board geometry, review queue, side-scope buttons, settings, and library sheets match Flutter app behavior.
- [x] **Task 3: Dynamic Design Sync**: `scripts/sync-design.js` extracts tokens, fonts, and piece silhouettes directly from the app codebase.
- [x] **Task 4: Launch Items**: Canonical/OG metadata configured for GitHub Pages ($0 free hosting); dead donation links removed until an account is created.
- [x] **Automated Drift & Parity Gates**:
  - `npm run sync:check`: Catches app asset/token changes.
  - `npm test`: Runs Biome linter, unit tests, and FSRS math tests.
  - `npm run test:e2e`: Playwright suite covering interactions, WCAG AA accessibility, style isolation, and structural parity against `design/app-ui.json`.
  - `npm run parity:pixels`: 60-pair visual comparison against Flutter goldens.

For detailed technical post-mortems of subtle bugs discovered and fixed during development, see [docs/ENGINEERING-NOTES.md](docs/ENGINEERING-NOTES.md).

---

## Workstream Summary

### Workstream A: Repo & Hygiene
- [x] Clean Git history, public repository, license (GPL-3.0), and GitHub Actions CI.

### Workstream B: Browser Testing
- [x] Playwright integration covering mouse click-to-move, touch taps, drag-and-drop, keyboard navigation, and mobile viewports.

### Workstream C: Demo Fidelity
- [x] Replicate default Diagram board theme with paper squares, ink hatching, and real SVGs.
- [x] Side column card layout with ruled action footer matching recent app redesigns.
- [x] True FSRS-5 scheduling logic and full legal move generator in `engine.js`.

### Workstream D: Authentic Assets
- [x] App screenshots and OpenGraph card (`assets/og.jpg`, 1200x630) verified.

### Workstream E: Content & Claims
- [x] `credits.html` and `privacy.html` pages in place; claims cross-referenced with app documentation.

### Workstream F: Design & Aesthetics
- [x] Responsive layout adapted to desktop, tablet, and mobile (>=240px board at all viewports).

### Workstream G: Performance & SEO
- [x] Self-hosted variable fonts (`InstrumentSans-var.ttf`, `Newsreader-var.ttf`, `Geist-Regular.ttf`, `InstrumentSerif-Regular.ttf`).
- [x] Clean metadata with zero placeholders.

### Workstream H: Deployment & Automation
- [x] Automated GitHub Actions deploy workflow to GitHub Pages with artifact minimization.

---

## Known Blockers (found 2026-10-07, pre-existing — not caused by launch polish)

- [x] **Demo scope-drawer drift vs app (`npm run sync:check` fails).** RESOLVED 2026-10-07: demo now mirrors the per-side drawers (top-bar colour squares, side-only Studies, 7-row actions sheet with Create, search filtering), `sync-strings.js` parses the new structure, `design/app-ui.json` regenerated, parity tests rewritten, pixel parity green with no re-baseline. Remaining known gap: collapsible group headers are not ported (untested either way).
- [x] **Horizontal overflow at phone widths (pre-existing).** RESOLVED 2026-10-07: root cause was grid blowout, not the headings — the PGN panel's unbreakable `white-space:pre` line set the `.stg` track's min-content width (~391px) and grid items default to `min-width:auto`, stretching the whole track on a 320px column (the `.st`/`h3` elements were victims). Fix: `.story>*{min-width:0}` scoped to the existing `max-width:860px` media query in `styles.css` (desktop sticky behavior untouched); the PGN card keeps its pre-existing `overflow:auto` internal scroll. Verified 0px overflow at 360/390/768/1280 via probe, queue rows unclipped, full e2e green.

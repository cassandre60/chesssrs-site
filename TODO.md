# ChessSRS Website — Implementation Tracker

Tracking progress across workstreams as defined in the handoff specification.

## Workstream A: Repo and Project Hygiene
- [x] Check GitHub CLI auth (`gh auth status`)
- [x] Initialize git repo, `.gitignore`, GPL-3.0 `LICENSE`
- [x] Create public remote repository `chesssrs-site` via `gh repo create`
- [x] Commit "Import starting block" and push to `origin main`
- [x] Add GitHub Actions CI workflow for test and build validation

## Workstream B: Real-Browser QA Harness
- [ ] Install Playwright (`@playwright/test`)
- [ ] Script responsive screenshot capture (375px, 768px, 1280px, 1920px; light & dark)
- [ ] Script demo state screenshots (initial, mistake reveal, empty state, sheets)
- [ ] Add accessibility audit (axe-core) & Lighthouse checks
- [ ] Add real end-to-end browser tests (drag-and-drop, click-to-move, keyboard, import, settings)
- [ ] Fix any layout or interaction regressions discovered in real browsers

## Workstream C: Demo Fidelity (Align Demo with Real App)
- [ ] Inspect app source in `/home/mohamed/Desktop/Github/Chess Repertoire SRS/`
- [ ] Run app in release mode (`flutter run -d linux --release` or inspect desktop build)
- [ ] Write fidelity specification (`docs/demo-spec.md`)
- [ ] Replace piece art with authentic app piece set (`assets/pieces/`) & check license
- [ ] Reproduce exact default "Diagram" board geometry, colors, and hatching (`BoardBackground`, `HatchPainter`)
- [ ] Match review screen layout, typography, figurines, icons, spacing (desktop & mobile)
- [ ] Match real review states, labels, buttons, and strings
- [ ] Match real menus, sheets, and options (settings, import, analyze, practice)
- [ ] Port/integrate true FSRS scheduling logic matching app behavior
- [ ] Integrate full legal move generation (chessops / chess.js / dartchess model)
- [ ] Verify keyboard, touch, and sound interactions match app
- [ ] Produce side-by-side verification screenshots in `docs/fidelity/`

## Workstream D: Authentic Screenshots & Marketing Assets
- [ ] Capture authentic release-build screenshots from the running app (light & dark, desktop & phone)
- [ ] Optimize images (WebP/AVIF with dimensions)
- [ ] Regenerate social graph preview image (`assets/og.jpg`, 1200x630, no debug banner)
- [ ] Update noscript fallback image

## Workstream E: Content & Claims Audit
- [ ] Audit platforms supported from `pubspec.yaml`, platform folders, CI/releases
- [ ] Source version dynamically from app `pubspec.yaml`
- [ ] Audit FAQ answers, pricing, privacy, offline capabilities against docs & app
- [ ] Compile `docs/claims-audit.md` documenting every factual statement with sources
- [ ] Create Credits / Licenses page (`credits.html` or modal) with GPL-3.0, OFL, and library credits
- [ ] Create Privacy page (`privacy.html`)
- [ ] Audit donation / Liberapay link

## Workstream F: Design Polish
- [ ] Refine typography scale, rhythm, and editorial aesthetic (restrained, modern, confident)
- [ ] Refine sticky scroll story with faithful product moments
- [ ] Verify light and dark mode contrast, visual polish, and mobile layout

## Workstream G: Performance, Accessibility, SEO
- [ ] Self-host fonts (Instrument Serif, Geist, Geist Mono under OFL) in `assets/fonts/`
- [ ] Remove Google Fonts external dependencies and tighten CSP
- [ ] Target Lighthouse 95+ across Performance, Accessibility, Best Practices, SEO
- [ ] Verify WCAG 2.2 AA compliance (contrast, keyboard navigation, aria-live regions)
- [ ] Verify canonical tags, Open Graph, Twitter cards, JSON-LD, sitemap, robots

## Workstream H: Deployment & Automation
- [ ] Configure GitHub Actions workflow for GitHub Pages deployment
- [ ] Set up CSP and base path compatibility (`/<repo>/` vs custom domain)
- [ ] Deploy to GitHub Pages and verify live URL
- [ ] Provide launch checklist for the user

## Workstream I: Documentation
- [ ] Update `README.md` with architecture, local dev, testing, and deployment guide
- [ ] Ensure `docs/demo-spec.md` is complete and maintained

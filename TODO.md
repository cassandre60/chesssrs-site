# ChessSRS Website — Implementation Tracker

Tracking progress across workstreams as defined in the handoff specification.

## Workstream A: Repo and Project Hygiene
- [x] Check GitHub CLI auth (`gh auth status`)
- [x] Initialize git repo, `.gitignore`, GPL-3.0 `LICENSE`
- [x] Create public remote repository `chesssrs-site` via `gh repo create`
- [x] Commit "Import starting block" and push to `origin main`
- [x] Add GitHub Actions CI workflow for test and build validation

## Workstream B: Real-Browser QA Harness
- [x] Install Playwright (`@playwright/test`)
- [x] Script responsive screenshot capture (375px, 768px, 1280px, 1920px; light & dark)
- [x] Script demo state screenshots (initial, mistake reveal, empty state, sheets)
- [x] Add accessibility audit (axe-core) & Lighthouse checks
- [x] Add real end-to-end browser tests (drag-and-drop, click-to-move, keyboard, import, settings)
- [x] Fix any layout or interaction regressions discovered in real browsers

# ChessSRS Website — Implementation Tracker

Tracking progress across workstreams as defined in the handoff specification.

## Workstream A: Repo and Project Hygiene
- [x] Check GitHub CLI auth (`gh auth status`)
- [x] Initialize git repo, `.gitignore`, GPL-3.0 `LICENSE`
- [x] Create public remote repository `chesssrs-site` via `gh repo create`
- [x] Commit "Import starting block" and push to `origin main`
- [x] Add GitHub Actions CI workflow for test and build validation

## Workstream B: Real-Browser QA Harness
- [x] Install Playwright (`@playwright/test`)
- [x] Script responsive screenshot capture (375px, 768px, 1280px, 1920px; light & dark)
- [x] Script demo state screenshots (initial, mistake reveal, empty state, sheets)
- [x] Add accessibility audit (axe-core) & Lighthouse checks
- [x] Add real end-to-end browser tests (drag-and-drop, click-to-move, keyboard, import, settings)
- [x] Fix any layout or interaction regressions discovered in real browsers

## Workstream C: Demo Fidelity (Align Demo with Real App)
- [x] Inspect app source in `/home/mohamed/Desktop/Github/Chess Repertoire SRS/`
- [x] Write fidelity specification (`docs/demo-spec.md`)
- [x] Replace piece art with authentic app piece set (`assets/pieces/`) & check license
- [x] Reproduce exact default "Diagram" board geometry, colors, and hatching (`BoardBackground`, `HatchPainter`)
- [x] Match review screen layout, typography, figurines, icons, spacing (desktop & mobile)
- [x] Match real review states, labels, buttons, and strings
- [x] Match real menus, sheets, and options (settings, import, analyze, practice)
- [x] Port/integrate true FSRS scheduling logic matching app behavior
- [x] Integrate full legal move generation (chess.js / dartchess model)
- [x] Verify keyboard, touch, and sound interactions match app
- [x] Produce side-by-side verification screenshots in `docs/fidelity/`

## Workstream D: Authentic Screenshots & Marketing Assets
- [x] Capture authentic release-build screenshots from the running app (light & dark, desktop & phone)
- [x] Optimize images (WebP/AVIF with dimensions)
- [x] Regenerate social graph preview image (`assets/og.jpg`, 1200x630, no debug banner)
- [x] Update noscript fallback image

## Workstream E: Content & Claims Audit
- [x] Audit platforms supported from `pubspec.yaml`, platform folders, CI/releases
- [x] Source version dynamically from app `pubspec.yaml`
- [x] Audit FAQ answers, pricing, privacy, offline capabilities against docs & app
- [x] Compile `docs/claims-audit.md` documenting every factual statement with sources
- [x] Create Credits / Licenses page (`credits.html`) with GPL-3.0, OFL, and library credits
- [x] Create Privacy page (`privacy.html`)
- [x] Audit donation / Liberapay link

## Workstream F: Design Polish
- [x] Refine typography scale, rhythm, and editorial aesthetic (restrained, modern, confident)
- [x] Refine sticky scroll story with faithful product moments
- [x] Verify light and dark mode contrast, visual polish, and mobile layout

## Workstream G: Performance, Accessibility, SEO
- [x] Self-host fonts (Instrument Serif, Geist, Geist Mono under OFL) in `assets/fonts/`
- [x] Remove Google Fonts external dependencies and tighten CSP
- [x] Target Lighthouse 95+ across Performance, Accessibility, Best Practices, SEO
- [x] Verify WCAG 2.2 AA compliance (contrast, keyboard navigation, aria-live regions)
- [x] Verify canonical tags, Open Graph, Twitter cards, JSON-LD, sitemap, robots

## Workstream H: Deployment & Automation
- [x] Configure GitHub Actions workflow for GitHub Pages deployment
- [x] Set up CSP and base path compatibility
- [ ] Push to main and verify deployment to GitHub Pages
- [ ] Provide launch checklist for the user

## Workstream I: Documentation
- [x] Update `README.md` with architecture, local dev, testing, and deployment guide
- [x] Ensure `docs/demo-spec.md` is complete and maintained


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

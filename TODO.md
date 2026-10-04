# ChessSRS Website — Implementation Tracker

Tracking progress across workstreams as defined in the handoff specification.

## Active High-Priority Tasks
- [x] Task 1: Update repository URLs across all files from deprecated `chess-repertoire-srs` to active `ChessSRS` (`https://github.com/mansourvery-hub/ChessSRS`).
- [x] Task 3: Dynamic sync of the demo's design inputs from the app repo (`scripts/sync-design.js`, `--check` fails on stale output). Replaces the earlier `sync-app-meta.js`, which only read a version string and hardcoded the accent list it claimed to extract.
- [ ] Task 2: Finish review-screen fidelity. Tokens, fonts, piece art, top bar, meta row, turn indicator, dashed blank, board frame and chapter titles are done and verified against the real app. Remaining:
  - [x] Notation line: full move history with figurines (`SrsNotationLine` truncates to the last 8 plies behind a `…`), answer rendered as SAN in the accent
  - [x] Answer slot: SAN plus figurines
  - [x] Menus: Library sheet (Settings, About) and Study Actions sheet (Analyze, Practice, Export, Pause/Resume, Rename, Delete) match the app
  - [x] Settings screen: section headers + `SrsSegmented`, `SrsSwitch`, `SrsAccentDots` — matches `SrsSettingsScreen`
  - [ ] Re-verify against the app's own screenshot harness (`SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart`) — committed screenshots are 46% stale
- [ ] Task 4: Complete launch items (Liberapay handle placeholder, custom domain docs). Blocked on user: replace `liberapay.com/YOUR_NAME` in `index.html` and optionally set custom domain per `README.md` launch checklist.

## Bugs the demo was hiding (found 2026-10-04, all fixed)

Every one of these rendered as a plausible-looking screen rather than an error, which is why the
gates did not catch them until the tests were brought back in line. Each now has a regression guard.

- The board **never rendered**. `labels()` asked for `.coords-r` from inside `.board`, where it does
  not exist (the gutters are siblings), so `setup()` threw on load and the 32 squares stayed empty.
  `.coords-in` was also never populated. Guarded by `the board renders on load`.
- Pieces were **invisible**: `PIECE_DEFS` was generated into `pieces.js` but never injected, so all
  96 `<use>` layers resolved to nothing. The injection also has to happen *after* `host.innerHTML`
  is assigned, which replaces the demo's entire contents. Same guard.
- The theme toggle **did nothing**. `apply()` wrote `data-theme` to `<html>`, but `sync-design.js`
  re-anchors the app's tokens from `:root` onto `.app`, so the attribute never matched — and it was
  written as the boolean `true`/`false` rather than the tokens' `"dark"`/`"light"`. Guarded by
  `the demo root carries its own theme tokens`.
- `.frame`, not `.app`, painted the background, so the demo measured its text against the
  **marketing page's** palette. Guarded by `no element in the demo is painted with the marketing palette`.
- The marketing stylesheet's `.meta` rule restyled the **app's** meta row (`#5F584D` on the app's
  surface, 2.73:1). The two stylesheets share class names and `styles.css` loads last; the colliding
  marketing classes are now namespaced `mk-meta` / `mk-sr`.
- `drawAn()` replaced `.view-settings`' innerHTML wholesale, detaching `#backBtn`'s startup listener
  and `#settingsBody` itself, so **every screen after Analyze** (settings, export, rename, import)
  threw. Guarded by `Analyze renders into the settings shell without destroying it`.
- `analyze`, `export`, `rename`, `delete`, `import` and `about` left the scrim up, putting a modal
  barrier over the screen that replaced the sheet.
- A closed sheet is `opacity:0`, not `display:none`. The old tests asserted `toBeHidden()`, which
  passes for a sheet that is still open — they were asserting nothing. Now keyed on the `open` class
  and `pointer-events`.

### Known, inherited from the app

- The app's `--ink3` is 3.0–3.4:1 where small text needs 4.5:1 (`design/docs/04-screens-and-flows.md`
  claims AA). The demo copies the token verbatim, so it inherits the shortfall rather than hiding
  it. `accessibility.spec.js` exempts exactly that token value and counts the exempted nodes in
  `ink3-shortfall`, so fixing the app turns the gate back on by itself.

## Ground truth for fidelity work

Do not review the demo against the app's markdown. Review it against the app's code and its
own captured screenshots:

- `design/tokens/tokens.{css,json}` — the app's design system, machine-readable
- `test/view/screenshot_capture_test.dart` — renders the real screens headlessly. Committed
  screenshots under `docs/screenshots/` had drifted: the prompt state is **46% different pixels**
  from what the current code renders.


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
- [ ] Match review screen layout, typography, figurines, icons, spacing (desktop & mobile)
- [ ] Match real review states, labels, buttons, and strings
- [ ] Match real menus, sheets, and options (settings, import, analyze, practice)
- [x] Port/integrate true FSRS scheduling logic matching app behavior
- [x] Integrate full legal move generation (chess.js / dartchess model)
- [x] Verify keyboard, touch, and sound interactions match app
- [ ] Produce side-by-side verification screenshots in `docs/fidelity/`

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
- [x] Push to main and verify deployment to GitHub Pages
- [x] Provide launch checklist for the user

## Workstream I: Documentation
- [x] Update `README.md` with architecture, local dev, testing, and deployment guide
- [x] Ensure `docs/demo-spec.md` is complete and maintained

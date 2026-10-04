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
  - [x] Match real review states, labels, buttons and strings — enforced by `scripts/sync-strings.js`
        against `design/app-ui.json`, and by `tests/e2e/app-parity.spec.js` against the running demo
  - [x] Match real menus, sheets and options — same gate. The rows still unported are listed in
        `KNOWN_GAPS` and asserted to remain in the manifest, so the excuse has to be revisited if the
        app changes
  - [x] Side-by-side verification screenshots in `docs/fidelity/` (4 captures: light and dark, desktop
        and phone)
  - [ ] 15 of the app's 23 settings rows are unported. Deliberate, not drift: they navigate to screens
        this demo does not port, so rendering them would be inventing UI. A scope decision.
  - [ ] Re-verify against the app's own screenshot harness (`SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart`) — committed screenshots are 46% stale. Needs FVM-pinned Flutter 3.47.3 and belongs on a local/nightly run, not per-commit. **This is the only remaining mechanism that would catch a purely visual overhaul** — see "What this still cannot do" below.
- [ ] Task 4: Complete launch items. Remaining:
  - [ ] Liberapay handle: `index.html` still carries `liberapay.com/YOUR_NAME`, so the donation and
    support links point at an account that does not exist. A dead donation link is worse than none —
    either supply the real handle or hide the block. **Blocked on the user.**
  - [x] Canonical URL: the site is served from the free `github.io` address and now says so in
    `canonical`, `og:url`, `og:image`, `twitter:image` and the JSON-LD, replacing the
    `chesssrs.example` placeholder. Gated by `every URL the page tells the world about points at the
    live origin`. A custom domain is optional and was declined on cost grounds; re-pointing is a
    five-line edit in `index.html` plus the `SITE_ROOT` constant in `tests/e2e/basic.spec.js`.

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
- **Dragging only appeared to work.** `place()` parks a piece with `translate(<col*100>%, <row*100>%)`
  but the drag handler wrote its offset in *pixels*, so the piece sat on a8 with a few pixels of travel
  while the destination highlight tracked the cursor. `pointerup` resolves the move from `idx(e)`, so
  the move itself landed correctly and every click-to-move test passed — the defect was only
  observable mid-drag. `.drag` was also never added, although `demo-reference.css` has always defined
  it, so a dragged piece painted under its neighbours with no lift and no grabbing cursor.
- **Space was shadowed twice.** `review_screen.dart` wraps the review screen in `CallbackShortcuts`
  (Space = Continue, S = Skip) and the app's board — chessground 10.3.0 — handles no keys at all, so
  nothing there can consume a key first. The demo's board bound Space as select-and-move, so after any
  click on it Space moved the cursor and overwrote the verdict. Separately, a focused `<button>` is a
  click on Space and the global handler skipped focused buttons, so Escape-closing the scope drawer
  left Space re-opening it.
- **The board collapsed to 0x0 on phones** (found 2026-10-04). `index.html` renders the `desktop`
  frame variant at every width and the app's rule for it is `aspect-ratio:1280/800`, so the frame's
  height is `width * 0.625`; the app then sizes the board as
  `--b: min(100cqw - 24px, 100cqh - 340px)`, reserving 340px of height below it. In a phone-width
  column that frame is 324x202px, so `202 - 340` went negative and clamped to zero: 32 pieces in the
  DOM, nothing painted, no tap target. On an 810px iPad it survived as a 98px board. Fixed in
  `styles.css` by giving the frame real height below 1000px, which hands the demo to the app's own
  narrow stacked layout. **Not** fixed by editing `assets/demo-reference.css`, which is generated from
  the app repo and must not diverge from it. Guarded by `the demo board stays usable across viewport
  widths`, which asserts size, that nothing visible spills out of the frame, and that a touch tap
  actually lands a move.

### Drift gate (added 2026-10-04)

`sync-design.js` only ever compared the demo's *assets*. Nothing compared its *structure*. Proof:
renaming `Daily limit` in `srs_settings_screen.dart` left `--check`, the unit suite and the whole e2e
suite green while the demo kept serving the old string. `scripts/sync-design.js` was the only file in
the repository that read the app at all.

Now two halves:

| | catches | where it runs |
|---|---|---|
| `scripts/sync-strings.js` | the app's screens changed and nobody re-derived the manifest | local / anywhere the app repo is present (`npm run sync:check`) |
| `tests/e2e/app-parity.spec.js` | the demo no longer matches `design/app-ui.json` | everywhere, including CI |

Covers the settings screen (section headers, row labels, row order, row kind, conditional rows), the
Library sheet, the Study Actions sheet, the scope drawer's copy, and the nothing-due / first-run
screens.

Building it immediately found real drift, all now fixed: the demo's everywhere row said
`All repertoires` where the app says `All studies`; the Library sheet had no `Preferences` group
header; the scope row was missing the memory bar and the `N positions` / `Paused` sub-line, with the
due numeral nested inside `.row-sub` instead of beside it; and the nothing-due screen had invented
an `All caught up` headline and a `Paused` state the app cannot produce.

Rows in `KNOWN_GAPS` (in the spec) are work the demo has not done — mostly settings rows that
navigate to screens this demo does not port. They are asserted to still exist in the manifest, so
the day the app drops one the excuse is forced to be revisited. Anything outside that list fails.

**What this still cannot do:** make the demo's DOM generate itself. That remains blocked by
`dartchess` not compiling to JavaScript. The gate makes drift impossible to *miss*, not impossible.
Pixel parity against the app's own `SRS_CAPTURE_SCREENSHOTS` harness is the natural next layer and
would catch a purely visual overhaul; it is local/nightly rather than per-commit.

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
- [x] Match review screen layout, typography, figurines, icons, spacing (desktop & mobile) — including
      the narrow-viewport board collapse fixed 2026-10-04, see "Bugs the demo was hiding"
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
- [x] Push to main and verify deployment to GitHub Pages
- [x] Provide launch checklist for the user

## Workstream I: Documentation
- [x] Update `README.md` with architecture, local dev, testing, and deployment guide
- [x] Ensure `docs/demo-spec.md` is complete and maintained

# ChessSRS Website

The official website and interactive web demo for **ChessSRS**, a free, open-source, local-first spaced-repetition trainer for chess openings.

---

## Architecture & Files

- **`index.html`**: Marketing homepage with semantic landmarks, header, hero with the live demo, sticky scroll story ("How it works"), principles, download guide, FAQ, community support, and footer.
- **`privacy.html`**: Privacy policy (zero cookies, zero analytics, local-first data model).
- **`credits.html`**: Complete credits and open-source licences (GPL-3.0, OFL fonts, chess.js, Lichess Mobile pedigree).
- **`styles.css`**: Design system tokens for the "Diagram" visual identity, responsive layout, dark/light themes, and demo styles.
- **`chess.bundle.js`**: Vendored chess rule engine (chess.js, BSD-2-Clause) for legal move validation and SAN compilation.
- **`engine.js`**: ChessSRS FSRS-5 mathematical scheduler (Decision D015 DSR model) and PGN parsing/export logic. Zero DOM dependencies.
- **`pieces.js`**: Authentic vector piece definitions (`gK`, `gQ`, `gR`, `gB`, `gN`, `gP`) from the ChessSRS Diagram identity, plus static story board rendering.
- **`demo.js`**: Interactive Review screen demo (study picker, study actions, library/settings sheet, FSRS binary recall, practice mode, keyboard navigation, and PGN import).
- **`assets/`**:
  - `fonts/`: Self-hosted OFL fonts (`Geist`, `Geist Mono`, `Instrument Serif`).
  - `app-review.webp`: High-resolution authentic screenshot of the app's review screen.
  - `og.jpg`: Social graph preview image (1200x630).
  - `favicon.svg`: SVG favicon matching the Diagram brand mark.
- **`build.py`**: Inlines CSS, JS, and font assets into `dist/index.single.html` for single-file previewing, writes strict `_headers` Content-Security-Policy, and packages `dist/chesssrs-site.zip`.
- **`docs/`**:
  - `demo-spec.md`: Detailed fidelity specification mapping app tokens, widgets, and strings to the web demo.
  - `claims-audit.md`: Source audit proving every factual claim on the site against the app repository.
  - `fidelity/`: Side-by-side screenshots verifying demo rendering across desktop and phone viewports in dark and light themes.

---

## Local Development & Testing

### Running locally
Serve the repository root with any static web server:
```bash
python3 -m http.server 4321
```
Open `http://localhost:4321` in your browser.

### Linting

Biome, wired into `npm test` and therefore into CI:

```bash
npm run lint        # check only
npm run lint:fix    # apply safe fixes
```

Rules are pinned explicitly in `biome.json` rather than inherited from `preset: recommended`.
That is deliberate: with the preset, `noUndeclaredVariables` was **not firing** — `preset: none`
and an explicit `"noUndeclaredVariables": "error"` both produced it. A gate that silently does
nothing is worse than no gate, so the rule that matters most is named outright.

Two things to know about its reach:

- It cannot see that `process.homedir` is not a function. Biome resolves `process` as a Node
  global and stops there; a bad *property* on a valid global is invisible to a linter. Catching that
  needs a typechecker or a test, not lint.
- **The formatter is off.** `biome format --write` rewrote ~1,900 lines, expanding `demo.js`'s
  deliberate one-line-per-statement style into multi-line blocks and burying the real fixes in noise.
  `npm run format` still exists if you want it as a one-off; it is simply not a gate.

### Running unit tests
Runs simulated DOM tests and FSRS math tests:
```bash
npm test
```

### Running Playwright end-to-end tests
Runs end-to-end user interaction tests and WCAG 2.2 AA accessibility audits with `@axe-core/playwright`:
```bash
npm run test:e2e
```

### Capturing screenshots
Captures responsive screenshots (375px, 768px, 1280px, 1920px) and demo states in both dark and light modes:
```bash
npm run screenshots
```

### Checking the demo still matches the app

Three gates, each catching a different kind of drift. The first two run in CI; the third needs the
app's golden captures and is deliberately not per-commit.

| command | catches | needs |
|---|---|---|
| `npm run sync:check` | the app's tokens, fonts or piece art changed | the app repo |
| `npm run test:e2e` | the demo's copy or structure drifted from `design/app-ui.json` | nothing |
| `npm run parity:pixels` | the app was redesigned **visually** and no token moved | the app's captures |

`parity:pixels` records how far the demo currently sits from the app's own golden captures and fails
only when that distance *moves*, because two independently written UIs will never agree pixel for
pixel — the app's own harness says as much. Re-baseline deliberately after reviewing the diff images:

```bash
npm run parity:pixels:update      # accept the current state
npm run parity:pixels:self-test   # prove the gate can still detect a change
```

### Reviewing the app's screenshots after a regeneration

If you regenerate the app's golden captures, review them side by side rather than one at a time:

```bash
cd "<app repo>"
SRS_CAPTURE_SCREENSHOTS=1 fvm flutter test test/view/screenshot_capture_test.dart --update-goldens

cd -                                  # back here
npm run review:screenshots            # serves before/after pairs on http://127.0.0.1:4777
```

The `--update-goldens` flag is required: the harness captures through `matchesGoldenFile`, which
**fails** on a differing golden and never overwrites it, so the command in that harness's own header
cannot refresh anything.

### Building
Compiles single-file bundle and writes deployment headers:
```bash
npm run build
```

---

## Deployment

Deployments to GitHub Pages run automatically on pushes to `main` via `.github/workflows/deploy.yml`.

### Launch Checklist
1. **Custom Domain (Optional)**: If attaching a custom domain, update `CNAME` and canonical URL in `index.html`, `sitemap.xml`, and `robots.txt`, plus the `SITE_ROOT` constant in `tests/e2e/basic.spec.js`.
2. **Donations**: The Liberapay account does not exist yet, so the donation links have been **removed** rather than shipped pointing at `liberapay.com/YOUR_NAME`. When the account is created, add the link back in two places — the `#support` section in `index.html` and the footer's Support list. The section's headline was changed to "Free software, built in the open." because it previously read "funded by the people who use it", which was a claim with no funding route behind it; revisit that wording too. `tests/e2e/basic.spec.js` fails if a placeholder href returns.
3. **Releases**: Verify latest releases on GitHub attach `app-release.apk` for direct download.

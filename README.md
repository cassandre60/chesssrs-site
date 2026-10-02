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

### Building
Compiles single-file bundle and writes deployment headers:
```bash
npm run build
```

---

## Deployment

Deployments to GitHub Pages run automatically on pushes to `main` via `.github/workflows/deploy.yml`.

### Launch Checklist
1. **Custom Domain (Optional)**: If attaching a custom domain, update `CNAME` and canonical URL in `index.html`, `sitemap.xml`, and `robots.txt`.
2. **Liberapay Handle**: Replace `liberapay.com/YOUR_NAME` in `index.html` once your donation account is created.
3. **Releases**: Verify latest releases on GitHub attach `app-release.apk` for direct download.

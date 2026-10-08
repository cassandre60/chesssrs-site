# ChessSRS Website — Claims and Facts Audit

This document verifies and sources every factual claim made on the ChessSRS marketing website and live demo against the official application source code (`/home/mohamed/Desktop/Github/Chess Repertoire SRS/`), documentation, commit history, and GitHub release metadata.

---

## 1. Product Identity and Positioning

| Claim | Verified Reality | Source / Proof |
|---|---|---|
| **Name** | `ChessSRS` | `pubspec.yaml` (name: `chess_srs`), `PRODUCT.md` |
| **Current Version** | `0.2.1-beta` / `0.2.0` | `pubspec.yaml` (version `0.2.0+1`), GitHub release tags `v0.2.0-beta`, `v0.2.1-beta` |
| **Licence** | GNU General Public License v3.0 (GPL-3.0) | `LICENSE` file in repo root, `COPYING.md` |
| **Foundation / Pedigree** | Fork of Lichess Mobile (Flutter) | `COPYING.md`, `README.md`, commit `0bf10db2a` |
| **Pricing** | Free, zero ads, no subscriptions | `docs/01-identity.md`, `COPYING.md`, `lib/src/` |
| **Account / Cloud** | Fully local-first, offline capable, no account required for local review | `docs/01-identity.md` ("No account, no cloud"), `lib/src/db/database.dart` (local SQLite database) |
| **Lichess Affiliation** | Independent project, not affiliated with or endorsed by Lichess.org | `COPYING.md`, `docs/01-identity.md` |

---

## 2. Platforms and Release Deliverables

| Claim | Verified Reality | Source / Proof |
|---|---|---|
| **Supported Platforms** | Flutter codebase with `android/`, `ios/`, `linux/` trees. `release.yml` packages a Linux tarball plus Android AAB/APK (throwaway-signed, testing only). Not packaged: iOS (no signing certs), Windows/macOS (no platform directories), Web. | `pubspec.yaml`, `.github/workflows/release.yml` header comment |
| **Release Artifacts** | Pre-release tags exist (`v0.1.3`–`v0.4.0`, all `--prerelease`) but carry **zero attached files** — verified 2026-10-08 via the releases API. The site's `#download` block fetches the release list live and offers a platform menu with direct downloads once files are attached; until then it waits as "Coming soon" (see `docs/site-invariants.md` I-1). | `gh api repos/cassandre60/ChessSRS/releases`, `download.js` |
| **Installation Instruction** | No installable builds yet, so the homepage download button waits as "Coming soon" with no external links and no toolchain instructions; direct platform downloads light up automatically once files are attached (see `docs/site-invariants.md` I-1). | Site `index.html` `#download`, `download.js` |

---

## 3. Chess Engine & Spaced-Repetition Mechanics

| Claim | Verified Reality | Source / Proof |
|---|---|---|
| **Target Move vs Engine Evaluation** | Reviews test memory of the user's prepared repertoire, not Stockfish best moves | `docs/01-identity.md`, `docs/review.md`, `lib/src/domain/review/review_engine.dart` |
| **Spaced-Repetition Algorithm** | FSRS-5 continuous DSR model adapted for chess binary recall (Decision D015) | `lib/src/domain/chess_fsrs_scheduler.dart`, `SPEC.md` |
| **Default Target Retention** | 88% default recall probability (configurable 80% to 95%) | `lib/src/domain/chess_fsrs_scheduler.dart` (`targetRetention = 0.88`), `srs_settings_screen.dart` |
| **Grading Philosophy** | Binary Pass/Fail (`again` / `good`). Thinking time is verification/calculation, not punished | `lib/src/domain/chess_fsrs_scheduler.dart` (enum `FsrsRating { again, good }`) |
| **Repertoire Import Formats** | PGN text, `.pgn` files, or Lichess study URL/ID | `lib/src/view/review/repertoire_import_dialog.dart`, `lib/src/import/` |

---

## 4. Visual Design & Interface ("Diagram")

| Claim | Verified Reality | Source / Proof |
|---|---|---|
| **Visual Identity** | "Diagram" design system: paper light squares, hatched dark squares, 1.5px ink border | `lib/src/design/tokens.dart`, `board_background.dart`, `hatch.dart` |
| **Color Accents** | Four accessible accents: Ultramarine (default), Violet, Verdigris, Ochre | `lib/src/design/tokens.dart` (`kSrsAccents`) |
| **Board Geometry** | Dark squares hatched at 45° with 1.1px ink lines spaced 4.6–7.0px apart | `lib/src/design/board_background.dart` (`SrsBoardBackgroundPainter`) |
| **Piece Set** | Original vector silhouettes designed specifically for the Diagram print-book identity | `assets/pieces/silhouettes.svg`, `piece_set.dart` |
| **Fonts** | Instrument Sans (UI, tabular figures) and Newsreader (study annotations and notes) | `lib/src/design/tokens.dart` (`SrsText.ui`, `SrsText.read`) |

---

## 5. Website Privacy & Operations

| Claim | Verified Reality | Source / Proof |
|---|---|---|
| **Cookies & Tracking** | Zero cookies, zero analytics, zero external tracking beacons | Audit of all web source (`index.html`, `main.js`, `demo.js`, `styles.css`) |
| **Local Storage** | Only stores user preference for color theme (`light` / `dark`) | `index.html` inline script, `main.js` |
| **Content Security Policy** | Strict CSP: `default-src 'self'`, `font-src 'self'`, no third-party script/font origins; `connect-src` allows only the public releases API (`api.github.com`) so `#download` can fetch the live build list. | `_headers`, `build.py` |
| **Donations / Funding** | Community funded via the support routes listed in `#support` and the footer; every route is verified live (see `docs/site-invariants.md` I-2). No platform is named here so new providers need no doc edit. | `index.html` `#support`, `tests/support-links.test.js` |

# ChessSRS Web Demo Fidelity Specification

This specification documents the exact tokens, layout, assets, states, copy, and logic derived directly from the ChessSRS Flutter application source repository (`/home/mohamed/Desktop/Github/Chess Repertoire SRS/`) and its "Diagram" design package.

---

## 1. Visual Identity & Design Tokens ("Diagram")

Derived from `lib/src/design/tokens.dart`, `hatch.dart`, `board_background.dart`, and `piece_set.dart`.

### 1.1 Color Tokens
| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--page` | `#E2E6E9` | `#050608` | Surrounding canvas/window background |
| `--ground` / `--bg` | `#F1F3F4` | `#0D0F13` | Review screen background |
| `--surface` | `#FAFBFB` | `#151920` | Panels, sheets, popovers, dialogs |
| `--ink` | `#101318` | `#ECEEF1` | Primary text, board frame, active tabs |
| `--ink2` | `#4B5361` | `#9BA2AE` | Secondary text, inactive states, coordinates |
| `--ink3` | `#868D98` | `#666D79` | Subtle text, tertiary metadata, wide coordinates |
| `--hairline` | `rgba(16, 19, 24, 0.13)` | `rgba(236, 238, 241, 0.14)` | Borders, divider lines, sheet borders |
| `--hairline-soft` | `rgba(16, 19, 24, 0.055)` | `rgba(236, 238, 241, 0.06)` | Pill backgrounds, subtle containers |
| `--scrim` | `rgba(16, 19, 24, 0.22)` | `rgba(0, 0, 0, 0.5)` | Modal backdrop |
| `--square-light` | `#F8F9FA` | `#232A36` | Board light squares |
| `--square-dark` | `#E7EAED` | `#10141B` | Board dark squares |
| `--hatch` | `rgba(16, 19, 24, 0.30)` | `rgba(236, 238, 241, 0.22)` | 45-degree ink hatch lines on dark squares |
| `--halo` | `#F8F9FA` | `#232A36` | Text shadow halo for coordinates on board |

### 1.2 Accent Tokens (4 Verified Accents)
Default accent in app: **Ultramarine**.
- **Ultramarine** (Default): Light `#2A3FD9`, Dark `#8A9BFF`
- **Violet**: Light `#6B3FD4`, Dark `#B7A0FF`
- **Verdigris**: Light `#0B7A83`, Dark `#5FCBD3`
- **Ochre**: Light `#9A5500`, Dark `#F2B04D`

### 1.3 Board Hatching Geometry
- Angle: 45 degrees (`/` direction, bottom-left to top-right).
- Stroke width: 1.1px (or relative SVG equivalent).
- Gap: `(size / 100).clamp(4.6, 7.0)` perpendicular distance.
- Dark square rule: `(file + rowFromTop) % 2 === 1`. `a1` is dark, `h1` is light.
- Frame: 1.5px solid `--ink` border around the board.

### 1.4 Typography & Fonts
- **UI & Interface**: `Instrument Sans` (Google Fonts / self-hosted OFL), weights 400, 500, 600, tabular figures for numbers.
- **Reading / Study Notes**: `Newsreader` (Google Fonts / self-hosted OFL), serif.
- **Chess Notation**: Figurines drawn from authentic piece vector definitions.

### 1.5 Piece Art
- Sourced directly from `assets/pieces/{light,dark}/svg/` (original ChessSRS piece set designed for the Diagram identity).
- White pieces: Halo `#F8F9FA` (light) / `#11141A` (dark), Line `#101318` / `#0D0F13`, Fill `#FFFFFF` / `#ECEEF1`.
- Black pieces: Halo `#F8F9FA` (light) / `#11141A` (dark), Line `#101318` / `#ECEEF1`, Fill `#101318` / `#0D0F13`.

---

## 2. Review Screen Layout & States

Derived from `lib/src/review/` and `docs/04-screens-and-flows.md`.

### 2.1 Top Bar
- **Colour Squares**: a white and a black square (20px on 44px targets); the live side carries a 2px accent ring. Tapping a square selects that colour's scope and opens its drawer; tapping the live square re-opens the drawer without restarting the session.
- **Due Count Indicator**: the live side's due, e.g. `16 due` (tabular numerals in `--ink` 600, `due` in `--ink2`), or `Practice` in accent color when drilling.
- **Overflow Button (`⋯`)**: Opens the Library sheet.

### 2.2 Board Region
- Desktop/wide (>= 720px): Outer coordinates in gutter (`--ink3`, 11.5px).
- Mobile/narrow (< 720px): Inner coordinates (`--ink2`, 9.5px with halo).
- Active piece selection highlight: Accent outline / subtle tint.
- Repertoire correction arrow: Pen-stroke arrow from source to target square in accent color.

### 2.3 Side Panel / Feedback Region
- **Prompt State**:
  - Context meta line: `[Study Title] · [Chapter Name]`
  - Side to play: `White to play` or `Black to play`
  - Headline move notation with dashed blank slot `___` for the expected move.
  - Action button: `Skip` (shows answer).
- **Correction State** (on wrong move or skip):
  - Large answer move in accent color (e.g. `Nc3` with figurine).
  - Help text: `Play this move to continue. The position will come back soon.`
  - Action button: `Continue` (or auto-advances on playing move).
- **Study Note State**:
  - Shown if study has comments on this move and "Show notes after a move" is active.
  - Note rendered in `Newsreader` font with 2px accent rule on the left.
  - Source attribution: `From your study`.
  - Action button: `Continue` (or Spacebar).
- **Nothing Due State** (Queue empty):
  - Heading: `Nothing due.`
  - Subtitle: `Next review in [time].`
  - 3-state Memory Bar: `[n] retained`, `[n] learning`, `[n] new`.
  - Action buttons: `Practice`, `Choose a repertoire`.

---

## 3. Real FSRS Scheduling Logic

Derived from `lib/src/domain/chess_fsrs_scheduler.dart`.
- Default target retention: **88%** (`0.88`).
- Rating model: Binary (Decision D015):
  - `good`: first attempt correct.
  - `again`: wrong move, hint/skip used, or mistake.
- FSRS-5 continuous DSR model:
  - Decay constant `kFsrsDecay = -0.5`.
  - Factor `kFsrsFactor = (0.9 ** (1 / -0.5)) - 1 = (0.9 ** -2) - 1 = 19/81 ≈ 0.2345679`.
  - Retrievability: `R(t, S) = (1 + kFsrsFactor * t / S) ** kFsrsDecay`.
  - Solved Interval: `I = (S / kFsrsFactor) * (R_target ** (1 / kFsrsDecay) - 1)`.
- Default ChessFSRS weights ($w_0 \dots w_{14}$):
  `w0=0.35, w2=2.20, w4=4.93, w5=0.94, w6=1.05, w7=0.01, w8=1.49, w9=0.14, w10=0.94, w11=2.18, w12=0.09, w13=0.34, w14=1.26`.

---

## 4. Sheets & Modals
- **Scope List**: one drawer per colour, listing only that colour's studies under `Studies` (the `Openings` group appears when opening hubs exist), with due counts, memory bars and per-study options; full-width `Import PGN` pill at the foot; live search with a `Nothing matches "…".` empty state.
- **Study Actions Sheet**: `Create <other side> repertoire`, `Analyze`, `Practice`, `Export PGN`, `Pause`/`Resume`, `Rename`, `Delete` — four hairline-separated groups, subtitles on all but Rename/Delete, no title.
- **Library Sheet**:
  - `Import PGN` (sub: `From a file, pasted text or a Lichess study`)
  - `Explore`: `Analysis board`, `Opening explorer`, `Board editor`
  - `Settings`
  - `About and licences`
- **Settings Sheet**:
  - Daily limit (positions per day)
  - Target retention (default 88%)
  - Show notes after a move (toggle)
  - Show arrows and circles (toggle)
  - Accent color picker (`Ultramarine`, `Violet`, `Verdigris`, `Ochre`)
  - Theme (`Light`, `Dark`, `System`)
  - Sound (`Soft move and correction sounds`)
  - Scheduling algorithm (FSRS)

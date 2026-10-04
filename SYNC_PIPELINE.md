# ChessSRS Demo ↔ App Sync Pipeline

The app repo (`/home/mohamed/Desktop/Github/Chess Repertoire SRS`) is the source of truth. This
document records which of its inputs reach the demo without a human in the loop, and which do not.

## What syncs automatically (`scripts/sync-design.js --check`, a CI gate)

| Source | Target | Note |
|--------|--------|------|
| `design/tokens/tokens.css` | `assets/demo-tokens.css` | Re-scoped from `:root` onto `.app`, so the marketing page keeps its own palette |
| `design/reference/styles.css` | `assets/demo-reference.css` | Verbatim. Never hand-edited — additions live in the `DEMO-ONLY ADDITIONS` block of `styles.css` |
| `design/tokens/tokens.json` | `assets/app-meta.js` | Accent ids, fonts, motion |
| `pubspec.yaml` version | `assets/app-meta.js` version | |
| `assets/fonts/InstrumentSans[wdth,wght].ttf` | `assets/fonts/InstrumentSans-var.ttf` | Brackets renamed for URL safety; bytes untouched |
| `assets/fonts/Newsreader[opsz,wght].ttf` | `assets/fonts/Newsreader-var.ttf` | |
| `assets/figurines/*.svg` | `assets/figurines.js` + `assets/figurines/*.svg` | Inlined for the notation line, and copied for reference |
| `assets/pieces/light/svg/*.svg` | `pieces.js` | Silhouette geometry only; the halo/line/fill layers are coloured by CSS |

Because the tokens are re-anchored onto `.app`, the demo's theme and accent have to be written as
`data-theme` / `data-accent` on the demo root — on `<html>` they match nothing. `apply()` normalises
the theme to the tokens' own vocabulary (`"dark"` / `"light"`).

`--check` fails if any generated file is stale, so an app-side design change cannot reach the demo
unnoticed.

## What is hand-written, and why

| App component | Demo | Why it cannot be generated |
|---------------|------|---------------------------|
| `SrsReviewLayout` structure | `demo.js` shell markup | Flutter widget tree → HTML is a translation, not a copy |
| `SrsNotationLine` | `notationHTML()` | Dart → JS logic |
| `_AnswerSlot` | `reveal()` / `#answer` | As above |
| `SrsLibrarySheet` | `more()` | Copying the rows still means writing the DOM |
| `StudyActionsSheet` | `studyActions()` | As above |
| `SrsSettingsScreen` | `settings()` | Rows, section headers and controls |
| Board interaction, keyboard, drag | `demo.js` | Same |
| Legal moves / PGN | `chess.js` | See below |

These are mirrored from the app's *code*, not from its markdown: the committed screenshots under
`docs/screenshots/` drift from the current code by ~46% of pixels on the prompt state, so a
screenshot comparison is not a usable oracle. Review against the Dart.

## Chess logic

`dartchess` uses 64-bit bitboard operations and literals that do not compile to JavaScript, and
Flutter 3.47.3's `--wasm` flag still emits `-DFLUTTER_WEB_USE_SKWASM=false`. So the demo uses
`chess.js`, which is faithful for legal moves and PGN round-tripping but is a different
implementation from the app's engine — an edge case where they disagree is a place to look first,
not a place to assert equality.

## Running the sync

```bash
# Regenerate all design inputs from app repo
node scripts/sync-design.js

# Verify nothing is stale (CI gate)
node scripts/sync-design.js --check
```

## Adding a sync path

1. Extract it in `scripts/sync-design.js`.
2. Write the target through `put()`, never with a bare `writeFileSync`, so `--check` can see it.
3. Consume it in the demo from `window.CHESSSRS_META`, `window.PIECE_DEFS`, `window.FIGURINES` or
   the generated CSS — not from a literal in `demo.js`.
4. Add a row to the table above.

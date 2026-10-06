# ChessSRS Web Demo — Engineering Notes & Post-Mortems

This document preserves the engineering rationale, architectural constraints, post-mortems of subtle bugs discovered during development, and the design of the drift & pixel-parity gates.

---

## 1. Bugs Discovered & Repaired (October 2026)

Every one of these bugs rendered as a plausible-looking screen rather than an outright crash, allowing them to escape surface-level inspection until deterministic end-to-end regression tests were added.

### Board Failed to Render
- **Symptom**: Board displayed 32 squares but remained blank/empty.
- **Cause**: `labels()` queried `.coords-r` from inside `#bd`, where it does not exist (the gutters are siblings of `#bd`). `setup()` threw an uncaught error on load, leaving pieces unrendered and `.coords-in` unpopulated.
- **Guard**: `tests/e2e/interactions.spec.js`: `"the board renders on load"`.

### Missing Piece Sprites
- **Symptom**: Pieces were invisible despite DOM nodes existing.
- **Cause**: `PIECE_DEFS` was extracted into `pieces.js` but never injected into the SVG `<defs>`. Additionally, injection must occur *after* `host.innerHTML` is assigned, since rewriting `host.innerHTML` discards prior child nodes.
- **Guard**: Verified in `"the board renders on load"`.

### Inactive Theme Toggle
- **Symptom**: Tapping light/dark theme switch produced no visual change.
- **Cause**: `apply()` set `data-theme` on `<html>`, but `sync-design.js` re-anchors all app tokens from `:root` onto `.app` to prevent theme bleed into the marketing page. Furthermore, it wrote `"true"`/`"false"` instead of `"dark"`/`"light"`.
- **Guard**: `tests/e2e/style-namespace.spec.js`: `"the demo root carries its own theme tokens"`.

### Palette Pollution Across Boundaries
- **Symptom**: Contrast was measured against marketing dark colors rather than the app's surface.
- **Cause**: `.frame`, not `.app`, painted the background. Colliding class names (such as `.meta`) caused marketing styles in `styles.css` to overwrite app review screen components. Colliding classes were namespaced to `.mk-meta` / `.mk-sr`.
- **Guard**: `tests/e2e/style-namespace.spec.js`: `"no element in the demo is painted with the marketing palette"`.

### Analyze Screen DOM Overwrite
- **Symptom**: Exiting Analyze broke navigation to Settings, Export, Import, and About.
- **Cause**: `drawAn()` replaced `.view-settings`' `innerHTML` wholesale, discarding `#backBtn` and its event listeners.
- **Guard**: `tests/e2e/interactions.spec.js`: `"Analyze renders into the settings shell without destroying it"`.

### Broken Drag Offset & Lift
- **Symptom**: Clicking pieces worked, but dragging left the piece visually stuck at a8 while the drop highlight followed the cursor.
- **Cause**: `place()` positions pieces in percentages (`translate(${col*100}%, ${row*100}%)`), but pointermove wrote raw pixel offsets (`translate(${px}px, ${py}px)`), leaving pieces stuck near (0, 0). Also, `.drag` (which applies `scale(1.08)` and `z-index: 6`) was defined in CSS but never added to element classes.
- **Guard**: `tests/e2e/interactions.spec.js`: `"a dragged piece follows the pointer and is lifted above the others"`.

### Keyboard Shortcut Shadowing
- **Symptom**: Space stopped advancing reviews after interacting with menus or clicking the board.
- **Cause**: The board element intercepted Space for keyboard move selection, clobbering the review screen's global Space-to-Continue binding. Separately, closing dialogs left focus on buttons, which re-triggered on Space.
- **Guard**: `tests/e2e/interactions.spec.js`: `"Space is Continue everywhere, never a board key"`.

### Board Collapse on Small Viewports
- **Symptom**: On mobile devices (<=760px), board collapsed to 0x0.
- **Cause**: The frame had a fixed `aspect-ratio: 1280/800`. On a 390px mobile screen, frame height became 202px. The app sizes the board with `--b: min(100cqw - 24px, 100cqh - 340px)`. `202 - 340` went negative, clamping board size to 0. Fixed by providing an explicit height in `styles.css` below 1000px.
- **Guard**: `tests/e2e/basic.spec.js`: `"the demo board stays usable across viewport widths"`.

---

## 2. Drift & Parity Architecture

Because the demo cannot share compiled Dart code directly (`dartchess` relies on 64-bit integer bitboards which do not compile to JavaScript without Wasm/Skwasm overhead), the demo is maintained using a three-tier synchronization pipeline:

```
┌────────────────────────────────────────────────────────┐
│ App Repository: /home/.../Chess Repertoire SRS         │
└────────────────────────────────────────────────────────┘
          │ (1) Design Tokens & Assets
          ▼
┌────────────────────────────────────────────────────────┐
│ scripts/sync-design.js                                 │
│  - Generates assets/demo-tokens.css                    │
│  - Extracts pieces.js, figurines, app-meta.js          │
│  - Pinned by `npm run sync:check`                      │
└────────────────────────────────────────────────────────┘
          │ (2) Structural & Copy Manifest
          ▼
┌────────────────────────────────────────────────────────┐
│ scripts/sync-strings.js -> design/app-ui.json          │
│  - Scans settings rows, headers, library, idle copy    │
│  - Validated by tests/e2e/app-parity.spec.js           │
└────────────────────────────────────────────────────────┘
          │ (3) Visual Parity Gate
          ▼
┌────────────────────────────────────────────────────────┐
│ scripts/pixel-parity.js -> design/pixel-parity.json    │
│  - Compares rendered demo against app golden captures  │
│  - Block-averaging coarse diff filters text raster diff│
│  - Runs via `npm run parity:pixels`                    │
└────────────────────────────────────────────────────────┘
```

### Manifest Drift Gate
`scripts/sync-strings.js` scans Dart AST/source code directly from the app repo and commits `design/app-ui.json`. CI runs `tests/e2e/app-parity.spec.js` on every commit to ensure the demo's live DOM never drifts from the manifest.

### Pixel-Parity Gate
`scripts/pixel-parity.js` compares 60 surface pairs across 6 states, 5 resolutions, and 2 brightness modes:
- **Fine metric**: Per-pixel RGBA diff (measures typography, content, rendering).
- **Coarse metric**: 16x16 block-averaged luminance diff (measures composition, geometry, spacing).
- **Self-test**: `npm run parity:pixels:self-test` verifies sensitivity by artificially shifting a design token and verifying the gate fails.
- **Reviewer tool**: `npm run review:screenshots` launches an interactive local web UI (`http://127.0.0.1:4777`) to inspect before/after captures side-by-side.

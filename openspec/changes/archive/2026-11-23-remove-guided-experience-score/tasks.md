# Tasks

## 1. Removal

- [x] 1.1 Remove the score from the guided kind: model, edits, checks, inspector, overlay curve, outline `[n]`, reconcile change kind, and Mermaid storage (journey export writes 3). Verify: the guided test suites pass, with the score tests deleted or rewritten.
- [x] 1.2 Remove the unused contract and host pieces: `KindMarker.badge`, `KindBadge`, `focusMarkers`, `KindOverlay.curve`, the mode-bar chip, the node badge overlay and its CSS. Also remove the curve from the overlay layer and the draw.io decorations. Verify: typecheck, the canvas and export tests, and fallow.
- [x] 1.3 Remove the locale keys and the prompt lines, update the docs, and edit the in-flight changes' specs. Verify: the i18n coverage test and prompt tests pass, and `openspec validate` passes for every in-flight change.

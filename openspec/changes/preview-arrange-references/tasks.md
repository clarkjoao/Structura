# Tasks

## 1. Arranger outside the app store

- [x] 1.1 `applyLayoutResultEdges` and `applyDiagramAutoLayout` take an optional store (default: the app store).

## 2. Embed

- [x] 2.1 `protocol.ts`:
  - `ARRANGE` and `PreviewArrange`;
  - `arrange?` on `LOAD_GRAPH`;
  - `readArrange` normalises the settings and ignores a malformed value.
- [x] 2.2 `arrange.ts`:
  - `arrangePreviewDiagram` (throwaway store, plan, apply);
  - the structural signature, and the text-only patch.
- [x] 2.3 `EmbedPreview.tsx`:
  - keeps the arrange choice;
  - arranges in automatic mode, dropping a late result and falling back to host positions on failure;
  - `ARRANGE` re-arranges the last graph;
  - a click on an automatic reference reveals its original.

## 3. Read-mode zoom

- [x] 3.1 `buildReactFlowShellProps` read branch: `minZoom: CANVAS_MIN_ZOOM`.

## 4. Extension

- [x] 4.1 `src/arrange.ts`: settings, defaults, bounds, the menu items' labels, and the message.
- [x] 4.2 `extension.ts`:
  - `opscr.arrangePreview` QuickPick;
  - `workspaceState` per folder;
  - the status bar item;
  - `arrange` on every `LOAD_GRAPH`, and `STRUCTURA_ARRANGE` on change;
  - Re-layout re-arranges.
- [x] 4.3 `package.json` command and README.

## 5. Verification

- [x] 5.1 Unit tests:
  - protocol;
  - arrange (reference made, off, text-only edit keeps positions);
  - EmbedPreview;
  - the read-mode zoom;
  - extension `arrange.ts`.
- [x] 5.2 Gates:
  - `npm run typecheck`, lint, format, test;
  - the extension's typecheck and test;
  - `npm run build:embed`.
- [x] 5.3 The extension's end-to-end suite (`node e2e/run.mjs`, real VSCode):
  - the default picture is arranged in the webview;
  - references off;
  - then manual for the existing checks.

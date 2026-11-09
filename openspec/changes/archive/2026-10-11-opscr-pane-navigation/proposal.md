# Proposal

## Why

The pane draws the YAML and patches it from the canvas, but neither side tells where the other
is: finding the manifest of an element means reading the files, and finding the element of a
manifest means scanning the canvas. Some edits do not carry across at all (a label that is not an
edge type, a connection to an element outside the YAML, Kinds this view does not draw) and say
nothing. A conflict with the folder shows two buttons but not the two texts, switching files
reset the editor's undo history, and an empty folder showed an empty pane.

## What Changes

- **Plugin API 1.11.0** (additive): `api.canvas` — `getSelection()`, `onSelectionChange()` and
  `highlight()` (lights elements, bringing them into view when they are not). `CodeEditor` gains
  `path` (a model per file: its own undo, cursor and scroll), `revealLine`, `onCursorLine` and
  `original` (a comparison against `value`).
- **opscr plugin 0.13.0:** selecting an element or a connection on the canvas opens the manifest
  or edge that writes it; the element the cursor is in is lit on the canvas. The pane lists what
  does not carry between the two sides, each entry pointing at its element or line. A conflict
  can be compared with the folder's version. Each file keeps its own undo history. An empty folder
  offers a first manifest.
- **Shared:** `SourceIndex` (opscr-mapping) maps elements to the lines that write them and back,
  also used by the VSCode preview; `connectionKeys` moves there.

## Capabilities

### Modified Capabilities

- `plugin-system`: canvas selection and highlight; editor path, line navigation, comparison.
- `opscr-text-editing`: navigation both ways, what is not carried, comparison, empty folder.

## Impact

- Host: `plugin-api.ts`, plugin types, `PluginCodeEditor`, `LazyMonacoDiffEditor`, a highlight
  request store answered by `Canvas.tsx`, `frameUnlessInView`.
- Plugin: `reconcile` reports unwritten connections, `project` returns sources and what is not
  drawn, pane, i18n, e2e.

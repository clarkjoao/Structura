# Proposal

## Why

Manual testing of initiatives as Versions showed two kinds of noise. Binding a folder, or just
showing an initiative's Version, rewrote `opscr.layout.json` (the root's and the initiative's) with
the sizes the canvas gives its cards, so the pane said "2 unsaved" before the user touched anything.
And an initiative's new elements were placed by the layout engine's guess relative to the nearest
survivor, not beside the elements they connect to.

## What Changes

- The layout sidecar records the reader's arrangement only: a box moved on the canvas (or a panel
  resized) is written with the panels holding it; drawing alone, and the canvas measuring its cards,
  write nothing. A rename still re-keys a moved box, a deletion still drops its entry.
- `stabilizeLayout` (shared by the app, the plugin and the VS Code preview): when most of a panel's
  children are kept (an initiative over the root, a few additions), a new element goes beside the
  sibling it is connected to, along the flow (after what calls it, before what it calls), takes the
  room its drawn siblings take, and lands on the nearest free spot. When most is new (a first
  drawing), the engine's arrangement is kept as before.

## Impact

- `src/lib/opscr-mapping/stable-layout.ts` (+ synced copies in the opscr plugin and VS Code
  extension), plugin `engine/sync.ts` and `engine/engine.ts`.
- `e2e/initiatives.mjs` now checks that drawing writes nothing and that the new elements overlap
  nothing; `e2e/views.mjs` accepts a box back within one pixel (the sidecar keeps whole pixels).

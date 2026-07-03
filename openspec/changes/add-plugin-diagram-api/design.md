# Design: Plugin diagram read/write API (v1.1)

## Context

Additive extension of the API fixed by the archived RFC
(`openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md`) and implemented
by `add-canvas-plugin-mvp`. RFC rules carried forward unchanged: snapshots over internals,
sanctioned mutations through store actions with history, capabilities declared in the manifest,
additive growth by API minor version.

## Decisions

### D1 — Surface

```ts
interface StructuraPluginApi {
  // ... v1.0 members unchanged ...
  /** v1.1 — capability "diagram:read" */
  getActiveDiagramId(): string | null;
  getDiagram(diagramId?: string): DiagramSnapshot | null;
  /** v1.1 — capability "diagram:write"; active diagram only */
  updateComponent(componentId: string, patch: PluginComponentPatch): void;
  moveComponents(moves: Array<{ id: string; x: number; y: number }>): void;
}
```

`STRUCTURA_PLUGIN_API_VERSION` becomes `1.1.0`. `PluginComponentSnapshot` gains
`parentId: string | null`. `KNOWN_PLUGIN_CAPABILITIES` gains `diagram:read` and
`diagram:write` (older app versions reject manifests declaring them at install — the intended
failure mode for a plugin needing a newer API).

### D2 — Implementation mapping

- `getDiagram` → `toDiagramSnapshot(useDiagramStore.getState().diagrams[id])`; fresh objects
  per call, so plugins can never mutate store state through the return value.
- `updateComponent` → `sanitizeComponentPatch` + the store's `updateComponent` action (same
  path as `PluginPanelContext`, which already pushes history). Active-diagram scoped because
  the underlying action is; documented on the method.
- `moveComponents` → the store's `applyAutoLayout` action: it pushes one history step and
  batch-writes `nodeLayouts`, giving single-undo semantics for a whole rearrangement (the
  draw.io reorder-children equivalent). Unknown ids are skipped by the action's own guard.
- Both write methods warn (not block) on undeclared capability, like every v1 method.

### D3 — Example plugin (`examples/plugins/console-log-plugin.js`)

Replaces the stub at the same path. Demonstrates:

- `onDiagramChange` + `getDiagram`: keeps the last snapshot per diagram id and
  `console.groupCollapsed`-logs a structured diff (components added/removed/renamed/moved,
  connections added/removed) on every committed change.
- Manipulation via keyboard commands, mirroring how draw.io plugins register actions
  (a plain-JS single-file plugin cannot author a React panel component — it has no
  `React.createElement` in scope; exposing a rendering helper to plugins is a future
  ergonomics item, out of scope here). Under the no-sandbox trust model, listening to
  `keydown` is sanctioned plugin behavior; the listener is removed in `deactivate`:
  - **Alt+Shift+O** — arrange the active diagram's root components in a grid with one
    `moveComponents` call (single undo).
  - **Alt+Shift+U** — uppercase every component name via `api.updateComponent`.

## Risks / Trade-offs

- [Write API is active-diagram scoped] → matches today's store actions; cross-diagram writes
  would need new store surface — deferred until a real plugin needs it.
- [Snapshot-per-call cost on large diagrams] → acceptable: calls are user- or commit-driven,
  not per-frame; optimize with caching only if profiling demands it.

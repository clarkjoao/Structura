# Design

## Context

See proposal.md (Why) for motivation and specs/diagram-auto-layout/spec.md for the
behaviour. The facts below are the ones that shape the approach.

- **One planner.** Every whole-diagram arrangement goes through `planDiagramAutoLayout` /
  `applyDiagramAutoLayout` (`canvas/layout/autoLayoutDiagram.ts`). The callers are the
  shortcut and context menus through `useAutoLayout`, and the assistant and generation
  through `autoLayoutActiveDiagram`. The planner is pure; applying the plan writes to the
  store.
- **One ELK option set.** `ELK_OPTIONS_INTERACTIVE` (`layoutEngine.ts`) holds the base
  spacings, and `ELK_OPTIONS_LABELLED` overrides the between-layer gap (110) when an edge
  has a label. Both were tuned by measurement and are locked by the readability and
  generated-diagram baselines.
- **Collapse writes sizes as follows** (`useCanvasDrillHandlers`). Collapsing a panel
  stores the _expanded_ size in `component.collapsedWidth/Height` and writes
  `PANEL_COLLAPSED_W/H` to the node layout. `fromDiagram` still hands ELK every descendant
  of a collapsed panel. ELK therefore sizes the panel to its hidden children, and
  `resizableIds` writes that size back, while only `fitToContentIds` skips collapsed panels.
- **The store write.** `applyAutoLayout` (`layout.slice.ts`) pushes one history checkpoint
  and bumps `_lastLayoutWriteAt`, which is how `useLocalNodes` learns that positions
  changed without a drag. React Flow positions nodes with a CSS `transform` on
  `.react-flow__node`, and adds `.dragging` while a node is dragged.
- **Precedent for an optional diagram field.** `Diagram.textsVisible` is an optional field
  on the diagram that is absent by default, written by a slice action, and added without a
  schema bump.

## Goals / Non-Goals

**Goals:**

- Normal density with no overrides produces byte-identical results on every existing
  baseline.
- One code path decides spacing, so the toolbar, the shortcut, the assistant and generation
  cannot drift apart.
- The animation adds no store writes and no per-frame React work, and does not touch
  `useLocalNodes`.

**Non-Goals:**

- Laying out a collapsed panel's hidden subtree (it is simply left alone).
- Interpolating edge waypoints during the transition.
- The selection layout (`layoutScopedNodes`) adopting settings or animation in this slice.

## Decisions

### 1. Settings shape: `Diagram.layoutSettings`, optional, no schema bump

```ts
type LayoutDensity = "compact" | "normal" | "spacious";
interface DiagramLayoutSettings {
  density?: LayoutDensity; // absent = "normal"
  layerGap?: number; // absent = density-scaled default
  nodeGap?: number; // absent = density-scaled default
}
// Diagram.layoutSettings?: DiagramLayoutSettings
```

The field is added and optional, and absent means today's behaviour, so an old workspace
loads unchanged. Following the `textsVisible` precedent, `PERSIST_SCHEMA_VERSION` is not
bumped. A setter normalises the field by deleting it when it equals the defaults, so a
diagram that was never touched stays byte-identical in storage and exports. The plan
reserves `mode` and `direction` for slices 2 and 3; they are not added here.

_Alternative considered:_ `canvas-preferences.store`, kept per browser. Rejected because
the arrangement is part of how the diagram reads, so the viewer, shared links, folder sync
and a collaborator must all see the same value.

### 2. Density is a multiplier applied in the engine, not a second option set

`layout(graph, { spacing })` gains an optional `spacing` argument. A pure function
`elkSpacingFor(settings, labelled)` builds the effective options:

- It starts from `ELK_OPTIONS_INTERACTIVE`, plus `ELK_OPTIONS_LABELLED` when an edge has a
  label.
- It multiplies these five keys by the density factor (compact 0.75, normal 1,
  spacious 1.35):
  - `nodeNodeBetweenLayers`
  - `spacing.nodeNode`
  - `spacing.edgeNode`
  - `spacing.edgeEdge`
  - `edgeEdgeBetweenLayers`
- It rounds the results.
- It then applies `layerGap` → `nodeNodeBetweenLayers` and `nodeGap` → `spacing.nodeNode`,
  each clamped to [40, 308].

At factor 1 with no overrides the function returns the original strings unchanged. A unit
test asserts that, and the baselines prove it end to end. Port spacing (`HANDLE_PITCH`)
and padding are not scaled, because they encode where the canvas draws handles and
headers.

_Alternative considered:_ absolute pixel values in the UI. Rejected because they discard
the measured ratio between the labelled and unlabelled gaps (110 vs 220) and invite
values that the baselines never saw.

### 3. Settings travel through `DiagramAutoLayoutInput`

`planDiagramAutoLayout` takes `settings?: DiagramLayoutSettings` and passes it to
`layout()`. The `layout` passed to `chooseAutoRefs` is wrapped so that reference selection
measures with the same spacing as the final run. `useAutoLayout` and
`autoLayoutActiveDiagram` read `diagram.layoutSettings` from the store, and no caller
builds spacing on its own.

### 4. Collapsed panels: leaf at stored size, subtree excluded, never resized

In `fromDiagram`, the scope pass drops every component that has a collapsed panel among
its ancestors, using the same rule as `buildCollapsedPanelIds`. The rule is re-derived
locally (or moved to `diagram/utils`) so the layout path does not import from
`canvas/core`. Edges whose ends become excluded drop out through the existing
`included.has` check. The collapsed panel then enters as a leaf at its stored layout size,
which is already the collapsed size. `resizableIds` excludes collapsed panels, so the
expanded size kept in `collapsedWidth/Height` is never overwritten.

Descendants keep their parent-relative `nodeLayouts`. They are absent from the plan, so
`applyAutoLayout` never touches them, and expanding the panel restores them as they were.
Edge waypoints for connections to hidden elements are left as stored.

### 5. Settings change plus arrangement in a single store write

The menu does not write the setting and then call arrange, because that would push two
checkpoints. Instead it plans with the _candidate_ settings in memory and applies the plan
with them. `applyAutoLayout` gains an optional `layoutSettings` argument. When it is
present, the action writes it (normalised) inside the same `set()`, after the one
`pushHistory`. A history checkpoint holds only `snapshot`, `nodeLayouts`, `edgeLayouts`
and `versions`, not the diagram's top-level fields. So `DiagramSnapshot` gains
`layoutSettings`, and undo/redo restore it with the rest. A settings change also takes a
structural checkpoint, the same way reference reconciliation does: without it, a run
inside `HISTORY_COALESCE_MS` would fold into the previous checkpoint, and one undo would
skip past the density the user just picked. The primary Arrange action passes no
settings and writes only positions, which is today's behaviour.

If a second change arrives while ELK is running, the existing `isRunning` guard drops it.
The menu instead queues the latest requested settings and runs once more after the current
run finishes, so the last click wins.

### 6. Animation is a CSS class toggled around the write

`useAutoLayout` adds `data-layout-animating` to the React Flow wrapper just before the
store write and removes it after 320 ms (and on unmount). The global canvas CSS is:

```css
[data-layout-animating] .react-flow__node:not(.dragging) {
  transition: transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-layout-animating] .react-flow__edges,
[data-layout-animating] .react-flow__edgelabel-renderer {
  opacity: 0;
  transition: opacity 120ms;
}
@media (prefers-reduced-motion: reduce) {
  [data-layout-animating] .react-flow__node {
    transition: none;
  }
}
```

Nodes interpolate because React Flow only changes their `transform`. Edges are hidden
because their stored waypoints jump to the final route at once, and an edge chasing a
gliding node reads as broken. `fitView({ duration: 400 })` already runs alongside. The
selector excludes `.dragging`, so a drag that starts mid-transition follows the pointer
with no delay. The approach costs no store writes, and `useLocalNodes` already re-syncs on
`_lastLayoutWriteAt`.

_Alternative considered:_ interpolating positions in JS through `setNodes` per frame.
Rejected because it means one React Flow update per frame across the hot path, and it
would have to work around `useLocalNodes`.

### 7. UI: an Arrange split button in `CanvasBottomToolbar`

The primary half shows the lucide `Wand2` icon with the label "Arrange", plus the shortcut
hint `Kbd`. The chevron opens a `Popover` containing:

- a reserved **Mode** row: "Manual" is shown and selected, with "Automatic" disabled and a
  "soon" hint;
- **Density** as a three-option segmented radiogroup, styled like `CanvasViewOptions`'s
  scroll-mode options;
- a collapsible **Advanced** section with two sliders, _Gap between layers_ and _Gap
  between nodes_, plus "Reset to density".

Slider changes are debounced (250 ms) before arranging. The control is hidden when
`canEditCanvas` is false, with the same gate as the context menus. All copy lives under
`canvasToolbar.arrange.*` in `en.json` and `pt-BR.json`.

## Risks / Trade-offs

- **[Risk]** Excluding collapsed descendants changes the result for diagrams that already
  hold collapsed panels, so their baselines may move. → Check whether any reference, seed
  or generated diagram has a collapsed panel. If one does, update that baseline in its own
  commit and state the measured change in the message. Every other baseline must stay
  identical.
- **[Risk]** Edge labels and HTML overlays may live outside `.react-flow__edges` and stay
  visible mid-transition. → Hide `.react-flow__edgelabel-renderer` too, and verify by hand
  with labelled edges.
- **[Risk]** A slider dragged continuously could queue many ELK runs. → The debounce plus
  last-click-wins queue caps it at one run in flight and one pending.
- **[Trade-off]** Settings do not sync live in a collaboration session beyond what the
  diagram's other top-level fields already do. Collaboration behaviour for automatic
  arrangement is deferred to slice 2.
- **[Trade-off]** Edges disappear for about 300 ms on every arrangement. This is accepted
  because animating waypoints is out of scope.

## Migration Plan

This needs no data migration: the field is optional and absent means today's layout.
Rollback means removing the field reader. Any `layoutSettings` already stored stays in the
JSON and is ignored.

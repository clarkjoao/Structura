## Why

Structura's edge system was grown incrementally and is now a liability: editing is limited to axis-locked orthogonal segment dragging (only when `edgeStyle === Step`), there is no way to freely shape a connection, reconnect is not implemented at all, and there is no edge toolbar. The interaction feels foreign compared to the reference [React Flow editable-edge example](https://reactflow.dev/examples/edges/editable-edge). The implementation is also internally tangled — a single god-hook (`useCustomEdge`) and a 380-line `edgeBuilding.ts` mix path math, segment-drag, the connection→edge mapper, and geometry, while the `EdgeData` blob couples pure styling with flow/playback/recording/coverage/collab concerns. On top of that, waypoint and label edits bypass `pushHistory`, so they are silently not undoable (a hard-rule violation). We are treating the current edge implementation as disposable and rebuilding it to deliver native-feeling, freely editable edges on a clean foundation.

## What Changes

- **New `editable` edge style**: a dedicated `EdgeStyle.Editable` rendered as a Catmull-Rom curve through freely positioned control points. The existing `bezier`, `smoothstep`, `step`, and `straight` styles remain non-editable presets.
- **Freeform control points**: drag any point to any position (no axis lock), add a point by clicking a "ghost" midpoint on the path, remove a point by double-clicking it. Points render only when the edge is selected/hovered.
- **Edge reconnection** (new): drag either endpoint to a different node/handle — wired via `onReconnect` / `onReconnectStart` / `onReconnectEnd` with `reconnectable` edges. This capability does not exist today.
- **Floating edge toolbar** (new): contextual actions (e.g. reset points, delete, style) anchored to the edge via `EdgeLabelRenderer`.
- **Comfortable hitbox, hover, selection, cursor, keyboard/a11y**: precise selection with a wide invisible hit area, consistent hover feedback, correct cursors, and accessible control points — matching the reference UX under zoom and pan.
- **Undo/redo correctness (BREAKING internal behavior fix)**: control-point and label-offset mutations go through `pushHistory` (coalesced on drag start/end). Waypoint/label edits are undoable for the first time.
- **Data model change (BREAKING, persisted)**: `EdgeLayout.waypoints: Point[]` is replaced by `EdgeLayout.points: EdgeControlPoint[]` (each with a stable `id`) plus `pathType`. A persistence migration converts existing waypoints and bumps `PERSIST_SCHEMA_VERSION` 5 → 6.
- **Remove dead code**: delete the unused `ConnectionStyle.waypoints` field, the orthogonal segment-drag machinery, `edgeGeometry.ts` wrappers, and dead parameters in the label-drag hook.
- **Architecture refactor**: `features/canvas/edges/` is reorganized into `geometry/` (pure, tested), `interaction/` (control points, reconnect, label drag), `components/` (control point, hit area, toolbar, label), `overlays/` (particle, payload, collab — isolated non-editing concerns), and `data/` (connection→edge mapper, split `EdgeStyleData` vs `EdgeOverlayData` types). `EditableEdge.tsx` becomes a thin composition root replacing `CustomEdge`/`useCustomEdge`.

## Capabilities

### New Capabilities
- `editable-edges`: Interactive editing of diagram connections on the canvas — control-point add/drag/remove, path shaping, endpoint reconnection, label positioning, edge toolbar, selection/hover/hitbox behavior, and the persisted per-edge layout (control points + path type + label offset) with undo/redo.

### Modified Capabilities
<!-- None. Edge behavior is not yet covered by an existing spec; the plugin-system spec is unaffected. -->

## Impact

- **Domain (`features/diagram`)**: `EdgeLayout` type (`model/layout.types.ts`), `layout.slice.ts` actions (rename + add `pushHistory`), `actions.types.ts`, selectors (`useEdgeWaypoints` → control-point selectors), `connection.types.ts` (remove `waypoints`), `persist.config.ts` (v6 migration).
- **Canvas (`features/canvas/edges` + `Canvas.tsx`)**: full replacement of the edge subsystem; new `onReconnect*` wiring; edge type registration.
- **Export (`lib/export-service`)**: `export-drawio.ts` and `edge-builder.ts` read edge layout points instead of `waypoints`.
- **Keyboard/shortcuts**: `useEdgeWaypointShortcuts` / `reset-edge-waypoints` adapt to the new point model.
- **Persistence**: schema version bump 5 → 6 with a forward migration; no `IStoragePort` boundary changes.
- **Tests**: new pure-geometry unit tests; existing edge/segment-drag tests replaced.
- **Dependencies**: none added — Catmull-Rom/path math is implemented in-repo.

## Non-Goals

- Not changing the connection domain model beyond removing dead `waypoints` and adding the `editable` style (no new intents, directions, or transport presets).
- Not adding multi-selection edge editing, edge annotations, or edge-level menus beyond the basic toolbar (these are future work the architecture should enable, not deliver now).
- Not migrating existing `smoothstep`/`bezier`/`step`/`straight` edges to become editable — only the new `editable` style is control-point editable.
- Not reworking the handle-assignment system (`connectionDerivations`) or node handles.
- Not adding a backward (v6 → v5) downgrade path.

## 1. Domain model, store, and persistence migration

- [x] 1.1 Add `EdgeControlPoint = { id: string; x: number; y: number }` and `EdgePathType` to `features/diagram/model/layout.types.ts`; change `EdgeLayout` to `{ points?: EdgeControlPoint[]; pathType?: EdgePathType; labelOffset?: number }`
- [x] 1.2 Add `EdgeStyle.Editable` to `features/diagram/enums.ts` and export it via the diagram barrel
- [x] 1.3 Remove the dead `waypoints` field from `ConnectionStyle` in `model/connection.types.ts` and fix any resulting type references
- [x] 1.4 Replace `layout.slice.ts` edge actions with `setEdgeControlPoints`, `addEdgeControlPoint`, `removeEdgeControlPoint`, `resetEdgeControlPoints`, `setEdgeLabelOffset`; each calls `pushHistory` (coalesced per gesture via the existing marker convention); update `actions.types.ts` and `diagram.store.ts` wiring. Also extended the history snapshot (`DiagramSnapshot`/`pushHistory`/`undo`/`redo`) to capture `edgeLayouts` — previously omitted, so edge edits were never undoable.
- [x] 1.5 Replace the `useEdgeWaypoints` selector with `useEdgeControlPoints` (+ keep `useEdgeLabelOffset`); update `store/selectors/layout.selectors.ts` and the diagram README table
- [x] 1.6 Add a persist migration in `persist.config.ts` converting `edgeLayouts[*].waypoints` → `points` (ids via `generateId`), defaulting `pathType`, preserving `labelOffset`; bump `PERSIST_SCHEMA_VERSION` 5 → 6
- [x] 1.7 Unit-test the migration: load a v5 fixture with waypoints and assert converted `points` (stable ids, equivalent geometry) and idempotency; update `scene.utils.test.ts` edgeLayouts fixtures

## 2. Pure geometry modules

- [x] 2.1 Create `edges/geometry/paths.ts`: Catmull-Rom path builder for `editable` edges through `[source, ...points, target]` (linear variant included). Preset styles keep using React Flow's `getBezierPath`/`getSmoothStepPath`/`getStraightPath` at the mapper/component layer.
- [x] 2.2 Create `edges/geometry/projection.ts`: `getPointAtOffset`, `getClosestOffsetOnPath`, and ghost-midpoint placement helpers (pure, operating on control points)
- [x] 2.3 Unit-test `paths.ts` and `projection.ts` (zero/one/many points, degenerate coincident points, offset clamping)

## 3. Data mapper and type split

- [x] 3.1 Split `edges/data/edgeData.types.ts` into `EdgeStyleData` (label, technology, color, stroke, edgeStyle) and `EdgeOverlayData` (flow/playback/recording/coverage); old `edgeData.types.ts` re-exports for the outgoing CustomEdge. (Removing the `as unknown as` cast happens at the new EditableEdge read site in Group 4.)
- [x] 3.2 Extract the connection→React Flow edge mapper into `edges/data/buildEdges.ts` (from `edgeBuilding.ts`), keeping marker sizing and opacity/style logic; wired into `useCanvasEdges` and the `canvas` barrel
- [x] 3.3 Relocated `filterVisibleConnections` + marker helpers (`toMarkerType`, `getEdgeOpacity`) into `data/buildEdges.ts`; `edgeBuilding.ts` now holds only the legacy orthogonal geometry pending deletion

## 4. Editable edge core (control points)

- [x] 4.1 Create `edges/components/EdgeHitArea.tsx`: wide invisible hit path (pointer-events on stroke) with hover state and cursor feedback
- [x] 4.2 Create `edges/components/ControlPoint.tsx`: draggable point + ghost midpoints; add-on-click, drag (free, flow coords via `screenToFlowPosition`), remove-on-double-click; a11y (role/aria/tabIndex)
- [x] 4.3 Create `edges/interaction/useControlPoints.ts`: bridges pointer gestures to the store actions with per-gesture history coalescing (history at drag start / discrete add/remove/reset)
- [x] 4.4 Create `edges/EditableEdge.tsx` (thin): compose `EdgeHitArea` + rendered path (from `geometry/paths.ts`) + control points (only when selected/hovered) + label; replace the `c4 → CustomEdge` registration in `Canvas.tsx` with the new component

## 5. Reconnect and Canvas wiring

- [x] 5.1 Create `edges/interaction/useEdgeReconnect.ts` mapping RF reconnect callbacks to `updateConnection` (source/target/handles) with `pushHistory`; discard invalid drops
- [x] 5.2 Mark editable edges `reconnectable` and wire `onReconnect`/`onReconnectStart`/`onReconnectEnd` in `Canvas.tsx`
- [x] 5.3 Verify handle re-derivation (`connectionDerivations`) after reconnect onto multi-handle nodes; add a smoke test

## 6. Edge toolbar and label drag

- [x] 6.1 Create `edges/components/EdgeToolbar.tsx` anchored via `EdgeLabelRenderer`, shown on selection, with reset-points and delete actions; add `en` + `pt-BR` i18n keys
- [x] 6.2 Rewrite label drag as `edges/interaction/useEdgeLabelDrag.ts` (drop dead `updateConnection`/`connectionStyle`/`edgePath` params); persist `labelOffset` via `setEdgeLabelOffset` with history; reposition label on path changes
- [x] 6.3 Update `ConnectionPanel.tsx` reset action to use the new reset/label actions

## 7. Overlays re-attachment

- [x] 7.1 Move `EdgeParticle`, `EdgePayloadOverlay`, and collab highlight into `edges/overlays/`, rendered independently from `EdgeOverlayData` so overlay changes don't recompute editing geometry
- [x] 7.2 Confirm flow-mode playback/recording/coverage overlays render correctly; keep flow-mode stress/e2e tests green

## 8. Remove old implementation

- [x] 8.1 Delete `CustomEdge.tsx`, `useCustomEdge.ts`, `edgeGeometry.ts`, and the orthogonal segment-drag machinery (`buildSegments`/`computeSegmentDrag`/`buildOrthogonalPath`) and their tests (`edgeBuilding.segment-drag.test.ts`)
- [x] 8.2 Delete the old `useLabelDrag.ts` and `EdgeSvgLayer.tsx` once replaced; remove now-unused exports from the edges barrel/`index.ts`
- [x] 8.3 Grep for dangling references (`waypoints`, `useEdgeWaypoints`, `EdgeStyle.Step` segment gating) and clean them up

## 9. Export and shortcuts adaptation

- [x] 9.1 Update `lib/export-service/export-drawio.ts` and `edge-builder.ts` to read `points` instead of `waypoints`; adjust their tests
- [x] 9.2 Adapt `reset-edge-waypoints.ts` and `useEdgeWaypointShortcuts.ts` (and `useAutoLayout.ts` waypoint writes) to the control-point model
- [x] 9.3 Update `edges/README.md` / diagram `store/README.md` to describe the new edge architecture and control-point model

## 10. Verification

- [x] 10.1 Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run format:check` — all green
- [x] 10.2 Manually verify against the reference UX: select/hover/hitbox, add/drag/remove points, reconnect both endpoints, toolbar reset/delete, label drag, behavior under zoom/pan, and undo/redo of each edit
- [x] 10.3 Load a pre-migration workspace and confirm existing edges migrate and render with equivalent geometry

## Context

The current edge subsystem lives in `features/canvas/edges` and stores per-edge routing in `diagram.edgeLayouts[connId] = { waypoints: Point[], labelOffset? }`. Editing is limited to axis-locked orthogonal segment dragging and only when `edgeStyle === Step`. There is no reconnect and no edge toolbar. Internally the code is tangled: `useCustomEdge` is a god-hook; `edgeBuilding.ts` (≈380 lines) mixes the connection→edge mapper, orthogonal path building, segment-drag math, and geometry; `EdgeData` couples pure styling with flow/playback/recording/coverage/collab; `useLabelDrag` carries dead params (`updateConnection` noop, `connectionStyle`, `edgePath`); and `ConnectionStyle.waypoints` is dead. Waypoint/label mutations bypass `pushHistory`, so they are not undoable — a hard-rule violation.

Constraints that bound the rebuild:

- `edgeLayouts` is persisted (`persist.config.ts`, schema v5) and already has an array→record migration; changing its shape requires a forward migration and a version bump.
- `lib/export-service` (`export-drawio.ts`, `edge-builder.ts`) reads edge-layout waypoints.
- Flow/playback/recording/coverage/collab overlays ride on edges and must keep working.
- The handle-assignment system (`connectionDerivations`) determines source/target handles and is out of scope.
- Repo hard rules: strict TS (no `any`/`as unknown as`), type guards, i18n en + pt-BR for all UI strings, `pushHistory` before structural mutations, persistence only via `IStoragePort`.

The reference UX is the [React Flow editable-edge example](https://reactflow.dev/examples/edges/editable-edge): free control points, add-on-click ghost midpoints, remove-on-double-click, a smooth curve through the points, and endpoint reconnection.

## Goals / Non-Goals

**Goals:**

- Deliver native-feeling editable edges (control points, hitbox, hover, selection, toolbar, label drag, reconnect) matching the reference example under zoom/pan.
- Rebuild `features/canvas/edges` into small, single-responsibility modules with pure, tested geometry.
- Make control-point and label edits undoable via `pushHistory` (coalesced per drag).
- Introduce a persisted `points`-based `EdgeLayout` with a clean forward migration.
- Keep flow/playback/collab overlays working but decoupled from the editing core.

**Non-Goals:**

- Making preset styles (`smoothstep`/`bezier`/`step`/`straight`) control-point editable.
- Multi-edge editing, edge annotations, or rich edge menus beyond the basic toolbar.
- Reworking handle assignment or node handles.
- A v6 → v5 downgrade path.

## Decisions

### D1 — Dedicated `editable` style over universal editability

Add `EdgeStyle.Editable`; only these edges render control points and use the Catmull-Rom path. Presets stay geometric-only.

- **Why:** Matches the reference example exactly and avoids the intractable geometry of freeform points layered on an orthogonal `smoothstep` router. Keeps each style's mental model clean.
- **Alternative rejected:** Control points on any style — more surface area, messy smoothstep+points edge cases, diverges from the reference.

### D2 — `points: EdgeControlPoint[]` with stable ids, replacing `waypoints`

`EdgeLayout` becomes `{ points?: EdgeControlPoint[]; pathType?: EdgePathType; labelOffset?: number }` where `EdgeControlPoint = { id: string; x: number; y: number }`. Stable ids are the React keys and the drag/remove targets.

- **Why:** Ghost-midpoint insertion and per-point drag/remove need identity that survives reordering; positional indices are fragile. Ids also make undo diffs and collab patches stable.
- **Alternative rejected:** Keep index-keyed `Point[]` — reintroduces the identity bugs the reference example avoids.

### D3 — Pure geometry in `geometry/`, isolated from React

`geometry/paths.ts` builds the SVG path (Catmull-Rom for `editable`; thin adapters over React Flow's `getBezierPath`/`getSmoothStepPath`/`getStraightPath` for presets). `geometry/projection.ts` provides closest-point / offset-on-path / point-at-offset used by label drag and ghost placement.

- **Why:** Deterministic, unit-testable, no hook churn; replaces the geometry buried in `edgeBuilding.ts`/`edgeGeometry.ts`.

### D4 — Split responsibilities into folders

`EditableEdge.tsx` (thin composition) + `interaction/` (`useControlPoints`, `useEdgeReconnect`, `useEdgeLabelDrag`) + `components/` (`ControlPoint`, `EdgeHitArea`, `EdgeToolbar`, `EdgeLabel`) + `overlays/` (`EdgeParticle`, `EdgePayloadOverlay`, `CollabEdgeHighlight`) + `data/` (`buildEdges` mapper, `edgeData.types` split into `EdgeStyleData` vs `EdgeOverlayData`).

- **Why:** Replaces the god-hook and the mixed mapper; overlays isolated so their state changes don't recompute editing geometry (spec requirement).

### D5 — Undo/redo via `pushHistory`, coalesced per gesture

New `layout.slice` actions (`setEdgeControlPoints`, `addEdgeControlPoint`, `removeEdgeControlPoint`, `setEdgeLabelOffset`) push history once per gesture: capture history at drag start (or at discrete add/remove/reset), stream position updates without pushing, commit on drag end. Reuse the store's existing coalescing marker convention used by node drags.

- **Why:** Fixes the current hard-rule violation while keeping drags to a single undo step.
- **Alternative rejected:** Push on every pointer move — floods history; push never — not undoable.

### D6 — Reconnect via React Flow's native mechanism

Mark editable edges `reconnectable` and wire `onReconnect` / `onReconnectStart` / `onReconnectEnd` in `Canvas.tsx`, mapping the resulting `{ source, target, sourceHandle, targetHandle }` to a `updateConnection` mutation (with `pushHistory`). On invalid drop, leave the connection unchanged.

- **Why:** Uses the framework's tested endpoint-drag interaction instead of a hand-rolled one; the current code has no reconnect at all.

### D7 — Externally-controlled selection preserved

Keep the existing `visualState.selectedEdgeId` model (RF selection is externally controlled today, `deleteKeyCode={null}`), and drive control-point/toolbar visibility from it plus local hover. Register the single edge type under an `editable`-capable component (replacing the `c4 → CustomEdge` mapping).

- **Why:** Minimizes blast radius into the selection/keyboard subsystem; avoids regressing multi-select and panel wiring.

### D8 — Migration bumps schema 5 → 6

Add a forward migration converting each `edgeLayouts[*].waypoints: Point[]` into `points: EdgeControlPoint[]` (generate ids via the existing `generateId` util), default `pathType`, preserve `labelOffset`; delete the dead `ConnectionStyle.waypoints` field. Export-service reads `points`.

- **Why:** Existing diagrams must render with equivalent geometry; a version bump forces the migration to run.

## Risks / Trade-offs

- **Persisted migration correctness** → Cover with a persist-config unit test that loads a v5 fixture (waypoints) and asserts converted `points` with stable ids and equivalent geometry; keep the migration idempotent.
- **Catmull-Rom vs old orthogonal geometry differ visually** → Only the new `editable` style uses Catmull-Rom; migrated waypoints become editable points, so existing edges change router. Mitigate by defaulting migrated edges to a path type that best matches prior appearance and documenting the visual change in the change/PR.
- **Reconnect interacting with handle assignment** → Reconnect writes `sourceId`/`targetId`/handles; verify `connectionDerivations` re-derives assignments correctly and add a smoke test for reconnect onto multi-handle nodes.
- **Export regressions (draw.io/mermaid)** → Update `export-drawio.ts` and `edge-builder.ts` together with the model change; keep/adjust their existing tests.
- **Overlay coupling regressions during the rewrite** → Re-attach overlays behind a stable interface (`EdgeOverlayData`) and keep flow-mode e2e/stress tests green.
- **Scope creep from the god-hook removal** → Land as ordered, independently-reviewable commits (see tasks) so each step stays small and the tree stays green.

## Migration Plan

1. Land domain + store + persist migration (v6) with tests — no UI behavior change yet.
2. Land pure geometry modules with tests (no wiring).
3. Land the data mapper + type split.
4. Land the `EditableEdge` core (hit area + control points) behind the existing edge-type registration, replacing `CustomEdge`.
5. Wire reconnect in `Canvas.tsx`.
6. Add the edge toolbar and rewrite label drag.
7. Re-attach overlays.
8. Delete old `CustomEdge`/`useCustomEdge`/segment machinery/`edgeGeometry.ts`/dead fields.
9. Adapt export-service and waypoint shortcuts to the point model.

Rollback: revert the feature commits; the v6 migration is forward-only, so a downgrade would require restoring a pre-migration workspace snapshot (documented as out of scope).

## Open Questions

- Default `pathType` for migrated (previously orthogonal) edges — closest visual match vs. always Catmull-Rom. Decide during task 1 with a quick visual check.
- Whether the edge toolbar should also expose path-type/style switching now or defer to future work (proposal scopes it to reset + delete at minimum).

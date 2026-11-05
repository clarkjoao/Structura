# Tasks

## 1. Measurement harness

- [x] 1.1 Add the deterministic large-diagram fixture `cypress/support/seed-large-diagram.ts` at the current persist schema version; verify that the generated stats report 657 nodes, 711 edges, ~3k route corners, a payload of ~1 MB and a canvas of ~29k × 66k
- [x] 1.2 Add `scripts/perf-large-diagram.ts`, covering open, pan, zoom, child drag and header panel drag, with a `moved` check on the canvas transform; verify that one run against `vite preview` reports `moved: true` for both drags
- [x] 1.3 Add the `perf:large` npm script and a determinism unit test (same seed gives byte-identical payload, minimum sizes from the spec); verify that `npm run test` passes and `npm run perf:large` runs
- [x] 1.4 Record the baseline (median of 3) in `openspec/changes/large-diagram-performance/baseline.json`; verify the file holds every scenario

## 2. Viewport persisted on settle

- [x] 2.1 Make `onMoveEnd` schedule a trailing viewport write that a newer `onMoveEnd` replaces, and flush it on diagram switch, `pagehide`, `visibilitychange` and canvas unmount; verify with a hook test: 60 move-ends lead to one `updateViewport` with the final viewport, and a switch before the delay still writes
- [x] 2.2 Verify through the canvas-navigation e2e/unit tests that wheel pan, zoom and minimap behave as before and that the viewport survives a reload
- [x] 2.3 Re-measure; verify that `pan` long-task time and p95 improve over the baseline, and record the numbers in `baseline.json` under `after.viewport`

## 3. Cost of one store write

- [x] 3.1 Replace `createJSONStorage` with a `PersistStorage` whose wrapper keeps the latest state object and stringifies on debounce flush or forced leave flush; verify with persist tests: 50 writes in a window give one stringify, the saved payload equals a direct `buildPersistStoragePayload`, a leave flush writes synchronously, and the save-status transitions are unchanged
- [x] 3.2 Update `docs/concepts/canvas-hot-path.md` (move "stringify once per debounce" from _Remaining opportunities_ to _Already in place_, and name the test that locks it); verify the doc names the test file
- [x] 3.3 Re-measure; verify that child-drag and panel-drag long-task time do not regress and that the commit cost drops; record the numbers. The stringify alone made no measurable difference (one nudge ≈ 110 ms before and after), so add a `nudge` scenario (one store write per key press) to the harness and count renders per write
- [x] 3.4 Keep `EdgeLabelRevealContext` identity while its members are unchanged (`useRevealedLabelEdgeIds`); verify a hook test and an instrumented count: one nudge went from 711 `EditableEdge` renders to 0
- [x] 3.5 Hand React Flow a stable `onNodeClick` (`useStableCallback`), because its `NodeWrapper` is not memoised; verify `useCanvasEventHandlers.node-click-identity.test.tsx` (fails without the fix) and an instrumented count: the end of a pan went from 657 node renders to 0
- [x] 3.6 Keep each node's `handleOrder` identity while its slots are unchanged (`stabilizeHandleOrder`); verify `connectionDerivations.stableHandleOrder.test.ts` and an instrumented count: one nudge went from 434 node `data` rebuilds to 0
- [x] 3.7 Compare `main` against the branch in one session; verify `baseline.json` `comparison` shows nudge long tasks 2,222 → 50 ms, pan 45 → 66 fps, zoom 55 → 80 fps, child drag 488 → 222 ms

## 4. Route-aware edge culling

- [x] 4.1 Compute each edge's route box from React Flow's absolute node boxes and the stamped `data.layoutPoints`, without adding anything to `edge.data` (so identity holds while nodes move); verify `routeCulling.test.ts`: detour lane, a long edge with both endpoints off screen, pinned and unmeasured edges, and a 2,000-case property test that the window always contains the viewport plus its margin
- [x] 4.2 Add `useRouteCulledEdges` (one store selector, a snapped window, the mounted set growing during a gesture and released after 400 ms of stillness) and use it in `DiagramSurface`; verify `useRouteCulledEdges.test.tsx`: off-screen edges left out, the same array for a small pan, release after settling, deleted ids not counted, small diagrams untouched
- [x] 4.3 Verify on a production build of the fixture that culled edges stay reachable: select all + delete removes 657 elements and 711 connections, one undo restores them, the empty-viewport card reads "657 elements are off screen" with 0 edges mounted. Waypoint reset only reads selected edges, which are pinned
- [x] 4.4 Re-measure against the pre-culling build in one session: 711 → 151 edges mounted at open, DOM 20.6k → 13.9k, panel drag long tasks 2,350 → 95 ms (37 → 1), child drag 273 → 127 ms. Regression: zoom-out over the whole canvas mounts ~560 edges, 0 → ~260 ms of long tasks (batched mounting was tried and was worse); group 5 targets it
- [x] 4.5 Node-culling spike: open costs the same with 151 or 711 edges mounted, so nodes dominate opening; decision deferred until after group 5 and recorded in `design.md` Decision 3

## 5. Far-zoom level of detail

- [x] 5.1 Add `CanvasLodSync` (one zoom subscriber writing `data-lod` and the `CanvasLodContext` value, with hysteresis 0.45/0.5 from `canvas.constants.ts`); verify `canvasLod.test.ts` covers both thresholds and holding between them
- [x] 5.2 Render a `FarEdge` (resting path, stroke and arrowheads, clickable, no editing hooks, no label, no hops) for edges nothing points at under far detail, and hide node secondary content with `visibility` under `[data-lod="far"]`; verify `EditableEdge.lod.test.tsx` (same path as the full edge; selected and revealed edges stay full) and, on a production build, that 1,740 of 1,740 `data-lod-secondary` elements are hidden at 0.3 and visible after zooming in, with node size unchanged
- [x] 5.3 Verify at far zoom on a production build, with the same script run against the previous commit as the reference: clicking a node selects it, clicking an exposed edge selects it and switches it to the full edge (segment handles shown), box selection selects the same 3 nodes, and header panel drag moves the panel (`perf:large` `dragPanel.moved`)
- [x] 5.4 Re-measure against the previous commit in one session: open 878 → 608 ms long tasks, pan 58 → 78 fps, zoom 263 → 57 ms long tasks (the group 4 regression, fixed by releasing on zoom-in), panel drag 33 → 42 fps. The node CSS alone measured no effect

## 6. Line hops

- [x] 6.1 Measure line-hop cost at full detail before making the recompute incremental; verify with a profile of the 97-child panel drag: about 10 ms of 899 ms of JavaScript at zoom 0.6 and about 3 ms of 539 ms at zoom 1.0, so the incremental recompute is not implemented (design Decision 5)
- [x] 6.2 Skip hop computation while the level of detail is far; done by 5.2, because `FarEdge` never publishes a path to the registry. Verify that `EditableEdge.lod.test.tsx` shows a hop arc at full detail and none at far detail
- [x] 6.3 Rewrite the spec requirement to what holds and is tested ("Line hops are computed only between edges drawn in full"); verify that `openspec validate --strict` passes

## 7. Integration

- [x] 7.1 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run fallow:check` and the stress Cypress specs; verify all pass. Gates and stress specs pass; `editable-edges-smoke`, `panel-hit-geometry` and `selection-behavior-matrix` each fail one test with identical errors on `main` (60d51ec2), so those failures are pre-existing and outside this change
- [x] 7.2 Add the culling and level-of-detail rules to `docs/concepts/canvas-hot-path.md` ("Strategies that must not regress"), with the tests that lock them; verify that each rule names its test (§5b, §5c, §5d and the "Already in place" table)
- [x] 7.3 Write the before and after table (`main` compared with the final branch for every scenario, same session) into `baseline.json` `final`, for the PR description; verify it covers every scenario

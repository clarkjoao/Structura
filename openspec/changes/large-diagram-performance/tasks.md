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

- [ ] 4.1 Stamp a route box on `edge.data` in `buildEdge` from endpoints and stored corners, keeping identity when the box is unchanged; verify `useCanvasEdges.identity.test.ts` still passes and a new test checks the box for a detoured route
- [ ] 4.2 Add a canvas-level visible-edge-set hook (viewport plus a one-viewport margin, recomputed only when the viewport leaves the band, pinned ids always kept) and filter the array handed to React Flow; verify unit tests for the long off-screen-endpoints edge, the detour lane, pinned edges, and that unchanged sets keep the same array reference
- [ ] 4.3 Verify that culled edges stay reachable by non-render consumers: select-all and delete removes culled edges, reconnect works, export includes them, and the empty-viewport card counts every element (unit or e2e tests for each)
- [ ] 4.4 Re-measure; verify that mounted edges at the opening viewport are under half of 711, and that pan and panel-drag improve; record the numbers
- [ ] 4.5 Node-culling spike: measure the remaining node-side cost and choose option (a), (b) or (c) from design Decision 3; verify the decision and the numbers are written into `design.md` (and an ADR if it is (c)) before any node-culling code

## 5. Far-zoom level of detail

- [ ] 5.1 Add a single canvas-level component that writes `data-lod` with hysteresis from the zoom (threshold in `canvas.constants.ts`) and a context exposing the bucket; verify with a test: crossing the threshold changes the attribute once, and node and edge components do not re-render
- [ ] 5.2 Add the CSS rules that hide node secondary content, edge label chrome and widened hit areas under `[data-lod="far"]`; verify with an e2e check at zoom 0.3 that descriptions and icons are not displayed, and at zoom 1 that they are
- [ ] 5.3 Verify that clicking, header panel drag and box selection work at far zoom (e2e)
- [ ] 5.4 Re-measure; verify that open, pan and zoom improve, attach screenshots at 0.3 and 1 to the PR, and record the numbers

## 6. Incremental line hops

- [ ] 6.1 Make the line-hops registry track route boxes and recompute only the changed edges plus the edges whose box overlaps them; verify with a property test (random orthogonal routes, random changed subset, result equals a full recompute) and with the existing `lineHops` tests
- [ ] 6.2 Skip hop computation while the level of detail is far (edges publish `null`); verify that a registry test shows zero recompute work under far
- [ ] 6.3 Re-measure; verify that `findLineHops` time during panel drag drops in a profile and that panel-drag long tasks improve; record the numbers

## 7. Integration

- [ ] 7.1 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run fallow:check` and the stress Cypress specs; verify all pass
- [ ] 7.2 Add the culling and level-of-detail rules to `docs/concepts/canvas-hot-path.md` ("Strategies that must not regress"), with the tests that lock them; verify that each rule names its test
- [ ] 7.3 Write the before and after table (baseline compared with the final numbers for every scenario) into the PR description and into `baseline.json`; verify it covers every scenario

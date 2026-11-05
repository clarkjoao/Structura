# Proposal

## Why

Generated diagrams keep growing: ~650 nodes, ~700 edges, ~3k route corners, ~1.1 MB, on a
29k × 66k px canvas opened at zoom 0.3. On those the canvas stops being interactive. Panning
drops frames and dragging a large panel blocks the main thread for most of the gesture. The
size will keep growing, so the canvas has to cost according to what is **on screen and
readable**, not according to the size of the whole diagram.

Baseline, measured on a production build with `scripts/perf-large-diagram.ts` (fixture
`cypress/support/seed-large-diagram.ts`, median of 3 runs, headless Chromium 1600×1000):

| Scenario                      | Result                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Open                          | 1.7 s to first nodes, 0.9 s of long tasks, all 657 nodes + 711 edges mounted, 20.6k DOM elements |
| Pan at zoom 0.3               | 49 fps, p95 frame 50 ms                                                                          |
| Drag a panel with 97 children | 26 fps, 37 long tasks, 2.5 s blocked in a 4.3 s gesture                                          |
| Drag one child node           | 42 fps, 0.47 s of long tasks                                                                     |

Profiling (unminified production build) attributes the cost to:

- **Pan:** `updateViewport` took 653 ms over 60 wheel frames. The wheel handler calls
  `setViewport` once per frame, React Flow fires `onMoveEnd` for each call, and each one runs a
  full diagram-store `set()`. That `set()` stringifies the persisted workspace and re-renders
  `Canvas`.
- **Panel drag:** React re-renders every edge attached to a moved child. Line hops are
  recomputed over every edge on the canvas (`findLineHops` + `buildPathWithHops` ≈ 290 ms).
  Each edge also runs its own Zustand selectors and `useTranslation`.
- **Everything:** nothing is culled. React Flow's `isEdgeVisible` tests the box around the
  source and target nodes, not the route. A 40k px cross-panel edge would never be culled, and
  an edge whose route leaves that box could be culled while still visible.

## What Changes

- **Done:** a repeatable measurement harness, made of a deterministic large-diagram fixture and
  a Playwright script that reports frame and long-task metrics per scenario.
- Persist the viewport once per gesture, after it settles, not once per pan/zoom frame.
- Viewport culling. Nodes outside the viewport, plus a margin, are not mounted. Edges are culled
  by the bounding box of their **drawn route**, not by their endpoints. Edges whose endpoints
  are off screen still draw correctly.
- Zoom-based level of detail. Below a zoom threshold, nodes render a simplified body, and edges
  drop line hops, label chrome and hover hit areas. The level is read once per canvas, never
  subscribed to per node or per edge.
- Line hops are scoped. They are skipped under the low level of detail, and a recompute only
  revisits edges whose route changed and the edges whose box overlaps them.
- Persisted-state serialization runs once per persist debounce, not once per store `set()`.
- Smaller items that the profile showed are cheap get done only if the re-measure shows
  remaining cost: stable minimap `nodeColor`, per-edge selector hoisting.

Every item is re-measured against the baseline, and the PR records the numbers. None of them may
regress the rules in `docs/concepts/canvas-hot-path.md`.

## Capabilities

### New Capabilities

- `canvas-large-diagrams`: how the canvas keeps its cost bounded by what is visible and readable.
  This covers viewport culling, level of detail by zoom, line-hop scope, how often the viewport
  and workspace are persisted during continuous gestures, and the measurement harness that
  guards these.

### Modified Capabilities

None. The minimap, the wheel behavior and the empty-viewport recovery card in `canvas-navigation`
keep their current requirements. The new capability must preserve them; it does not change them.

## Non-Goals

- Auto-collapsing panels or semantic zoom. Panels already support `collapsed`, and tying it to
  zoom is a follow-up change.
- Storing edge points relative to a panel. That needs a persisted schema migration and an ADR.
- A spatial index (grid or R-tree) shared by culling, hit-testing and drop targets. It is only
  needed if the culling cost measures high.
- A canvas or WebGL layer for far zoom.
- Changing layout or generation, such as how the generator places empty panels or routes long
  edges. That lives outside Structura.
- Changing minimap defaults. It measured at about 9 ms per pan.

## Impact

- `src/features/canvas`: `Canvas.tsx`, `core/DiagramSurface.tsx`, `hooks/useCanvasEffects.ts`
  (wheel), `hooks/useCanvasEventHandlers.ts` (`onMoveEnd`), `nodes/useCanvasNodes.ts`,
  `edges/data/buildEdges.ts` (route bounds), `edges/EditableEdge.tsx`,
  `edges/lineHopsRegistry.ts`, `contexts/LineHopsContext.tsx`, node renderers (simplified body),
  and `hooks/useViewportOccupancy.ts`, which must keep counting every node and not only the
  mounted ones.
- `src/features/diagram/store/persist.config.ts`: when serialization runs.
- New: `cypress/support/seed-large-diagram.ts`, `scripts/perf-large-diagram.ts`, and an
  `npm run perf:large` script.
- Docs: `docs/concepts/canvas-hot-path.md` gains the culling and level-of-detail rules.
- No persisted schema change and no new dependencies.

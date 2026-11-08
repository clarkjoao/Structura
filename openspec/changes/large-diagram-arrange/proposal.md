# Proposal

## Why

Arranging a large generated diagram froze the page. On the reference fixture (`perf:large`, 657
nodes, 704 connections) Cmd/Ctrl+Shift+L took 44 s from the shortcut to the success toast, 44 s of
it long tasks: 1 fps, the worst frame 4.7 s. Users arrange right after generating, so the first
thing they do with a large diagram is wait with a frozen tab.

Measured on a production build, where the time went:

- ELK ran on the main thread (`elk.bundled.js`): 1.6–2.2 s per whole-diagram run.
- `chooseAutoRefs` runs ELK once for the diagram and once per reference trial, up to 6 hub trials
  and 12 one-edge trials: 19 runs. Each trial is also scored (`scoreLayout`, ~0.45 s), comparing
  every pair of edges segment by segment.
- Writing the result called the store once per node side and once or twice per connection
  (`updateHandleOrder`, `resetEdgeControlPoints`, `setEdgeControlPoints`, `setEdgeLabelOffset`):
  ~2,500 `set()`s, ~2 s, each copying the workspace and notifying every subscriber.

The trials buy little on a diagram this size: all 18 take crossings from 15,041 to 14,763 (−1.8%)
for 36 s; two hub trials reach 15,022 in 3.4 s, and hub trials 3–6 find nothing more.

## What Changes

- ELK runs in a Web Worker, one for the session. A worker that fails to load or dies falls back to
  ELK on the main thread; environments without `Worker` (tests) use the main thread. The result is
  the same: one ELK, another thread.
- The reference trials get a budget in graph size: up to 3,000 node-plus-edge units of extra
  layout work. Diagrams up to ~166 units keep all 18 trials; the fixture (1,361) gets 2. A count,
  not a clock, so a diagram always gets the same references.
- The arrangement's edge writes are one store action, `applyLayoutEdges`, one `set()`, with the
  same history behavior as the calls it replaces.
- `scoreLayout`'s crossing and edge-through-node counts skip pairs whose bounds are apart. The
  counts are unchanged.
- Since the page stays live while ELK plans, a plan is applied only to the diagram, scene and
  structure it was made from. Otherwise it is dropped, with a message to arrange again.
- `perf:large` gains an opt-in `arrange` scenario (`PERF_ARRANGE=1`).

## Impact

- Arrange on the fixture: 44.4 → 5.4 s, long tasks 44.0 → 0.9 s, 1 → 43 fps.
- Large diagrams (over ~166 nodes plus edges) can get fewer automatic references than before.
- Code: `canvas/layout/elkRunner.ts` (new), `layoutEngine.ts`, `autoRefs.ts`,
  `layoutReadability.ts`, `applyLayoutResult.ts`, `hooks/useAutoLayout.ts`; store action
  `applyLayoutEdges` (`layout.slice.ts`, `actions.types.ts`); i18n `autoLayout.discardedChanged`.
- Every caller of `applyLayoutResultEdges` benefits: Arrange, the assistant's generation, scoped
  layout and panel children.

# Design

## Context

Arrange is `useAutoLayout.runAutoLayout` → `planDiagramAutoLayout` (pure: `fromDiagram`,
`chooseAutoRefs`, ELK through `layoutWithSettings`) → `applyDiagramAutoLayout` (positions with
`applyAutoLayout`, then `applyLayoutResultEdges`). Measured on the fixture with a CPU profile of a
production build (`perf:large`, 657 nodes, 704 connections): 19 ELK runs on the main thread, 19
scores, and ~2,500 store writes.

## Decisions

### 1. Only ELK moves to a worker

The whole plan in a worker would also free the scoring, but the planner imports the diagram
barrel (store, persistence) and the element registry, which imports React node components; any of
them touching `window` or `localStorage` at import breaks the worker. ELK alone has no such
dependencies, and `elk-api` already speaks to `elk-worker.min.js` (`workerFactory`). It is most of
the time (1.6–2.2 s of ~2.5 s per trial). One worker for the session, so ELK's 1.5 MB is parsed
once.

`elk-api` waits for the worker with no timeout. The worker's `error` event rejects what is in
flight with `ElkWorkerFailure`, and `runElk` retries on the main thread and stays there. A layout
ELK rejects for its own reasons is not retried: it would fail the same way.

Checked on a production build: the arrangement with the worker and with `Worker` removed from the
page lands every node at the same position.

### 2. A trial budget in graph size, not in time

A trial costs about one whole-graph ELK run plus a score, both growing with the graph. The budget
is `floor(3000 / (nodes + edges))` trials, hubs first (up to 6), then one-edge references (up to
12). A time budget would cut faster on a slow machine but give the same diagram different
references on different machines; the layout contract sorts its input so that the same diagram
always lays out the same way (`layoutEngine.ts`, "Input order is not information").

Measured on the fixture (crossings over the drawn path, ms in Node):

| Trials          | ms     | Crossings | References |
| --------------- | ------ | --------- | ---------- |
| 0               | 2,755  | 15,041    | 0          |
| 2 hub           | 6,147  | 15,022    | 1          |
| 6 hub           | 14,484 | 15,022    | 1          |
| 6 hub + 4 lone  | 21,835 | 15,018    | 2          |
| 6 hub + 12 lone | 38,328 | 14,763    | 4          |

3,000 keeps every trial for diagrams up to ~166 units, which covers the reference, generated and
seed diagrams of the layout baselines (their tests are unchanged).

### 3. One store write for the edges

`applyLayoutEdges(diagramId, { handleOrders, resetConnectionIds, routes })` does in one `set()`
what the per-edge calls did, in the same order. History is kept as it was: the first reset that
cleared a route called `pushHistory` (soft, coalescing), and so does the batch, once, before it
writes. The per-call version only stayed one undo step because every call landed inside
`HISTORY_COALESCE_MS`; at ~2 s on the fixture, a checkpoint could land mid-way and undo would stop
in a half-applied state. The batch removes that dependence on timing, as `applyAutoLayout` already
does for positions.

### 4. Bounds before segments in the score

`countPolylineCrossings` compared every pair of edges and, in each, every pair of segments. It now
sorts edges by their bounds' left edge, sweeps, and tests a pair only when the bounds touch, and a
pair of segments only when theirs do. `countEdgeNodeOverlaps` tests the edge's bounds against the
box before the ancestor checks, which built a chain per pair. The bounds tests have a 1 px slack,
far above the `1e-6` tolerance of `segmentsIntersect`, so they only skip pairs that could never
count. Locked by a test against the every-pair count over 40 seeded drawings with shared ends,
touching corners and collinear runs; it fails with a negative slack.

### 5. A plan is for the state it was made from

Before, the page was frozen while ELK ran, so nothing could change. Now the user can switch
diagrams, enter a scene, or edit the structure in those seconds, and `useAutoLayout` read the
active diagram at apply time: a plan made for one diagram could be written to another, or write
routes for connections deleted meanwhile. The hook keeps the active diagram id, its `snapshot`,
the active scene id and the scene object from the start, and drops the plan if any changed
(immer replaces them on any structural edit), with `autoLayout.discardedChanged`. Positions are
not compared: a node moved meanwhile is placed by the arrangement, as arranging does.

## Risks / Trade-offs

- **Fewer references on large diagrams.** The fixture gets 1 instead of 4. Measured, the other 3
  took crossings down 1.7% for 24 s.
- **The scores stay on the main thread.** Three ~0.3 s tasks on the fixture.
- **A worker is a second copy of ELK in memory** for the session (~1.5 MB of script).

## Migration Plan

None: no stored data changes.

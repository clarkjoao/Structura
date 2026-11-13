# Tasks

## 1. Measure

- [x] 1.1 Measure Arrange on the fixture on a production build, shortcut to toast, with a CPU profile: 47 s, 42 s of long tasks (worst 2.7 s); 19 ELK runs on the main thread, 19 scores, ~2,500 store writes; in Node the plan alone is 39 s (`baseline.json`, `steps`, `trialsInNode`)

## 2. Off the main thread, fewer runs

- [x] 2.1 Run ELK in a Web Worker (`elkRunner.ts`: `elk-api` + `elk-worker.min.js`, one worker per session; `ElkWorkerFailure` on the worker's error event falls back to `elk.bundled` and stays there; no `Worker` → main thread); verify with `elkRunner.test.ts` (no Worker; a worker that dies on creation) and, on a production build, that arranging with and without `Worker` lands every node at the same position
- [x] 2.2 Bound the reference trials by graph size (`autoRefTrialLimits`, `AUTO_REF_TRIAL_BUDGET` 3,000); verify the layout, generation and seed suites pass unchanged (243 tests) and measure quality against the trial count on the fixture (`trialsInNode`)

## 3. Main-thread work that is left

- [x] 3.1 Write the arrangement's edges in one `set()` (`applyLayoutEdges`), with the history of the per-edge calls it replaces; verify with `applyLayoutEdges.test.ts` (same writes as the per-edge calls, one notification, one undo step back to the routes before, no checkpoint when no reset clears a route) and the `applyLayoutResultEdges` call-site tests, whose fakes replay the batch as the old calls (`src/test/layoutEdgeCalls.ts`)
- [x] 3.2 Skip edge pairs and segment pairs whose bounds are apart in `countPolylineCrossings`, and test bounds before ancestry in `countEdgeNodeOverlaps`; verify with `layoutReadability.bounds.test.ts` against the every-pair count over 40 seeded drawings (fails with a negative slack) and the readability baselines

## 4. A live page while planning

- [x] 4.1 Drop a plan when the active diagram, its snapshot, the active scene or the scene object changed while it was made, with `autoLayout.discardedChanged` (en, pt-BR); verify with `useAutoLayout.staleness.test.tsx` (applied when unchanged and when only a position moved; dropped on another diagram and on a removed component; two of four fail without the check)

## 5. Integration

- [x] 5.1 Add an opt-in `arrange` scenario to `perf:large` (`PERF_ARRANGE=1`); record base against branch in `baseline.json`: 44.4 → 5.4 s, long tasks 44.0 → 0.9 s, 1.1 → 43 fps; the other scenarios unchanged
- [x] 5.2 Run typecheck, lint, format, tests (4,433), fallow and `openspec validate --strict`

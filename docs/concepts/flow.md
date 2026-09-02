# Flow

A **flow** is a named path through a diagram: an ordered walk over components
and connections that answers "what happens when someone creates a short URL?".
Flows live inside a diagram's snapshot, are recorded by clicking the canvas,
and are replayed step by step with the participants highlighted.

Everything below describes the code as it stands. Where behaviour is surprising,
the entry says why it is that way.

## The model is a graph, not a list

```ts
interface Flow {
  id: string;
  name: string;
  mermaid: string;          // serialized form, kept alongside the steps
  diagramId: string;
  description?: string;
  tags?: string[];
  entryStepId?: string;
  steps: Record<string, FlowStep>;
}

interface FlowStep {
  id: string;
  type: "action" | "condition" | "note";
  next?: string;                 // linear continuation
  branches?: FlowBranch[];       // { label, nextId }[]
  componentId?: string;          // what the step points at on the canvas
  connectionId?: string;
  // presentation: description, note, handleId, duration, payload,
  // payloadDirection, isAsync, connectionIntent, conditionLabel
}
```

There is **no `order` field**. A step's position is not stored anywhere — it is
derived by walking the graph from `entryStepId` through `next` and
`branches[].nextId`. That is the single most important thing to know about this
subsystem: "reorder a step" is not a number to bump, it is a relink.

The shape is a graph rather than a list because a flow branches. A condition
step has several possible continuations, and a list cannot express that without
an out-of-band index.

### One rule the whole subsystem obeys

**A non-empty `branches` array shadows `next`.** `getNextSteps` returns the
branch targets and ignores `next` entirely when both are present. Every
traversal in the codebase follows that rule, so a `next` set on a condition step
is unreachable data. `checkFlowInvariants` reports its target as an unreachable
step rather than silently numbering it.

## Two representations, one boundary

The flow exists in two different shapes at different moments, and the conversion
between them is the seam where most surprises live.

| | While recording | Once stored |
| --- | --- | --- |
| Shape | `FlowStep[]` — a flat array | `Record<string, FlowStep>` — a graph |
| Branch membership | a side `Map<stepId, {conditionStepId, branchIndex}>` | the `branches[].nextId` links themselves |
| Where it lives | React state in `FlowModeContext` | the Zustand store, inside `diagram.snapshot.flows` |
| Ordering | array position | reachability from `entryStepId` |

`FlowModeContext.tsx` holds the whole recording session in a `useState`, plus a
`branchOwnershipRef`. **The store is not touched while recording or playing.**
Nothing is persisted until the user presses Finish.

That single boundary is `src/pages/workspace/useWorkspaceFlowRecordingFinalize.ts`.
It converts the array to a graph with `buildFlowFromRecordingSnapshot`,
serializes mermaid, and calls `addFlow` (new) or `updateFlow` (editing) — always
writing the flow whole, never a step at a time.

This is why the store's per-step mutators are dead code (see
[Sharp edges](#sharp-edges)): the editing surface never needed them.

### The three ways a flow comes into existence

| Path | Action | Opens an undo checkpoint? |
| --- | --- | --- |
| Finish a recording | `addFlow` / `updateFlow` (`flows.slice.ts`) | no |
| Duplicate in the panel | `addFlow` with `buildFlowDuplicatePatch` | no |
| Import a Mermaid sequence | `importMermaidSequenceResult` (`clipboard.slice.ts`) | yes |

The import path is the odd one out twice over: it writes into
`d.snapshot.flows` directly rather than going through the flows slice, and it is
the only one that calls `pushHistory`. It has to, because it also creates the
components and connections the steps point at.

## Lifecycle

### Recording

`FlowMode` is a three-state machine: `idle`, `playing`, `recording`. Recording
carries its own sub-context:

| `RecordingContext` | Meaning |
| --- | --- |
| `{ mode: "trunk" }` | clicks append to the main path |
| `{ mode: "branch-select", conditionStepId }` | the user is choosing which branch to fill |
| `{ mode: "branch-record", conditionStepId, branchIndex }` | clicks append inside that branch |

While recording, clicking a node calls `onRecordNodeClick`, clicking an edge
`onRecordEdgeClick`, and `appendRecordedStep` pushes a step onto the array. In
`branch-record` the step is spliced in after the last step already owned by that
branch, and its ownership is written into the map — that is how a flat array
keeps track of a tree.

The canvas dims everything not yet recorded and shows numeric badges on the
nodes that are (`buildRecordingInfo` → `recordingBadges` in
`c4.descriptor.ts`). **Those badges are the array index + 1**, so they are the
recording's own numbering, not the graph's.

Steps can be edited in place from the recorder panel: description, duration,
payload and direction, async flag, delete, and **reorder by dragging**
(`StepList.tsx` uses HTML5 drag-and-drop — `draggable` plus
`dragstart`/`dragover`/`drop` — and `onReorderSteps` splices the array).
Reordering only exists here, on the array, during a session. There is no
gesture that reorders a flow that has already been stored.

### Finalize

`buildFlowFromRecordingSnapshot` turns the array into a graph:

- Steps with no branch owner form the trunk and are chained with `next`.
- Each condition's branch `bi` gets `nextId` = the first step owned by
  `(conditionStepId, bi)`, and those steps are chained among themselves.
- `entryStepId` is `steps[0].id` — the first thing recorded, always.

**A condition ends the trunk.** The chaining loop skips condition steps
(`if (step.type !== "condition")`), so a condition never receives a `next`.
Anything recorded on the trunk *after* a condition is therefore left with no
predecessor and becomes unreachable. Verified directly:

```
steps: A, C(condition: sim→x, nao→y), x, y, D     (x, y owned by C's branches)
result: A.next=C   C.next=undefined   C.branches=[sim→x, nao→y]   D.next=undefined
        reachable = A, C, x, y        invariants = unreachable_step:D
```

This is consistent with the shadowing rule — a condition could not carry a
usable `next` anyway — but it means the recorder cannot express reconvergence:
once a flow branches, each branch runs to its own end.

### Playback

`play(flow)` copies the flow **into** the mode object, so playback reads a
frozen snapshot rather than the live store. Navigation is deliberately manual:

- `goNext` follows `next`, and refuses on a condition step.
- `chooseBranch(i)` follows `branches[i].nextId`.
- `goBack` pops a `history` array, so backtracking works across a branch choice.

`buildFlowHighlight` drives the canvas: the current step's component and
connection are active, previously visited components are marked, and every
participant of the flow is distinguished from the rest of the diagram.

When nothing is playing or recording, `buildCoverage` runs instead and maps each
component and connection to the flows that mention it — that is the "which flows
touch this node" affordance.

## Derived numbering

`computeFlowStepLabels` (`utils/flow-labels.ts`) derives a hierarchical label for
every reachable step. Nothing is stored; it is recomputed on demand.

| Label | Meaning |
| --- | --- |
| `1`, `2`, `3` | the main path, from `entryStepId` |
| `3a`, `3b`, `3c` | branches of the condition labelled `3`, in the order declared in `branches[]` |
| `3a.1`, `3a.2` | the continuation inside branch `a` |
| `3a.2b`, `3a.2b.1` | a branch inside a branch, and its continuation |
| `4` | a reconvergence: back to the enclosing sequence, right after the branch point |

`compareFlowStepLabels` sorts them the way a reader walks them:
`3 < 3a < 3a.1 < 3b < 4 < 10`.

The numbering depends only on the graph and `entryStepId`, never on the
insertion order of the `Record` — two builds of the same structure with
different key order produce identical labels.

Two shapes the rule does not settle are **reported rather than resolved**: a
join whose incoming chains close at two different branch points lands in
`ambiguities`, and the base-26 branch letters can collide past 26 branches
(`1aa` is both the 27th branch of `1` and the first branch of `1a`), which lands
in `collisions`. The label is still assigned deterministically in both cases, so
the caller decides what to surface.

## Structural invariants

`checkFlowInvariants` (`utils/flow-graph.ts`) is the one place the four
structural rules are expressed:

1. Every step is reachable from `entryStepId`.
2. There is no cycle.
3. No `next` or `branches[].nextId` points at an id that is absent from `steps`.
4. `entryStepId` exists in the record.

It is a **reporter, not an enforcer**: flows persisted by earlier versions can
violate it, and callers decide what to do. Every graph operation's tests assert
through this one function instead of restating the rules per case.

## Repair, deletion and moving

### Deleting a step, or the element it points at

`sewOnDelete` (`utils/flow-sew.ts`) removes steps and **sews** the graph:
every reference to a removed step is redirected to that step's successor.

| Case | Result |
| --- | --- |
| Step in the middle | the predecessor points at the successor |
| The entry step | its successor becomes the entry |
| The last step | the predecessor simply loses its `next` |
| A run of consecutive removals | crossed in one pass, to the first survivor |
| A branch point | **not removed** — see below |

`repairFlow` keeps its old signature and delegates, so the two store slices and
the flow panel get the sewn behaviour without changing their calls.
`repairFlowsAfterRemovingDiagramElements` is what runs when a component or a
connection is deleted from the diagram: it finds the steps that referenced the
removed element and sews them out.

Before sewing existed this pruned instead, and the effect was visible: deleting
the "Auth Guard" component turned the seed flow `cp-f1 → f2 → f3 → f4 → f5` into
`cp-f1` alone plus an unreachable island, and the panel read one step where
there had been five. `flow-sew.regression.test.ts` locks that shut.

**Deleting a branch point is held back.** Its predecessor would be left with no
defined successor and its branches with nothing to hang from, and every
mechanical answer discards branches the user built. So the step is kept with its
branches intact and reported in `blocked`; because it now references an element
that is gone, the existing broken-step check surfaces it for the user to
resolve. That is a decision, not an omission.

### Moving a step

`moveStep` (`utils/flow-move.ts`) relinks a step to another position:
`{ kind: "before" | "after", stepId }` or
`{ kind: "branchStart", stepId, branchIndex }`. The step is unstitched by the
same sewing rule and stitched in at the target, which pushes the target's old
occupant behind it. The entry follows: it passes to the successor when the entry
step leaves, and to the moved step when it lands in front.

It is defined on a graph that already holds the invariants, and refuses rather
than guesses: `branch_point_move`, `target_after_branch_point` ("after" a
condition means nothing while `branches` shadows `next` — use `branchStart`),
`invalid_input`, `unknown_step`, `unknown_target`, `self_target`,
`invalid_branch_index`.

One consequence worth knowing: `FlowBranch` requires `nextId: string`, so a
branch with no target cannot be expressed. Moving the only step out of a branch
**deletes the branch**, label and all.

`moveStep` has no caller in the UI yet. It is the graph operation a future drag
gesture will sit on.

### Broken steps

`validateFlowGraph` walks the flow and reports steps whose `componentId` or
`connectionId` no longer resolves against the diagram. `FlowPanel` runs it
before playing; if anything is broken it opens `BrokenFlowDialog`, and the user
can remove the offending steps — which routes through `repairFlow`, so the
chain is sewn rather than cut.

## Persistence

Flows are part of `diagram.snapshot`, so they are persisted with the diagram by
the normal store persistence — see [persistence.md](persistence.md). There is no
separate flow storage and no flow-specific schema version.

`migrateFlowsToGraph` in `persist.config.ts` runs `migrateFlow` over every flow
on **every** hydration. `migrateFlow` is a no-op unless `steps` is an array,
which is the legacy shape: a `LegacyFlowStep` carried an `order: number`, and
the migration numbers them into a `next` chain and sets `entryStepId` to the
first. That legacy type is the historical evidence that flows *were* an ordered
list before they became a graph.

## Interchange

| Format | Carries flows? | How |
| --- | --- | --- |
| Mermaid | yes | `exportMermaid(flows, …)`; the file gets a `-flows` suffix |
| JSON | yes | the whole `snapshot` is spread, and `flows` is part of it |
| draw.io | no | `exportDrawio(diagram, …)` never receives the flows |

Mermaid is both an export and an *import*: `MermaidImportDialog` accepts a
sequence diagram (`parseMermaidSequence` → components, connections and a flow)
or a flowchart (`parseMermaidFlowchart` → components and connections only). The
sequence path is the only way to author a flow's contents without recording it
by hand — duplicating copies an existing one.

Each `Flow` also carries a `mermaid` string alongside its `steps`. It is
regenerated by `stepsToMermaid` at finalize and is what the panel's copy button
puts on the clipboard.

## Where the canvas reads flow state

`useCanvasFlowState` → `useFlowState` produces three things the node and edge
descriptors consume:

| Value | When it is built | What it drives |
| --- | --- | --- |
| `flowHighlight` | while playing | active node/edge, visited nodes, participants |
| `recordingInfo` | while recording | step badges and the dimming of unrecorded nodes |
| `coverage` | only when idle | "which flows touch this node" |

The canvas never reads `flows` to decide semantics; it only receives these three
derived structures through the descriptor context, which is the same
domain-agnosticism rule described in [canvas-engine.md](canvas-engine.md).

## Sharp edges

- **Six of the nine store mutators have no caller.** `addFlowStep`,
  `updateFlowStep`, `removeFlowStep`, `addFlowBranch`, `removeFlowBranch` and
  `convertStepToCondition` are referenced only by the store's own action map,
  `actions.types.ts`, and the `useFlowActions` hook — which has no consumer
  either, and neither does `useHistoryActions`. They are dead because the
  recorder edits its own React state and writes the flow whole at finalize.
  Do not build on them without first deciding whether that boundary should move.

- **`flows.slice.ts` never calls `pushHistory`.** Eleven mutating slices do;
  this one does not, so recording, editing, duplicating or deleting a flow opens
  no undo checkpoint — while importing a Mermaid sequence, which writes flows
  from a different slice, does. Flows are still *inside* the snapshot that other
  mutations photograph, so an undo triggered by an unrelated structural change
  can roll flows back to whatever they were at that checkpoint. The result is
  that undo affects flows without ever being *about* them.

- **Keyboard shortcuts are silently disabled while the flow panel is open.**
  `useCanvasKeyboard` returns early on
  `isFlowPanelOpen || isPlaying || isCompareMode || isRecording`, which sits
  *before* copy/paste, selection, undo/redo, grouping, waypoints and locking.
  Auto Layout is gated separately a few lines above. There is no feedback: the
  key simply does nothing.

- **The recorder cannot express reconvergence**, because the trunk is severed at
  a condition (see [Finalize](#finalize)). The graph model supports it — the
  numbering, the invariants and the sewing all handle joins — but nothing in the
  UI produces one today.

- **Duplicating a flow reuses the step ids.** `buildFlowDuplicatePatch` passes
  `steps: flow.steps` straight through, so the copy's steps carry the original
  ids. Step ids are only ever resolved within their own flow, so this is not
  currently observable, but it is not what a reader expects from a duplicate.

- **19 of the 79 flow i18n keys used in code are missing from both locales**,
  all under `flowRecorder.*` (`addBranch`, `convertToCondition`,
  `selectBranchPrompt`, …). They render through the inline default passed as
  `t(key, default)`, which is why nothing looks broken — but the defaults are a
  mix of English and Portuguese, so a Portuguese UI shows "Add condition step".
  A parity check that only compares `en.json` against `pt-BR.json` will not find
  this: the two files agree, both by omission.

- **The flow UI has no tests.** `src/features/canvas/flow/` is 26 files and
  about 3600 lines with no test file in it. The graph core underneath
  (`flow-graph`, `flow-labels`, `flow-sew`, `flow-move`, `flow-traversal`,
  `flow-repair`) is covered; the recorder, the panel and the playback hooks are
  not.

## Where things live

| Path | What |
| --- | --- |
| `features/diagram/model/flow.types.ts` | `Flow`, `FlowStep`, `FlowBranch` |
| `features/diagram/utils/flow-traversal.ts` | `walkFlow`, `getNextSteps`, `getOrderedStepIds`, `getStepCount`, `validateFlowGraph` |
| `features/diagram/utils/flow-graph.ts` | traversable edges, reachability, `checkFlowInvariants` |
| `features/diagram/utils/flow-labels.ts` | `computeFlowStepLabels` |
| `features/diagram/utils/flow-sew.ts` | `sewOnDelete` |
| `features/diagram/utils/flow-move.ts` | `moveStep` |
| `features/diagram/utils/flow-repair.ts` | `repairFlow`, `repairFlowsAfterRemovingDiagramElements` |
| `features/diagram/utils/recording-to-flow.ts` | array + ownership → graph |
| `features/diagram/utils/flow-migration.ts` | legacy ordered list → graph |
| `features/diagram/utils/flow-mermaid.ts` | `stepsToMermaid`, `parseMermaidToSteps` |
| `features/diagram/store/slices/flows.slice.ts` | `addFlow`, `updateFlow`, `removeFlow` (+ six unused) |
| `features/diagram/store/slices/clipboard.slice.ts` | `importMermaidSequenceResult` — writes a flow directly |
| `features/canvas/flow/` | the mode machine, recorder, panel, playback and overlays |
| `pages/workspace/useWorkspaceFlowRecordingFinalize.ts` | the only UI → store write for flows |

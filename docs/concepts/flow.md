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

## One representation, written as it goes

There used to be two shapes — a flat `FlowStep[]` in React state while
recording, converted to a graph when the user pressed Finish. There is one now.
`FlowModeContext` holds only interaction state: which flow is open and where the
next recorded step goes. The steps live in `diagram.snapshot.flows` from the
first click.

| | Then | Now |
| --- | --- | --- |
| Shape while recording | `FlowStep[]` in React state | the graph, in the store |
| Branch membership | a side `Map<stepId, {conditionStepId, branchIndex}>` | the `branches[].nextId` links themselves |
| Written to the store | once, at Finish | on every click |
| Ordering | array position | reachability from `entryStepId` |

A recording therefore starts by creating a real flow. It appears in the flows
panel while it is being recorded, and cancelling deletes it again.

### The three ways a flow comes into existence

| Path | Action | Opens an undo checkpoint? |
| --- | --- | --- |
| Record one | `beginFlowSession` + `addFlow` (`flows.slice.ts`) | yes — one for the whole session |
| Duplicate in the panel | `addFlow` with `buildFlowDuplicatePatch` | no |
| Import a Mermaid sequence | `importMermaidSequenceResult` (`clipboard.slice.ts`) | yes |

The import path still writes into `d.snapshot.flows` directly rather than going
through the flows slice. It has to open a checkpoint of its own, because it also
creates the components and connections the steps point at.

## Lifecycle

### Recording

`FlowMode` is a three-state machine: `idle`, `playing`, `recording`. Recording
carries a cursor — where the next step goes:

| `RecordingContext` | Meaning |
| --- | --- |
| `{ mode: "trunk" }` | clicks append to the main sequence |
| `{ mode: "branch-select", conditionStepId }` | the user is choosing which branch to fill; clicks record nothing |
| `{ mode: "branch-record", conditionStepId, branchIndex }` | clicks append inside that branch |

`recordingCursor` maps that to a `FlowCursor`, and `recordFlowStep` writes it:

- `getFlowTail` finds the end of the sequence the cursor points at, read off the
  derived labels — the main sequence is the steps whose label is a bare number,
  one branch is `3a` plus `3a.1`, `3a.2`. That is what makes the step where two
  branches meet count as the trunk's tail rather than either branch's.
- If that tail is a step nobody has filled in yet — a new flow's first step, a
  fresh branch's placeholder — the click fills it instead of pushing it down.
- Otherwise `appendFlowStep` hangs the new step off the end.

**Returning to the main sequence after a condition reconverges the branches.**
The new step becomes the successor of every open end below the condition, so the
branches meet again at it. Before, a step recorded there was simply left
unreachable; the numbering already described this shape (a condition at `2`, a
meeting point at `3`), and now the recorder produces it.

A condition's branches each stand on a real step, so a branch is never a
dangling reference and the numbering can see it. Converting a step to a
condition keeps whatever followed it: each new branch points at the old
successor, which makes the rest of the flow the place the branches meet again
rather than something the conversion threw away.

### Finishing, cancelling, undo

**The undo unit is the session, not the click.** `beginFlowSession` opens one
checkpoint and the flow actions push none while it is open. `MAX_HISTORY_STEPS`
is 30 and every checkpoint clones the diagram snapshot, so a checkpoint per
recorded step would push the diagram's real history off the end after thirty
clicks. That checkpoint is taken unconditionally, bypassing the undo/redo
cooldown in `pushHistory`: a recording started right after a Ctrl+Z would
otherwise have nothing to go back to.

- **Finish** — `commitFlowSession`. The flow is already written; an unnamed one
  gets the default name. One Ctrl+Z afterwards removes the whole recording.
- **Cancel** — `cancelFlowSession` restores the snapshot the session opened on
  and takes its checkpoint back with it, so a cancelled recording leaves neither
  a half-written flow nor a Ctrl+Z that does nothing visible. Cancelling an
  *edit* puts the flow back the way it was for the same reason.
- **The recorder's own undo** — `undoLastRecordedStep` takes back the last step
  of the sequence in hand. The head of a sequence is emptied rather than
  removed, so the flow keeps its first step and a condition keeps its branch.

Outside a session — the script panel on a stored flow — every gesture is its own
undo step.

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

## The script panel

`FlowScriptPanel` is where a flow is edited. It renders `buildFlowOutline`,
which turns the graph into rows in reading order — `1`, `2`, `2a`, `2a.1`, `2b`,
`3` — each carrying its derived label, how far it is indented (one level per
lettered segment of the label) and which branch it sits in.

It opens in two places: inside the recorder, and from a flow in the flows panel,
which is how a stored flow is edited without recording anything.

| Gesture | What it calls |
| --- | --- |
| Drag a row onto another | `moveStep`, `before` from below and `after` from above |
| The `+` on a row | `insertFlowStepAt`, `after` that row |
| The `×` on a row | `removeFlowSteps` — the graph is sewn, not cut |
| Edit a description, duration, payload | `updateFlowStep` |
| Turn a step into a condition | `convertStepToCondition` |
| Rename a branch, add or drop one | `setFlowBranchLabel`, `addFlowBranch`, `removeFlowBranch` |

Every one of those returns a `FlowStoreResult`, and **a refused gesture is named
on screen** rather than quietly reverted: moving a condition, dropping a step
directly behind one, removing a branch point. `flowRefusalMessage.ts` maps every
refusal code to a message through a total `Record`, so a new code without a
message is a type error.

Row selection and canvas selection are one selection. Picking a row selects what
the step points at; selecting that element moves the panel to the row. The panel
stays where it is while its row still matches, so a flow that visits the same
node twice does not snap back to the first visit.

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

The labels are also what the canvas shows. **One flow numbers the canvas at a
time: the one whose script is open.** A label means something inside one flow's
graph and nothing across two, so a node on the path of two flows would otherwise
carry two unrelated numbers with nothing to tell them apart. With no script open
the canvas carries no numbers. While recording it is the flow being recorded,
narrowed to the branch in hand, so the canvas shows what the panel shows.

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

**A sew is said out loud.** Removing a node the script walks through is a change
to the flow made as a side effect of a different gesture, so
`repairFlowsAfterRemovingDiagramElements` reports each join it made — the label
the removed step had, read before the sew, and the labels on both sides of the
join, read after it. `useFlowSewNotices` turns that into one notice per join
("«Storefront» left the diagram. The script of «Checkout» was sewn shut:
1 → 2.") with an action that puts the node and the step back together. That
works because the removal already took a single undo checkpoint covering both.

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

Dragging a row in the script panel is what calls it. A refusal is shown as a
message, so the gesture never looks like it silently sprang back.

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

Each `Flow` also carries a `mermaid` string alongside its `steps`. It is a
cache — every reader that draws or exports recomputes it from the graph — and
the flows slice refreshes it wherever the graph changes, so the stored copy does
not drift now that the graph is written a step at a time.

## Where the canvas reads flow state

`useCanvasFlowState` → `useFlowState` produces three things the node and edge
descriptors consume:

| Value | When it is built | What it drives |
| --- | --- | --- |
| `flowHighlight` | while playing | active node/edge, visited nodes, participants |
| `flowBadges` | whenever a script is open | the step numbers on nodes and edges |
| `coverage` | only when idle | "which flows touch this node" |

The badges are permanent: they are derived from the graph on each render and
stay outside a recording. Dimming the rest of the diagram is still a recording
thing and is gated on `isRecording` separately.

The canvas never reads `flows` to decide semantics; it only receives these three
derived structures through the descriptor context, which is the same
domain-agnosticism rule described in [canvas-engine.md](canvas-engine.md).

## Sharp edges

- **Keyboard shortcuts are silently disabled while the flow panel is open.**
  `useCanvasKeyboard` returns early on
  `isFlowPanelOpen || isPlaying || isCompareMode || isRecording`, which sits
  *before* copy/paste, selection, undo/redo, grouping, waypoints and locking.
  Auto Layout is gated separately a few lines above. There is no feedback: the
  key simply does nothing. It is also why the recording session can be the undo
  unit without fighting a global Ctrl+Z.

- **Flows are inside the snapshot other mutations photograph.** A structural
  change anywhere in the diagram opens a checkpoint that includes the flows, so
  an undo can roll flows back without ever being *about* them.

- **A branch cannot be empty.** `FlowBranch` requires `nextId: string`, so every
  branch stands on a real step — a placeholder until something fills it. Moving
  the only step out of a branch therefore deletes the branch, label and all, and
  `isPlaceholderStep` is what tells a step nobody has filled in from a real one.

- **Duplicating a flow reuses the step ids.** `buildFlowDuplicatePatch` passes
  `steps: flow.steps` straight through, so the copy's steps carry the original
  ids. Step ids are only ever resolved within their own flow, so this is not
  currently observable, but it is not what a reader expects from a duplicate.

- **Scene mode does not sew.** `removeElements` and `removeComponent` return
  early when a scene is active, before the flows are repaired, so removing an
  element inside a scene leaves the flows pointing at it.

- **The numbering reports two shapes it cannot settle** — an ambiguous join and
  a base-26 branch-letter collision (see [Derived numbering](#derived-numbering)).
  The script panel does not surface either yet; it reads `outline.unreachable`
  and shows a count, but `ambiguities` and `collisions` are carried through and
  dropped.

## Where things live

| Path | What |
| --- | --- |
| `features/diagram/model/flow.types.ts` | `Flow`, `FlowStep`, `FlowBranch` |
| `features/diagram/utils/flow-traversal.ts` | `walkFlow`, `getNextSteps`, `getOrderedStepIds`, `getStepCount`, `validateFlowGraph` |
| `features/diagram/utils/flow-graph.ts` | traversable edges, reachability, `checkFlowInvariants` |
| `features/diagram/utils/flow-labels.ts` | `computeFlowStepLabels` |
| `features/diagram/utils/flow-sew.ts` | `sewOnDelete` |
| `features/diagram/utils/flow-move.ts` | `moveStep` |
| `features/diagram/utils/flow-edit.ts` | `getFlowTail`, `appendFlowStep`, `insertFlowStep`, `isPlaceholderStep` |
| `features/diagram/utils/flow-condition.ts` | turning a step into a condition, adding and dropping branches |
| `features/diagram/utils/flow-outline.ts` | the graph as numbered, indented rows |
| `features/diagram/utils/flow-repair.ts` | `repairFlow`, `repairFlowsAfterRemovingDiagramElements` |
| `features/diagram/utils/flow-migration.ts` | legacy ordered list → graph |
| `features/diagram/utils/flow-mermaid.ts` | `stepsToMermaid`, `parseMermaidToSteps` |
| `features/diagram/store/slices/flows.slice.ts` | every write to a flow, and the session that bounds a recording |
| `features/diagram/store/slices/clipboard.slice.ts` | `importMermaidSequenceResult` — writes a flow directly |
| `features/canvas/flow/` | the mode machine, recorder, panel, playback and overlays |
| `features/canvas/flow/script/` | the script panel: rows, drag, condition form |
| `features/canvas/flow/useFlowViewStore.ts` | which flow's script is open, and which row is selected |
| `features/canvas/flow/useFlowSewNotices.ts` | the notice shown when deleting a node sews a script |

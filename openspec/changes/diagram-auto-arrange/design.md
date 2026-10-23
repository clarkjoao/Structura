# Design

## Context

See proposal.md for motivation and specs/diagram-auto-layout/spec.md for the behaviour.
This builds on `diagram-layout-settings`. The facts below shape the approach.

- **The arrangement path.** `useAutoLayout.runAutoLayout` plans with measured sizes, then
  calls `applyDiagramAutoLayout`:
  - `applyAutoLayout` pushes one checkpoint;
  - `applyLayoutResultEdges` writes the handle order (no history), resets control points
    (`resetEdgeControlPoints` pushes a _soft_ checkpoint), and sets ELK corridors
    (`history: false`).
  - After that, the hook fits the view and shows a toast.
- **Store markers.**
  - `_lastUndoRedoAt` is bumped by undo and redo.
  - `_lastLayoutWriteAt` is bumped by `applyAutoLayout` and by a few other position
    writers, including `addSharedRef`, which is also a structural edit.
  - Nothing marks a peer's write: `StoreBridge.write` calls `setState` directly, skipping
    history.
- **Collaboration scope.** The bridge synchronises `doc` fields and the entity
  collections, not `layoutSettings`.
- **Scenes.** The canvas draws `getCachedCanvasSnapshot(diagram)`, a snapshot resolved for
  scenes and cached by identity.

## Goals / Non-Goals

**Goals:**

- No new undo entries from automatic runs, and no lost redo stack.
- No work on the drag hot path: the watcher does O(1) work unless the snapshot identity
  changed.
- One arrangement per burst of edits.

**Non-Goals:**

- Running the automatic arrangement outside the editor canvas (generation, the viewer).
- Making a run that is already in progress cancellable.

## Decisions

### 1. `mode` lives in `DiagramLayoutSettings`

`mode?: "manual" | "automatic"`, absent = manual. `normalizeLayoutSettings` drops
`manual`, so a diagram that never turned it on stays byte-identical. `elkSpacingFor`
ignores the field.

### 2. A structural signature decides what is an edit

A pure function `structuralSignature(snapshot)` is computed over the resolved canvas
snapshot. It covers:

- component ids, sorted, each with its `parentId`, and with `collapsed` for panels;
- connection ids with their `sourceId` and `targetId`.

Text components are excluded, as the layout excludes them. The watcher memoises the
signature by snapshot identity, so a store update that does not touch the snapshot
(a drag commit writes `nodeLayouts`) costs a pointer comparison.

_Alternative considered:_ instrumenting every structural action. Rejected because it is
spread across slices, easy to miss for the next action added, and the signature is what
the layout actually consumes.

### 3. A watcher subscribed to the store, owned by the canvas

`useAutoArrange({ enabled, arrange })` is called from `useCanvasController`. `enabled`
requires `canEditCanvas`, no flow reading and no compare mode. The hook subscribes with
`useDiagramStore.subscribe((state, prev) => …)`, and on each update:

1. If it is not enabled, or the active diagram is not in automatic mode, it drops any
   pending run and rebaselines.
2. If the active diagram changed, it rebaselines and does not schedule.
3. If the signature is unchanged, it does nothing.
4. If the update bumped `_lastUndoRedoAt` or `_lastRemoteWriteAt`, it rebaselines and
   does not schedule.
5. If an automatic run of its own is in flight, it rebaselines when that run settles.
6. Otherwise it rebaselines, records the current `_lastLayoutWriteAt`, and (re)starts a
   400 ms timer.

When the timer fires, it skips the run if `_lastLayoutWriteAt` moved since scheduling,
because something already arranged the diagram (the assistant's `autoLayoutActiveDiagram`
after it inserts). Otherwise it calls `arrange({ automatic: true })` and awaits it. After
the run, it rebaselines to the current signature, so references made or dissolved by the
run are not mistaken for an edit.

`arrange` is read through a ref, so the timer always uses the latest render's measured
nodes and resolved snapshot. 400 ms gives React Flow time to measure an element that was
just inserted.

### 4. Remote writes are marked

`StoreBridge.write` bumps `_lastRemoteWriteAt` in the `setState` it already performs. The
field is initialised to 0 and reset on rehydrate, like the other underscore markers. No
other code reads it.

### 5. Merged history: `history: false` through the whole apply

- `applyAutoLayout(layouts, autoRefs, { history: false })` skips its `pushHistory`.
- `applyLayoutResultEdges(…, { history: false })` passes `history: false` to
  `resetEdgeControlPoints`, which gains the same option as `setEdgeControlPoints`.

Every write of the run then lands in the edit's own checkpoint: the checkpoint was taken
before the edit, so one undo restores the structure and the positions together. Redo is
untouched because nothing calls `pushHistoryCheckpoint`, which is what clears `future`.

_Alternative considered:_ relying on coalescing (`HISTORY_COALESCE_MS` = 1500). Rejected
because a slow ELK run past the window splits the step, which is exactly the temporal
coupling the `applyAutoLayout` doc comment warns about.

### 6. `runAutoLayout` options for automatic runs

`{ automatic: true }` means no fit-to-view, no success toast and merged history, while the
error toast stays. The no-op toast ("nothing to lay out") is also suppressed. It composes
with `settings` (slice 1), which the menu passes when switching to automatic.

### 7. Mode switching

- **To Automatic**: goes through the slice 1 path `request({ ...shown, mode: "automatic" })`
  → arrange with these settings and write them (one structural checkpoint).
- **To Manual**: must not move anything, so it calls a new store action
  `setDiagramLayoutSettings(diagramId, settings)`. That action takes a structural
  checkpoint, then writes the normalised settings, or deletes them when they are default.
- **Restore defaults**: arranges at Normal, which also clears the mode.

The Arrange button shows a small "Auto" badge (i18n) when the mode is automatic.

## Risks / Trade-offs

- **[Risk]** An edit made while an automatic run is computing is absorbed into the
  baseline after the run, and does not trigger another run. → A run takes milliseconds to
  a few hundred; the next structural edit arranges again. Accepted.
- **[Risk]** An element inserted without a measured size is laid out at its default
  size. → The 400 ms debounce covers the measurement frame; `runAutoLayout` already waits
  when nothing at all is measured.
- **[Trade-off]** In a collaboration session, each participant's mode is local. A peer in
  manual mode sees the arranger's positions sync in.
- **[Trade-off]** A manual move in automatic mode is undone by the next structural edit.
  This is documented in the menu hint.

## Migration Plan

This needs no data migration: `mode` is optional and absent means manual.

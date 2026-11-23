# Design

## Context

- **Vertical is already supported.** `diagram.direction` is "LR" or "TB". The guided arrangement, overlay, edits and lane orientation (`laneOrientation`) already handle "TB".
- **The existing switch.** The Organizar menu switches the direction through `useAutoLayout` with `writeDirection`, and it is locked by `directionLockedReasonKey`.

## Decisions

### 1. One switch, reused

The mode bar toggle calls the same handler the ArrangeControl uses. It is exposed as a small hook (`useDiagramDirectionSwitch`) that returns `{ direction, lockedReasonKey, switchTo }`, so the two surfaces cannot drift.

### 2. Creation passes the direction through the template

`createKindDiagram({ ..., direction })` sets `diagram.direction`, then builds the guided template. That template already orients lanes by direction (`guidedAppendLanes`, laneFrame).

### 3. Mermaid direction as a build hint

`ParsedOutline.direction?: "LR" | "TB"` comes from the header. The guided `build` returns `direction?` in its outcome only when the journey is just the start step. The host applies it with the same switch, run _before_ the build: switch first, then add. The paste stays a single undo step by batching both in one history entry, using the store's `withHistoryBatch`. If no batch API exists, the edit includes `laneOrientation` and the diagram's direction write.

## Risks / Trade-offs

- **[Risk]** The switch rearranges asynchronously (ELK in a worker). → Guided arrangement is synchronous (`arrangeGuidedSync`), so the switch-then-build path stays in one tick. A test covers this.

## As implemented

- **No extracted hook.** The mode bar toggle takes the canvas's own arrange control (`useCanvasArrangeControl`): the same `onDirectionChange` and the same lock reason. So the hook the design proposed was not needed.
- **A new edit field.** A Mermaid direction applies through a new `KindEdit.direction`, in the same edit as the pasted block, so it is one undo step. Left to right is stored as no direction, as before.

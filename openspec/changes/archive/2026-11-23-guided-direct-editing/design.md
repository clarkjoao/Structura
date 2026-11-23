# Design

## Context

- **The band.** `KindOverlayView` draws the segments as buttons and the separators as divs, inside the `ViewportPortal`, in flow coordinates.
- **Step names.** They are committed through the element panel's title (`ComponentPanel` → `editFields({ name })`).
- **Lanes.** They are swimlane panel nodes, with a header label.
- **Kind data.** The guided edits already have `guidedSetPhaseStart`, and `reconcile` and `buildOutline` already parse an outline item (`parseItemText`).

## Decisions

### 1. Interactions are outcomes on the overlay data

`segments[i].rename?: (name) => outcome` and `separators[i].moves?: { candidates: Array<{ along, run: () => outcome }> }`. The kind builds them, and the host draws the editor and the drag. Each candidate is a column a start may move to. The host snaps to the nearest candidate on drop.

This keeps the contract pure data plus functions, like `inspector`, and leaves the drag math in the host.

_Alternative considered:_ a generic `onOverlayEdit(event)` callback. Rejected: every kind would re-implement hit testing.

### 2. A `nameCommit` hook

`nameCommit?(ctx, id, text) → KindCommandOutcome | { refused } | null`. Null means a plain rename. The guided kind runs the outline's item reader on the text, so the escapes and the case rules are the same as in the outline. The resulting edit is `update` for the name and flowShape, plus a lane move from `guidedMoveStepToLane`, or a new lane added with `guidedAppendLanes`.

The host calls the hook in `ComponentPanel`'s name commit when the policy is kind, and falls back to `editFields`.

### 3. The lane header editor

The swimlane node renders a small inline input on double-click when `kindPlaced` is set and the canvas is editable. It commits through `applyKindEdit({ update: [{ id, name }] })`, which already keeps `laneLabel` in sync.

## Risks / Trade-offs

- **[Risk]** A double click on a segment also selects the phase start. → **Mitigation:** the selection is kept, and editing starts on the second click.
- **[Risk]** A name that should start with `?` gets reinterpreted. → **Mitigation:** the shortcut applies only in kind mode, `\?` keeps the character, and the rename is one undo step.

## As implemented

- **`Lane:` only for existing lanes.** The prefix moves a step only to a lane that already exists. Otherwise the text stays the name, so "Meeting: kickoff" is kept as typed. The spec was updated to match.
- **A single-line reader.** `nameCommit` reads one line on its own (`parseOutlineLine`), because a lone decision is an error for the whole-outline parser.
- **Lane headers.** The header editor is provided through `LaneRenameContext`, only by the editor canvas in kind mode. The field sits outside the header, which clips its content.

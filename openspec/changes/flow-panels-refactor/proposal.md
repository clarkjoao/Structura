# Proposal

## Why

Flows grew three surfaces built at different times: a list that floated over the canvas, a recorder
docked with its own header, and a reading rail. After the side-panel redesign they no longer read as
one product — different headers, 9–10 px uppercase labels, the list covering the diagram. Writing a
flow was also slow: branches were recorded through a separate "pick a branch" screen, the only sign a
recording was live sat in the top bar, and undo had no button. Reading a long flow broke down: every
past and upcoming step stayed in the spine and the variables block could take 40% of the rail, so the
scene in hand was squeezed out.

## What Changes

- **One column, one anatomy.** The flows list and the flow editor dock in the inspector's resizable
  column (`PanelColumn`) with the inspector's `PanelHeader` and `PanelSection`; the inspector stands
  aside while flows hold the column. _(M1, done.)_
- **Recording is visible on the canvas.** A strip over the canvas while a flow is written: what is
  being written into (main sequence or a branch, in its colour), how many steps, Undo last, Finish.
- **Branches are written in place.** The `branch-select` screen and mode are removed. Every branch
  head in the script is a target: choosing it moves the recorder there; the strip offers the way back
  to the main sequence. Turning a step into a condition moves the recorder into its first branch.
- **Long readings stay readable.** The spine shows the last few walked steps and the next few, each
  behind a "N earlier / N more" toggle; the variables block folds, and starts folded past six steps.

## Non-Goals

- No change to the flow data model (`Flow`, `FlowStep`, branches, cursors) or persisted schema.
- The parallel-thread reading proposal (design 1c) is not part of this change.
- The viewer's chrome is unchanged beyond the shared reading rail.
- No new keyboard shortcuts; Backspace/Delete still undo the last recorded step.

## Impact

- `features/canvas/flow/*` (FlowPanel, FlowRecorderPanel, script list/row, reading rail, variables
  panel, `flowMode.types`, `useFlowRecording`), `panels/ElementPanel/shell/PanelFrame`,
  `useElementPanelGate`, `WorkspaceContent`, i18n (en + pt-BR).
- Removed: `recorder/RecorderHeader`, `recorder/BranchSelectView`, `recorder/BranchRecordingStrip`.

# Proposal

## Why

Small edits to a guided journey still send the author away from the canvas. Renaming a phase or moving where it starts goes through the Journey tab or the text. Turning a step into a decision, or moving it to another lane, takes a trip to the panel. Renaming a lane goes through the Details tab. The text format already has a compact vocabulary for these: `?`, `!`, `Lane:` and `##`. The canvas should accept the same gestures where the eye already is.

## What Changes

- **Phase band**
  - A double click on a phase segment edits its name in place. Enter commits, Esc cancels, and an empty name removes the phase.
  - Dragging a separator along the axis moves the start of the phase after it to the step at the drop column. The band previews the drop.
- **Step names**
  - When a step's name is committed in kind mode, an opening `? ` makes it a decision and `! ` makes it an end, the same way the outline reads them.
  - A leading `Lane: ` moves the step to that lane when the lane already exists; otherwise the text stays as the name. These prefixes are taken off the name.
  - `\?`, `\!` and `\:` keep the characters literally.
- **Lane headers:** a double click on a lane's header renames it in place.
- Each gesture is one undo step, and none of them is offered in freehand mode or on read-only surfaces.

## Non-Goals

- Dragging lanes to reorder them. The lane bar's move actions stay.
- Dragging a step to another column (time order). The arrangement owns positions.
- Shortcuts for phases or participants inside a step's name.

## Capabilities

### New Capabilities

- `guided-direct-editing`: in-place editing on the canvas, covering the phase band, the step name shortcuts and lane header renames.

### Modified Capabilities

None. The phase band requirement in `guided-journey-phases` only gains interactions, and those are specified here.

## Impact

- **Overlay contract:** `KindOverlay.segments[]` gains `rename?` and `separators[]` gains `moves?`. These are pure outcomes the host calls.
- **Canvas:** `KindOverlayLayer` gets the inline editor and separator dragging.
- **New kind hook:** `DiagramKindDescriptor.nameCommit?(ctx, id, text)` returns the edit for a typed name, or null to keep the plain rename. The host calls it where a step's name is committed: the inspector title, and inline node editing if present.
- **Swimlane node:** gains a header editor in kind mode.
- **Guided kind:**
  - `guidedRenamePhase` and `guidedMovePhaseStart` in `guided.edits`;
  - name parsing that reuses the outline's item reader.
- **Other:** en and pt-BR keys and the docs.

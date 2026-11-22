# Proposal

## Why

In a workshop or discovery meeting, the person taking notes can't keep up while also using the canvas. Tab is fast, but every step still needs a lane gesture. A guided journey is just an ordered list of who does what, with decisions along the way. Plain text expresses that faster than any gesture, and the same text is what an LLM can produce from meeting notes. This change builds on the guided kind (`guided-flow-diagram`) while it is fresh: the edit vocabulary and the automatic layout already turn a structural edit into a finished picture.

## What Changes

- **Outline format.** A plain-text, line-based format for a guided journey:
  - `Lane: step` adds a step in a lane; a line without `Lane:` stays in the previous lane.
  - `? question` adds a decision. The decision's exits are indented `label -> …` lines.
  - `!` adds an end step.
  - `-> @Step` jumps back to an existing step (a retry loop).
  - `#` starts a comment.
  - The format is the same in pt-BR and en; only the punctuation is fixed.
- **Text to journey.** An outline is turned into a guided edit, which is applied as one undo step:
  - Missing lanes are created by name, in the order they appear.
  - Steps are appended after the selected step, or after the journey's last step when nothing is selected.
  - The kind's layout and flow derivation then run as after any other edit.
- **"Write as text" panel** in guided mode:
  - A text area that checks the outline as you type, with errors per line.
  - A preview count: lanes, steps, decisions.
  - "Apply", or Ctrl/Cmd+Enter.
- **Paste onto the canvas.** In guided mode, plain text that is a valid outline is added like the panel would add it, after the selection, with no prompt. Text that is not an outline keeps today's paste behaviour.
- **Journey to text.** "Copy as text" serializes the current journey back into the format. A copied outline can be pasted again (round trip) or handed to the assistant.
- **Assistant.** When the active diagram is guided:
  - The assistant gets the format and the current journey as an outline.
  - It gets one tool that applies an outline. It can then turn meeting notes into a journey in one call, instead of node-by-node patches.

## Capabilities

### New Capabilities

- `guided-journey-outline`: the text outline format for guided journeys. It covers:
  - parsing it, with errors per line;
  - turning it into a guided edit, whether from the panel, a canvas paste or the assistant;
  - serializing a journey back to text.

### Modified Capabilities

None. The guided kind's specs (`guided-flow-authoring`, `guided-flow-derivation`, `guided-flow-layout`) live in the unarchived `guided-flow-diagram` change. This change adds an authoring route over their existing rules and changes none of their requirements.

## Non-Goals

- **Editing the whole journey as text.** Applying a modified outline does not reconcile it with the existing steps (no diff, rename or delete from text). The outline only appends. Reconciliation is a later change.
- **Other diagram kinds.** Freehand, C4 and other diagrams get no outline format.
- **Every step shape.** Shapes beyond rectangle, decision, start and end (document, cylinder, subroutine, event) have no syntax yet. They can be changed on the canvas afterwards.
- **Payloads, owners, SLAs or other step fields** in the text.
- **Live two-way sync** between the text area and the canvas.
- **Server-side or network parsing.** Everything stays client-side.

## Impact

- **New pure module** in `src/features/diagram-kinds/guided/`. It holds the outline parser, the builder (outline → `KindEdit`) and the serializer, with unit tests next to it.
- **Guided kind descriptor.** A new command to open the panel, and a new hook for plain-text paste.
- **Canvas.** The paste path (`useCanvasMediaPaste` / keyboard paste) gets one plain-text branch, used only when the active kind accepts text.
- **UI.** A new panel or dialog in `src/features/canvas/`. The entry point is in `KindModeBar`.
- **LLM.** `src/features/llm/tools.ts` and `prompt-builder.ts` get a guided-only tool and prompt section.
- **i18n.** New keys under `diagramKinds.guided.outline.*` in en and pt-BR.
- **Docs.** `docs/concepts/diagram-kinds.md` gets an "Outline" section. No new dependencies, no storage change.

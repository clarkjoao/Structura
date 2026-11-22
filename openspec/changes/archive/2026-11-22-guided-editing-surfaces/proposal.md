## Why

In guided mode, three editing surfaces still behave as if the diagram were freehand C4:

- **The inspector.** It shows Technology, Type ("Processos") and Shape, which mean little for a business journey. "Move to lane" sits pinned below "Advanced", cramped and easy to miss.
- **Connecting to empty canvas.** Dropping a connection offers Recents and an empty "C4" heading instead of the journey's step kinds.
- **The bottom toolbar.** It offers the "C4" and "Flowchart" menus instead of the journey's elements.

An architect mapping a journey has to know the internals to find the right element. The kind already declares its elements and insert semantics (ADR-0014). These surfaces should read them.

## What Changes

- **A "Journey" tab in the inspector**, in kind mode, placed first and opened by default for a step. It holds:
  - **Lane**: every lane as a segmented choice, with the current one marked, plus "+ New lane". Picking another lane moves the step there, in one undo step; "New lane" adds a lane and moves the step into it. The step's floating bar no longer offers a lane menu.
  - **Step kind**: step, decision, end, start, event, subprocess, data, document. Picking one changes the shape. The header's type chip names it ("Decision" instead of "Processes").
  - **Exits** (decisions only): each exit's label, editable in place.
- **Details is trimmed in kind mode.** Type and Shape move to the Journey tab. Technology is hidden. The kind declares this through a new `inspector` hook on the descriptor, and freehand diagrams are untouched. The "Move to lane" strip at the bottom is removed.
- **Quick insert follows the kind.** With an empty field, it lists the kind's elements under the kind's name ("Guided") instead of "C4". Recents are filtered to what the kind offers, and empty sections are not shown. Search is already filtered.
- **The bottom toolbar follows the kind.** The C4 and Flowchart menus are replaced by one button per main step kind (step, decision, end) and a "More" menu for the rest. Inserting uses the kind's `insert` (after the selected step, in its lane), as the palette already does.

## Capabilities

### New Capabilities

- `guided-editing-surfaces`: the inspector tab, quick insert and bottom toolbar of a diagram in kind mode, starting with the guided journey.

### Modified Capabilities

None. `guided-flow-authoring` ("The palette offers journey steps only") is still pending archive in `guided-flow-diagram`; this change extends it to the two surfaces that ignored it.

## Non-Goals

- Business data on steps (owner, duration, SLA): that is item 3 of the roadmap.
- Dragging a step between lanes on the canvas.
- Changing the freehand inspector, quick insert or toolbar.

## Impact

- **Kind contract:** `kind.types.ts` gains `inspector?` (tab, hidden fields, sections as data) and `primary?`/`label?` on `KindElementRef`.
- **Guided kind:** `guided.kind.ts`, the new `guided.inspector.ts`, and `guidedChangeShape` in `guided.edits.ts`. `GUIDED_STEP_SHAPES` is reordered so step, decision and end come first.
- **Inspector:** `ElementPanel/index.tsx`, `ComponentPanel.tsx`, `components/TabBar.tsx` and `sections/FlowchartFieldsSection.tsx`. A new `components/KindInspectorTab.tsx` replaces `KindActionsSection.tsx`.
- **Insert surfaces:** `QuickInsertPopover.tsx`, `CanvasBottomToolbar.tsx` and the new `catalog/kindCatalog.ts`.
- **Locales:** en and pt-BR.
- **Tests:** component tests and a Cypress tour step.

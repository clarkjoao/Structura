# Proposal

## Why

Step 2 of ADR-0013 (`diagram-reading-direction`) made a diagram's reading direction real in the
editor and the viewer, but the direction stops at the canvas's edge:

- a top-to-bottom diagram exports to draw.io with left-to-right connection points;
- a Mermaid `flowchart TD` imports as a horizontal diagram;
- the assistant cannot ask for a vertical diagram, and does not lay out on the diagram's axis
  when it adds to one.

This is step 3: interchange follows the direction.

## What Changes

- **draw.io export.** Edges attach where the canvas draws them for the diagram's direction:
  - left-to-right: right out, left in;
  - top-to-bottom: bottom out, top in, with the cross axis on the right/left;
  - slot offsets go along the side.

  Left-to-right output stays byte-identical.

- **JSON / folder / share import.** The imported `direction` and `layoutSettings` are sanitised
  (an unknown value is dropped) instead of trusted.
- **Mermaid flowchart import.** The header direction is read: `TD`/`TB` mean top-to-bottom,
  `LR` left-to-right, and `BT`/`RL` take the nearest one with a notice.
  - Importing into an empty diagram sets the diagram's direction, in the same undo step as the
    import's layout.
  - Importing into a diagram with content lays the import out on that diagram's axis, with a
    notice when the header asked for the other one.
- **Assistant IR.** `DiagramIR.direction?: "LR" | "TB"` is documented in the generator prompt and
  validated (an invalid value is ignored).
  - A generation into an empty diagram sets the direction it asks for.
  - Into a diagram with content, the new part is laid out on the diagram's axis.

## Non-Goals

- **draw.io import** does not infer a direction; draw.io has no diagram-level one. An imported
  diagram is left-to-right.
- **Mermaid flowchart export** does not exist today and is not added.
- **Live-session sync** of the direction is step 4.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `diagram-reading-direction`: export, import and assistant generation follow the declared
  direction. The capability is introduced by the in-flight `diagram-reading-direction` change.

## Impact

- `src/lib/export-service/edge-routing.ts`, `to-export-model.ts`, `normalize-imported-diagram.ts`.
- `src/features/diagram/utils/import-mermaid-flowchart.ts`, `canvas/flow/FlowPanel.tsx`,
  `canvas/layout/layoutScopedNodes.ts`.
- `src/features/llm/ir/` (types, validator, prompt, apply) and
  `canvas/layout/autoLayoutDiagram.ts`.
- i18n (en/pt-BR) for the import notices.
- Tests: the draw.io golden suite must not change; new TB cases in each area.

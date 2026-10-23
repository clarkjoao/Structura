# Proposal

## Why

ADR-0013, accepted, lets a diagram declare whether it reads left-to-right or top-to-bottom. Step 1
(`handle-sides-by-direction`) gave node renderers one source for their handle sides. This change
is step 2: the direction becomes real. A diagram can be switched to vertical, its handles, edges
and layout follow the declared axis, and the hard rule in AGENTS.md is restated per axis.

## What Changes

- `Diagram.direction?: "TB"`, where absent means left-to-right. It is saved, exported as JSON,
  undone and reloaded with the diagram, and carried by the history checkpoints.
- **Handles and edges follow the declared axis.**
  - Input sits on top and output at the bottom on every node of a top-to-bottom diagram.
  - The flowchart shapes' cross axis becomes left (in) and right (out).
  - Stored edge sides stay absolute: `sourceSide` gains `"right"` and `targetSide` gains
    `"left"`.
  - The default side is never stored.
- **The layout runs per axis.**
  - The full arrangement, a selection, a panel's children and the automatic placement all lay
    out top-to-bottom in a vertical diagram.
  - It is implemented by transposing the graph into the tuned left-to-right pipeline and the
    result back. Left-to-right output is byte-identical.
- **Switching direction** from the Arrange menu is one undo step:
  - it sets the field, re-arranges the whole diagram on the new axis and re-derives every
    edge route;
  - it is disabled during a live session, until the relays carry the field (step 4).
- The editor and the viewer draw handles from the diagram's direction.
- AGENTS.md restates the hard rule per axis, and ADR-0013 becomes Accepted with an amendment
  recording the transposition approach.

## Non-Goals

- **Exports and imports** (draw.io exit/entry points, Mermaid `TD`, the assistant's IR) are
  step 3. Until then a top-to-bottom diagram exports with left-to-right connection points.
- **Live-session sync of the field** is step 4.
- **Renaming `verticalSides`** is not done. The handle-spec flag keeps its name and now means
  "renders the cross axis".
- **Spacing tuned specifically for the vertical axis.** It reuses the left-to-right tuning, and
  the measurements are recorded.

## Capabilities

### New Capabilities

- `diagram-reading-direction`: a diagram's declared reading axis and how handles, edges, layout
  and undo follow it.

### Modified Capabilities

(none)

## Impact

- **Model and store:** `diagram/model/diagram.types.ts`, `connection.types.ts`, history and
  layout slices, `actions.types.ts`, `store.types.ts`.
- **Persistence:** `infrastructure/persistence/workspace-folder-sync-equality.ts`.
- **Layout:** `canvas/layout/` (new `axis.ts`, `layoutEngine.ts`, `contract.ts`,
  `autoLayoutDiagram.ts`, `applyLayoutResult.ts`, `layoutScopedNodes.ts`,
  `incrementalPlacement.ts`).
- **Hooks:** `canvas/hooks/useAutoLayout.ts`, `usePanelChildLayout.ts`.
- **Edges:** `canvas/edges/connectionDerivations.ts`, `node-types/handle-spec.ts`, and the
  callers of both.
- **Surface and UI:** `canvas/core/DiagramSurface.tsx`, the editor and viewer canvases, and
  `catalog/ArrangeControl.tsx`.
- **i18n:** en and pt-BR.
- **Docs:** AGENTS.md, ADR-0013, `docs/features.md`.

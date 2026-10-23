# Proposal

## Why

Slice 1 (`diagram-layout-settings`) made arranging a diagram tunable and smooth, but it
still only happens when the author asks for it. In the style of React Flow's auto-layout
example, an author who is sketching wants the diagram to keep itself arranged as they add,
connect and remove elements, without losing the manual mode for diagrams laid out by hand.
This is slice 2 of 3. Slice 3 (vertical direction) still waits on an ADR.

## What Changes

- The layout settings gain a **mode**: `manual` (the default and today's behaviour) or
  `automatic`.
- In automatic mode, a **structural edit** made by the local user re-arranges the diagram
  shortly after the edit (debounced).
  - Structural edits: adding or removing an element or a connection, changing what an
    element is nested in, changing a connection's ends, and collapsing or expanding a
    panel.
  - Not structural: moving, resizing, renaming and restyling.
- The automatic arrangement **joins the undo step of the edit that caused it**: one undo
  takes back both the edit and the arrangement.
- The automatic arrangement does **not** run for:
  - undo or redo;
  - a peer's change in a collaboration session;
  - switching diagrams;
  - an edit the assistant already laid out itself;
  - a read-only canvas, flow reading or compare mode.
- The automatic arrangement keeps the user's viewport (no fit-to-view) and shows no
  success toast. The nodes glide as in slice 1. Errors are still reported.
- The Arrange menu's **Automatic** option becomes selectable:
  - switching to Automatic arranges at once;
  - switching to Manual moves nothing;
  - each switch is one undo step.
- The Arrange button shows when the diagram is in automatic mode.
- "Restore defaults" also goes back to manual mode.

## Non-Goals

- Vertical direction (slice 3).
- Pinning nodes, or an arrangement that respects positions the user set by hand. In
  automatic mode, a manual move holds until the next structural edit.
- An "adjusted by hand" indicator.
- Synchronising layout settings over a collaboration session. The relay's `doc` does not
  carry them today; each participant's mode is local while in a session, and only the
  participant who made the edit arranges.
- Re-arranging on label or technology edits, which would move the diagram while the user
  is typing.
- Automatic arrangement for a selection or a panel's children.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `diagram-auto-layout`: adds the automatic mode, its triggers and exclusions, its undo
  behaviour, and the mode control. The capability is introduced by the in-flight
  `diagram-layout-settings` change, which has to be archived first.

## Impact

- `src/features/diagram/model/layout-settings.ts`: `mode`.
- `src/features/diagram/store/`:
  - `applyAutoLayout` gains a no-checkpoint option;
  - `resetEdgeControlPoints` gains a `history` option;
  - a `setDiagramLayoutSettings` action;
  - a `_lastRemoteWriteAt` marker.
- `src/features/collaboration/sync/StoreBridge.ts`: bumps the remote-write marker.
- `src/features/canvas/layout/`: `applyLayoutResult.ts`, `autoLayoutDiagram.ts`, and a new
  structural signature and auto-arrange scheduler.
- `src/features/canvas/hooks/`: `useAutoLayout` (silent, no fit, merged history) and a new
  `useAutoArrange` watcher, wired in `useCanvasController`.
- `src/features/canvas/catalog/ArrangeControl.tsx`, plus i18n en/pt-BR and `docs/features.md`.

# Proposal

## Why

Auto-layout is one fixed ELK profile that users can only reach through a shortcut or a
context menu. It cannot be tuned, and its result jumps into place. It also lays out a
collapsed panel as if it were open, so collapsing a panel frees no room. That is a
prerequisite for anything in the style of React Flow's expand/collapse example. This change
is the first of three slices toward a configurable layout experience (manual vs automatic,
horizontal vs vertical). It makes the layout correct and tunable, and it makes running it
from a visible control feel smooth.

## What Changes

- Auto-layout treats a collapsed panel as collapsed. Its hidden descendants are left out of
  the layout, and the panel takes part at its collapsed size. When the panel is expanded
  later, the descendants are where they were before it was collapsed.
- Each diagram gets layout settings that are saved with it:
  - a **density** (Compact / Normal / Spacious) that scales the tuned spacing;
  - optional advanced overrides for the **gap between layers** and the **gap between
    nodes**, which play the role of React Flow's `treeHeight`/`treeWidth`.
  - Normal with no overrides is exactly today's layout.
- The bottom toolbar gets an "Arrange" split button:
  - its main action runs the layout;
  - its menu sets density and the advanced gaps. Changing a setting re-arranges the diagram
    immediately, as one undo step.
- Arranging the diagram animates. Nodes glide to their new place over about 300 ms, and
  edges fade out during the move and back in at their new route.
- Every existing auto-layout entry point uses the diagram's settings: the shortcut, the
  context menus, the assistant's tool and generation.

## Non-Goals

- **Automatic mode** (re-arranging on structural edits): slice 2. The menu only reserves
  room for it.
- **Vertical direction**: slice 3. It conflicts with the left-to-right handle rule in
  `AGENTS.md` and needs an ADR first.
- Per-node pinning or a layout that respects the positions the user set by hand.
- Layout settings as a per-browser preference: they belong to the diagram.
- Changing the ELK option set itself. The Normal density must reproduce today's layout
  exactly.
- Animating the layout of a selection (`MultiSelectPanel`). It keeps its current behaviour.

## Capabilities

### New Capabilities

- `diagram-auto-layout`: arranges a diagram automatically. Covers which elements take part,
  the per-diagram layout settings and how they shape spacing, how the user triggers and
  tunes the arrangement, its undo behaviour and its animated transition. Slices 2 and 3
  extend this capability with automatic mode and direction.

### Modified Capabilities

(none)

## Impact

- `src/features/canvas/layout/`:
  - `fromDiagram.ts`: collapsed-panel exclusion;
  - `layoutEngine.ts`: spacing derived from settings;
  - `autoLayoutDiagram.ts`: settings threaded through the plan.
- `src/features/canvas/hooks/useAutoLayout.ts`: settings, animation trigger.
- `src/features/canvas/catalog/CanvasBottomToolbar.tsx`: new Arrange split button and menu.
- `src/features/diagram/model/diagram.types.ts`: optional `layoutSettings` field.
- `src/features/diagram/store/slices/diagram.slice.ts`: an action to set it, with undo.
- The assistant's AUTO_LAYOUT tool and diagram generation (via `autoLayoutActiveDiagram`).
- i18n: new keys in `en.json` and `pt-BR.json`.
- Tests: the layout baselines must stay byte-identical at Normal density. New unit tests
  cover the density math, the collapsed-panel exclusion and the settings action.

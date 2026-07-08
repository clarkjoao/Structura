## Why

Today, changing a node's color requires three steps: click the node, scroll to the right-side ElementPanel, find the color row, open the color picker, and apply. Users that move a lot of elements want to recolor a node as a one-shot action without ever touching the panel — a common pattern in design tools (Figma's right-click color palette, Excalidraw's floating toolbar, draw.io's style chip). The right-side panel keeps the structural properties it owns (name, description, technology, tags, type) and the Quick Actions popover only owns the most frequent, low-risk visual tweaks.

This change delivers a floating "Quick Actions" popover that appears next to a selected node and exposes a small fixed color palette — the most commonly used visual change. Closing the loop on "edge direction / edge style" requires them to live on the connection, not the node, and is intentionally out of scope here (see Non-Goals).

## What Changes

- A new floating component, `NodeQuickActions`, is rendered on the canvas whenever exactly one node is selected and the canvas is editable. It shows a fixed palette of colors plus a "No color" / "Reset" action.
- The popover is anchored to the selected node: it appears at a fixed offset from the node's top-right corner in screen space, follows the node when it is dragged, and is clamped to the viewport.
- Picking a color calls `updateComponent(nodeId, { panelColor } | { nodeColor } | { panelColorDark })` with the appropriate field for the selected node's type. The action goes through the existing `pushHistory` flow, so a single `Cmd/Ctrl+Z` undoes the change.
- The popover is dismissed when: the user clicks outside it, the user deselects the node, the user clicks the node a second time (toggle off), the canvas enters a locked mode (compare, recording, playback, viewing), or `Esc` is pressed.
- No new i18n strings beyond the action labels (which reuse the existing `colors.*` keys and a new `nodeQuickActions.resetColor` key).
- No changes to the ElementPanel, the NodeContextMenu, the store actions, the persistence schema, or the canvas event handlers. The popover is purely additive.

## Capabilities

### New Capabilities

- `node-quick-actions`: Floating popover anchored to a single selected node, exposing a fixed color palette and a reset action. Defines when the popover appears, where it is anchored, how the chosen color is applied, and the dismissal conditions.

### Modified Capabilities

_None._ No existing spec in `openspec/specs/` describes a node-anchored floating popover.

## Impact

- **New source files**
  - `src/features/canvas/panels/NodeQuickActions.tsx` — the popover component (palette + reset button + click-outside dismiss + Esc dismiss).
  - `src/features/canvas/panels/NodeQuickActions.css` (or inline) — small bit of positioning / palette grid styling.
- **Modified source files**
  - `src/features/canvas/Canvas.tsx` — mount `<NodeQuickActions>` next to the existing `<ElementPanel>` block, gated on `showElementPanel` (single node, editable, no inline editing, not compare/playback/recording).
  - `src/features/canvas/hooks/useCanvasController.ts` (or the visualState owner) — possibly add a small ref / derived value to expose the selected node's screen position to the popover. The selected node's geometry is already accessible through `reactFlowInstance.getNode`; the popover can call that directly.
  - `src/infrastructure/i18n/locales/en.json` and `pt-BR.json` — one new key per locale (`nodeQuickActions.resetColor`).
- **Store surface** — unchanged. The popover calls `updateComponent` which already exists and already pushes history with `STRUCTURAL_MUTATION_MARKER`.
- **i18n** — minimal. The palette reuses the existing `colors.*` labels. One new key per locale is added.
- **Persistence** — none. The change is the same data the ElementPanel already mutates; persisted via the existing store pipeline.
- **Risk** — low. The popover is purely additive. The dismissal conditions and the "single node only" gate are the main correctness surfaces; both have unit-test-friendly logic.
- **Out of scope (Non-Goals)**
  - Quick actions for **edge direction** and **edge style**. These live on `Connection`, not on the node, and would change the selection model (Quick Actions today only fires on single-node selection). UX-005 ("Separar ações rápidas das configurações do elemento") is the natural follow-up to extend this to edges.
  - A free-form color picker. The palette is fixed for this change; a follow-up can swap it for `react-colorful` or similar if user demand appears.
  - Quick actions for **multi-selection**. The popover only appears when exactly one node is selected. The ElementPanel already has a `MultiSelectPanel` for batch operations.
  - Touch-specific gestures. The popover is click / keyboard driven; touch users get the ElementPanel.
  - Persistence of the user's most-recently-used color.
  - Animations beyond a simple fade-in / fade-out.

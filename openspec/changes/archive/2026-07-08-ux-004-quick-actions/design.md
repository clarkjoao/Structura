## Context

The canvas today only exposes node properties through the right-side `ElementPanel` (`src/features/canvas/panels/ElementPanel/index.tsx`), which is mounted in `Canvas.tsx` around the same gate (`showElementPanel`) that opens whenever something is selected. The panel handles a wide set of properties (name, description, technology, tags, type, color, border style, etc.) and is the only place to change a node's color today. The single-click flow sets `selectedNodeId` (`useCanvasEventHandlers.ts::onNodeClick`, lines 107–175); the panel then re-renders keyed on that ID.

The right-click `NodeContextMenu` (`src/features/canvas/panels/NodeContextMenu.tsx`) handles structural actions (copy, paste, duplicate, delete, ordering, grouping, auto layout) but does not touch color, shape, or any visual property — that decision is intentional and out of scope for this change.

`useCanvasVisualState` already exposes `selectedNodeId`, `selectedNodeIds: Set<string>`, `selectedEdgeId`, plus a `setContextMenu(null)` for dismissal. The popover will consume `selectedNodeId` directly and gate on `selectedNodeIds.size === 1` to avoid showing on multi-selection.

Color lives on the component type: `C4Component.panelColor`, `PanelComponent.panelColor`, `NoteComponent.panelColor` / `panelColorDark`, `FlowNodeComponent.nodeColor`, `ProcessNodeComponent.nodeColor`. The store has a single `updateComponent(id, patch)` action that accepts a `ComponentPatch`; this is the only mutation path used today by both `ComponentPanel` and any other code that changes a node field.

The codebase has two existing popover patterns:

- **Radix UI Popover** (`src/components/ui/popover.tsx`) — used for shadcn-style floating UI. Best when the trigger element is a known React node.
- **Manual fixed positioning with viewport clamping** — used by `QuickInsertPopover` (`src/features/canvas/toolbar/QuickInsertPopover.tsx`). Best when the trigger position is computed from a screen coord (e.g. cursor, node center) and there is no static trigger element.

`NodeQuickActions` matches the second pattern: the trigger is "a single node is selected" and the anchor is "the selected node's screen rect", not a known React element.

## Goals / Non-Goals

**Goals:**

- A floating popover appears when exactly one node is selected and the canvas is editable.
- The popover is anchored to the selected node's top-right corner in screen space, with a fixed pixel offset, and clamped to the viewport so it never overflows.
- The popover exposes a fixed color palette (8–10 colors) and a "Reset" action that clears the color field on the node.
- Picking a color calls `updateComponent` with the appropriate field for the node's type; the change is a single undo step.
- The popover is dismissed on click-outside, deselection, re-click on the same node, locked modes, and `Esc`.
- The popover follows the node as it is dragged (re-anchored each frame via `reactFlowInstance.getNode(id)`).
- Existing functionality (ElementPanel, NodeContextMenu, keyboard shortcuts) is unchanged.

**Non-Goals:**

- No quick actions for edges (direction / style) — those live on `Connection`, not on `Node`. UX-005 is the natural follow-up.
- No free-form color picker; the palette is fixed.
- No quick actions for multi-selection.
- No persistence of the most-recently-used color.
- No touch gestures; touch users continue to use the ElementPanel.
- No new dependencies.

## Decisions

- **Anchoring math**: the popover reads `reactFlowInstance.getNode(selectedNodeId).position` and the current viewport (`reactFlowInstance.getViewport()`) to compute the screen-space position of the node's top-right corner every time the popover re-renders. `requestAnimationFrame` is used to throttle the re-render to the drag frame rate, not the React render rate. This is the same pattern React Flow uses internally for edge labels and handles.
- **Single-node gate**: the popover mounts only when `selectedNodeId !== null && selectedNodeIds.size === 1 && !selectedEdgeId`. The edge check is a defensive belt — the panel-level `showElementPanel` already excludes edges, but the popover should not flash if the user clicks an edge while a node is still highlighted.
- **Mode gate**: the popover also gates on `interactionMode.canEditCanvas && !isFlowActive && !isCompareMode && !isRecording && !isPlaying`. The first three already drive `showElementPanel`; the playback / recording gates are added because color edits are non-sensical in those modes and would confuse users mid-flow.
- **Color field selection by node type**: a small helper resolves the right patch key for the node's type. `C4Component` / `PanelComponent` / `NoteComponent` (light mode) → `panelColor`. `NoteComponent` dark mode → `panelColorDark`. `FlowNodeComponent` / `ProcessNodeComponent` → `nodeColor`. Cloud / plugin / endpoint components have no color field and the popover renders nothing for them (a small `t("nodeQuickActions.notApplicableForNode")` muted hint is shown in that case so the user is not left wondering why the popover is empty).
- **Palette composition**: 8 colors picked from the existing `colors.*` keys: `slate`, `blue`, `indigo`, `emerald`, `amber`, `red`, `pink`, `purple`. The exact list is recorded in a small constant so it can be tweaked without touching component logic. The `Reset` button is shown as a separate icon button to the right of the palette; it is enabled only when the node currently has a non-default color.
- **No new store actions**: the popover calls `updateComponent` directly. Adding `setComponentColor` is tempting but redundant — `updateComponent` is the single mutation path that pushes history, and adding parallel actions would split the audit trail. If a future optimization needs batch color changes (multi-selection), it can be added without changing this surface.
- **Dismissal**: a small `useDismiss` style hook (click-outside via document mousedown, Esc via window keydown) is implemented inline. The hook clears `selectedNodeId` (and the Set) on dismiss only when the popover is the originator — i.e. it does not steal the dismiss from the ElementPanel's own close button. This is the same approach `QuickInsertPopover` already uses, so the pattern is familiar to the codebase.
- **Component placement**: `NodeQuickActions` lives next to the existing panel files under `src/features/canvas/panels/`, not under `panels/ElementPanel/` — it is a sibling surface, not a subpanel.
- **Re-render budget**: the popover subscribes to `selectedNodeId` only. The drag follow uses a `requestAnimationFrame` loop that reads the latest viewport, not React state, to avoid re-rendering the popover on every store change. This is the same shape as `QuickInsertPopover`'s cursor follow.

## Risks / Trade-offs

- **[Popover flashes on the wrong element]** If a user clicks a node, then quickly clicks a different one, the popover might briefly show colors from the previous node before React reconciles. _Mitigation_: the popover derives its color from `getNode(selectedNodeId)` inside the render body, not from a snapshot; React's reconciliation will pick the new node before the next paint. If a flash is observed in practice, a one-line `useDeferredValue(selectedNodeId)` is the fix.
- **[Drag-follow jank]** Re-anchoring every frame is cheap (one read of viewport, one read of node position) but it does run during drag. _Mitigation_: the loop only runs while the popover is mounted; mounting is gated on `selectedNodeId`, so the loop costs nothing when the popover is closed.
- **[Click-outside dismisses the selection]** If the user clicks the palette, the click is inside the popover (handled) but if the click lands on the canvas backdrop, the selection is cleared. That is the existing React Flow behavior (the pane clears selection on click), so this is consistent and not a regression.
- **[Color field wrong for an edge case component type]** A new component type added in the future (e.g. a `FooComponent` with its own color field) will be missed by the helper. _Mitigation_: the helper returns `null` for unknown types, the popover renders the "not applicable" hint, and TypeScript will flag the missing case in the switch the next time a new type is added (we keep the switch exhaustive with a `never` default).
- **[Reset on a dark-mode note]** Resetting `panelColor` for a note in dark mode also clears `panelColorDark`, so the note falls back to the theme default for both. _Mitigation_: documented in the design; this is the behavior users expect from the ElementPanel today.
- **[No keyboard shortcut to open the popover]** Opening the popover requires a click. A future UX-005 follow-up can add a shortcut, but for this change the click is the only entry point, which keeps the surface small and avoids stealing focus from the ElementPanel.

## Migration Plan

Single PR on `feat/ux-004-quick-actions` (off `main`):

1. Add the new `NodeQuickActions.tsx` component (palette + reset + dismiss + drag follow).
2. Add the new `nodeQuickActions.*` i18n keys to `en.json` and `pt-BR.json`.
3. Mount the popover in `Canvas.tsx` next to `<ElementPanel>`, gated on single-node selection + edit mode.
4. Run `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`.
5. Manual smoke: select a C4 component, change color, drag the node, dismiss with Esc, dismiss with click-outside, undo, multi-select (popover must not appear), select an edge (popover must not appear).
6. Open a PR; do not merge until reviewed.

Rollback: revert the single commit. No schema, persistence, or migration concerns. The store surface is unchanged.

## Open Questions

- **Should the popover also offer shape change (FlowNode/ProcessNode)?** Currently out of scope; the palette is the only action. A follow-up can add a small "shape" dropdown without changing the popover's shell.
- **Should the popover offer "open in panel" as a hint?** Could be useful for discoverability, but the ElementPanel is already visible when a node is selected, so the hint is redundant. Deferred.
- **Should the popover stay open during drag?** Today yes, because the user is dragging the node and the palette is the reason they have it open. If a future test shows users inadvertently clicking the palette during a drag, the dismiss-on-drag-start path is a small follow-up.

## 1. Branch and prep

- [ ] 1.1 Confirm the working branch is `feat/ux-004-quick-actions` and that it is off `main`.
- [ ] 1.2 Confirm the working tree starts clean for files we are about to edit (ignore `.gitignore` and `vite.config.ts` modifications inherited from main).

## 2. Add the locale keys

- [ ] 2.1 In `src/infrastructure/i18n/locales/en.json`, add a new top-level `nodeQuickActions` object with at least: `resetColor` and `notApplicableForNode`.
- [ ] 2.2 Mirror the same keys in `src/infrastructure/i18n/locales/pt-BR.json` with Portuguese translations.

## 3. Build the popover component

- [ ] 3.1 Create `src/features/canvas/panels/NodeQuickActions.tsx` exporting a `NodeQuickActions` component.
- [ ] 3.2 The component takes props for: `selectedNodeId: string | null`, the `reactFlowInstance`, an `updateComponent` action, an `isLocked` boolean, and a `dismiss` callback.
- [ ] 3.3 Resolve the node from `reactFlowInstance.getNode(selectedNodeId)`. If the node is missing or has no color field, render the "not applicable" hint and nothing else.
- [ ] 3.4 Render a fixed palette of 8 color swatches (slate, blue, indigo, emerald, amber, red, pink, purple) using the existing `colors.*` keys for tooltips. Each swatch is a button that calls `updateComponent` with the correct field for the node type.
- [ ] 3.5 Render a Reset button (icon + label) that calls `updateComponent` with the color field set to `undefined`. Disable the button when the node has no color.
- [ ] 3.6 Position the popover at the node's top-right corner in screen space, with a fixed offset (e.g. 12px right, 8px above). Clamp to the viewport using the same approach as `QuickInsertPopover` (lines 533-534).
- [ ] 3.7 Use a `requestAnimationFrame` loop to re-anchor the popover during a drag. Stop the loop when the component unmounts.
- [ ] 3.8 Wire click-outside dismissal (document `mousedown`) and `Esc` dismissal (window `keydown`). The dismissal callback is provided by the parent.
- [ ] 3.9 Use the `bg-popover` / `text-popover-foreground` / `border` Tailwind tokens (matching the existing Radix Popover styles) so the popover respects the theme.

## 4. Mount the popover

- [ ] 4.1 In `src/features/canvas/Canvas.tsx`, add a `<NodeQuickActions>` mount next to the existing `<ElementPanel>` block, gated on:
  - `visualState.selectedNodeId !== null`
  - `visualState.selectedNodeIds.size === 1`
  - `visualState.selectedEdgeId === null`
  - `interactionMode.canEditCanvas === true`
  - not in compare / recording / playback (use the same flags that drive `showElementPanel`)
- [ ] 4.2 Pass the `updateComponent` action (from `useDiagramActions()` or via the existing controller return) to the popover.
- [ ] 4.3 Pass the `reactFlowInstance` from the `useReactFlow()` hook already in scope.
- [ ] 4.4 The dismiss callback clears the selection (`setSelectedNodeId(null)`) when the popover originates the dismiss. To avoid stealing the dismiss from the ElementPanel, gate the popover's own dismiss effect so it only fires when the click target is outside both the popover and the panel.

## 5. Verify

- [ ] 5.1 Run `npm run typecheck` — must be green.
- [ ] 5.2 Run `npm run lint` — must be clean.
- [ ] 5.3 Run `npm run format` to normalize formatting.
- [ ] 5.4 Run `npm run test` — existing unit tests must still pass.
- [ ] 5.5 Run `npm run build` — must succeed.
- [ ] 5.6 Manual smoke:
  - Select a C4 component → popover appears; pick a color → node color updates; press `Cmd/Ctrl+Z` → undo restores the previous color.
  - Drag the node → popover follows.
  - Click outside the popover → popover dismisses, selection cleared.
  - Press `Esc` → popover dismisses.
  - Re-click the same node → popover dismisses.
  - Multi-select two nodes → popover does not appear.
  - Select an edge → popover does not appear.
  - Enter compare mode with a node selected → popover hides.
  - Open the popover, change a color in the ElementPanel → popover's Reset enabled state updates.

## 6. Commit and PR

- [ ] 6.1 Commit on the branch with a Conventional Commits message (e.g. `feat(canvas): add Node Quick Actions popover with color palette`).
- [ ] 6.2 Archive the OpenSpec change with `openspec archive` and commit the archive.
- [ ] 6.3 Open a PR against `main` and request review. Do not merge.

# Spec: node-quick-actions

## ADDED Requirements

### Requirement: Quick Actions popover appears on single-node selection

A floating popover MUST appear on the canvas whenever exactly one node is selected, the canvas is editable, and the active mode is not a locked mode (compare, recording, playback, viewing). The popover MUST NOT appear on multi-selection, on edge selection, or on no selection.

#### Scenario: Single-node selection shows the popover

- **WHEN** the user clicks exactly one node on an editable canvas
- **THEN** the popover becomes visible
- **AND** the popover is positioned next to the selected node

#### Scenario: Multi-selection does not show the popover

- **WHEN** the user multi-selects two or more nodes
- **THEN** the popover is not visible
- **AND** the ElementPanel's multi-select view takes over

#### Scenario: Edge selection does not show the popover

- **WHEN** the user clicks an edge (and no node is the primary selection)
- **THEN** the popover is not visible
- **AND** the existing edge-specific panel / properties view handles the selection

#### Scenario: Locked modes hide the popover

- **WHEN** the canvas enters compare mode, recording, flow playback, or any other non-editable mode
- **THEN** the popover is not visible even if a node is selected

### Requirement: Quick Actions popover is anchored to the selected node

The popover MUST be anchored to the selected node's top-right corner in screen space, with a small fixed pixel offset, and MUST be clamped to the viewport so it never overflows. While the node is being dragged, the popover MUST follow the node in real time.

#### Scenario: Popover follows a dragged node

- **WHEN** the user drags the selected node
- **THEN** the popover's screen position updates each frame
- **AND** the popover remains clamped to the viewport

#### Scenario: Popover stays inside the viewport

- **WHEN** the selected node is near a viewport edge
- **THEN** the popover is offset so it does not overflow the viewport
- **AND** the offset direction is chosen automatically based on the available space

### Requirement: Quick Actions popover exposes a color palette

The popover MUST show a fixed color palette of 8 named colors. Each color is rendered as a small swatch button. Clicking a swatch MUST apply that color to the selected node via the appropriate field for the node's type, in a single undoable step.

#### Scenario: Color applied to a C4 component

- **WHEN** the user clicks a color swatch while a `C4Component` is selected
- **THEN** the node's `panelColor` is set to that color
- **AND** the change is a single history step (one `Cmd/Ctrl+Z` undoes it)

#### Scenario: Color applied to a process / flow node

- **WHEN** the user clicks a color swatch while a `FlowNodeComponent` or `ProcessNodeComponent` is selected
- **THEN** the node's `nodeColor` is set to that color
- **AND** the change is a single history step

#### Scenario: Color applied to a note in dark mode

- **WHEN** the user clicks a color swatch while a `NoteComponent` is selected in dark mode
- **THEN** the node's `panelColorDark` is set to that color
- **AND** the light-mode `panelColor` is not changed

#### Scenario: Component with no color field shows a hint

- **WHEN** the user selects a node whose type has no color field
- **THEN** the popover renders a small "not applicable for this node" hint instead of a palette
- **AND** no `updateComponent` call is made

### Requirement: Quick Actions popover exposes a Reset action

The popover MUST show a Reset action that clears the color field on the selected node. The action MUST only be enabled when the node currently has a non-default color.

#### Scenario: Reset clears the color

- **WHEN** the user clicks Reset on a node that has a non-default `panelColor`
- **THEN** the node's `panelColor` is set to `undefined` (or the type's empty default)
- **AND** the change is a single history step

#### Scenario: Reset is disabled when the node has no color

- **WHEN** the user opens the popover on a node with no color set
- **THEN** the Reset action is disabled
- **AND** clicking it has no effect

### Requirement: Quick Actions popover is dismissable

The popover MUST be dismissed (closed without applying any change) when the user clicks outside it, presses `Esc`, deselects the node, re-clicks the same node (toggle off), or the canvas enters a locked mode.

#### Scenario: Click outside dismisses

- **WHEN** the user clicks anywhere outside the popover
- **THEN** the popover closes
- **AND** no change is applied to the node

#### Scenario: Esc dismisses

- **WHEN** the popover is open and the user presses `Esc`
- **THEN** the popover closes
- **AND** focus returns to the canvas

#### Scenario: Deselection dismisses

- **WHEN** the user clicks the canvas pane (no node)
- **THEN** the selection is cleared
- **AND** the popover closes

#### Scenario: Re-click on same node dismisses

- **WHEN** the user clicks the already-selected node again (no modifier)
- **THEN** the selection is toggled off
- **AND** the popover closes

#### Scenario: Locked mode dismisses

- **WHEN** the canvas enters compare / recording / playback / viewing while the popover is open
- **THEN** the popover closes
- **AND** it does not reappear until the user re-selects a node after returning to an editable mode

### Requirement: Quick Actions does not change the ElementPanel

The popover and the ElementPanel MUST coexist. The popover MUST NOT hide, replace, or otherwise alter the ElementPanel. The two surfaces MUST apply color changes through the same store action (`updateComponent`), so a change via the popover is reflected in the panel and vice versa.

#### Scenario: Popover change reflects in the panel

- **WHEN** the user picks a color in the popover
- **THEN** the ElementPanel's color control updates to show the new color

#### Scenario: Panel change does not break the popover

- **WHEN** the user changes the color in the ElementPanel while the popover is open
- **THEN** the popover's Reset button enabled-state updates to reflect the new color
- **AND** the popover remains open and functional

### Requirement: i18n keys for the popover

The popover MUST use the existing `colors.*` keys for palette swatch labels. One new key, `nodeQuickActions.resetColor`, MUST be added to both `en.json` and `pt-BR.json` for the Reset action label. One additional key, `nodeQuickActions.notApplicableForNode`, MUST be added for the "not applicable" hint. No other new keys are introduced.

#### Scenario: Locale files are updated

- **WHEN** the implementation is reviewed against the locale files
- **THEN** `en.json` and `pt-BR.json` each contain `nodeQuickActions.resetColor` and `nodeQuickActions.notApplicableForNode`
- **AND** no other new keys are added by this change

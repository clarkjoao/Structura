# selection-actions-toolbar Specification

## Purpose

Floating contextual toolbar (QuickActionsBar) above selected canvas elements — nodes and edges — replacing scattered side-panel controls with a FigJam-style inline action surface.

## Requirements

### Requirement: Node QuickActionsBar renders when one node is selected

The system SHALL render a floating toolbar above the selected node when exactly one node is selected. The toolbar SHALL be implemented via React Flow's `<NodeToolbar position={Position.Top} offset={10}>`. All toolbar labels SHALL be provided through i18n in both `en` and `pt-BR`.

#### Scenario: Toolbar appears above a selected node

- **WHEN** a user selects exactly one node on the canvas
- **THEN** a floating toolbar appears above that node, rendered by `<NodeToolbar position={Position.Top} offset={10}>`

#### Scenario: Toolbar hides when no node is selected

- **WHEN** the user deselects all nodes (clicks the canvas pane)
- **THEN** the node toolbar is hidden

#### Scenario: Toolbar hides when multiple nodes are selected

- **WHEN** the user selects two or more nodes
- **THEN** the node toolbar is hidden (multi-select remains handled by `MultiSelectPanel`)

### Requirement: Node QuickActionsBar contains lock, opacity, and icon controls

The node toolbar SHALL contain, in order from left to right: a lock/unlock toggle, an opacity slider (0–100), and an icon-picker button. Each control SHALL directly mutate the selected component's state via `updateComponent`.

#### Scenario: Lock/unlock toggle updates component

- **WHEN** the user clicks the lock icon while a component is unlocked
- **THEN** `updateComponent(componentId, { locked: true })` is called and the icon changes to locked
- **WHEN** the user clicks the lock icon while a component is locked
- **THEN** `updateComponent(componentId, { locked: false })` is called and the icon changes to unlocked

#### Scenario: Opacity slider updates panelOpacity

- **WHEN** the user drags the opacity slider from 0 to 100
- **THEN** `updateComponent(componentId, { panelOpacity: <value> })` is called on each change with the current value

#### Scenario: Opacity slider does not close the toolbar during drag

- **WHEN** the user drags the opacity slider from the start to the end of its range
- **THEN** the toolbar remains visible throughout the drag and does not close

#### Scenario: Icon picker opens existing modal

- **WHEN** the user clicks the icon picker button
- **THEN** the existing `IconPickerModal` is opened with the current diagram ID and component icon
- **WHEN** the user selects an icon in the modal
- **THEN** `updateComponent(componentId, { iconId: <selectedIconId> })` is called
- **WHEN** the user closes the modal without selecting
- **THEN** no update is made

### Requirement: Edge QuickActionsBar extends the existing EdgeToolbar

The system SHALL extend the existing `EdgeToolbar` component in `src/features/canvas/edges/components/EdgeToolbar.tsx` with additional controls. The toolbar SHALL be anchored at the edge's label point and visible only when the edge is selected.

#### Scenario: Extended toolbar appears above a selected edge

- **WHEN** a user selects an edge with a label
- **THEN** the extended `EdgeToolbar` appears anchored at the label point, above the label

#### Scenario: Extended toolbar renders for edge without label

- **WHEN** a user selects an edge without a label
- **THEN** the toolbar appears anchored at the midpoint of the edge path

### Requirement: Edge QuickActionsBar contains style, color, caps, and delete

The edge toolbar SHALL contain: an edge-style dropdown, a color swatch picker, marker-start and marker-end caps dropdowns, and a delete button. All mutations SHALL use `updateConnection`. All labels SHALL be provided through i18n in both `en` and `pt-BR`.

#### Scenario: Edge style dropdown changes edgeStyle

- **WHEN** the user selects "Straight" in the edge-style dropdown
- **THEN** `updateConnection(edgeId, { style: { edgeStyle: 'straight' } })` is called and the edge re-renders

#### Scenario: Color swatch changes edge color

- **WHEN** the user clicks a color swatch in the toolbar
- **THEN** `updateConnection(edgeId, { style: { color: <swatchColor> } })` is called and the edge color updates

#### Scenario: Marker-end dropdown changes arrowhead

- **WHEN** the user selects "Arrow" in the marker-end dropdown
- **THEN** `updateConnection(edgeId, { style: { markerEnd: 'arrow' } })` is called and the arrowhead updates

#### Scenario: Marker-start dropdown changes start cap

- **WHEN** the user selects "ArrowClosed" in the marker-start dropdown
- **THEN** `updateConnection(edgeId, { style: { markerStart: 'arrowClosed' } })` is called and the start cap updates

#### Scenario: Delete button removes the edge

- **WHEN** the user clicks the delete button in the toolbar
- **THEN** `removeConnection(edgeId)` is called and the toolbar is hidden

### Requirement: Toolbar interactions do not deselect the element

Clicking any control inside the toolbar (buttons, dropdowns, slider, color picker) SHALL NOT deselect the element or close the toolbar. The toolbar closes only when the user explicitly deselects (clicks pane, presses Escape, or selects a different element).

#### Scenario: Clicking toolbar controls keeps element selected

- **WHEN** the user clicks a button inside the node toolbar
- **THEN** the node remains selected and the toolbar stays open

#### Scenario: Dragging opacity slider keeps toolbar open

- **WHEN** the user drags the opacity slider from one end to the other
- **THEN** the element stays selected and the toolbar stays visible throughout

### Requirement: Toolbar uses canonical color palette

The toolbar color picker SHALL reuse `VIBRANT_PRESETS` from `src/features/canvas/panels/ElementPanel/components/colorPresets.ts`. No duplicate swatches SHALL be introduced.

#### Scenario: Color picker shows vibrant presets

- **WHEN** the user opens the color picker in the toolbar
- **THEN** the swatches displayed are exactly `VIBRANT_PRESETS` with no additional colors

### Requirement: Opacity control lives inside the toolbar

The opacity control for panel components SHALL be available inside the node toolbar. The legacy `PanelColorPicker` component in the side panel SHALL be gated behind `ENABLE_LEGACY_PANEL_ACTIONS` (see `legacy-panel-gating` spec).

#### Scenario: Opacity visible in toolbar

- **WHEN** a panel component is selected
- **THEN** the node toolbar contains the opacity slider

### Requirement: All UI strings use i18n

All user-facing text in the QuickActionsBar components SHALL be provided through i18n using `useTranslation`. Supported locales: `en` and `pt-BR`. New translation keys SHALL be added to `locales/en.json` and `locales/pt-BR.json`.

#### Scenario: Toolbar labels in English

- **WHEN** the user locale is set to English
- **THEN** all toolbar labels display English text from `en.json`

#### Scenario: Toolbar labels in Portuguese

- **WHEN** the user locale is set to Portuguese
- **THEN** all toolbar labels display Portuguese text from `pt-BR.json`

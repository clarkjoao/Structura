# legacy-panel-gating Specification

## Purpose

Gate migrated controls in `ComponentPanel`, `ConnectionPanel`, and `PanelStyleSection` behind a feature flag so they can be hidden during the transition to the QuickActionsBar, without deleting existing code.

## Requirements

### Requirement: Feature flag controls legacy panel visibility

The system SHALL provide a boolean feature flag `ENABLE_LEGACY_PANEL_ACTIONS` (default `false`) defined in `src/infrastructure/config.ts`. When `false`, migrated controls are hidden from panels. When `true`, migrated controls remain visible alongside the toolbar.

#### Scenario: Flag false hides migrated controls

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false`
- **THEN** the lock/unlock button, opacity slider, and style controls are not rendered in `ComponentPanel`, `ConnectionPanel`, or `PanelStyleSection`

#### Scenario: Flag true shows migrated controls

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `true`
- **THEN** all migrated controls render in the panels as they did before this change

### Requirement: Panel mutations are gated independently of toolbar mutations

The toolbar and panels operate on the same state (`updateComponent`, `updateConnection`). Toggling the feature flag SHALL NOT affect toolbar behavior — the toolbar always functions regardless of the flag value.

#### Scenario: Toolbar works when flag is false

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false` and a node is selected
- **THEN** the node toolbar renders and its controls still call `updateComponent`

#### Scenario: Toolbar works when flag is true

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `true` and a node is selected
- **THEN** the node toolbar renders and its controls still call `updateComponent`

### Requirement: Specific controls are gated in ComponentPanel

The following controls in `ComponentPanel.tsx` SHALL be gated behind `ENABLE_LEGACY_PANEL_ACTIONS`:

- The lock/unlock button in the panel header (`ComponentPanel.tsx:262-273`)
- All controls rendered via `PanelStyleSection` when the component is a panel type

#### Scenario: Lock button hidden when flag is false

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false`
- **THEN** the lock/unlock button is not rendered in `ComponentPanel`'s header

#### Scenario: PanelStyleSection hidden when flag is false

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false` and a panel component is selected
- **THEN** `PanelStyleSection` is not rendered in the panel

### Requirement: Specific controls are gated in ConnectionPanel

The following controls in `ConnectionPanel.tsx` SHALL be gated behind `ENABLE_LEGACY_PANEL_ACTIONS`:

- Edge-style buttons (lines 217-244)
- Stroke style and width selects (lines 382-406)
- Marker start and end selects (lines 411-446)
- Animated checkbox (lines 447-455)
- Reset path button (lines 476-489)
- Color swatches (lines 345-376)

#### Scenario: Edge style buttons hidden when flag is false

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false`
- **THEN** the edge-style button row is not rendered in `ConnectionPanel`

#### Scenario: Color swatches hidden when flag is false

- **WHEN** `ENABLE_LEGACY_PANEL_ACTIONS` is `false`
- **THEN** the color swatch section is not rendered in `ConnectionPanel`

### Requirement: Panel ColorPicker range-input bug is fixed

The range input in `PanelColorPicker.tsx` SHALL NOT close the containing panel when the user drags the slider. The fix SHALL ensure pointer events from the range input do not propagate to cause panel dismissal. All UI strings SHALL use i18n.

#### Scenario: Slider drag does not close panel

- **WHEN** the user drags the opacity slider in `PanelColorPicker`
- **THEN** the panel containing the slider remains open throughout the drag

#### Scenario: Clicking outside the panel closes it

- **WHEN** the user clicks outside the panel
- **THEN** the panel closes as expected

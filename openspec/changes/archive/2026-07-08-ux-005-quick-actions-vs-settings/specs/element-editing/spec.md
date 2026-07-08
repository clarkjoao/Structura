# Spec: element-editing

This spec groups the rules for editing a single node, including where the editing happens (Quick Actions popover vs ElementPanel) and which fields are owned by which surface.

## ADDED Requirements

### Requirement: Quick Actions palette exposes the full vibrant + neutral set

The popover MUST expose the full `PANEL_PRESETS` palette (15 vibrant + 6 neutral colors) divided into two labeled sections. By default the neutral section is hidden behind a "More" toggle. Expanding the toggle does not move the popover (it grows downward and remains clamped to the viewport).

#### Scenario: Popover shows vibrant colors by default

- **WHEN** the user selects a single node and the popover appears
- **THEN** the popover shows the 15 vibrant swatches in a single row with a "Vibrant" section label
- **AND** the Reset action remains in the top-right

#### Scenario: More toggle reveals neutrals

- **WHEN** the user clicks the "More" toggle
- **THEN** the neutral row appears below the vibrant row
- **AND** the toggle label changes to "Less"
- **AND** clicking "Less" collapses the neutrals back

#### Scenario: Popover stays clamped when expanded

- **WHEN** the popover is expanded and the selected node is near the bottom of the viewport
- **THEN** the popover grows upward instead of overflowing the viewport
- **AND** no part of the popover is cut off

### Requirement: Quick Actions is the only place to change a node's color

The ElementPanel MUST NOT render a color picker, swatch grid, or any other color-editing control. A read-only "color hint" line in the panel tells the user the current color and points them to the Quick Actions popover as the place to change it.

#### Scenario: Panel shows the current color as a hint

- **WHEN** a single node is selected and the ElementPanel is open
- **THEN** the panel shows a one-line hint with the current color name (or "Default" if no color is set)
- **AND** the hint includes a button or link labeled "Open Quick Actions" that focuses the popover (the popover must already be open; the focus is a no-op if not, otherwise it moves keyboard focus to the first swatch)

#### Scenario: Panel does not have a color picker

- **WHEN** the implementation is reviewed
- **THEN** `ColorAccentSection` is not imported anywhere under `src/features/canvas/panels/ElementPanel/`
- **AND** the panel's component tree contains no `ColorPicker`, no swatch grid, and no `input[type="color"]`

#### Scenario: Quick Actions color change reflects in the panel hint

- **WHEN** the user picks a color in the popover
- **THEN** the panel's hint label updates to the new color name
- **AND** the change happens without re-rendering the entire panel

### Requirement: Quick vs structural classification is documented

A short document at `src/features/canvas/panels/ElementPanel/QUICK_VS_STRUCTURAL.md` MUST list the fields that belong to the Quick Actions popover and the fields that belong to the ElementPanel. The document is checked when a new field is added to either surface.

#### Scenario: Document exists and lists both buckets

- **WHEN** a reviewer inspects the ElementPanel directory
- **THEN** `QUICK_VS_STRUCTURAL.md` exists
- **AND** the document lists at least: `nodeColor`, `panelColor`, `panelColorDark` under "Quick" and `name`, `description`, `technology`, `tags`, `type`, `parent`, `shape`, `locked`, `swimlane`, `borderStyle`, `externalLinks`, `position` under "Structural"

### Requirement: ElementPanel scope is structural fields only

The ElementPanel MUST render only the fields classified as structural in `QUICK_VS_STRUCTURAL.md`. Quick fields MUST NOT be rendered in the panel, except for the one-line color hint that mirrors the popover state.

#### Scenario: Panel renders only structural sections

- **WHEN** a single node is selected
- **THEN** the panel renders the structural sections for the node's type (Basic Fields, Service Link, Linked Diagram, Flowchart Fields, Position, External Links, etc.)
- **AND** the panel does not render a color picker or a border color picker

#### Scenario: Future quick field is not added to the panel

- **WHEN** a new "quick" field is added (e.g. border color)
- **THEN** the field is added to the popover and `QUICK_VS_STRUCTURAL.md` is updated
- **AND** the field is NOT added to the ElementPanel

### Requirement: Adding a new field respects the classification

A new field on `Component` (or on the panel's model) MUST be classified as Quick or Structural before its UI is implemented. The classification is recorded in `QUICK_VS_STRUCTURAL.md` and drives where the UI lives.

#### Scenario: New field is classified before UI is added

- **WHEN** a developer adds a new field to `Component`
- **THEN** the PR description references the new field's classification
- **AND** the field is implemented in the popover or the panel, never both

### Requirement: Existing Quick Actions behavior is preserved

All behavior from the `node-quick-actions` spec (UX-004) MUST continue to work: single-node gate, anchoring, click-outside / Esc dismissal, Reset, coexistence with the ElementPanel for non-color fields.

#### Scenario: Re-verify all UX-004 scenarios

- **WHEN** the existing smoke / manual checks are run
- **THEN** all UX-004 scenarios still pass
- **AND** the popover still appears next to the selected node
- **AND** the Reset action still works
- **AND** `Cmd/Ctrl+Z` still undoes the color change

### Requirement: New i18n keys are added in both locales

The change MUST add the following keys to both `en.json` and `pt-BR.json`: `nodeQuickActions.sectionVibrant`, `nodeQuickActions.sectionNeutral`, `nodeQuickActions.moreToggle`, `elementPanel.colorHintLabel`, `elementPanel.openQuickActions`. No other new keys are introduced.

#### Scenario: Locale files are updated

- **WHEN** the implementation is reviewed against the locale files
- **THEN** `en.json` and `pt-BR.json` each contain the five new keys
- **AND** no other new keys are added

# Spec Delta

## Purpose

Arranges a diagram's elements automatically. The arrangement follows layout settings that
the author chooses and saves with the diagram, and the author can run and tune it from the
canvas without losing control of the result.

## ADDED Requirements

### Requirement: Collapsed panels take part at their collapsed size

When the diagram is arranged, a collapsed panel SHALL take part in the layout at its
collapsed size. Its descendants SHALL NOT take part, and their stored positions SHALL be
left unchanged.

#### Scenario: Collapsing a panel frees room on the next arrangement

- **GIVEN** a panel holding several elements that has been collapsed
- **WHEN** the user arranges the diagram
- **THEN** the panel occupies only its collapsed size, and its neighbours are placed against that size rather than the expanded one

#### Scenario: Descendants keep their place inside a collapsed panel

- **GIVEN** a collapsed panel whose children have stored positions
- **WHEN** the user arranges the diagram and then expands the panel
- **THEN** the children appear where they were before the arrangement, and the panel keeps its stored expanded size

#### Scenario: Connections to hidden elements do not shape the layout

- **GIVEN** a connection between an element outside a collapsed panel and an element hidden inside it
- **WHEN** the user arranges the diagram
- **THEN** that connection is not handed to the layout, and the arrangement completes without error

### Requirement: Layout settings belong to the diagram

Each diagram SHALL carry optional layout settings: a density (compact, normal or spacious)
and optional gaps between layers and between nodes. The settings SHALL be saved, undone,
exported and reloaded with the diagram through the existing persistence port, and not kept
as a browser preference.

#### Scenario: A diagram without settings behaves as today

- **GIVEN** a diagram saved before this change, with no layout settings
- **WHEN** the user arranges it
- **THEN** the arrangement is identical to the one produced before this change

#### Scenario: Settings survive a reload

- **GIVEN** a diagram whose density is set to spacious
- **WHEN** the workspace is reloaded or the diagram is reopened from a connected folder
- **THEN** the diagram's density is still spacious

#### Scenario: Settings are per diagram

- **GIVEN** two diagrams, one set to compact and one with no settings
- **WHEN** the user arranges each one
- **THEN** the first uses compact spacing and the second uses normal spacing

### Requirement: Density scales the tuned spacing proportionally

Normal density SHALL reproduce the current tuned spacing exactly, compact SHALL scale every
layout spacing by 0.75, and spacious by 1.4. The labelled-edge spacing SHALL scale by the
same factor, so the relationships between spacings that were tuned by measurement are
preserved.

#### Scenario: Normal density is byte-identical to the current layout

- **GIVEN** the reference, generated and seed diagrams used by the layout baselines
- **WHEN** they are arranged at normal density with no overrides
- **THEN** every node position, size and edge route equals the current baseline

#### Scenario: Spacious spreads the diagram out

- **GIVEN** a diagram with at least two layers
- **WHEN** it is arranged at spacious density
- **THEN** the gap between consecutive layers and between nodes in a layer is larger than at normal density

#### Scenario: Compact pulls the diagram in

- **GIVEN** a diagram with at least two layers
- **WHEN** it is arranged at compact density
- **THEN** the diagram's bounding box is smaller than at normal density

### Requirement: Advanced gaps override the density for their own spacing

A layer-gap override SHALL set the gap between consecutive layers, and a node-gap override
SHALL set the gap between nodes in the same layer. Each override SHALL replace only its own
spacing, which density otherwise scales, and SHALL be limited to a bounded range.

#### Scenario: A layer-gap override wins over density

- **GIVEN** a diagram at compact density with a layer-gap override of 300
- **WHEN** it is arranged
- **THEN** consecutive layers are 300 apart while the gap between nodes in a layer stays compact

#### Scenario: Out-of-range values are clamped

- **WHEN** a layer gap or node gap outside the allowed range is stored or received
- **THEN** the layout uses the nearest bound, and the arrangement does not fail

### Requirement: Every arrangement entry point uses the diagram's settings

The shortcut, the canvas and node context menus, the toolbar control, the assistant's
auto-layout tool and diagram generation SHALL all arrange the diagram with its saved
layout settings.

#### Scenario: The assistant honours the density

- **GIVEN** a diagram set to spacious
- **WHEN** the assistant runs its auto-layout tool on it
- **THEN** the result matches what the toolbar control produces for the same diagram

### Requirement: The arrangement is reachable and tunable from the toolbar

The bottom toolbar SHALL offer an Arrange control. Its primary action SHALL arrange the
diagram, and its menu SHALL let the author choose the density and edit the advanced gaps.
The control SHALL be unavailable when the canvas cannot be edited. Every visible string
SHALL come from i18n, in both `en` and `pt-BR`.

#### Scenario: Arranging from the toolbar

- **GIVEN** an editable diagram
- **WHEN** the user clicks the primary Arrange action
- **THEN** the diagram is arranged with its saved settings and the view fits the result

#### Scenario: Changing density re-arranges immediately

- **GIVEN** the Arrange menu is open on a diagram at normal density
- **WHEN** the user picks spacious
- **THEN** the setting is saved and the diagram is re-arranged at spacious density without any further action

#### Scenario: Restoring the defaults

- **GIVEN** a diagram set to compact with a layer-gap override
- **WHEN** the user picks "Restore defaults" in the Arrange menu
- **THEN** the diagram is re-arranged at normal density with no overrides, no layout settings are stored, and one undo brings the previous settings back

#### Scenario: Read-only canvas

- **GIVEN** a canvas the user cannot edit (viewer, or a locked collaboration session)
- **WHEN** the toolbar is shown
- **THEN** the Arrange control is not offered or is disabled

#### Scenario: No hardcoded copy

- **WHEN** the UI language is switched between English and Portuguese
- **THEN** every label and hint in the Arrange control and menu is translated

### Requirement: A settings change and the arrangement it causes are one undo step

Changing a layout setting from the menu, together with the re-arrangement it triggers,
SHALL be recorded as a single undo step. Undoing it SHALL restore both the previous
settings and the previous positions.

#### Scenario: Undo a density change

- **GIVEN** a diagram at normal density that the user switched to spacious from the Arrange menu
- **WHEN** the user presses undo once
- **THEN** the density is normal again and every node is back at its previous position

### Requirement: Arranging animates the transition

After an arrangement is applied, nodes SHALL move to their new positions over a short
transition of about 300 ms. Edges SHALL be hidden or faded during the transition and shown
at their final routes when it ends. When the user prefers reduced motion, positions SHALL
apply instantly.

#### Scenario: Nodes glide into place

- **GIVEN** an arranged diagram
- **WHEN** the user arranges it at a different density
- **THEN** the nodes move smoothly to their new positions rather than jumping, and edges reappear on their final routes

#### Scenario: Reduced motion

- **GIVEN** the operating system's reduced-motion preference is on
- **WHEN** the user arranges the diagram
- **THEN** the new positions apply with no transition

#### Scenario: Editing right after an arrangement

- **GIVEN** an arrangement whose transition is still running
- **WHEN** the user starts dragging a node
- **THEN** the drag follows the pointer without lag, and no transition is applied to the dragged node

# diagram-auto-layout Specification

## Purpose

Arranges a diagram's elements automatically. The arrangement follows layout settings that
the author chooses and saves with the diagram, and the author can run and tune it from the
canvas without losing control of the result.

## Requirements

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
layout spacing by 0.75, and spacious by 1.35. The labelled-edge spacing SHALL scale by the
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

### Requirement: Layout settings carry a mode

A diagram's layout settings SHALL carry a mode, `manual` or `automatic`. Absent means
`manual`, which is today's behaviour. The mode SHALL be saved, exported and reloaded with
the diagram through the persistence port like the other layout settings.

#### Scenario: A diagram without a mode is manual

- **GIVEN** a diagram saved before this change
- **WHEN** the user adds an element
- **THEN** nothing moves until the user arranges the diagram

#### Scenario: The mode survives a reload

- **GIVEN** a diagram switched to automatic
- **WHEN** the workspace is reloaded
- **THEN** the diagram is still in automatic mode

### Requirement: Automatic mode places only what the edit touched

In automatic mode, shortly after a local structural edit, the elements the edit touched SHALL be placed and every other element SHALL keep its position. Touched means: added, moved into another container, or connected for the first time to an element already in place. A touched element SHALL go one column after the element it is connected from (before the one it connects to), on the same row, moved down until it overlaps nothing; containers SHALL grow to keep it inside. A burst of edits SHALL be placed once.

#### Scenario: Adding a connected element leaves the diagram in place

- **GIVEN** an arranged diagram in automatic mode
- **WHEN** the user adds an element and connects an existing element to it
- **THEN** the new element appears to the right of the existing one, and no other element moves

#### Scenario: The spot is taken

- **GIVEN** a diagram in automatic mode where the column right of an element is occupied
- **WHEN** the user adds an element connected from it
- **THEN** the new element is placed below what occupies that spot, overlapping nothing

#### Scenario: A deletion or a connection between placed elements moves nothing

- **GIVEN** a diagram in automatic mode
- **WHEN** the user deletes an element, or connects two elements that are already in place
- **THEN** no element moves

#### Scenario: An unconnected element stays where it was dropped

- **GIVEN** a diagram in automatic mode
- **WHEN** the user adds an element without connecting it
- **THEN** it stays where it was inserted, and is placed when it gets its first connection

#### Scenario: Moving or renaming is not structural

- **GIVEN** a diagram in automatic mode
- **WHEN** the user drags an element or edits a name or label
- **THEN** nothing is placed

#### Scenario: Manual mode never places by itself

- **GIVEN** a diagram in manual mode
- **WHEN** the user adds, connects and removes elements
- **THEN** nothing moves on its own

### Requirement: The automatic arrangement joins the edit's undo step

An automatic arrangement SHALL NOT create an undo step of its own. Undoing the edit that
caused it SHALL restore both the structure and the positions as they were before the edit.

#### Scenario: One undo takes back the edit and the arrangement

- **GIVEN** a diagram in automatic mode
- **WHEN** the user adds an element, the diagram re-arranges, and the user presses undo once
- **THEN** the element is gone and every other element is back at its position from before the edit

#### Scenario: Undo and redo do not re-arrange

- **GIVEN** a diagram in automatic mode
- **WHEN** the user undoes or redoes a structural edit
- **THEN** no arrangement runs, and the redo history is kept

### Requirement: Only the author's own edits trigger an automatic arrangement

The automatic arrangement SHALL run only for structural changes made in this editor by the
local user. It SHALL NOT run for:

- a peer's change in a collaboration session;
- switching to another diagram;
- an arrangement that has already been applied, such as the assistant laying out what it
  generated;
- a canvas that cannot be edited, flow reading or compare mode.

#### Scenario: A peer's edit does not arrange

- **GIVEN** a collaboration session where this editor has the diagram in automatic mode
- **WHEN** a peer adds an element
- **THEN** this editor does not re-arrange the diagram

#### Scenario: The assistant's layout is not redone

- **GIVEN** a diagram in automatic mode
- **WHEN** the assistant inserts elements and lays them out itself
- **THEN** no second arrangement runs on top of it

#### Scenario: Switching diagrams does not arrange

- **GIVEN** two diagrams in automatic mode
- **WHEN** the user opens the other one
- **THEN** nothing moves

### Requirement: An automatic arrangement is quiet

An automatic placement SHALL animate like any arrangement. It SHALL NOT change the
viewport and SHALL NOT show a notification.

#### Scenario: No toast while sketching

- **GIVEN** a diagram in automatic mode
- **WHEN** an element is placed automatically
- **THEN** no notification is shown and the zoom and pan are unchanged

### Requirement: The mode is chosen in the Arrange menu

The Arrange menu SHALL let the author choose Manual or Automatic. Choosing either SHALL
save the mode as one undo step without moving anything; the full arrangement stays on the
Arrange button. The Arrange button SHALL indicate
when the diagram is in automatic mode, and "Restore defaults" SHALL return to manual mode.
Every visible string SHALL come from i18n, in both `en` and `pt-BR`.

#### Scenario: Turning automatic on

- **GIVEN** a manual diagram
- **WHEN** the user picks Automatic in the Arrange menu
- **THEN** the diagram is arranged, the mode is saved, and one undo restores both the manual mode and the previous positions

#### Scenario: Turning automatic off

- **GIVEN** a diagram in automatic mode whose elements the user moved by hand
- **WHEN** the user picks Manual
- **THEN** no element moves, and the mode is saved as manual

#### Scenario: The button shows the mode

- **GIVEN** a diagram in automatic mode
- **WHEN** the toolbar is shown
- **THEN** the Arrange button marks that automatic mode is on, in the current UI language

### Requirement: Large diagrams are not re-arranged during a live session

During a live session, arranging the whole diagram SHALL be unavailable when the diagram has more than 50 elements, free text excluded. This covers the Arrange button, the shortcut, the context menus, spacing changes in the Arrange menu and the assistant's layout. The automatic mode's placement of what was just added SHALL stay available.

#### Scenario: Arrange is locked in a large session

- **GIVEN** a live session on a diagram with 51 elements
- **WHEN** the user opens the Arrange menu or presses the shortcut
- **THEN** arranging and the spacing controls are disabled, and an explanation says why

#### Scenario: Small diagrams stay arrangeable

- **GIVEN** a live session on a diagram with 50 elements
- **WHEN** the user arranges it
- **THEN** the diagram is arranged

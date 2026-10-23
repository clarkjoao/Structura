# Spec Delta

## ADDED Requirements

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

### Requirement: Automatic mode re-arranges after a local structural edit

In automatic mode, the diagram SHALL be re-arranged with its saved settings shortly after
the local user changes its structure. Structural changes are: adding or removing an
element or a connection, changing an element's parent, changing a connection's ends, and
collapsing or expanding a panel. Edits made in quick succession SHALL produce a single
arrangement.

#### Scenario: Adding an element arranges the diagram

- **GIVEN** a diagram in automatic mode
- **WHEN** the user adds an element and connects it
- **THEN** the diagram is re-arranged once, after the last of those edits, and the user's viewport is kept

#### Scenario: Moving an element is not structural

- **GIVEN** a diagram in automatic mode
- **WHEN** the user drags an element to a new place
- **THEN** the element stays where it was dropped and no arrangement runs

#### Scenario: Renaming is not structural

- **GIVEN** a diagram in automatic mode
- **WHEN** the user edits an element's name or a connection's label
- **THEN** no arrangement runs

#### Scenario: Manual mode never re-arranges by itself

- **GIVEN** a diagram in manual mode
- **WHEN** the user adds, connects and removes elements
- **THEN** no arrangement runs

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

An automatic arrangement SHALL animate like any arrangement. It SHALL NOT change the
viewport and SHALL NOT show a success notification. It SHALL still report a failure.

#### Scenario: No toast while sketching

- **GIVEN** a diagram in automatic mode
- **WHEN** an automatic arrangement succeeds
- **THEN** no success notification is shown and the zoom and pan are unchanged

### Requirement: The mode is chosen in the Arrange menu

The Arrange menu SHALL let the author choose Manual or Automatic. Choosing Automatic SHALL
arrange the diagram immediately and save the mode as one undo step. Choosing Manual SHALL
save the mode as one undo step without moving anything. The Arrange button SHALL indicate
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

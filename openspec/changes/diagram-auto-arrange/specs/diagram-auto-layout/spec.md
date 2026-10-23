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

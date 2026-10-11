# Spec Delta

## Purpose

Lets a user edit an opscr workspace's YAML inside Structura, on the files in their own folder, with
the diagram bound to that folder following every edit while keeping the arrangement they made.

## ADDED Requirements

### Requirement: Binding a diagram to a folder

The user SHALL be able to bind the active diagram to an opscr folder from the opscr document pane.
The bound diagram SHALL then show the technical view of every manifest in that folder, and the
binding SHALL survive a page reload (after the browser asks for permission again).

#### Scenario: First bind

- **GIVEN** an empty diagram and a folder holding the opscr sample
- **WHEN** the user binds the diagram to the folder
- **THEN** the canvas shows the sample's panels, elements and edges, and the pane lists the five
  manifest files

### Requirement: Text edits sync the canvas

Editing a manifest in the pane SHALL update the bound diagram after a short pause in typing:
elements and edges the YAML adds appear, ones it removes disappear, and renamed descriptions,
providers and technologies update. While the workspace YAML does not parse, the diagram SHALL stay
as it was and the pane SHALL show the parse problem.

#### Scenario: Adding a Cache

- **WHEN** the user adds a Cache manifest and a `reads` edge to it in the pane
- **THEN** the canvas gains the Cache and the edge without a reload

#### Scenario: Deleting a manifest

- **WHEN** the user deletes a Queue's manifest
- **THEN** the Queue and its edges leave the canvas

### Requirement: The user's arrangement is kept

A sync SHALL NOT move an element that was already on the canvas, including elements the user
dragged; only new elements are placed, without overlapping their siblings.

#### Scenario: Dragged element

- **GIVEN** the user dragged `orders-db` to another position
- **WHEN** a later edit adds an element
- **THEN** `orders-db` stays where the user put it

### Requirement: Edits are saved to the folder

The pane SHALL write an edited file back to the folder when the user saves (Ctrl/Cmd+S or the save
button), and SHALL show which files have unsaved edits. _Reload_ SHALL re-read the folder, keeping
unsaved edits only after the user confirms discarding them is not wanted.

#### Scenario: Save

- **WHEN** the user edits `commerce.opscr.yaml` and saves
- **THEN** the file on disk has the edited text and the pane no longer marks it unsaved

### Requirement: opscr problems in the editor

Every opscr error and warning for the open file SHALL be shown as a marker on its line in the pane's
editor, with a count of problems in other files.

#### Scenario: Unknown field

- **WHEN** the user adds a field the Kind does not declare
- **THEN** the editor marks that line with opscr's message

### Requirement: Undo per sync

Each sync SHALL be one history step, so undo reverts the canvas to before that sync without touching
the text.

#### Scenario: Undo a sync

- **GIVEN** an edit that added a Cache
- **WHEN** the user undoes once on the canvas
- **THEN** the Cache leaves the canvas and the YAML still declares it, until the next edit syncs again

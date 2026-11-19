# Spec Delta

## ADDED Requirements

### Requirement: Canvas and text point at each other

While a folder is open, selecting a bound element or connection on the canvas SHALL open the file
of its manifest or edge in the pane with the cursor on its line, and moving the cursor into a
manifest or edge SHALL light the element it writes on the canvas.

#### Scenario: Selecting an element

- **WHEN** the user selects `statements` on the canvas
- **THEN** the pane shows `finance.opscr.yaml` with the cursor on the `statements` manifest

#### Scenario: Moving the cursor

- **WHEN** the cursor moves into the `payment-worker` manifest
- **THEN** `payment-worker` is lit on the canvas and the other elements dim

### Requirement: What does not carry is listed

The pane SHALL list canvas connections the YAML does not carry as drawn (an end outside the YAML,
a label that is not an edge type, an edge no Relationship could take), manifests of Kinds the view
does not draw and edges it cannot draw, each entry lighting its connection or opening its line.

#### Scenario: A label that is not an edge type

- **WHEN** the user labels a bound connection "HTTP"
- **THEN** the pane lists it, saying the YAML keeps its edge type

### Requirement: Comparing a conflict

A file in conflict with the folder SHALL offer a comparison of the folder's version with the
user's, editable, until a side is picked.

#### Scenario: Compare

- **GIVEN** `commerce.opscr.yaml` changed in the folder while it had unsaved edits
- **WHEN** the user clicks Compare
- **THEN** the folder's text is shown against the user's, and picking a side closes it

### Requirement: An empty folder starts with a manifest

A bound folder without manifests SHALL offer to create a first, valid manifest, unsaved, which is
drawn on the canvas.

#### Scenario: Empty folder

- **WHEN** the user binds an empty folder and clicks "Create a first manifest"
- **THEN** `architecture.opscr.yaml` opens unsaved and its element is drawn

# Spec Delta

## ADDED Requirements

### Requirement: Canvas edits patch the YAML

While a bound folder is open in the opscr pane, a canvas edit of an element or edge the YAML
declares SHALL be written into that folder's manifests as a text patch (left unsaved), changing
only the affected text: renaming an element renames its manifest and every edge end naming it;
editing its description sets `spec.description`; deleting elements removes their manifests and the
edges naming them; drawing a connection between two bound elements adds an edge; deleting a
connection removes its edge; relabelling it with an opscr edge type changes the edge's type.
Comments, ordering and formatting elsewhere SHALL be preserved byte for byte.

#### Scenario: Rename on the canvas

- **GIVEN** the sample is bound and `orders-db` is drawn
- **WHEN** the user renames it to `order-store` on the canvas
- **THEN** its manifest's `metadata.name` and every edge end `{ kind: Database, id: orders-db }`
  read `order-store`, the element keeps its position, and no other line changes

#### Scenario: Delete on the canvas

- **WHEN** the user deletes `cart-cache` on the canvas
- **THEN** its manifest and the edges naming it are gone from the text, and the file still parses

#### Scenario: Connect on the canvas

- **WHEN** the user draws a connection from `order-tracker` to `catalog-db`
- **THEN** a `calls` edge between them is appended to the Relationship holding `order-tracker`'s
  edges

#### Scenario: Name already taken

- **WHEN** the user renames `orders-db` to `catalog-db` (another Database)
- **THEN** the YAML is unchanged and the canvas name goes back to `orders-db`

### Requirement: Undo reaches the YAML

A canvas undo or redo on a bound diagram SHALL leave the YAML matching the canvas: undoing a canvas
edit reverts its patch, and undoing a sync reverts the text change it showed.

#### Scenario: Undo a canvas delete

- **GIVEN** the user deleted `cart-cache` on the canvas
- **WHEN** they undo
- **THEN** `cart-cache` is back on the canvas and its manifest and edges are back in the text

#### Scenario: Undo a sync

- **GIVEN** a text edit added a Storage `exports` and the canvas drew it
- **WHEN** the user undoes on the canvas
- **THEN** `exports` leaves the canvas and its manifest leaves the text

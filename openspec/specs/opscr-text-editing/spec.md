# opscr-text-editing Specification

## Purpose

Lets a user edit an opscr workspace's YAML inside Structura, on the files in their own folder, with
the diagram bound to that folder following every edit while keeping the arrangement they made.

## Requirements

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

### Requirement: Layout sidecar

The bound diagram's arrangement SHALL be kept in `opscr.layout.json` in the bound folder, keyed by
`Kind/name`, rewritten from the canvas after each sync or canvas change and saved with the
manifests. Elements the canvas does not have yet SHALL be placed at their sidecar box when the
sidecar has one.

#### Scenario: Restoring the arrangement

- **GIVEN** a folder whose sidecar places `orders-db` at (900, 300)
- **WHEN** an empty diagram is bound to the folder
- **THEN** `orders-db` is drawn at (900, 300)

#### Scenario: Dragging updates the sidecar

- **WHEN** the user drags `public-api` and saves
- **THEN** the sidecar on disk holds `public-api`'s new position, and a rename on the canvas
  re-keys its entry

### Requirement: F2 renames an element everywhere

F2 on a manifest's `metadata.name`, or on an edge end's `id`, SHALL rename that element in every
manifest of the bound folder and rename the canvas element in place, keeping its position and
children. A name the same Kind already uses, or an empty one, SHALL be refused.

#### Scenario: F2 on a name

- **WHEN** the user presses F2 on `order-tracker` and enters `order-relay`
- **THEN** the manifest and every edge end read `order-relay`, and the canvas element is renamed
  where it was

### Requirement: The chat edits the bound YAML

While a bound folder is open in the opscr pane, a chat message on that diagram SHALL be answered
with the opscr skill and the folder's manifests as context, and the manifests the model writes or
deletes SHALL be applied to the pane's text as patches, validated by opscr, with new errors sent
back to the model to fix.

#### Scenario: Adding a cache through the chat

- **WHEN** the user asks the chat to add a Redis cache that `orders-api` reads
- **THEN** a Cache manifest and the edge appear in the text (unsaved) and on the canvas, other
  manifests unchanged

### Requirement: Chat changes are pending until kept

Elements a chat reply adds or replaces on a bound diagram SHALL be highlighted as pending and
focused. Discard SHALL restore the manifests to their text before that reply, unless the text has
changed since, in which case it SHALL say so and keep the change.

#### Scenario: Discard a chat cache

- **GIVEN** the chat added `search-cache`
- **WHEN** the user clicks Discard
- **THEN** `search-cache` leaves the text and the canvas

### Requirement: The pane follows outside changes

While a bound folder is open, changes made to it outside Structura SHALL reach the pane within a
few seconds: unchanged-in-Structura files reload and the canvas syncs, new and removed files appear
and disappear, and a file with unsaved edits SHALL keep them and offer the folder's version or the
user's. A changed layout sidecar SHALL move the canvas to it.

#### Scenario: Edited in another editor

- **GIVEN** `finance.opscr.yaml` has no unsaved edits in Structura
- **WHEN** another editor adds a Storage manifest to it
- **THEN** the Storage appears on the canvas without a reload

#### Scenario: Edited on both sides

- **GIVEN** `commerce.opscr.yaml` has unsaved edits
- **WHEN** another editor changes it
- **THEN** the pane keeps the unsaved edits and shows the conflict with both choices

### Requirement: Palette elements into the YAML

The opscr pane SHALL list the bound diagram's elements that the YAML does not declare, each with a
suggested Kind and provider, and adding one SHALL write its manifest, a `belongsTo` to the panel it
sits in, and edges for its connections to bound elements, keeping the same canvas element.

#### Scenario: A DynamoDB from the palette

- **GIVEN** the user adds an AWS DynamoDB from the palette to a bound diagram
- **WHEN** they click Add to YAML with the suggested Kind Database
- **THEN** a Database manifest with provider DynamoDB is written and the element is no longer
  listed as outside the YAML, without a duplicate on the canvas

### Requirement: Moving an element between panels

Moving a bound element into another bound panel on the canvas SHALL retarget its `belongsTo` to
that panel, and taking it out of every panel SHALL remove its `belongsTo`, keeping the element in
place. A move into a panel outside the YAML SHALL change nothing until the panel is added.

#### Scenario: Out of its panel

- **GIVEN** `order-tracker` sits in the `orders` panel
- **WHEN** the user ungroups it on the canvas
- **THEN** its `belongsTo` to `orders` is gone from the text and the element stays where it is

### Requirement: Catalog service and technology edits

Changing a bound element's catalog service or technology on the canvas SHALL set its manifest's
`spec.provider` when the new value is a provider of the element's Kind, and SHALL otherwise revert
the change on the canvas and say why.

#### Scenario: Lambda to ECS

- **GIVEN** `order-tracker` is an Application drawn as AWS Lambda
- **WHEN** the user picks Amazon ECS as its cloud service
- **THEN** its manifest reads `provider: ECS` and the element stays in place

#### Scenario: Another Kind's service

- **WHEN** the user picks DynamoDB for that Application
- **THEN** the manifest is unchanged and the canvas goes back to AWS Lambda

### Requirement: Canvas and text point at each other

While a folder is open, selecting a bound element or connection on the canvas SHALL open the file
of its manifest or edge in the pane with the cursor on its line, and moving the cursor into a
manifest or edge SHALL light the element it writes on the canvas. Dragging an element SHALL NOT
open its file, and typing SHALL NOT light what the cursor is in.

#### Scenario: Selecting an element

- **WHEN** the user selects `statements` on the canvas
- **THEN** the pane shows `finance.opscr.yaml` with the cursor on the `statements` manifest

#### Scenario: Dragging an element

- **GIVEN** the pane shows `commerce.opscr.yaml`
- **WHEN** the user drags `statements` to another position
- **THEN** the pane still shows `commerce.opscr.yaml`

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

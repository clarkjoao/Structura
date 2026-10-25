# Spec Delta

## MODIFIED Requirements

### Requirement: Layout sidecar

The bound diagram's arrangement SHALL be kept in `opscr.layout.json` in the bound folder, keyed by
`Kind/name`, and saved with the manifests. It SHALL record what the reader arranged: a box moved on
the canvas, or a panel resized, together with the panels holding it. Drawing from the YAML, and the
canvas sizing its cards, SHALL NOT change it. Elements the canvas does not have yet SHALL be placed
at their sidecar box when the sidecar has one.

#### Scenario: Restoring the arrangement

- **GIVEN** a folder whose sidecar places `orders-db` at (900, 300)
- **WHEN** an empty diagram is bound to the folder
- **THEN** `orders-db` is drawn at (900, 300)

#### Scenario: Dragging updates the sidecar

- **WHEN** the user drags `public-api` and saves
- **THEN** the sidecar on disk holds `public-api`'s new position, and a rename on the canvas
  re-keys its entry

#### Scenario: Drawing alone writes nothing

- **WHEN** a folder is bound, or an initiative's Version is shown, and the user moves nothing
- **THEN** no sidecar changes and the pane has nothing unsaved

### Requirement: The user's arrangement is kept

A sync SHALL NOT move an element that was already on the canvas, including elements the user
dragged; only new elements are placed, without overlapping their siblings. Where most of a panel's
children are kept, a new element SHALL be placed beside the sibling it is connected to, along the
flow.

#### Scenario: Dragged element

- **GIVEN** the user dragged `orders-db` to another position
- **WHEN** a later edit adds an element
- **THEN** `orders-db` stays where the user put it

#### Scenario: New element beside what it connects to

- **GIVEN** an initiative adds `order-events`, which `orders-api` publishes to
- **WHEN** its Version is drawn
- **THEN** `order-events` sits right of `orders-api`, in the same panel, overlapping nothing

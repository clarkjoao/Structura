# Spec Delta

## Purpose

Keeps the editor and viewer canvas interactive on large diagrams by making its cost depend on
what is on screen and readable at the current zoom, not on the size of the whole diagram. A
reference fixture and harness guard this.

## ADDED Requirements

### Requirement: Large-diagram performance is measured against a reference fixture

The project MUST provide a deterministic large-diagram fixture and a script that measures
opening, panning, zooming, dragging a child node and dragging a large panel by its header on a
production build. Every change that claims a canvas performance effect MUST report these
numbers before and after the change, on the same machine.

#### Scenario: Same fixture, same numbers to compare

- **GIVEN** the fixture generator is run twice with the default seed
- **WHEN** both payloads are compared
- **THEN** they are byte-identical
- **AND** the fixture has at least 650 nodes, 700 edges, 2,900 route corners, one panel with at
  least 95 children, and opens at zoom 0.3

#### Scenario: Gestures that did not happen are not reported as measured

- **GIVEN** the harness runs the panel-drag scenario
- **WHEN** the panel's position on the canvas is unchanged after the gesture
- **THEN** the report marks the scenario as not moved, so it is not read as a valid measurement

### Requirement: Continuous viewport gestures persist the viewport once

A pan or zoom made of many frames (wheel, trackpad, drag, minimap) MUST write the viewport to the
diagram store at most once, after the gesture has settled. During the gesture the viewport MUST
NOT be written. The settled viewport MUST still survive a reload. The viewport stays local to the
user and is never sent to collaborators.

#### Scenario: Wheel panning does not write the store per frame

- **GIVEN** a diagram is open in the editor
- **WHEN** the user pans with 60 consecutive wheel events
- **THEN** the diagram store receives no viewport write until the wheel events stop
- **AND** after they stop it receives exactly one viewport write with the final viewport

#### Scenario: The settled viewport survives a reload

- **GIVEN** the user panned and the gesture settled
- **WHEN** the page is reloaded
- **THEN** the diagram opens at the viewport where the gesture ended

#### Scenario: Leaving right after a pan keeps the viewport

- **GIVEN** the user panned and the settle delay has not elapsed yet
- **WHEN** the user switches to another diagram or the page is hidden or unloaded
- **THEN** the pending viewport is written before it is lost

### Requirement: Off-screen edges are not rendered, judged by their drawn route

The canvas MUST NOT render an edge whose drawn route lies entirely outside the viewport plus a
margin. Whether an edge is visible MUST be decided from the route it draws (endpoints and every
corner), not only from the boxes of its source and target nodes. An edge whose route crosses
the viewport MUST render, even when both endpoints are off screen.

#### Scenario: A long edge whose endpoints are both off screen

- **GIVEN** an edge between two nodes that are both outside the viewport
- **AND** one of its route segments crosses the viewport
- **WHEN** the canvas renders
- **THEN** that edge is drawn, with its arrowheads and label in their usual place

#### Scenario: A detoured edge outside its endpoints' box

- **GIVEN** an edge whose route detours above both endpoint nodes
- **WHEN** the viewport shows only the detour lane and neither endpoint
- **THEN** the edge is drawn

#### Scenario: Edges far away are not mounted

- **GIVEN** the large-diagram fixture is open at zoom 0.3
- **WHEN** the viewport shows one panel
- **THEN** the number of mounted edge elements is less than half of the diagram's edges

#### Scenario: Panning brings culled edges back unchanged

- **GIVEN** an edge was culled
- **WHEN** the user pans until its route enters the viewport
- **THEN** the edge is drawn with the same path, handles, label and line hops it had before
  being culled

### Requirement: Culling does not change what the user can do with an element

Culling MUST be invisible except in cost. Selection, select-all, search and focus, the minimap,
the empty-viewport recovery card, export, flow playback framing and collaboration presence MUST
behave the same for culled and mounted elements. An element that is selected, being dragged,
being edited or followed by a collaborator's highlight MUST stay mounted.

#### Scenario: Select all includes off-screen elements

- **GIVEN** most nodes are culled
- **WHEN** the user selects all and deletes
- **THEN** every node and edge in the diagram is removed, not only the mounted ones
- **AND** one undo step restores them all

#### Scenario: Empty-viewport card still counts every element

- **GIVEN** the user pans to an empty region of a large diagram
- **WHEN** no node intersects the viewport
- **THEN** the recovery card shows the full element count of the diagram

#### Scenario: Searching an off-screen element frames it

- **GIVEN** a node is outside the viewport and culled
- **WHEN** the user searches for it and picks it
- **THEN** the viewport frames that node and the node is drawn and selected

### Requirement: Far zoom renders a simplified level of detail

Below a documented zoom threshold, the canvas MUST render a simplified level of detail. Nodes keep
their box, color, type and name, and drop secondary content (description, icons, badges, handle
dots). Edges keep their stroke and arrowheads, and drop line hops, label chrome and widened hover
hit areas. Crossing the threshold MUST NOT re-render every node or every edge through a
per-entity subscription.

#### Scenario: Zooming out past the threshold simplifies the drawing

- **GIVEN** a diagram is open at zoom 1
- **WHEN** the user zooms out below the threshold
- **THEN** node descriptions, icons and badges are no longer drawn
- **AND** edges are drawn without line-hop arcs

#### Scenario: Zooming back in restores full detail

- **GIVEN** the canvas is in the simplified level of detail
- **WHEN** the user zooms in above the threshold
- **THEN** every node and edge is drawn exactly as before zooming out

#### Scenario: Interaction still works at far zoom

- **GIVEN** the canvas is in the simplified level of detail
- **WHEN** the user clicks a node, drags a panel by its header, or selects a box of nodes
- **THEN** the interaction behaves as at full detail

#### Scenario: Any user-visible text added is translated

- **GIVEN** the level of detail adds a user-visible string, such as a preference label
- **WHEN** the app is shown in English or Brazilian Portuguese
- **THEN** the string comes from `t()` with entries in both `en.json` and `pt-BR.json`

### Requirement: Line hops are computed only between edges drawn in full

Line hops MUST be computed only between edges that are mounted and drawn at full detail. Culled
edges and edges drawn at the far level of detail MUST NOT take part in the computation, either as
hoppers or as obstacles.

#### Scenario: No hops at far detail

- **GIVEN** two edges whose routes cross
- **WHEN** the canvas is at the far level of detail and neither edge is selected
- **THEN** neither path contains a hop arc

#### Scenario: Hops at full detail

- **GIVEN** the same two edges
- **WHEN** the canvas is at full detail
- **THEN** the horizontal edge hops over the vertical one

### Requirement: Store writes do not serialize the workspace each time

Persisting the workspace MUST serialize it at most once per persistence debounce window, however
many store writes happen in that window. Persistence MUST keep going through the storage port and
MUST flush pending state when the page is hidden or unloaded.

#### Scenario: A burst of writes serializes once

- **GIVEN** 50 store writes happen inside one debounce window
- **WHEN** the window elapses
- **THEN** the workspace is serialized and written once, and contains the result of all 50 writes

#### Scenario: Closing the tab keeps the last edit

- **GIVEN** an edit was made and the debounce window has not elapsed
- **WHEN** the page is hidden or unloaded
- **THEN** the edit is persisted

#### Scenario: Undo stays per user gesture

- **GIVEN** a structural edit made by one user gesture
- **WHEN** the user undoes
- **THEN** exactly that gesture is undone, as before this change

### Requirement: A store write re-renders only what it changed

After a store write that changes one element, only that element and the elements whose drawn
output depends on it MUST re-render. Context values and handlers that every node or edge reads
MUST keep their identity across writes that leave their content unchanged.

#### Scenario: Nudging one node

- **GIVEN** the large-diagram fixture is open and a node with no edges is selected
- **WHEN** the user moves it with one arrow key press
- **THEN** no edge component re-renders
- **AND** no other node is handed a new node object

#### Scenario: Ending a pan

- **GIVEN** the large-diagram fixture is open
- **WHEN** a pan gesture ends and the viewport is persisted
- **THEN** no node and no edge re-renders

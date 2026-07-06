## ADDED Requirements

### Requirement: Editable edge style

The system SHALL provide an `editable` edge style (`EdgeStyle.Editable`) whose path is rendered as a smooth Catmull-Rom curve passing through the edge's source endpoint, its ordered control points, and its target endpoint. The existing `bezier`, `smoothstep`, `step`, and `straight` styles SHALL remain available as non-editable presets and MUST NOT render control points.

#### Scenario: Editable edge renders through its control points

- **WHEN** a connection with `edgeStyle = editable` and two stored control points is displayed
- **THEN** its rendered path passes through the source handle, both control points in order, and the target handle as a single smooth curve

#### Scenario: Editable edge with no control points is a direct curve

- **WHEN** a connection with `edgeStyle = editable` has zero control points
- **THEN** the path is drawn directly from source to target with no visible control points

#### Scenario: Preset styles are not editable

- **WHEN** a connection uses `smoothstep`, `bezier`, `step`, or `straight`
- **THEN** no control points, ghost midpoints, or point-editing affordances are shown for that edge

### Requirement: Control point manipulation

For an editable edge, the system SHALL let the user add, move, and remove control points directly on the canvas. Control-point affordances SHALL be visible only when the edge is selected or hovered.

#### Scenario: Add a control point

- **WHEN** the user clicks a ghost midpoint marker on a selected editable edge
- **THEN** a new control point is inserted at that position between the two adjacent points and the path updates to pass through it

#### Scenario: Drag a control point freely

- **WHEN** the user drags an existing control point
- **THEN** the point follows the pointer in flow coordinates without axis locking, and the path updates live during the drag

#### Scenario: Remove a control point

- **WHEN** the user double-clicks an existing control point
- **THEN** that point is removed and the path re-routes through the remaining points

#### Scenario: Control points hidden when idle

- **WHEN** an editable edge is neither selected nor hovered
- **THEN** no control points or ghost midpoints are rendered for it

### Requirement: Comfortable selection and hover hitbox

The system SHALL give every edge an invisible hit area wider than its visible stroke so it can be selected and hovered comfortably, with correct cursor feedback, at any zoom level and while panning.

#### Scenario: Click near the edge selects it

- **WHEN** the user clicks within the invisible hit area near an edge but not exactly on the visible stroke
- **THEN** the edge becomes selected

#### Scenario: Hover feedback

- **WHEN** the pointer enters an edge's hit area
- **THEN** the edge shows hover feedback and the cursor reflects the available interaction

#### Scenario: Hitbox is stable under zoom and pan

- **WHEN** the viewport is zoomed or panned
- **THEN** the hit area continues to track the edge geometry and selection/hover remain accurate

### Requirement: Edge reconnection

The system SHALL allow reconnecting an existing edge by dragging either of its endpoints to a different node handle, updating the underlying connection's `sourceId`/`targetId` (and handle assignment) accordingly.

#### Scenario: Reconnect the target endpoint

- **WHEN** the user drags an editable edge's target endpoint onto a valid handle of another node and releases
- **THEN** the connection's target is updated to the new node and the edge is redrawn to it

#### Scenario: Reconnect the source endpoint

- **WHEN** the user drags an edge's source endpoint onto a valid handle of another node and releases
- **THEN** the connection's source is updated to the new node

#### Scenario: Invalid reconnect is discarded

- **WHEN** the user releases a reconnect drag over empty canvas or an invalid target
- **THEN** the connection is left unchanged

### Requirement: Edge toolbar

The system SHALL show a contextual edge toolbar anchored to a selected editable edge, offering at least reset of control points and deletion of the edge. All toolbar labels SHALL be provided through i18n in both `en` and `pt-BR`.

#### Scenario: Toolbar appears on selection

- **WHEN** an editable edge becomes selected
- **THEN** a floating toolbar is shown anchored to the edge

#### Scenario: Reset control points from toolbar

- **WHEN** the user activates the reset action in the toolbar
- **THEN** all control points for that edge are removed and the path returns to a direct curve

#### Scenario: Delete edge from toolbar

- **WHEN** the user activates the delete action in the toolbar
- **THEN** the connection is removed from the diagram

### Requirement: Draggable label along the path

The system SHALL let the user drag an edge's label along the edge path, persisting its offset per edge, and SHALL keep the label positioned at that offset as the path changes.

#### Scenario: Drag label to a new offset

- **WHEN** the user drags an edge label along the path and releases
- **THEN** the label settles at the nearest point on the path and its normalized offset is persisted for that edge

#### Scenario: Label tracks path changes

- **WHEN** an edge's control points change while a label offset is set
- **THEN** the label is repositioned to the same normalized offset along the new path

### Requirement: Persisted per-edge layout

The system SHALL persist per-edge layout as an `EdgeLayout` containing ordered control `points` (each with a stable `id`, `x`, `y`), an optional `pathType`, and an optional normalized `labelOffset`, replacing the previous `waypoints: Point[]` shape. A persistence migration SHALL convert existing `waypoints` into `points` with generated ids and bump the persisted schema version. Persistence SHALL occur only through the existing `IStoragePort` boundary.

#### Scenario: Existing waypoints are migrated

- **WHEN** a workspace persisted under the previous schema (edge layouts using `waypoints`) is loaded
- **THEN** each `waypoints` entry is converted into a control `point` with a generated stable id, and the diagram renders with equivalent geometry

#### Scenario: Control points round-trip through persistence

- **WHEN** an editable edge's control points are edited and the workspace is reloaded from storage
- **THEN** the same control points (ids and positions) are restored

### Requirement: Undo/redo for edge editing

The system SHALL record edge control-point and label-offset mutations in history via `pushHistory` so they can be undone and redone, coalescing a single drag gesture into one history step.

#### Scenario: Undo a control-point edit

- **WHEN** the user adds, moves, or removes a control point and then triggers undo
- **THEN** the edge returns to its pre-edit control-point state

#### Scenario: A drag is a single history step

- **WHEN** the user performs one continuous control-point drag and then triggers undo once
- **THEN** the edge returns to the state before that drag began (not to an intermediate position)

#### Scenario: Undo a label move

- **WHEN** the user drags a label to a new offset and then triggers undo
- **THEN** the label offset returns to its previous value

### Requirement: Overlays remain functional and isolated

The system SHALL keep flow-mode, playback, recording, coverage, and collaboration edge overlays working, rendered independently of the core editable-edge component so that overlay state changes do not force the editing core to recompute geometry.

#### Scenario: Playback particle still animates

- **WHEN** a flow is played back over a connection
- **THEN** the edge's playback particle and payload overlay animate as before

#### Scenario: Collaboration highlight still shows

- **WHEN** a collaborator selects a connection
- **THEN** that edge shows the collaborator highlight overlay

#### Scenario: Overlay updates do not disrupt editing geometry

- **WHEN** overlay-only data (playback/recording/coverage/collab) changes on an edge
- **THEN** the edge's control-point geometry and path are not recomputed as a result

### Requirement: Export honors edge control points

The system SHALL export edge geometry using the stored control `points` so that draw.io and Mermaid exports reflect the edited path.

#### Scenario: Draw.io export includes control points

- **WHEN** a diagram containing an editable edge with control points is exported to draw.io
- **THEN** the exported edge includes those points as its routing geometry

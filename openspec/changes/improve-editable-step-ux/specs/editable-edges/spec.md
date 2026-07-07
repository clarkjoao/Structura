## MODIFIED Requirements

### Requirement: Orthogonal step editing

The system SHALL provide an `editable-step` edge style (`EdgeStyle.EditableStep`) that routes the connection with horizontal/vertical segments and sharp right-angle corners (draw.io style). The user SHALL reposition a segment by dragging it perpendicular to its orientation, which keeps the route orthogonal and materializes the affected corners as control points. Segment handles SHALL be visible only when the edge is selected or hovered. Additionally, the user SHALL drag corner handles directly to reposition individual corners, and all drags SHALL support optional grid snapping.

#### Scenario: Step edge routes orthogonally

- **WHEN** a connection with `edgeStyle = editable-step` is displayed
- **THEN** its path consists solely of horizontal and vertical segments with sharp corners and no rounding

#### Scenario: Drag a segment to reposition it

- **WHEN** the user drags a horizontal segment vertically (or a vertical segment horizontally) on a selected step edge
- **THEN** that segment moves perpendicular to its orientation, the corners stay square, and the new corners are stored as control points

#### Scenario: Segment handles hidden when idle

- **WHEN** a step edge is neither selected nor hovered
- **THEN** no segment handles are rendered for it

#### Scenario: Drag a corner to reposition it

- **WHEN** the user drags a corner handle on a selected step edge
- **THEN** the corner moves in the direction perpendicular to its connecting segments, the path stays orthogonal, and the corner position is stored as a control point

#### Scenario: Corner handles visible on selection

- **WHEN** a step edge is selected or hovered
- **THEN** corner handles appear at each interior corner of the orthogonal route

#### Scenario: Drag supports grid snapping

- **WHEN** grid snapping is enabled and the user drags a segment or corner on a step edge
- **THEN** the drag position snaps to the nearest grid line during the drag

#### Scenario: Drag preview shown during manipulation

- **WHEN** the user is dragging a segment or corner on a step edge
- **THEN** a semi-transparent preview of the new path is rendered, updating in real time during the drag

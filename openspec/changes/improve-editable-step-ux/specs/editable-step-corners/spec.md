## ADDED Requirements

### Requirement: Corner handles on step edges

The system SHALL render visible corner handles at each interior corner of an `editable-step` edge when the edge is selected or hovered. Corner handles SHALL be small square markers positioned at the corner coordinates.

#### Scenario: Corner handles appear when selected

- **WHEN** a step edge is selected
- **THEN** a corner handle is rendered at each interior corner position of the orthogonal route

#### Scenario: Corner handles visible on hover

- **WHEN** the pointer enters a step edge's hit area
- **THEN** corner handles appear at each interior corner, even if the edge is not selected

#### Scenario: Corner handles hidden when idle

- **WHEN** a step edge is neither selected nor hovered
- **THEN** no corner handles are rendered

### Requirement: Drag corner to reposition

The system SHALL let the user drag a corner handle directly to reposition it, updating the adjacent segments in real time and persisting the new corner position as a control point.

#### Scenario: Drag a corner vertically when it connects horizontal segments

- **WHEN** the user drags a corner that connects two horizontal segments
- **THEN** the corner moves vertically, both adjacent segments update to remain horizontal/vertical, and the path stays orthogonal

#### Scenario: Drag a corner horizontally when it connects vertical segments

- **WHEN** the user drags a corner that connects two vertical segments
- **THEN** the corner moves horizontally, both adjacent segments update to remain vertical/horizontal, and the path stays orthogonal

#### Scenario: Corner drag checkpointed once per gesture

- **WHEN** the user drags a corner and releases
- **THEN** the history records a single checkpoint for the entire drag gesture

#### Scenario: Corner drag position persisted

- **WHEN** the user drags a corner to a new position and releases
- **THEN** the new corner position is stored as a control point in the edge layout

### Requirement: Minimum segment length guard

The system SHALL prevent a segment from collapsing to zero length or inverting its direction during corner drag. When a drag would cause a segment to collapse, the corner SHALL be clamped to the nearest valid position.

#### Scenario: Segment cannot collapse to zero length

- **WHEN** a corner drag would cause a segment to reach zero length
- **THEN** the corner is clamped to the minimum valid position, maintaining positive segment length

#### Scenario: Segment maintains orientation

- **WHEN** a corner is dragged
- **THEN** the resulting segments maintain their horizontal/vertical orientation without becoming diagonal

### Requirement: Corner handle visual feedback

The system SHALL provide visual feedback during corner drag including the cursor shape and the corner handle highlight state.

#### Scenario: Cursor reflects drag direction

- **WHEN** the pointer is over a corner handle
- **THEN** the cursor shows `move` to indicate the corner can be dragged

#### Scenario: Corner handle highlights on hover

- **WHEN** the pointer enters a corner handle's hit area
- **THEN** the corner handle changes to an emphasized visual state

#### Scenario: Corner handle active during drag

- **WHEN** a corner handle is being dragged
- **THEN** the corner handle shows an active visual state distinct from hover

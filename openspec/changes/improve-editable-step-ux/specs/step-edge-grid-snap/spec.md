## ADDED Requirements

### Requirement: Grid snapping during segment drag

The system SHALL snap orthogonal segment drags to the canvas grid when grid snapping is enabled, providing alignment assistance.

#### Scenario: Horizontal segment snaps to grid during drag

- **WHEN** the user drags a horizontal segment and grid snapping is enabled
- **THEN** the segment's Y position snaps to the nearest grid line while the drag is in progress

#### Scenario: Vertical segment snaps to grid during drag

- **WHEN** the user drags a vertical segment and grid snapping is enabled
- **THEN** the segment's X position snaps to the nearest grid line while the drag is in progress

#### Scenario: Grid snapping disabled skips snapping

- **WHEN** grid snapping is disabled in the diagram settings
- **THEN** segment drags move freely without grid alignment

### Requirement: Grid snapping during corner drag

The system SHALL snap corner drags to the canvas grid when grid snapping is enabled.

#### Scenario: Corner drag snaps to grid

- **WHEN** the user drags a corner handle and grid snapping is enabled
- **THEN** the corner position snaps to the nearest grid intersection during the drag

### Requirement: Visual snap indicator

The system SHALL provide visual feedback when a segment or corner snaps to a grid line.

#### Scenario: Snap line appears when snapped

- **WHEN** a segment or corner snaps to a grid line during drag
- **THEN** a visual indicator (e.g., a faint dashed line along the grid) appears to show the snap position

#### Scenario: Snap indicator disappears when released

- **WHEN** the drag is released
- **THEN** the snap indicator is removed and the final position is committed

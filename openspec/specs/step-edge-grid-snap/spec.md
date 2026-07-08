# step-edge-grid-snap Specification

## Purpose

TBD - created by archiving change improve-editable-step-ux. Update Purpose after archive.

## Requirements

### Requirement: Grid snapping during segment drag

The system SHALL snap orthogonal segment drags to the canvas grid when grid snapping is enabled, providing alignment assistance.

#### Scenario: Horizontal segment snaps to grid during drag

- **WHEN** the user drags a horizontal segment and grid snapping is enabled
- **THEN** the segment's Y position snaps to the nearest grid line while the drag is in progress

#### Scenario: Vertical segment snaps to grid during drag

- **WHEN** the user drags a vertical segment and grid snapping is enabled
- **THEN** the segment's X position snaps to the nearest grid line while the drag is in progress

#### Scenario: Grid snapping disabled skips snapping

- **WHEN** the user holds the bypass modifier (Alt) during a drag
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
- **THEN** a visual indicator (a faint dashed line along the grid position) appears to show the snap position

#### Scenario: Snap indicator disappears when released

- **WHEN** the drag is released
- **THEN** the snap indicator is removed and the final position is committed

### Requirement: Magnetic alignment to nodes

The system SHALL magnetically snap a dragged corner, control point, or segment to a node's left/center/right (x) or top/middle/bottom (y) alignment lines when the moved coordinate is within a small screen-space threshold, taking precedence over grid snapping. The magnet SHALL be bypassable with the Alt modifier.

#### Scenario: Corner aligns to a node edge

- **WHEN** the user drags a corner so its x (or y) comes within the alignment threshold of a node's left/center/right (or top/middle/bottom) line
- **THEN** the corner snaps to that line and an alignment guide is drawn from the node to the dragged handle

#### Scenario: Alignment beats grid

- **WHEN** both a grid line and a node alignment line are in range of the moved coordinate
- **THEN** the coordinate snaps to the node alignment line

#### Scenario: Alignment guide disappears when released

- **WHEN** the drag is released
- **THEN** the alignment guide is removed

### Requirement: Keyboard nudge for handles

The system SHALL let the user nudge a focused control point or corner handle with the arrow keys, moving it by one grid cell per press (or 1px while Shift is held), recording the movement in history.

#### Scenario: Arrow key nudges a focused corner

- **WHEN** a corner handle is focused and the user presses an arrow key
- **THEN** the corner moves one grid cell in that direction and the route stays orthogonal

#### Scenario: Shift-arrow makes a fine adjustment

- **WHEN** a handle is focused and the user presses Shift+arrow
- **THEN** the handle moves by 1px in that direction

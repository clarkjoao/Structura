## ADDED Requirements

### Requirement: Live drag preview for segments

The system SHALL render a semi-transparent preview of the edge path during a segment drag, updating in real time as the user moves the pointer.

#### Scenario: Preview shows during segment drag

- **WHEN** the user is dragging a segment on a step edge
- **THEN** a semi-transparent preview path is rendered along the new route, distinct from the static segment highlight

#### Scenario: Preview path matches final geometry

- **WHEN** a segment drag preview is rendered
- **THEN** the preview path exactly matches the path that will be committed when the drag ends

#### Scenario: Preview updates in real time

- **WHEN** the pointer moves during a segment drag
- **THEN** the preview path updates immediately to reflect the current drag position

### Requirement: Live drag preview for corners

The system SHALL render a semi-transparent preview of the edge path during a corner drag, updating in real time as the user moves the pointer.

#### Scenario: Preview shows during corner drag

- **WHEN** the user is dragging a corner handle on a step edge
- **THEN** a semi-transparent preview path is rendered along the route with the corner at its current drag position

### Requirement: Preview visual style

The system SHALL render the drag preview with a distinct visual style that differentiates it from the static edge and the segment highlight.

#### Scenario: Preview is semi-transparent

- **WHEN** a drag preview is rendered
- **THEN** the preview path uses reduced opacity (e.g., 50% of the edge's normal opacity) to distinguish it from the committed edge

#### Scenario: Preview uses accent color

- **WHEN** a drag preview is rendered
- **THEN** the preview path uses the interaction accent color (e.g., `var(--color-text-info)`) to visually separate it from the edge's normal stroke color

#### Scenario: Preview disappears on drag end

- **WHEN** the user releases the drag
- **THEN** the preview path is removed and the edge path updates to the committed geometry

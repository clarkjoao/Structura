# Spec Delta

## Purpose

Lets a guided journey be laid out top to bottom as easily as left to right: chosen at creation, switched from the mode bar, taken from Mermaid, with every guided feature behaving the same in both directions.

## ADDED Requirements

### Requirement: The direction is chosen at creation

Creating a guided diagram SHALL offer "Horizontal (lanes as rows)" and "Vertical (lanes as columns)", Horizontal by default. The new journey SHALL be created and arranged in the chosen direction, with its lanes oriented to match.

#### Scenario: A vertical journey

- **WHEN** the author creates a guided diagram with "Vertical"
- **THEN** it opens with its lanes as columns and the start step at the top

### Requirement: The mode bar switches the direction

In kind mode, on an editable canvas, the guided mode bar SHALL show the current direction and switch it on click. The switch SHALL be the same as Organizar → Direction:

- it re-arranges the journey;
- it turns the lanes;
- it is stored on the diagram;
- it is one undo step.

The toggle SHALL be disabled with the same reason as the Organizar menu when the direction cannot change.

#### Scenario: Switching and undoing

- **GIVEN** a horizontal journey with phases
- **WHEN** the author clicks the direction toggle
- **THEN** the lanes become columns, the phase band moves to the left, and one undo restores the horizontal layout

### Requirement: A Mermaid block's direction starts a journey

When a Mermaid `swimlane-beta`, `flowchart` or `graph` block is added to a guided journey that has only its start step:

- a header direction `TB`, `TD` or `BT` SHALL make the journey vertical;
- `LR` or `RL` SHALL make it horizontal.

On a journey with other steps, the block SHALL be added in the journey's current direction.

#### Scenario: Pasting a vertical flowchart

- **GIVEN** a new guided diagram
- **WHEN** the author pastes `flowchart TD` with two lanes
- **THEN** the journey is vertical with those lanes as columns

#### Scenario: An existing journey keeps its direction

- **GIVEN** a horizontal journey with steps
- **WHEN** a `flowchart TD` block is pasted
- **THEN** its steps are added and the journey stays horizontal

### Requirement: Guided features behave the same in both directions

In a vertical journey:

- the phase band SHALL sit left of the lanes, with phase segments along the vertical axis;
- the line of visibility SHALL run vertically between the lanes;
- participant tags SHALL show on the steps;
- the text panel SHALL read and write the same outline;
- whole-diagram framing and the draw.io decoration layer SHALL include the band.

#### Scenario: Parity

- **GIVEN** the same journey with phases, a line of visibility and participants
- **WHEN** it is switched to vertical
- **THEN** its outline text is unchanged, and the band, line and tags are drawn along the vertical axis

### Requirement: Direction labels are translated

All new labels SHALL go through i18n (en and pt-BR).

#### Scenario: Portuguese labels

- **GIVEN** the app is in pt-BR
- **WHEN** the creation dialog shows the direction choice
- **THEN** it reads "Horizontal (raias em linhas)" and "Vertical (raias em colunas)"

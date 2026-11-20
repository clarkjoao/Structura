## Purpose

Keeps the step being read in view however long the flow is.

## ADDED Requirements

### Requirement: The spine shows a window around the step in hand

When a reading has more walked steps than the window holds, the spine SHALL show only the most
recent of them and a control stating how many earlier steps are hidden, which reveals them. The same
SHALL hold for the steps still ahead. Opening either SHALL show every step on that side. Branch
summaries and the step in hand SHALL always be shown.

#### Scenario: A long reading is windowed

- **GIVEN** a flow of 30 steps read to step 15
- **WHEN** the rail is shown
- **THEN** only the last few walked steps and the next few are listed, with the hidden counts stated

#### Scenario: Revealing the earlier steps

- **GIVEN** a windowed reading
- **WHEN** the earlier-steps control is chosen
- **THEN** every walked step is listed

#### Scenario: A short reading is not windowed

- **GIVEN** a flow of 5 steps
- **WHEN** the rail is shown
- **THEN** every step is listed and no hidden-count control is shown

### Requirement: The variables block folds

The rail's variables block SHALL be foldable, SHALL keep its state for the reading, and SHALL start
folded when the reading has more than six steps.

#### Scenario: Folding the variables

- **GIVEN** a reading showing the variables block
- **WHEN** its header is chosen
- **THEN** its body is hidden and the step in hand gains the room

### Requirement: The canvas follows the reading at a readable zoom

While a flow is read, the canvas SHALL bring the step in hand into view at no more than 1× and,
when the step and its neighbours fit at a readable zoom, SHALL frame them together. A step that
names both a component and a call SHALL be framed with both ends of the call. A step too long to
read at once SHALL be framed on the node the reading names after "on". When the step is already
comfortably in view at a readable zoom, the canvas SHALL NOT move.

#### Scenario: A call is framed with both of its ends

- **GIVEN** a step on one component that calls another
- **WHEN** the step is read
- **THEN** both components are on screen

#### Scenario: The camera stays when nothing needs to move

- **GIVEN** a step whose nodes are already well inside the canvas at a readable zoom
- **WHEN** the step is read
- **THEN** the viewport does not change

#### Scenario: A call across the whole diagram

- **GIVEN** a step whose call spans more than the canvas can show at a readable zoom
- **WHEN** the step is read
- **THEN** the node the call arrives at is framed at a readable zoom

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

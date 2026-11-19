## Purpose

Makes writing a flow a continuous gesture on the canvas: the author always sees that a recording is
live and where the next click lands, and moves between branches without leaving the script.

## ADDED Requirements

### Requirement: A live recording is announced on the canvas

While a flow is being recorded or edited, the canvas SHALL show a strip naming where the next step is
written (the main sequence, or a branch by its label), the number of recorded steps, an action that
undoes the last recorded step, and an action that finishes the recording. Every string SHALL come
from i18n with entries in `en` and `pt-BR`.

#### Scenario: The strip appears with the recording

- **GIVEN** a diagram with no recording
- **WHEN** a new flow is started
- **THEN** the strip is shown and says the main sequence is being written

#### Scenario: Undo from the strip

- **GIVEN** a recording with two steps on the main sequence
- **WHEN** the strip's undo is chosen
- **THEN** the flow holds one step

#### Scenario: The strip goes with the recording

- **GIVEN** a recording in progress
- **WHEN** it is finished or cancelled
- **THEN** the strip is no longer shown

### Requirement: Branches are written from the script

In the recorder, every branch of a condition SHALL be offered as a place to write into, from the
script itself; choosing one SHALL move the recorder into that branch, and the branch being written
SHALL be marked. A way back to the main sequence SHALL be offered while a branch is being written.
There SHALL be no separate screen for choosing a branch.

#### Scenario: Writing into a branch

- **GIVEN** a recording whose script holds a condition with two branches
- **WHEN** the second branch is chosen in the script and a node is clicked
- **THEN** the step is written into the second branch

#### Scenario: Back to the main sequence

- **GIVEN** a recording writing into a branch
- **WHEN** the way back is chosen and a node is clicked
- **THEN** the step is written on the main sequence

#### Scenario: A new condition opens its first branch

- **GIVEN** a recording with a step
- **WHEN** the flow is forked from the recording strip with two ways out
- **THEN** a condition is written after that step, which is left as it was
- **AND** the recorder writes into the first way out

### Requirement: The flow forks from the recording strip

A condition SHALL be created from the strip over the canvas, at the end of the sequence being
recorded, in one line: an optional question and ways out that start as yes / no. Enter SHALL fork
the flow. The step panel SHALL NOT offer turning a step into a condition.

#### Scenario: Forking with the defaults

- **GIVEN** a recording
- **WHEN** Condition is chosen on the strip and Enter is pressed
- **THEN** a condition with the ways out "Yes" and "No" ends the sequence, in one undo step

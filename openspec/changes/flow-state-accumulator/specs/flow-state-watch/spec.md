## Purpose

Lets a reader follow one key across a whole reading — including through the steps where it is not in
scope — and see the events in its life along the path already walked, so the question "why is this
value what it is" is answered without leaving the step in hand.

## ADDED Requirements

### Requirement: A reader may pin keys and follow them across steps

The reading SHALL let a reader pin any key it knows about. Pinned keys SHALL remain visible as the
reading moves between steps, showing the value the running object holds for each of them at the step
in hand. Pinning SHALL belong to the reading and SHALL NOT be written to the flow.

#### Scenario: A pinned key follows the reading forward

- **GIVEN** a reading with a key pinned
- **WHEN** the reader moves to a step where the running object still holds that key
- **THEN** the key stays visible with the value held at that step

#### Scenario: A pinned key whose value changes

- **GIVEN** a reading with a key pinned
- **WHEN** the reader reaches a step that writes a new value over it
- **THEN** the key shows the new value

#### Scenario: Pinning survives nothing beyond the reading

- **GIVEN** a reading with keys pinned
- **WHEN** the reading ends
- **THEN** the flow is unchanged and no pin is persisted

### Requirement: A pinned key out of scope says so rather than disappearing

When the running object at the step in hand does not hold a pinned key, the reading SHALL keep the key
visible and SHALL state that it is out of scope, rather than removing it from view.

#### Scenario: The frame holding the key has closed

- **GIVEN** a reading with a key pinned that was introduced inside a call
- **WHEN** the reader reaches a step after that call has closed
- **THEN** the key remains visible
- **AND** it is marked as out of scope rather than shown with a value

#### Scenario: A key pinned before it is introduced

- **GIVEN** a reading with a key pinned, and the reader goes back to before the step that introduces it
- **WHEN** the pinned keys are shown
- **THEN** the key remains visible and is marked as out of scope

### Requirement: The life of a pinned key along the walked path

For a pinned key, the reading SHALL be able to report the events in its life over the path already
walked: where it was introduced, where a step consumed it, where a step replaced it, and where it left
scope with a call. Each event SHALL name the step it belongs to by the same number the reading shows.
The report SHALL be derived from the path; nothing about it SHALL be stored.

#### Scenario: A value introduced, read, and lost with its call

- **GIVEN** a reading that walked a path where a key was introduced by a response, read by two later
  steps, and left scope when an enclosing call closed
- **WHEN** the life of that key is reported
- **THEN** the four events appear in path order
- **AND** each names the step number the reading shows for it

#### Scenario: A key not yet introduced on the walked path

- **GIVEN** a reading whose walked path never reaches the step that introduces a pinned key
- **WHEN** the life of that key is reported
- **THEN** the report is empty

#### Scenario: The report follows the path, not the flow

- **GIVEN** a flow whose branch not taken also introduces the pinned key
- **WHEN** the life of that key is reported
- **THEN** only events on the walked path appear

### Requirement: Every string the watch adds exists in both locales

Text introduced by the watch SHALL be resolved through the translation layer and SHALL be present in
every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by the watch
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale

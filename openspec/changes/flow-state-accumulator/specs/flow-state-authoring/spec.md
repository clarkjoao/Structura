## Purpose

Gives an author one object for the whole script, seen from whichever step they have selected, so what
they write and what the reading will hold are the same thing looked at from two places — and a key the
reading will call undefined cannot look, while it is being written, exactly like a key that is defined.

## ADDED Requirements

### Requirement: One object for the script, seen from the step in hand

The panel in which an author writes SHALL show a single object rather than a table per step. It SHALL
sit outside the steps and SHALL show the object as it stands at the step the author has selected,
including what that step itself writes. With no step selected it SHALL show the object at the end of
the script and SHALL say so.

#### Scenario: The object at the selected step

- **GIVEN** a script where an earlier step writes a key and the selected step writes another
- **WHEN** the object is shown
- **THEN** both keys are present with the values in force at the selected step
- **AND** the panel says which step it is being seen from

#### Scenario: The step's own contribution is shown, not held back

- **GIVEN** a selected step that writes over a key an earlier step wrote
- **WHEN** the object is shown
- **THEN** the key carries the value the selected step gives it

#### Scenario: No step selected

- **GIVEN** a script and no selected step
- **WHEN** the object is shown
- **THEN** it holds the values in force at the end of the script
- **AND** the panel says it is the end of the script rather than naming a step

#### Scenario: A step the entry cannot reach

- **GIVEN** a step no path from the entry reaches
- **WHEN** the object is shown
- **THEN** it is empty and nothing fails

### Requirement: The object the author sees is the object the reading will hold

The values shown SHALL be the running object the reading folds at that step. In particular, values held
in a frame the step closes SHALL NOT appear for steps after it, and the object SHALL NOT be grouped by
the call each value was introduced inside.

#### Scenario: A value held in a frame that has closed

- **GIVEN** a step that closes a call, and an earlier step introduced a value into the frame that call
  belongs to
- **WHEN** the object for a step after the closing step is shown
- **THEN** that value is absent, exactly as the reading reports it

#### Scenario: One row for a key written twice

- **GIVEN** a key written both inside a call and outside it
- **WHEN** the object is shown
- **THEN** there is one row for that key, holding the value in force

### Requirement: A row is either inherited or written here, and the author moves it between them

Each row SHALL say whether the selected step is the one that writes it. A row written by the selected
step SHALL be editable and SHALL offer a way to stop writing it there. A row inherited from an earlier
step SHALL name that step, and acting on it SHALL make the selected step write that key, seeded with
the value it currently holds.

#### Scenario: Taking over an inherited key

- **GIVEN** a row inherited from an earlier step
- **WHEN** the author acts on its value
- **THEN** the selected step writes that key, starting from the value it held
- **AND** the row now reads as written by this step

#### Scenario: Giving a key back

- **GIVEN** a row written by the selected step over a key an earlier step wrote
- **WHEN** the author stops writing it there
- **THEN** the row is inherited again, holding the earlier step's value

#### Scenario: The last key given back

- **GIVEN** a selected step whose only written key is given back
- **WHEN** the step is read
- **THEN** it carries no values of its own, and no empty value is stored in its place

#### Scenario: Nothing is editable without a step

- **GIVEN** no step is selected
- **WHEN** the object is shown
- **THEN** no row can be written and no key can be added

### Requirement: A key the step consumes is part of the object

Consuming a key SHALL be shown on the key's own row rather than in a list apart from the object, and
SHALL be turned on and off there. A key the selected step consumes that the object does not hold SHALL
still appear, marked, with no value.

#### Scenario: Marking a key as consumed

- **GIVEN** a row in the object
- **WHEN** the author marks it as consumed by the selected step
- **THEN** the step records it, and the row shows it

#### Scenario: A key nothing writes

- **GIVEN** a selected step that consumes a key no step writes
- **WHEN** the object is shown
- **THEN** the key has a row of its own, marked apart, with no value

### Requirement: A value that does not outlive the call holding it says so

A row whose value was written inside a call SHALL name the step where that call is answered, when the
reading could reach that step from here. It SHALL say nothing when no reachable step answers the call.

#### Scenario: A value inside a call still open

- **GIVEN** a selected step inside a call, and a value written earlier in that same call
- **WHEN** the object is shown
- **THEN** the row names the step that answers the call

#### Scenario: A call answered only on the branch not taken

- **GIVEN** a call answered inside one branch, and a selected step on the other
- **WHEN** the object is shown
- **THEN** the row says nothing about where the value ends

### Requirement: Values already written elsewhere can be brought in at once

Pasting text shaped as `key: value` lines, or a JSON object, where a key is named SHALL write one value
per entry, splitting each line on the first colon so a value holding one stays whole. A single pasted
line SHALL be left to fill the field. When the selected step carries a body that is a JSON object, the
author SHALL be offered its top-level keys as values to write.

#### Scenario: Pasting several values at once

- **GIVEN** the author pastes two `key: value` lines where a key is named
- **WHEN** the paste is handled
- **THEN** the step writes both keys with those values

#### Scenario: A pasted value holding a colon

- **GIVEN** the author pastes two lines, one of whose values contains a colon
- **WHEN** the paste is handled
- **THEN** the key is the text before the first colon and the value is everything after it

#### Scenario: Taking the values from the step's own body

- **GIVEN** a selected step whose body is a JSON object
- **WHEN** the author accepts the offer
- **THEN** the step writes the body's top-level keys, and only those

### Requirement: Every string the authoring panel adds exists in both locales

Text introduced by the authoring panel SHALL be resolved through the translation layer and SHALL be
present in every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by the authoring panel
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale

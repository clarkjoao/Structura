## Purpose

Makes the state an author writes a step against the state the reading will actually have in scope
where that step runs, so a key the reading will call undefined cannot look, while it is being written,
exactly like a key that is defined.

## ADDED Requirements

### Requirement: The scope offered to an author is the scope the reading will have

The values shown to an author as being in scope at a step SHALL be the running object the reading
holds when it stands on that step, less the values the step itself introduces. In particular, values
held in a frame the step closes SHALL NOT be offered as available to steps after it.

#### Scenario: A value held in the frame the step closes

- **GIVEN** a step that closes a call, and an earlier step introduced a value into the frame that call
  belongs to
- **WHEN** the scope for a step after the closing step is shown
- **THEN** that value is absent, exactly as the reading reports it

#### Scenario: The editor and the reading agree

- **GIVEN** any step in any flow
- **WHEN** the scope shown to the author and the running object the reading folds at that step are
  compared
- **THEN** they hold the same keys, apart from what the step itself introduces

#### Scenario: A step the entry cannot reach

- **GIVEN** a step no path from the entry reaches
- **WHEN** the scope is shown
- **THEN** it is empty and nothing fails

### Requirement: The scope names the call each value belongs to

Values shown to an author SHALL be grouped by the call they were introduced inside, innermost first,
naming the call. A group held by a frame the step closes SHALL be marked as leaving scope after that
step.

#### Scenario: Values in an enclosing call

- **GIVEN** a step inside a call, with values introduced both inside that call and outside it
- **WHEN** the scope is shown
- **THEN** the values are grouped by call, innermost first
- **AND** the outermost group is named as being outside any call

#### Scenario: A group about to be lost

- **GIVEN** a step that closes a frame holding values
- **WHEN** the scope for that step is shown
- **THEN** that group is marked as leaving after this step

### Requirement: The values table is editable from the keyboard

The table in which an author writes the values a step introduces SHALL support completing a row and
opening the next one from the keyboard, moving between cells with the tab key, and SHALL discard a row
left with no key. Pasting text shaped as `key: value` lines, or a JSON object, into a key cell SHALL
produce one row per entry. A single pasted line SHALL be left to fill the cell, since one thing pasted
into one cell means to fill it.

#### Scenario: Opening the next row

- **GIVEN** the author is editing the last row of the table
- **WHEN** they confirm the row from the keyboard
- **THEN** a new empty row appears and takes focus at its key

#### Scenario: A row left with no key

- **GIVEN** a row whose key is empty
- **WHEN** focus leaves the table
- **THEN** the row is discarded and nothing about the step changes

#### Scenario: Pasting several values at once

- **GIVEN** the author pastes two `key: value` lines into an empty key cell
- **WHEN** the paste is handled
- **THEN** two rows exist carrying those keys and values
- **AND** the original text is not left in a single cell

#### Scenario: A pasted value holding a colon

- **GIVEN** the author pastes two lines, one of whose values contains a colon
- **WHEN** the paste is handled
- **THEN** the key is the text before the first colon and the value is everything after it

### Requirement: Every string the authoring panel adds exists in both locales

Text introduced by the authoring panel SHALL be resolved through the translation layer and SHALL be
present in every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by the authoring panel
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale

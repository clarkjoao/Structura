# guided-journey-text-sync Specification

## Purpose

Lets an author edit a whole guided journey as text and apply only what changed. Steps keep their identity across edits, and nothing the text cannot express is lost.

## Requirements

### Requirement: The panel shows the whole journey as text

In guided mode, opening the text panel SHALL fill it with the current journey written as an outline (the same text as "Copy as text"). While the user has not edited it, the text SHALL follow the diagram's changes.

#### Scenario: Opening the panel

- **GIVEN** a guided journey Start → A → B
- **WHEN** the author opens the text panel
- **THEN** the panel holds the outline with lines for A and B, and the change count reads no changes

#### Scenario: The canvas changes while the text is untouched

- **GIVEN** the panel is open and unedited
- **WHEN** the author renames B on the canvas to "B2"
- **THEN** the panel's text now reads "B2"

### Requirement: Applying the text applies only the difference

Applying an edited text SHALL compare it with the text the panel started from. It SHALL apply the difference as one guided edit that takes one history snapshot before it mutates (`pushHistory`), so one undo restores the diagram.

The difference SHALL be expressed per step:

- added;
- removed;
- renamed;
- kind changed (step, decision, end);
- moved to another lane;
- phase start set or cleared;
- exits added, removed or relabelled.

Positions SHALL never come from the text: the guided arrangement places the result.

#### Scenario: A rename keeps the step

- **GIVEN** steps A → B → C, where B has a comment and a link
- **WHEN** the author changes the line "B" to "Bee" and applies
- **THEN** the same element is now named "Bee", and its comment, link and history entries remain

#### Scenario: Several changes, one undo

- **GIVEN** a journey A → B → C
- **WHEN** the author removes the line "B", adds "D" after "C", renames "A" to "Alpha", and applies
- **THEN** Alpha → C → D, and one undo restores A → B → C

#### Scenario: Errors block applying

- **WHEN** the edited text has an outline error
- **THEN** the errors are shown per line, applying is disabled, and the diagram is unchanged

### Requirement: The panel lists the changes before applying

While the text differs from its starting point and has no errors, the panel SHALL show:

- the count of added, changed and removed steps;
- a "Review" list with one line per change, naming the step and what changes (for example "Rename “B” → “Bee”" or "Score “A”: — → 2").

The list SHALL be translated through i18n (en and pt-BR).

#### Scenario: Reviewing

- **GIVEN** the author renamed one step and removed another in the text
- **WHEN** they open "Review"
- **THEN** it lists one rename and one removal, and the count reads "~1 −1"

### Requirement: Step identity across edits

Inside the panel, each line of the starting text SHALL be bound to its step. After an edit:

- a line kept or edited in place SHALL keep its step;
- a removed line SHALL remove its step;
- a new line SHALL add a step.

A line MAY end with an explicit handle `{#name}`. A handle SHALL bind the line to the step that handle was given to in the starting text. A handle that matches no step SHALL be an error on that line. `\{` SHALL write a literal brace.

#### Scenario: Moving a line with a handle

- **GIVEN** the text was copied with ids, and the line `Paga {#s4}` is cut and pasted under another exit
- **WHEN** the text is applied
- **THEN** the step with handle s4 is reconnected there, not removed and recreated

#### Scenario: An unknown handle

- **WHEN** a line ends with `{#s99}` and no step has that handle
- **THEN** that line shows an error, and nothing is applied

### Requirement: What the text does not hold is kept

Applying SHALL NOT remove or change anything the outline does not write:

- steps unreachable from the start;
- connections the outline cannot express (a non-decision step's extra exits);
- lanes, notes and texts;
- the start step.

#### Scenario: An unreachable step survives

- **GIVEN** a journey with one step X not reachable from the start
- **WHEN** the author edits and applies the text, which does not show X
- **THEN** X is still in the diagram

### Requirement: Text and canvas both changed

When the diagram changes after the user edited the text, the panel SHALL keep the user's text. It SHALL show that the diagram changed, and offer "Reload from the diagram", which discards the text edits. Applying SHALL still be allowed, and changes are applied per step.

When a change targets a step that no longer exists, that change SHALL be skipped. The result SHALL say how many were skipped.

#### Scenario: A step deleted on the canvas meanwhile

- **GIVEN** the author renamed B in the text, then B was deleted on the canvas
- **WHEN** they apply
- **THEN** the other changes apply, and the result says one change was skipped

# Spec Delta

## MODIFIED Requirements

### Requirement: The write-as-text panel

In guided mode, the guided kind SHALL offer a text panel that holds the whole journey (spec `guided-journey-text-sync`):

- **Text area.** It shows the outline's errors per line as the user types.
- **Summary.** It shows the count of steps the edit adds, changes and removes, with a "Review" list.
- **Apply.** Apply is disabled while the outline has errors or nothing changed. Ctrl/Cmd+Enter applies.
- **Insert at the selection.** A secondary action keeps the previous behaviour: the text typed in its own field is _added_ after the selected step, as described in "Where an outline is added".
- **After applying,** the panel shows the journey's new text, and the first changed step is selected.

#### Scenario: Typing an invalid outline

- **GIVEN** the text panel is open
- **WHEN** the user types an outline with an error
- **THEN** the error and its line are shown, and Apply is disabled

#### Scenario: Applying from the keyboard

- **GIVEN** the user renamed a step in the panel's text
- **WHEN** they press Ctrl/Cmd+Enter
- **THEN** the rename is applied, and the renamed step is selected

#### Scenario: Inserting at the selection

- **GIVEN** steps A → B with A selected
- **WHEN** the user writes "X" in "Insert at the selection" and confirms
- **THEN** the sequence reads A → X → B

## ADDED Requirements

### Requirement: Step handles in the outline

A step, decision or end line MAY end with `{#name}`, where the name uses letters, digits, `-` and `_`. "Copy as… Text with ids" SHALL write a handle on every step line, numbered in reading order (`s1`, `s2`…). Adding an outline (paste, insert, the assistant's add tool) SHALL ignore handles. Only applying a whole-journey text SHALL use them (spec `guided-journey-text-sync`).

#### Scenario: Copy with ids

- **GIVEN** a journey Start → A → B
- **WHEN** the author picks "Copy as… Text with ids"
- **THEN** the lines read `A {#s1}` and `B {#s2}`

#### Scenario: Handles ignored when adding

- **WHEN** an outline with `X {#s1}` is pasted onto the canvas
- **THEN** a step named "X" is added, and the handle does not appear in its name

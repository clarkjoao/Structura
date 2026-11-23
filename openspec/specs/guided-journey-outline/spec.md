# guided-journey-outline Specification

## Purpose

A plain-text outline for guided journeys, used to write a journey as fast as notes are typed and to exchange journeys with the assistant. It covers the format, how an outline is added to a guided diagram (from the "write as text" panel, a canvas paste or the assistant), and how a journey is written back as text.

## Requirements

### Requirement: The outline format

The outline SHALL be line-based text in which each non-blank line, after its indentation, is one of the following:

- **Comment.** A line starting with `#`.
- **Step.** `[Lane[, Participant…]:] name`: a step with the default step shape.
- **Decision.** `[Lane[, Participant…]:] ? name`.
- **End step.** `[Lane[, Participant…]:] ! name`.
- **Jump.** `-> @name`: a connection to an existing step, which ends the current path.
- **Exit.** `label -> <step, decision, end or jump>`: valid only directly under a decision, indented or right after it. `-> <step>` is an exit without a label.
- **Lane declaration.** `Lane:` alone: declares the lane and makes it current, adding no step.
- **Line of visibility.** `---` alone, between lane declarations: the line of visibility sits before the next declared lane.

The lane rules SHALL be:

- `Lane:` is the text before the first `: `.
- In a step's prefix, the names after the first `,` are the step's participants (spec `guided-journey-blueprint`); the first name is the lane.
- A line without a lane stays in the lane of the line before it, and has no participants.
- The first line without a lane uses the diagram's first lane.

`\:` SHALL write a literal colon that is not a lane prefix. `\,` SHALL write a literal comma inside a lane or participant name. `→` SHALL be accepted wherever `->` is. Lane names SHALL match existing lanes trimmed and case-insensitively. The syntax SHALL NOT depend on the interface language.

A `---` line anywhere other than between lane declarations SHALL be an error on that line. Copy as text SHALL write `---` before the first backstage lane's declaration, and each step's participants after its lane, writing the lane prefix whenever the step has participants.

#### Scenario: A linear journey across lanes

- **GIVEN** a guided diagram with lanes "Cliente" and "App"
- **WHEN** the outline `Cliente: Escolhe produto` / `App: Gera cobrança` / `Envia QR code` is added
- **THEN** three steps are created in sequence: "Escolhe produto" in "Cliente", and "Gera cobrança" and "Envia QR code" in "App"

#### Scenario: A lane prefix that matches no lane

- **GIVEN** a guided diagram without a lane named "API"
- **WHEN** an outline containing `API: Confirma pagamento` is added
- **THEN** a lane named "API" is created after the existing lanes, and the step is placed in it

#### Scenario: Comments and blank lines

- **GIVEN** a guided diagram
- **WHEN** an outline contains blank lines and lines starting with `#`
- **THEN** those lines add nothing to the journey

#### Scenario: Participants and the line of visibility

- **GIVEN** a new guided diagram
- **WHEN** the outline `Cliente:` / `---` / `Atendente:` / `Cliente, Atendente: Revisa pedido` is added
- **THEN** the line of visibility sits above Atendente, and "Revisa pedido" is in Cliente with participant Atendente

#### Scenario: A misplaced separator

- **WHEN** a `---` line follows a step line
- **THEN** that line is reported as an error and nothing is added

### Requirement: Decisions, exits, convergence and jumps

The outline SHALL handle decisions as follows:

- **Exits.** A decision line SHALL be followed by one or more exit lines indented under it. Each exit creates a connection labelled with its label.
- **Branches.** Lines indented under an exit SHALL continue that exit's path.
- **Convergence.** After the decision's block, the next line at the decision's own indentation SHALL be connected from the end of every path that is still open. A path is closed when it ended in an end step or a jump.
- **Jumps.** A jump SHALL connect the current path to the named step. The name is looked up first among the steps written earlier in the same outline (the most recent one wins), then among the diagram's existing steps.

#### Scenario: Two exits that converge

- **WHEN** the outline is:
  - `? Pagou`
  - `  sim -> API: Confirma`
  - `  não -> Cliente: Tenta de novo`
  - `App: Emite nota`
- **THEN** the decision has two exits labelled "sim" and "não", and both "Confirma" and "Tenta de novo" connect to "Emite nota"

#### Scenario: A path that ends

- **WHEN** an exit reads `não -> ! Cancelado`, and a line at the decision's indentation follows the block
- **THEN** "Cancelado" is an end step, and only the other open paths connect to the following line

#### Scenario: A retry loop

- **WHEN** an exit reads `não -> @Escolhe produto`, and "Escolhe produto" was written earlier in the outline
- **THEN** that exit connects back to "Escolhe produto", and no new step is created

### Requirement: Outline errors are reported per line and block the whole outline

Parsing SHALL report every error with its line number, and an outline with any error SHALL change nothing. The errors SHALL include at least:

- an exit that is not directly under a decision;
- a decision with no exits;
- a line indented under a step or an end step;
- a step, decision or end step with an empty name;
- a jump whose name matches no step;
- a jump whose name matches more than one existing step and no earlier line.

#### Scenario: An unknown jump

- **WHEN** an outline contains `-> @Inexistente` on line 4, and no step has that name
- **THEN** an error naming line 4 is reported, and applying the outline is not possible

#### Scenario: An exit outside a decision

- **WHEN** an outline has `sim -> Pagar` indented under an ordinary step
- **THEN** an error is reported on that line

### Requirement: Where an outline is added

An outline SHALL be added as follows:

- **Nothing selected.** It is added after the last step of the journey's main path. The main path runs from the start step and follows each decision's first exit. If that path ends in an end step, the outline is added before that end step.
- **One step selected.** It is added after the selected step. The selected step's existing next connection is re-attached from the outline's open path ends, the way Tab inserts a step.
- **Not added as text.** On a guided diagram in freehand mode, or on any non-guided diagram, an outline SHALL NOT be added as text.

#### Scenario: A new guided diagram

- **GIVEN** a new guided diagram with only its start step
- **WHEN** an outline of three steps is added with nothing selected
- **THEN** the first outline step is connected from the start step, and the steps follow in order

#### Scenario: A selected decision or end step

- **WHEN** an outline is added with a decision selected
- **THEN** the outline's first step becomes a new exit of that decision
- **WHEN** an outline is added with an end step selected
- **THEN** nothing is added, and a notice says an end step has no next step

#### Scenario: Inserting after a step

- **GIVEN** steps A → B
- **WHEN** an outline of steps X and Y is added with A selected
- **THEN** the sequence reads A → X → Y → B

### Requirement: Adding an outline is one structural edit

Adding an outline SHALL apply all of its lanes, steps and connections as a single guided edit that takes one history snapshot before it mutates (`pushHistory`). One undo SHALL therefore remove all of it. After the edit, the guided arrangement and flow derivation SHALL run exactly as after any other structural edit. Positions SHALL never be taken from the text.

#### Scenario: Undo

- **WHEN** an outline of five steps and one new lane is added and the user undoes once
- **THEN** the diagram is exactly as it was before the outline was added

#### Scenario: Layout and derived flow follow

- **WHEN** an outline is added
- **THEN** the steps are in their lane bands in sequence order, and the derived flow includes the new steps

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

### Requirement: Pasting an outline onto the canvas

In guided mode, pasting plain text onto the canvas while focus is not in an editable field SHALL add it as an outline, with no prompt, when both of these hold:

- it parses with no errors;
- it has at least two step, decision or end lines.

Otherwise, the paste SHALL behave as it does today. Images, SVG markup and copied elements SHALL keep their existing paste handling.

#### Scenario: Pasting meeting notes as an outline

- **GIVEN** a guided diagram in guided mode with one step selected
- **WHEN** the user pastes a valid four-line outline
- **THEN** four steps are added after the selected step, in one undo step
- **AND** a non-blocking notice says how many steps were added and offers Undo

#### Scenario: Pasting ordinary text

- **WHEN** the user pastes a single line, or text with outline errors
- **THEN** no step is added, and the paste behaves as before this change

### Requirement: A journey can be written back as an outline

The guided kind SHALL offer "copy as text", which writes the current journey as an outline:

- **Order.** The outline follows the sequence from the start step, with each decision's exits indented under it.
- **Lanes.** Each line carries a lane prefix where the lane changes.
- **Lanes.** Every lane is declared first, in lane order.
- **Revisits.** A step that is reached again, by a convergence or a retry, is written as a jump.

Adding the copied outline to a new guided diagram SHALL reproduce the same:

- lanes, in the same relative order, after the new diagram's own;
- step names and step kinds (step, decision, end);
- exit labels;
- connections.

Steps that cannot be reached from the start step SHALL be left out, and a comment SHALL say how many were left out.

#### Scenario: Round trip

- **GIVEN** a guided journey with two lanes, a decision with two labelled exits that converge, and a retry back-edge
- **WHEN** it is copied as text and the outline is added to a new guided diagram
- **THEN** the new diagram has the same lane names in the same order, and the same steps, labels and connections

#### Scenario: Unreachable steps

- **GIVEN** a journey with one step that is not reachable from the start
- **WHEN** it is copied as text
- **THEN** the outline omits that step, and contains a comment saying one step was left out

### Requirement: The assistant writes journeys as outlines

When the active diagram is guided and in guided mode, the assistant SHALL be given:

- a description of the outline format, including step handles;
- the current journey as an outline with handles (`{#s1}`…);
- two tools:
  - one that adds an outline, optionally after a given step id;
  - one that proposes a revision of the whole journey (spec `guided-assistant-revisions`).

The prompt SHALL say to use the add tool for new parts and the revise tool for changes to existing steps.

The add tool SHALL follow the same rules as the panel, ignoring handles. An invalid outline SHALL change nothing, and its per-line errors SHALL be returned to the assistant. Neither tool SHALL be offered on other diagrams.

#### Scenario: The assistant turns notes into a journey

- **GIVEN** an open guided diagram and an assistant request containing meeting notes
- **WHEN** the assistant calls the outline tool with a valid outline
- **THEN** the journey is added in one undo step, and the tool's result reports what was added

#### Scenario: The assistant sends an invalid outline

- **GIVEN** an open guided diagram
- **WHEN** the tool is called with an outline that has an error
- **THEN** the diagram is unchanged, and the result lists the errors with their line numbers

#### Scenario: The current journey carries handles

- **GIVEN** a guided journey Start → A → B
- **WHEN** the assistant prompt is built
- **THEN** it contains `A {#s1}` and `B {#s2}`, and both tools are offered

### Requirement: Outline text is translated

Every label, error message, summary and comment the outline features show or write SHALL go through i18n, with keys in both en and pt-BR. The outline syntax itself (`:`, `?`, `!`, `->`, `@`, `#`) SHALL NOT be translated.

#### Scenario: Errors in Portuguese

- **GIVEN** the interface language is pt-BR
- **WHEN** an outline has an error
- **THEN** the error message is shown in Portuguese

### Requirement: Step handles in the outline

A step, decision or end line MAY end with `{#name}`, where the name uses letters, digits, `-` and `_`. "Copy as… Text with ids" SHALL write a handle on every step line, numbered in reading order (`s1`, `s2`…). Adding an outline (paste, insert, the assistant's add tool) SHALL ignore handles. Only applying a whole-journey text SHALL use them (spec `guided-journey-text-sync`).

#### Scenario: Copy with ids

- **GIVEN** a journey Start → A → B
- **WHEN** the author picks "Copy as… Text with ids"
- **THEN** the lines read `A {#s1}` and `B {#s2}`

#### Scenario: Handles ignored when adding

- **WHEN** an outline with `X {#s1}` is pasted onto the canvas
- **THEN** a step named "X" is added, and the handle does not appear in its name

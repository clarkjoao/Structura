# guided-mermaid-interchange Specification

## Purpose

Reading and writing guided journeys as Mermaid: a pasted `journey` or `flowchart` swimlane becomes a guided journey, and "Copy as…" writes the journey as Mermaid journey or swimlane.

## Requirements

### Requirement: A Mermaid block is recognised by its header

The guided text capture SHALL read a text as Mermaid when its first meaningful line (after an optional ` ```mermaid ` fence, front matter between `---` lines, blank lines and `%%` comments) is `swimlane-beta`, `flowchart` or `graph` (with an optional direction), or `journey`. Any other text SHALL be read as the outline, as today. Recognition SHALL be the same for a canvas paste, the Text panel and the assistant's tool.

#### Scenario: Fenced block

- **WHEN** the author pastes ` ```mermaid ` followed by a `swimlane-beta LR` block and a closing fence, onto a guided diagram in kind mode
- **THEN** the block is built as a journey, with the same Undo notice as an outline paste

#### Scenario: Not Mermaid

- **WHEN** the text starts with `Cliente: Escolhe produto`
- **THEN** it is read as an outline

### Requirement: Swimlane and flowchart blocks build lanes, steps and connections

For `swimlane-beta`, `flowchart` and `graph`:

- **Lanes.** Each top-level `subgraph` SHALL be a lane named by its label (`subgraph id [Label]`, `subgraph id["Label"]`, or the id). It SHALL match an existing lane by name, trimmed and case-insensitively, or be created after the last lane in order of appearance. A subgraph nested in a lane SHALL add its nodes to the enclosing lane. A node listed in two lanes SHALL stay in the first.
- **Nodes.** A node SHALL become a step in its lane, named by its label (its id when it has none), with this shape:
  - `{}` and `{{}}` → decision, and so is any plain node with two or more outgoing edges (the path splits there);
  - `[()]` → data;
  - `[[]]` → subprocess;
  - `(( ))`, `([ ])` or `(((...)))` with no incoming edge → the journey's entry (see below);
  - the same shapes with no outgoing edge → end;
  - anything else → step.

  Nodes outside every subgraph SHALL go in the diagram's first lane.

- **Edges.** Every edge form (`-->`, `---`, `-.->`, `==>`, with `|label|` or `-- label -->`, chained, and `&` groups) SHALL become a connection, keeping its label. Direction and styling SHALL be ignored.

#### Scenario: The basic swimlane example

- **WHEN** the Mermaid documentation's example (Customer, Support and Engineering lanes; triage with "Known issue" and "Needs code change" exits) is pasted into a new guided diagram
- **THEN** the lanes Customer, Support and Engineering exist, Triage request is a decision with exits labelled "Known issue" and "Needs code change", and the derived flow follows the edges

#### Scenario: Convergence and loops

- **WHEN** two nodes both point to `answer`, and a later node points back to `triage`
- **THEN** `answer` is one step with two incoming connections, and the back edge is a connection to the existing triage step

### Requirement: The block is added where an outline would be

A Mermaid block SHALL be added like an outline:

- after the selected step (a decision gains a new exit; an end step is refused), or at the end of the main path when nothing is selected;
- as one undo step;
- followed by the arrangement and the derivation.

The block's entry nodes (no incoming edge) SHALL connect from the anchor. A start-shaped entry SHALL not add a second start: its outgoing edges SHALL leave from the anchor instead, keeping their labels. When the anchor sits before an existing step, the block's open ends (nodes with no outgoing edge that are not ends) SHALL connect to that step.

#### Scenario: Pasted after the start

- **WHEN** the start step is selected and a block whose entry is `start((Start))` is pasted
- **THEN** the diagram still has one start, and the block's first steps follow it

### Requirement: A journey block builds a linear journey

For `journey`, each task line `Name: score: Actor, Other` SHALL become a step named `Name`, connected in the order written.

- The step goes in the lane of its first actor, matched or created like a subgraph lane.
- The other actors SHALL become the step's participants (spec `guided-journey-blueprint`).
- The score SHALL be read and checked (1–5) but not stored.
- Each `section` SHALL start a phase at its first task (spec `guided-journey-phases`).
- `title` SHALL be ignored.

#### Scenario: My working day

- **GIVEN** a new guided diagram
- **WHEN** the documentation's "My working day" journey is pasted into it
- **THEN** the steps Make tea, Go upstairs, Do work, Go downstairs and Sit down follow the start, in the lane "Me", in that order, with the two sections as phases

#### Scenario: A task with several actors

- **GIVEN** a new guided diagram
- **WHEN** the line `Do work: 1: Me, Cat` is read in a journey block
- **THEN** "Do work" is in lane "Me" with participant "Cat"

### Requirement: Mermaid errors are reported per line and block everything

A line that cannot be read SHALL be reported with its 1-based line number, and nothing SHALL be added. Errors include:

- an unclosed `subgraph`;
- an `end` with no open subgraph;
- an edge line that cannot be parsed;
- a journey task without `: score`;
- a score outside 1–5.

Styling and metadata lines (`classDef`, `class`, `style`, `linkStyle`, `click`, `accTitle`, `accDescr`, `title`, `%%`, `direction`) SHALL be ignored without error.

#### Scenario: Unclosed lane

- **WHEN** a block opens `subgraph Sales` and never closes it
- **THEN** the panel lists the error on the subgraph's line and Apply is disabled

### Requirement: The journey is copied as Mermaid

The Text panel's copy action SHALL offer three formats:

- **Outline**, as today.
- **Mermaid swimlane**:
  - `swimlane-beta`, with the diagram's direction (`LR` or `TB`);
  - one `subgraph` per lane, in lane order, with every step in it, and every connection with its label;
  - the shape syntax as the inverse of import (decision `{}`, data `[()]`, subprocess `[[]]`, start and end `(( ))`);
  - stable, readable node ids (`s1`, `s2`, … in reading order);
  - the `%% phases:` comment, as today;
  - when present, `%% participants: s4=Atendente|Gerente` and `%% visibility: lane2`. Import SHALL read both back.
- **Mermaid journey**:
  - the main path (each decision's first exit);
  - one `section` per phase along it, or one named after the diagram before the first phase;
  - each step as `Name: 3: Lane, Participant…` (Mermaid requires a score; Structura keeps none);
  - a `%%` comment counting the steps and branches left out.

Names with Mermaid-reserved characters SHALL be quoted.

#### Scenario: Swimlane round trip

- **GIVEN** a guided diagram with participants on a step and a line of visibility
- **WHEN** it is copied as Mermaid swimlane and the text is pasted into a new guided diagram
- **THEN** it has the same lanes in the same order, the same step names and kinds, the same connections and labels, the same participants and the same line of visibility

#### Scenario: Journey export of a branching journey

- **GIVEN** a journey with one decision of two exits
- **WHEN** it is copied as Mermaid journey
- **THEN** the text holds the steps of the first exit's path, and a comment says one branch was left out

#### Scenario: Participants in a journey export

- **GIVEN** a step "Revisa pedido" in Cliente with participant Atendente
- **WHEN** it is copied as Mermaid journey
- **THEN** its line reads `Revisa pedido: 3: Cliente, Atendente`

### Requirement: The assistant may answer in Mermaid

On guided diagrams, the assistant prompt SHALL say that the outline tool also accepts a Mermaid `swimlane-beta` block. A block with errors SHALL be dropped and its errors reported in the reply, as for an outline.

#### Scenario: Assistant answers with a swimlane block

- **WHEN** the assistant's tool call carries a valid `swimlane-beta` block and the author accepts it
- **THEN** the steps are added as for a paste

### Requirement: Interchange text is translated

The format names in the copy menu, the summary's "set aside" note, the Mermaid error messages and the export comments SHALL exist in en and pt-BR.

#### Scenario: Portuguese menu

- **WHEN** the app is in pt-BR
- **THEN** the copy menu reads "Texto", "Mermaid (raias)" and "Mermaid (jornada)"

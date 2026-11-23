# Spec Delta

## MODIFIED Requirements

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

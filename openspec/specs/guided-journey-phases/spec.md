# guided-journey-phases Specification

## Purpose

Journey phases: a step can start a named phase that runs on until the next start. Phases keep contiguous columns in the arrangement, show as a band beside the lanes, and survive the outline (`## Phase`) and Mermaid sections.

## Requirements

### Requirement: A phase starts at a step and runs until the next

A guided step MAY start a phase, stored as `kindProps.phase` (a non-empty name). Every step SHALL belong to the phase of the nearest phase start found by walking back through its first forward predecessor in reading order. A step that starts a phase belongs to that phase. A step with no start behind it SHALL belong to no phase. When a step's forward predecessors are in different phases, the step SHALL take the latest of them in phase order.

The phases SHALL be the phase starts, in reading order. A name SHALL be trimmed. A start that names the phase its step already inherits SHALL open no new phase: the step continues it. Two separate starts MAY share a name (a journey returning to an earlier phase); they are still two phases.

#### Scenario: Inherited phase

- **WHEN** a journey reads Start → A → B → C → D, and A starts "Discover" and C starts "Buy"
- **THEN** A and B are in Discover, and C and D are in Buy

#### Scenario: Removing a start merges phases

- **WHEN** the author clears C's phase start
- **THEN** C and D are in Discover

### Requirement: Phases occupy contiguous columns

The guided arrangement SHALL place each phase's steps in columns after every column used by the previous phases. Steps of different phases SHALL never share a column. Within a phase the existing layering SHALL apply. Back-edges SHALL still be left out of the layering. The arrangement SHALL stay deterministic.

#### Scenario: A short branch does not pull the next phase back

- **WHEN** phase Discover has a branch of three steps on one exit and one step on the other, and both converge into Buy's first step
- **THEN** Buy's first step sits in the column after the three-step branch's last step, and no Buy step shares a column with a Discover step

### Requirement: The header band shows the phases

In kind mode, when the journey has at least one phase start, the canvas SHALL show a header band along the reading axis. The band SHALL sit above the lanes, or left of them when the diagram reads top to bottom, and SHALL hold one segment per phase over that phase's columns, labelled with its name.

A faint separator SHALL cross the lanes between consecutive phases. Clicking a segment SHALL select the step that starts it.

The band SHALL be drawn by the host from the kind's `overlay`. It SHALL NOT be drawn in freehand mode or on read-only surfaces, and it SHALL not be a diagram element: it cannot be selected, moved or exported as a node.

#### Scenario: Two phases

- **WHEN** the journey has phases Discover and Buy
- **THEN** the band shows "Discover" over Discover's columns, "Buy" over Buy's, with a separator between them

#### Scenario: Freehand hides it

- **WHEN** the author switches to "Edit freehand"
- **THEN** the band and separators are gone, and the phase starts are kept

### Requirement: The band draws the emotion curve

When at least one step has an experience score, the header band SHALL draw the emotion curve:

- a polyline through the scored steps in reading order, along the main path (each decision's first exit), at each step's column centre;
- the height running from 1 (low) to 5 (high);
- a dot for each scored step, red for pain points.

Unscored steps SHALL be skipped, without breaking the line.

#### Scenario: A ### Requirement: The Journey tab picks or creates a phase

The Journey tab SHALL show a "Phase" select holding the phase the step is in (or "No phase"). Opening it SHALL list the journey's phase names, each once, in reading order, with the current one marked, and SHALL filter them by the typed text. Typed text that names no phase SHALL offer "Create phase “name”".

- Picking a phase, or creating one, SHALL make the step start it; picking the phase the step already inherits SHALL instead clear the step's own start.
- When the step starts its own phase, the select SHALL also offer "Continue the previous phase" (or "Remove the phase" when nothing comes before it), which clears the start.

Each choice SHALL be one undo step.

#### Scenario: Creating a phase from the tab

- **WHEN** the author types "Pay" in the phase select of a step and picks "Create phase “Pay”"
- **THEN** the band shows a new segment "Pay" starting at that step, and one undo removes it

#### Scenario: Picking an existing phase

- **WHEN** a journey has Discover (A, B) then Buy (from C), and the author picks "Buy" on B
- **THEN** B, C and the steps after are in Buy, and the band shows two segments, not three

s "Pay" in "Start a phase here" on a step and presses Enter

- **THEN** the band shows a new segment "Pay" starting at that step, and one undo removes it

### Requirement: Outline and Mermaid carry phases

Phases travel through text in three formats:

- **Outline.** A line `## Name` SHALL start a phase at the next step, decision or end added after it. Its indentation SHALL be ignored, and it SHALL inherit no lane. A `##` line with no following step SHALL be an error on that line. Copy as Text SHALL write `## Name` before each phase start.
- **Mermaid `journey`.**
  - Import: `section Name` SHALL start a phase at the next task, and the summary SHALL no longer report sections as set aside.
  - Export: one `section` per phase along the main path. A section named after the diagram SHALL be written only when the first task has no phase.
- **Mermaid swimlane.** When the journey has phase starts, the export SHALL add `%% phases: s1=Discover, s4=Buy`, and the import SHALL read it back by node id.

#### Scenario: Meeting notes with phases

- **WHEN** the author applies `## Descobrir`, `Cliente: Busca produto`, `## Comprar`, `Cliente: Escolhe`, `App: Cobra`
- **THEN** "Busca produto" starts Descobrir, "Escolhe" starts Comprar, and "Cobra" is in Comprar

#### Scenario: My working day keeps its sections

- **WHEN** "My working day" is pasted and copied back as Mermaid journey
- **THEN** the text has `section Go to work` before "Make tea" and `section Go home` before "Go downstairs"

### Requirement: The assistant knows the phases

On guided diagrams, the assistant prompt SHALL document `## Phase` lines, and the current journey it receives SHALL include them.

#### Scenario: Prompt carries phases

- **WHEN** a journey has the phase start "Comprar"
- **THEN** the current journey in the prompt contains a `## Comprar` line before that step

### Requirement: Phase text is translated

The section name, the field, "No phase", the outline error and the summary SHALL exist in en and pt-BR.

#### Scenario: Portuguese

- **WHEN** the app is in pt-BR
- **THEN** the section reads "Fase" and the field "Começar uma fase aqui"

# Spec Delta

## Purpose

How an author writes a guided diagram: lanes say who or what acts, steps are added in sequence
from the keyboard or the canvas, and the editor keeps the drawing standard. The author never
positions anything by hand.

## ADDED Requirements

### Requirement: What a guided diagram is made of

A guided diagram SHALL be stored only as ordinary elements: lanes are swimlane panels, steps are
flowchart-shape process nodes whose parent is a lane, and the sequence is the connections between
steps. Its kind data SHALL hold only the id of its derived flow. Every requirement in this
capability applies while the diagram is in guided mode; in freehand mode the diagram is edited as
any freehand diagram.

#### Scenario: Opened by a build without the kind

- **WHEN** a guided diagram is loaded where the guided kind is not registered
- **THEN** it shows as swimlanes holding flowchart shapes joined by connections

### Requirement: Guided conformance

The guided kind's conformance check SHALL pass when, ignoring free text and notes: every top-level
element is a lane, no lane is nested in another, every element inside a lane is one of the
journey step shapes, there is exactly one start step, and every connection joins two steps. Each
failure SHALL be reported as an issue naming the element and the rule. On return to guided mode,
lane order SHALL be taken from the lanes' current order along the cross axis.

#### Scenario: Two starts

- **WHEN** a guided diagram edited freehand has two start steps and the author chooses "Back to guided"
- **THEN** the check fails with an issue on the second start step

#### Scenario: Lanes reordered by hand

- **WHEN** in freehand mode the author drags lane "API" above lane "App" and returns to guided
- **THEN** the guided arrangement keeps "API" above "App"

### Requirement: A new guided diagram starts ready to type

Creating a guided diagram SHALL produce two lanes with localized default names and a start step in
the first lane, arranged, with the start step selected, so the first `Tab` adds a step.

#### Scenario: Creating a guided diagram

- **WHEN** the author creates a diagram and chooses Guided
- **THEN** it opens with two named lanes and a selected start step in the first lane

### Requirement: A guided diagram is made of ordered lanes

A guided diagram SHALL hold one or more lanes in a stated order. Each lane SHALL have a name and
SHALL contain steps only. The author SHALL be able to add a lane (after the selected one, or
last), rename it in place, move it up or down, and remove it. Removing a lane that holds steps
SHALL move those steps to the neighbouring lane rather than delete them. The last remaining lane
SHALL NOT be removable. Each of these actions SHALL be one undo step.

#### Scenario: Removing a lane keeps its steps

- **WHEN** the author removes the lane "App", which holds two steps, and "Cliente" is the lane above it
- **THEN** the two steps move to "Cliente", with their connections unchanged

#### Scenario: The last lane stays

- **WHEN** the diagram has a single lane
- **THEN** the remove-lane action is unavailable

### Requirement: Every step belongs to exactly one lane

Every step in a guided diagram SHALL sit in exactly one lane. A step SHALL NOT exist outside a
lane, and a lane SHALL NOT nest inside another lane.

#### Scenario: Paste lands in a lane

- **WHEN** the author pastes steps while a lane or a step is selected
- **THEN** the pasted steps land in that lane, or in the lane of the selected step

### Requirement: Tab adds the next step

With a single step selected, `Tab` SHALL add a task step in the same lane, connected from the
selected step, and select it. If the selected step already had a single successor, the new step
SHALL be inserted between them. If the selected step is a decision, `Tab` SHALL add a new exit
instead (see branches). The new step's label SHALL be editable at once, and typing SHALL replace
the placeholder. No dialog or prompt SHALL appear. The step, its connections and its arrangement
SHALL be one undo step.

#### Scenario: Appending

- **WHEN** "Abre app" is the last step and the author presses Tab
- **THEN** a new task step follows it in the same lane, connected, selected and ready for typing

#### Scenario: Inserting

- **WHEN** "Abre app" → "Escolhe" exists and the author selects "Abre app" and presses Tab
- **THEN** the new step sits between them: "Abre app" → new → "Escolhe"

#### Scenario: One undo

- **WHEN** the author presses Tab and then undoes
- **THEN** the step and its connections are gone and every other step is back where it was

### Requirement: Shift+Tab adds a branch

With a decision selected, `Shift+Tab` (and `Tab`) SHALL add a new exit: a task step connected
from the decision and placed after it. With any other step selected, `Shift+Tab` SHALL insert a
decision after the step, keep the step's existing successor as the decision's first exit, and add
a new task step as its second exit. The new step SHALL be selected. It SHALL be one undo step.

#### Scenario: Branching from a task

- **WHEN** "Valida" → "Salva" exists and the author selects "Valida" and presses Shift+Tab
- **THEN** "Valida" → decision, and the decision exits to "Salva" and to a new step, which is selected

### Requirement: Steps move between lanes by gesture

`Alt+↑` and `Alt+↓` SHALL move the selected step to the lane above or below. The same move SHALL
be available from the step's context menu and from a lane field in the inspector. Connections
SHALL stay as they were. On the top or bottom lane, the gesture in that direction SHALL do
nothing.

#### Scenario: Moving down

- **WHEN** "Valida" is in "Cliente" and the author presses Alt+↓
- **THEN** "Valida" is in the next lane down, keeping its incoming and outgoing connections

### Requirement: Deleting a step reconnects the sequence

Deleting a step with exactly one predecessor and one successor SHALL connect the predecessor to
the successor, keeping the label of the deleted step's outgoing connection. Deleting a decision
SHALL keep its first exit as the continuation and delete the other exits' steps only when nothing
else reaches them. Deleting the only start step SHALL be refused with a notice. Every deletion
SHALL be one undo step.

#### Scenario: Sewing on delete

- **WHEN** A → B → C exists and the author deletes B
- **THEN** A → C exists and carries the label B → C had

#### Scenario: The start stays

- **WHEN** the author tries to delete the only start step
- **THEN** nothing is deleted and a notice says a guided diagram needs a start

### Requirement: Positions are never set by hand in guided mode

In guided mode, steps and lanes SHALL NOT be draggable or resizable (free positioning is what
"Edit freehand" is for). Their positions and sizes
SHALL come only from the guided arrangement. Selecting, connecting by handle, editing labels and
opening the inspector SHALL work as in a freehand diagram. The Manual/Automatic arrangement mode
SHALL NOT be offered, because the guided arrangement always applies.

#### Scenario: Drag does nothing

- **WHEN** the author drags a step
- **THEN** the step does not move and no undo step is recorded

### Requirement: The palette offers journey steps only

In a guided diagram the element palette and quick insert SHALL offer only these step shapes:
task, start, end, event, decision, subprocess, data store and document. Inserting one SHALL place
it in the selected lane, or the first lane, connected from the selected step when there is one.
Free text and notes SHALL remain available as annotations.

#### Scenario: No architecture nodes

- **WHEN** the author opens quick insert in a guided diagram and searches "lambda"
- **THEN** no cloud or C4 element is offered

### Requirement: Connections carry what moves

A connection between steps SHALL keep its optional label, which in a guided diagram names the
data or value that moves along it. It SHALL be edited where connection labels are edited today.
Drawing a connection by handle between two steps SHALL be allowed, including a back-edge to an
earlier step. The edge SHALL leave its source on the output side and reach its target on the
input side (ADR-0013).

#### Scenario: Retry back-edge

- **WHEN** the author connects "Cobra cartão" back to the earlier "Valida"
- **THEN** the connection is kept and drawn as a back-edge, leaving the output side and entering the input side

### Requirement: Quiet checks mark what is missing

The canvas SHALL mark, without dialogs and without blocking any action: a decision exit that has
no label, and a step that ends a path without being an end step. A marker SHALL disappear as soon as
its cause is fixed. Markers SHALL NOT appear in the read-only viewer or in exports.

#### Scenario: Unlabelled exit

- **WHEN** a decision has two exits and one has no label
- **THEN** that exit shows a marker, and it goes away once the author labels it

### Requirement: Authoring text is translated and history is kept

Every user-visible string introduced for guided authoring, including lane defaults, placeholders,
notices, menu entries and markers, SHALL go through the translation layer and SHALL exist in both
`en` and `pt-BR`. Every structural action in this capability SHALL record its undo checkpoint
before it mutates the diagram.

#### Scenario: Default lane names follow the locale

- **WHEN** a pt-BR user creates a guided diagram
- **THEN** the two default lanes have pt-BR names

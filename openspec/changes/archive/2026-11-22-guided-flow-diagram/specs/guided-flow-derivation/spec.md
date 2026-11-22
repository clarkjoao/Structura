# Spec Delta

## Purpose

A guided diagram's steps already are a flow. This capability keeps one stored flow equal to the
step graph, so reading, playback, the shared reading and walkthroughs work on guided diagrams
unchanged, and so what an author writes into that flow is not lost.

## ADDED Requirements

### Requirement: Each guided diagram keeps one derived flow

A guided diagram SHALL hold exactly one derived flow, named after the diagram. Its entry SHALL be
the start step. Each step reachable from the start SHALL map to one flow step pointing at it. A
decision, or any step with more than one exit, SHALL map to a condition step whose branches follow
its exits (labelled with the exit labels). Every other step SHALL map to an action step whose
continuation follows its outgoing connection. A connection back to a step already on the path (a
retry) SHALL stay on the canvas but SHALL NOT enter the flow, which has no cycles. The derived
flow SHALL be updated in the same undo step as the edit that changed the step graph.

#### Scenario: Derivation after Tab

- **WHEN** the author presses Tab on the start step
- **THEN** the derived flow has the start step as entry, followed by an action step for the new step

#### Scenario: Retry back-edge stays out of the flow

- **WHEN** "Cobra cartão" connects back to the earlier "Valida"
- **THEN** the derived flow has no cycle and still reaches every step after "Cobra cartão"

#### Scenario: Decision becomes a condition

- **WHEN** a decision has exits labelled "sim" and "não"
- **THEN** the derived flow has a condition step with branches "sim" and "não" leading to the exits' steps

### Requirement: Re-derivation preserves step content

When the step graph changes, the derived flow SHALL keep, for every step that still exists, the
content written on its flow step: description, note, payload and its direction, duration, async
flag and state writes. It SHALL rewrite only the flow's topology. A flow step whose canvas step
was deleted SHALL be removed with it.

#### Scenario: Payload survives an insert

- **WHEN** a step carries a payload in the derived flow and the author inserts a new step before it
- **THEN** the step keeps its payload, and the new step has none

### Requirement: The derived flow is not edited as a recording

In guided mode the derived flow SHALL NOT be offered for recording, re-recording or step
reordering in the flows panel, and recording new flows SHALL NOT be offered. Its step content
SHALL remain editable in the step panel.

#### Scenario: No record button

- **WHEN** the author opens the flows panel of a guided diagram
- **THEN** it shows the derived flow, readable and playable, with no record action

### Requirement: The derived flow works wherever a flow works

Reading, playback, the shared reading and walkthrough scenes SHALL accept the derived flow like
any other flow. A walkthrough scene pointing at it SHALL keep working after the guided diagram is
edited.

#### Scenario: Walkthrough scene

- **WHEN** a walkthrough scene references a guided diagram's derived flow and the author later inserts a step
- **THEN** the scene plays the updated sequence

### Requirement: Freehand mode pauses derivation; return re-derives

In freehand mode, the derived flow SHALL stay as it was and SHALL NOT be updated. It SHALL be
readable and its step content SHALL remain editable. Other flows MAY be recorded over the
diagram like on any freehand diagram. On a successful return to guided mode, the derived flow
SHALL be re-derived from the steps, preserving step content by the step it points at. When the
flow's topology was changed in freehand mode, the return SHALL say that the derived flow's
order will follow the steps before it applies. Other flows recorded in freehand mode SHALL be
kept unchanged.

#### Scenario: Step added freehand

- **WHEN** in freehand mode the author adds a step in a lane, connects it, and returns to guided
- **THEN** the derived flow includes that step at its place in the sequence, and other steps keep their content

#### Scenario: Recorded flow survives the return

- **WHEN** the author records a second flow in freehand mode and returns to guided
- **THEN** that flow is still there, unchanged

#### Scenario: Derived flow missing

- **WHEN** the derived flow was deleted in freehand mode and the author returns to guided
- **THEN** a new derived flow is created and the kind data points at it

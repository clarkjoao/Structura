# Spec Delta

## Purpose

Arranging a large diagram stays responsive and bounded in time, without changing what a small
diagram gets.

## ADDED Requirements

### Requirement: Arranging does not freeze the page

ELK MUST run off the main thread where the browser supports Web Workers, and MUST fall back to the
main thread when the worker fails to load or stops, laying out what was in flight. The result MUST
be the same on either thread. The arrangement's edge writes (handle order, route resets, routes and
label offsets) MUST be one store write, keeping the arrangement one undo step.

#### Scenario: Arranging the reference large diagram

- **GIVEN** the `perf:large` fixture (657 nodes, 704 connections) open in the editor
- **WHEN** the user presses Cmd/Ctrl+Shift+L
- **THEN** the diagram is arranged in under 10 s on the reference machine
- **AND** no main-thread task during it lasts longer than 1 s

#### Scenario: The worker cannot be used

- **GIVEN** the ELK worker fails to load
- **WHEN** the user arranges the diagram
- **THEN** the diagram is arranged on the main thread, as it would have been in the worker

#### Scenario: One undo step

- **WHEN** the user arranges the diagram and then undoes
- **THEN** every position, handle order and route is back to what it was before arranging

### Requirement: Automatic references are tried within a budget

The layout trials that decide automatic references MUST be bounded by the graph's size: a graph of
N nodes plus edges MUST get at most `floor(3000 / N)` trials, hubs first (at most 6), then one-edge
references (at most 12). The budget MUST NOT depend on time, so the same diagram always gets the
same references.

#### Scenario: A small diagram keeps every trial

- **GIVEN** a diagram of 160 nodes plus edges
- **WHEN** it is arranged
- **THEN** up to 6 hub trials and 12 one-edge trials are run, as before

#### Scenario: A large diagram gets fewer trials

- **GIVEN** the `perf:large` fixture (1,361 nodes plus edges)
- **WHEN** it is arranged
- **THEN** 2 hub trials and no one-edge trial are run

### Requirement: A plan applies only to what it was made from

While a whole-diagram arrangement is being planned, if the user opens another diagram, enters or
leaves a scene, or changes the diagram's components or connections, the plan MUST NOT be applied,
and the user MUST be told to arrange again. A node moved while the plan is made MUST NOT stop it.

#### Scenario: Another diagram is opened while arranging

- **GIVEN** the user pressed Cmd/Ctrl+Shift+L on diagram A
- **WHEN** they open diagram B before the plan is ready
- **THEN** neither diagram is rearranged
- **AND** a message says the diagram changed and to arrange it again

#### Scenario: A node is moved while arranging

- **GIVEN** the user pressed Cmd/Ctrl+Shift+L
- **WHEN** they drag a node before the plan is ready
- **THEN** the plan is applied, the dragged node included

#### Scenario: Any user-visible text added is translated

- **WHEN** the message for a dropped plan is shown
- **THEN** it is available in English and Brazilian Portuguese

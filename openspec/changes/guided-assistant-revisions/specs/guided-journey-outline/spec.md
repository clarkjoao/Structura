# Spec Delta

## MODIFIED Requirements

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

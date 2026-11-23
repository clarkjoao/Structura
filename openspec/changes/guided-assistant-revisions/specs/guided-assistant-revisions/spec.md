# Spec Delta

## Purpose

Lets the assistant revise an existing guided journey. The author reviews each proposed change, and applies only the ones they choose, as one undo step.

## ADDED Requirements

### Requirement: The assistant can propose a revision of the whole journey

On a guided diagram in kind mode, the assistant SHALL be offered a `revise_journey` tool. It takes the whole revised journey as an outline, with the step handles it was given. A `# why: text` comment directly above a step line SHALL be read as the reason for that step's changes.

The tool SHALL change nothing by itself. It SHALL produce a pending suggestion. An outline with errors, or an unknown handle, SHALL produce no suggestion, and its per-line errors SHALL be returned to the assistant.

#### Scenario: A revision becomes a suggestion

- **GIVEN** a guided journey with steps s1 "Paga" and s2 "Espera" scored 1
- **WHEN** the assistant calls `revise_journey` with `Paga com Pix {#s1}` and `Espera [3] {#s2}`, and `# why: tela de espera com progresso` above s2
- **THEN** the diagram is unchanged, and a suggestion lists a rename of "Paga" and a score change on "Espera" with that reason

#### Scenario: An invalid revision

- **GIVEN** a guided journey
- **WHEN** the tool is called with an outline that has an unknown handle
- **THEN** no suggestion is created, and the assistant receives the error with its line number

### Requirement: The suggestion lists each change for review

A revision suggestion SHALL list its changes grouped by phase in reading order, with steps before the first phase in their own group. Each change SHALL show:

- its kind (add, remove, rename, step kind, lane, score, phase, exits);
- the step's name, with before and after values;
- the reason, when given.

Each change SHALL have a checkbox, ticked by default. All text SHALL go through i18n (en and pt-BR).

#### Scenario: Grouped list

- **GIVEN** a revision changing one step in phase Discover and adding one step in phase Buy
- **WHEN** the suggestion is shown
- **THEN** it shows a "Discover" group with one change and a "Buy" group with one change, both ticked

### Requirement: Only the selected changes are applied, as one undo step

"Apply selected" SHALL apply exactly the ticked changes as one guided edit that takes one history snapshot before it mutates (`pushHistory`).

Changes that cannot apply alone SHALL form one dependency group, ticked and unticked together:

- a new step and the exits into and out of it;
- a removed step and the reconnection of its neighbours.

With nothing ticked, the action SHALL be disabled.

#### Scenario: Partial accept

- **GIVEN** a suggestion with a rename, a score change and a removal
- **WHEN** the author unticks the removal and applies
- **THEN** the rename and the score change are applied, the step is kept, and one undo reverts both

#### Scenario: Dependent changes

- **GIVEN** a suggestion that adds steps X → Y after A
- **WHEN** the author unticks X
- **THEN** Y and the exits that use X are unticked with it

### Requirement: The canvas previews the selected changes

While a revision suggestion is pending, the canvas SHALL highlight the existing steps touched by the ticked changes, and mark the steps about to be removed. The preview SHALL follow the checkboxes, and SHALL clear when the suggestion is applied or rejected.

#### Scenario: Unticking clears the highlight

- **GIVEN** a pending suggestion that renames "Paga"
- **WHEN** the author unticks that change
- **THEN** "Paga" is no longer highlighted

### Requirement: A suggestion follows later edits

When the journey changes while a revision suggestion is pending, the suggestion SHALL be reconciled again against the current journey. A change whose step no longer exists SHALL be shown as no longer applicable, unticked and disabled. The rest SHALL keep their tick state.

#### Scenario: A step deleted meanwhile

- **GIVEN** a pending suggestion that renames "Espera"
- **WHEN** the author deletes "Espera" on the canvas
- **THEN** that change shows as no longer applicable, and the other changes can still be applied

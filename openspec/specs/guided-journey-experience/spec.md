# guided-journey-experience Specification

## Purpose

An experience score from 1 to 5 on guided steps, stored in the element's kind data. It is set from the Journey tab, shown as a badge, and turns scores of 1–2 into pain points the mode bar can walk through. Scores survive the outline and Mermaid.

## Requirements

### Requirement: An element can carry its kind's data

A component SHALL accept an optional `kindProps` JSON object, owned by the diagram's kind and opaque to every other surface.

- **Validation.** It SHALL be validated like `kindData`: JSON only, a bounded depth, and a size cap of 4 096 characters per element. An invalid value SHALL be dropped on import, not rejected.
- **Lifetime.** It SHALL be kept in freehand mode, saved, versioned and synced with its component. It SHALL be copied with the component and removed with it.
- **Kind edits.** A kind edit SHALL be able to set it on an added node (`add[].kindProps`) and replace or clear it on an existing one (`update[].kindProps`, with `null` to clear).

#### Scenario: Survives freehand and reload

- **WHEN** a guided step has `kindProps.experience = 2`, the author switches to "Edit freehand", reloads, and returns to guided
- **THEN** the step still has experience 2

#### Scenario: Invalid on import

- **WHEN** an imported diagram has a component whose `kindProps` is a string
- **THEN** the diagram imports and that component has no `kindProps`

### Requirement: A step has an experience score

A guided step MAY carry an experience score from 1 to 5, stored as `kindProps.experience`. The Journey tab SHALL offer an "Experience" choice with 1 to 5 and "—" (no score), with the current value marked. Picking one SHALL set or clear the score as one undo step, keeping the selection on the step.

#### Scenario: Scoring a step

- **WHEN** the author picks 2 for a selected step
- **THEN** the step's experience is 2, and one undo removes it

### Requirement: Scores show on the canvas and pain points are marked

In kind mode, a scored step SHALL show a badge with its score out of five ("2/5"). The badge SHALL be red for 1–2, neutral for 3 and green for 4–5.

A step scored 1 or 2 is a **pain point**: it SHALL carry the quiet marker "Pain point" and be counted in the mode bar. The badge SHALL be drawn by the host from a generic `KindMarker.badge` (`text`, `tone`), so any kind can use it. Freehand mode and read-only surfaces SHALL not show badges, as for every kind marker.

#### Scenario: A pain point

- **WHEN** a step is scored 1
- **THEN** it shows a red "1/5" badge and the marker "Pain point", and the mode bar reads "1 pain point"

### Requirement: The mode bar walks the pain points

When the journey has at least one pain point, the guided mode bar SHALL show "N pain points". Each click SHALL select the next pain point in reading order, wrapping around, and bring it into view.

#### Scenario: Two pain points

- **WHEN** two steps are scored 2 and the author clicks the chip twice
- **THEN** the first click selects the earlier one, and the second click selects the later one

### Requirement: The outline carries the score

An outline step, decision or end line MAY end with `[n]`, where n is 1 to 5, after the name and before any comment. The step SHALL be added with that score. `[n]` with any other n SHALL be an error on that line. `\[` SHALL make a bracket literal. Copy as Text SHALL write `[n]` after a scored step's name.

#### Scenario: Typed with a score

- **WHEN** the author applies `Cliente: Paga com Pix [2]`
- **THEN** the step "Paga com Pix" is added with experience 2 and is a pain point

#### Scenario: Out of range

- **WHEN** the line is `Paga [7]`
- **THEN** the panel reports the line, and Apply is disabled

### Requirement: Mermaid keeps the score

Mermaid keeps the score both ways:

- **Mermaid `journey` import.** Each task's score SHALL be stored as its step's experience. The summary SHALL no longer count scores as set aside; sections still are, until phases exist.
- **Mermaid `journey` export.** Each task SHALL be written with its step's score, or 3 when it has none.
- **Mermaid swimlane export.** When any step is scored, the export SHALL add one line, `%% experience: s3=2, s5=1`, naming the exported ids.
- **Swimlane import.** It SHALL read that comment back. Mermaid treats it as a comment.

#### Scenario: Journey round trip keeps scores

- **WHEN** "My working day" is pasted and then copied as Mermaid journey
- **THEN** "Do work" is written with score 1 and "Make tea" with score 5

#### Scenario: Swimlane round trip keeps scores

- **WHEN** a journey with a step scored 2 is copied as Mermaid (lanes) and pasted into a new guided diagram
- **THEN** the same step has experience 2

### Requirement: The assistant knows the scores

On guided diagrams, the assistant prompt SHALL document `[n]` in the outline format. The current journey it receives SHALL include the scores, so the assistant can point out pain points and add scored steps.

#### Scenario: Prompt carries scores

- **WHEN** a step is scored 2 and the prompt is built
- **THEN** the current journey contains that step's line ending in `[2]`

### Requirement: Experience text is translated

The section name, the score options' names, the marker, the mode-bar chip (with plural forms) and the new outline error SHALL exist in en and pt-BR.

#### Scenario: Portuguese

- **WHEN** the app is in pt-BR
- **THEN** the section reads "Experiência", the marker "Ponto de dor", and the chip "2 pontos de dor"

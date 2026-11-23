# guided-direct-editing Specification

## Purpose

Lets an author edit a guided journey in place on the canvas: renaming and moving phases on the band, changing a step's kind or lane by typing in its name, and renaming lanes from their headers.

## Requirements

### Requirement: Phases are renamed on the band

In kind mode on an editable canvas, a double click on a phase segment SHALL open an inline field with the phase name. Enter SHALL rename the phase at its start step, Esc SHALL cancel, and an empty name SHALL remove that phase start. Each commit SHALL be one undo step taken before the change (`pushHistory`).

#### Scenario: Renaming a phase

- **GIVEN** a journey with phases Discover and Buy
- **WHEN** the author double-clicks "Buy", types "Pay" and presses Enter
- **THEN** the band shows "Discover" and "Pay", and one undo shows "Buy" again

### Requirement: A separator moves a phase start

Dragging a separator along the reading axis SHALL move the start of the phase after it to the first step whose column is at or after the drop position. The start SHALL stay after the previous phase's start and before the next one's. While dragging, the band SHALL preview the drop column. The move SHALL be one undo step.

#### Scenario: Moving a start earlier

- **GIVEN** a journey A → B → C → D where C starts "Buy"
- **WHEN** the author drags the separator before C to B's column
- **THEN** B starts "Buy", C no longer starts a phase, and B, C and D are in Buy

### Requirement: Step names accept the outline's shortcuts

In kind mode, when a step's name is committed, an opening `? ` SHALL make the step a decision, and `! ` SHALL make it an end step when it has no exits. A leading `Lane: ` naming an existing lane (trimmed, case-insensitive) SHALL move the step to it. A prefix that names no lane SHALL leave the whole text as the name, so a name like "Meeting: kickoff" stays as typed. The shortcuts SHALL be removed from the stored name, and `\?`, `\!` and `\:` SHALL keep the characters. A shortcut the kind refuses (an end step with exits) SHALL leave the step unchanged and show the reason. Outside kind mode a name SHALL be stored as typed.

#### Scenario: Typing a decision in a lane

- **GIVEN** a step "Validate" in lane Cliente, and a lane API
- **WHEN** the author renames it to `API: ? Valid?`
- **THEN** the step is a decision named "Valid?" in lane API, in one undo step

#### Scenario: A colon that is not a lane

- **GIVEN** no lane named "Meeting"
- **WHEN** the author names a step `Meeting: kickoff`
- **THEN** the step is named "Meeting: kickoff" and stays in its lane

#### Scenario: A literal question mark

- **WHEN** the author names a step `\? Help`
- **THEN** the step is named "? Help" and keeps its kind

### Requirement: Lanes are renamed from their header

In kind mode on an editable canvas, a double click on a lane's header SHALL edit the lane's name in place. It SHALL be committed with Enter or blur, and cancelled with Esc. An empty name SHALL be ignored. The commit SHALL be one undo step.

#### Scenario: Renaming a lane

- **GIVEN** a lane "System"
- **WHEN** the author double-clicks its header, types "API" and presses Enter
- **THEN** the lane is named "API" in its header and in the Journey tab

### Requirement: Direct editing is translated and kind-only

All new labels and notices SHALL go through i18n (en and pt-BR). None of these gestures SHALL be offered in freehand mode or on read-only surfaces.

#### Scenario: Read-only viewer

- **GIVEN** a shared journey open in the viewer
- **WHEN** the reader double-clicks a phase segment
- **THEN** nothing becomes editable

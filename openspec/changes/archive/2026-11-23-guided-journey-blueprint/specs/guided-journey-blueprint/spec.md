# Spec Delta

## Purpose

Service-blueprint structure for guided journeys. A line of visibility separates the lanes the customer sees from the backstage ones. Steps can name participants besides their lane's actor.

## ADDED Requirements

### Requirement: A journey may have one line of visibility

A guided journey MAY store one line of visibility, as the id of the first backstage lane in the diagram's kind data. Lanes before that lane in lane order SHALL be frontstage, and that lane and the ones after it SHALL be backstage. When the lane is removed, or becomes the first lane, the line SHALL be dropped. Setting, moving or removing the line SHALL be one undo step taken before the change (`pushHistory`).

#### Scenario: Setting the line

- **GIVEN** a journey with lanes Cliente, App and API
- **WHEN** the author picks "Line of visibility above this lane" on App's context menu
- **THEN** Cliente is frontstage, App and API are backstage, and one undo removes the line

#### Scenario: The lane goes away

- **GIVEN** the line is above App
- **WHEN** App is deleted
- **THEN** the journey has no line of visibility

### Requirement: The canvas draws the line of visibility

In kind mode, the canvas SHALL draw the line along the reading axis at the boundary before the first backstage lane, across every column. It SHALL be labelled "Visible to the customer" on the frontstage side and "Backstage" on the other, through i18n (en and pt-BR).

The line SHALL be drawn from the kind overlay, like the phase band. It SHALL NOT be an element. It SHALL be hidden in freehand mode, drawn on read-only surfaces, and included in whole-diagram framing.

#### Scenario: A drawn line

- **GIVEN** the line is above App on a left-to-right journey
- **WHEN** the canvas renders in kind mode
- **THEN** a labelled line runs between the Cliente and App bands, from the first column to the last

#### Scenario: Freehand

- **GIVEN** the same journey
- **WHEN** the author switches to "Edit freehand"
- **THEN** the line is not drawn, and the stored line is kept

### Requirement: Steps may have participants

A guided step MAY store participants as `kindProps.participants`: a list of trimmed, non-empty, distinct names, at most 8. Each name is at most 60 characters. A participant equal to the step's own lane name SHALL be dropped.

The Journey tab SHALL show a "Participants" field:

- the current names as removable chips;
- a select that suggests the journey's other lanes and accepts a new name.

Each change SHALL be one undo step.

#### Scenario: Adding a participant from a lane

- **GIVEN** a step "Revisa pedido" in lane Cliente, and a lane Atendente
- **WHEN** the author picks "Atendente" in the Participants select
- **THEN** the step's participants are ["Atendente"], and one undo clears them

#### Scenario: A new name

- **WHEN** the author types "Gerente" and picks "Add “Gerente”"
- **THEN** "Gerente" is a participant, and no lane is created

### Requirement: The canvas shows participants

In kind mode, a step with participants SHALL show a small tag on the step reading "+ Name", or "+ Name +2" for three participants. The tag's full list SHALL be available as its tooltip. The tag SHALL NOT be drawn in freehand mode.

#### Scenario: Two participants

- **GIVEN** a step with participants Atendente and Gerente
- **WHEN** it is drawn in kind mode
- **THEN** it shows "+ Atendente +1", and the tooltip lists both

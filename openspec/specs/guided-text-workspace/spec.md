# guided-text-workspace Specification

## Purpose

Makes the guided Text panel a place to work: docked beside the canvas, with each line tied to its step in both directions, autocomplete for names, and errors marked on their lines.

## Requirements

### Requirement: The text panel can be docked

The Text panel SHALL offer "Dock beside the canvas". Docked, it SHALL be a persistent panel on the canvas's left, under the kind's mode bar, resizable between 280 and 640 pixels wide. It SHALL stay open while the author selects and edits on the canvas, and SHALL offer "Undock". The choice and the width SHALL be kept per browser as a viewer preference, never in the diagram.

#### Scenario: Working docked

- **GIVEN** the panel is docked
- **WHEN** the author clicks a step on the canvas and renames it in the inspector
- **THEN** the panel stays open, and its text shows the new name

### Requirement: A line and its step stay linked

When the cursor rests on a line that stands for a step, that step SHALL be selected on the canvas and brought into view if it is off-screen. When a step is selected on the canvas, the panel SHALL highlight its line and scroll to it. Lines of an edited, unapplied text SHALL be linked through the same line alignment that applying uses.

#### Scenario: From text to canvas

- **GIVEN** the docked panel and a journey with a step "Paga" off-screen
- **WHEN** the author moves the cursor to the line `Paga`
- **THEN** "Paga" is selected and scrolled into view

#### Scenario: From canvas to text

- **WHEN** the author selects "Recebe" on the canvas
- **THEN** the line `Recebe` is highlighted and visible in the panel

### Requirement: The panel suggests names

While typing, the panel SHALL suggest:

- existing lane names at the start of a line, before `: `;
- step names after `@`;
- phase names after `## `.

The suggestions SHALL be filtered by the typed prefix, case-insensitively. Tab or Enter SHALL insert the chosen one, and Esc SHALL dismiss the list. Enter SHALL insert a new line when no list is open.

#### Scenario: Jumping back

- **GIVEN** a journey with a step "Escolhe produto"
- **WHEN** the author types `-> @Esc`
- **THEN** "Escolhe produto" is suggested, and Tab completes it

### Requirement: Errors are marked on their lines

Each line with an outline error SHALL show a marker in the panel's gutter, with the error message as its tooltip. The error list below the text SHALL remain.

#### Scenario: A marked line

- **WHEN** line 3 has an unknown jump
- **THEN** a marker appears beside line 3, and hovering it shows the message

### Requirement: The workspace is translated

All new labels SHALL go through i18n (en and pt-BR).

#### Scenario: Portuguese

- **GIVEN** the app is in pt-BR
- **WHEN** the panel is docked
- **THEN** its actions read "Desacoplar" and "Fixar ao lado do canvas"

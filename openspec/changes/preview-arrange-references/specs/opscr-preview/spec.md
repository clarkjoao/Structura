# Spec Delta

## Purpose

The VSCode preview arranges an opscr workspace with the same arranger, rules and references as the
Structura canvas.

## ADDED Requirements

### Requirement: The embed arranges with the canvas arranger

When a host asks for `mode: "automatic"`, the embed preview SHALL lay each posted graph out with
the canvas whole-diagram arrangement (`planDiagramAutoLayout`). It SHALL use the posted
`DiagramLayoutSettings`, normalised the way a diagram's settings are. Under the default reference
settings, a connection pointing more than 2 columns back SHALL end on a reference beside its
consumer, as on the canvas.

A host that sends no `arrange` SHALL get its own positions drawn, as before.

#### Scenario: A far loop ends on a reference

- **GIVEN** a chain of five components whose last connects to the first
- **WHEN** the host posts it with `arrange: { mode: "automatic" }`
- **THEN** the preview draws a reference to the first component beside the last
- **AND** the connection ends on that reference

#### Scenario: References off

- **WHEN** the same graph is posted with `settings: { references: "off" }`
- **THEN** no reference is drawn

#### Scenario: Manual draws the host's positions

- **WHEN** a graph is posted without `arrange`
- **THEN** every component is drawn at the position the host gave

### Requirement: Automatic arrangement keeps the picture on text edits

In automatic mode, an update that changes no component, parent, size, connection or setting SHALL
keep every element where it was. It SHALL still show the new text.

#### Scenario: Description change

- **GIVEN** an arranged preview
- **WHEN** only a component's description changes
- **THEN** no element moves and the new description is shown

### Requirement: Arrange the preview from VSCode

_opscr: Arrange Preview…_ SHALL offer the following, applied at once and saved per workspace folder:

- the mode, Automatic or Manual;
- the spacing, compact, normal or spacious;
- the reference mode, Rules, Trial or Off;
- under Rules:
  - the neighbour distance, 1–6 columns;
  - the connections kept on the original, 1–5;
  - long forward lines.

A folder with no saved choice SHALL use Automatic and the canvas reference defaults. A status bar
item SHALL show the current mode and open the menu. _opscr: Re-layout Preview_ SHALL re-arrange the
picture in either mode.

#### Scenario: Turning references off

- **GIVEN** an open preview in Automatic mode
- **WHEN** the user picks References › Off
- **THEN** the preview re-arranges without references
- **AND** the choice is restored when the preview is reopened

### Requirement: Read-only surfaces zoom out like the canvas

The viewer, a shared link, the embed and the extension SHALL allow zooming out to the canvas
minimum zoom. Their maximum zoom is unchanged.

#### Scenario: A large arranged diagram fits

- **GIVEN** a diagram wider than the viewport at the old minimum zoom
- **WHEN** the reader zooms out
- **THEN** the zoom can go down to the canvas minimum

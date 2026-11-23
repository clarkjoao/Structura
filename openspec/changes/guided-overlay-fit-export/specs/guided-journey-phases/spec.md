# Spec Delta

## MODIFIED Requirements

### Requirement: The header band shows the phases

In kind mode, when the journey has at least one phase start, the canvas SHALL show a header band along the reading axis. The band SHALL sit above the lanes, or left of them when the diagram reads top to bottom, and SHALL hold one segment per phase over that phase's columns, labelled with its name.

A faint separator SHALL cross the lanes between consecutive phases. Clicking a segment SHALL select the step that starts it.

The band SHALL be drawn by the host from the kind's `overlay`. It SHALL NOT be drawn in freehand mode. On read-only surfaces (the viewer and embeds) it SHALL be drawn without click selection. It SHALL not be a diagram element: it cannot be selected, moved or exported as a node.

#### Scenario: Two phases

- **WHEN** the journey has phases Discover and Buy
- **THEN** the band shows "Discover" over Discover's columns, "Buy" over Buy's, with a separator between them

#### Scenario: Freehand hides it

- **WHEN** the author switches to "Edit freehand"
- **THEN** the band and separators are gone, and the phase starts are kept

#### Scenario: A shared journey shows its phases

- **GIVEN** a guided journey with phases Discover and Buy, opened in the viewer from a share link
- **WHEN** the viewer renders it
- **THEN** the band shows both segments and the separators, and clicking a segment selects nothing

## ADDED Requirements

### Requirement: Whole-diagram framing includes the band

Every framing of the whole diagram SHALL fit the union of the nodes' bounds and the kind overlay's bounds, with the same padding and zoom limits as before. This SHALL apply to:

- the Fit view control;
- the opening viewport;
- the framing after "Arrange" and after leaving a reading;
- "Show all".

Framing a selection or a single element SHALL be unchanged.

#### Scenario: Fit view shows the band

- **GIVEN** a guided journey with phases, scrolled so the band is off-screen
- **WHEN** the author clicks Fit view
- **THEN** the whole band, the curve and every lane are inside the viewport

#### Scenario: No overlay, no change

- **GIVEN** a freehand diagram, or a guided journey without phases or scores
- **WHEN** the author clicks Fit view
- **THEN** the viewport is the same as React Flow's node-only fit

### Requirement: The draw.io export carries the band

When the exported diagram is guided, in kind mode, with a band, the draw.io export SHALL add:

- one labelled rectangle per phase segment, at the band's position;
- one dashed line per separator;
- one polyline for the emotion curve, when the band has one.

These shapes SHALL be grouped in a locked layer named after the band ("Phases" / "Fases"), translated through i18n. No shapes SHALL be added in freehand mode or without a band.

#### Scenario: Phases in draw.io

- **GIVEN** a guided journey with phases Discover and Buy and three scored steps
- **WHEN** it is exported to draw.io
- **THEN** the file holds two labelled phase cells above the lanes, the separators, and a curve polyline, in a locked "Phases" layer, and the steps and lanes are exported as before

#### Scenario: Freehand export

- **GIVEN** the same journey switched to "Edit freehand"
- **WHEN** it is exported to draw.io
- **THEN** the file has no phase layer

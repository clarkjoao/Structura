# Spec Delta

## Purpose

Lets users export diagrams as SVG, PNG, and animated GIF (for FLOW playback) — visual formats suitable for documentation, sharing, and presentation.

## ADDED Requirements

### Requirement: SVG export with framing choice

The system SHALL allow exporting the current diagram as SVG. The user SHALL be able to choose between "Viewport" (the visible canvas area at current zoom/pan) and "Full diagram" (all elements, auto-fitted). The export SHALL produce a standalone SVG file containing all diagram elements and connections, with no external dependencies.

#### Scenario: SVG viewport export

- **GIVEN** a diagram is open with zoom/pan set to a specific region
- **WHEN** the user chooses SVG export with "Viewport"
- **THEN** the downloaded SVG contains exactly the visible region, at the canvas's current resolution

#### Scenario: SVG full-diagram export

- **GIVEN** a diagram with nodes spread across the canvas
- **WHEN** the user chooses SVG export with "Full diagram"
- **THEN** the downloaded SVG contains all nodes and edges, with a bounding box that fits the entire diagram content

### Requirement: PNG export with framing choice

The system SHALL allow exporting the current diagram as PNG. The user SHALL be able to choose between "Viewport" and "Full diagram". When "Full diagram" is selected, the output width SHALL be capped at 4096px; height SHALL scale proportionally to preserve the diagram's aspect ratio. The export SHALL produce a lossless PNG (no quality degradation).

#### Scenario: PNG viewport export

- **GIVEN** a diagram is open with zoom/pan set to a specific region
- **WHEN** the user chooses PNG export with "Viewport"
- **THEN** the downloaded PNG matches the visible region at screen resolution (1 device pixel = 1 image pixel)

#### Scenario: PNG full-diagram width cap

- **GIVEN** a diagram whose natural width exceeds 4096px
- **WHEN** the user chooses PNG export with "Full diagram"
- **THEN** the downloaded PNG width is exactly 4096px and height is scaled proportionally

### Requirement: GIF export records FLOW playback

The system SHALL allow exporting a FLOW as an animated GIF. The export SHALL play the flow automatically from its entry step, advancing through next/branches, and record each step as a frame. The user SHALL be able to choose playback speed: Slow (1.5s per step), Normal (1s per step), or Fast (0.5s per step). The GIF SHALL be framed on the current canvas viewport. The GIF SHALL highlight the current step during playback and SHALL NOT show flow panels or the reading rail.

GIF export SHALL be triggered from the Flow Panel ("Record GIF" in a flow's actions menu, with the speed chosen there), not from the Export modal, because recording drives live flow playback on the canvas.

#### Scenario: GIF export from flow panel

- **GIVEN** a diagram with an active FLOW, the Flow Panel is open, and the user has framed the canvas
- **WHEN** the user chooses "Record GIF" on that flow and picks a speed
- **THEN** a GIF file is downloaded showing the flow advancing step-by-step through the current viewport, with each step highlighted

#### Scenario: GIF is unavailable without a flow

- **GIVEN** a diagram with no FLOW
- **WHEN** the user opens the Export modal or the Flow Panel
- **THEN** no GIF export option is offered

### Requirement: Export modal integrates new formats

The Export modal SHALL include SVG and PNG as selectable formats alongside existing JSON and Draw.io options. Each image format SHALL expose its framing choice (viewport / full-diagram) in the modal. GIF SHALL NOT appear in the Export modal. All user-facing strings SHALL be internationalized through i18next (en + pt-BR).

#### Scenario: Format selection in modal

- **GIVEN** the Export modal is open on a diagram with a flow
- **WHEN** the user selects SVG and chooses "Full diagram"
- **THEN** the SVG export uses full-diagram framing; the modal's selection reflects the choice

### Requirement: No external network dependencies for export

All export operations SHALL run client-side. The system SHALL NOT send diagram data to external services during export. Required encoding libraries (html-to-image, gif.js) SHALL be bundled with the application.

#### Scenario: Offline export

- **GIVEN** the app is loaded and the user is offline
- **WHEN** the user exports SVG, PNG, or GIF
- **THEN** the export completes successfully without any network requests

### Requirement: i18n coverage for export UI

Every user-visible string introduced by this feature SHALL have entries in both `en.json` and `pt-BR.json` under the existing `export.*` key hierarchy.

#### Scenario: Portuguese UI strings

- **GIVEN** the app locale is pt-BR
- **WHEN** the user opens the Export modal
- **THEN** all labels, descriptions, and options for SVG and PNG appear in Portuguese, as do the Flow Panel's "Record GIF" action and speed options

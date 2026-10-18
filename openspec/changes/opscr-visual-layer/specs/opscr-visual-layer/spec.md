# Spec Delta

## Purpose

Draws an opscr workspace's `opscr.visual.json` — boundaries, services with no opscr Kind,
decoration and the edges through them — together with its technical view, so an imported draw.io
diagram keeps its groups and its full picture while the manifests stay the semantic source.

## ADDED Requirements

### Requirement: The visual layer is read beside the manifests

When a workspace has an `opscr.visual.json` (version 1), its view SHALL include the visual layer;
an absent or unreadable file SHALL leave the technical view exactly as it is today.

#### Scenario: No sidecar

- **GIVEN** a workspace with manifests and no `opscr.visual.json`
- **WHEN** it is drawn
- **THEN** the components and connections are the same as before this change

#### Scenario: Unreadable sidecar

- **GIVEN** an `opscr.visual.json` that is not valid JSON
- **WHEN** the workspace is drawn
- **THEN** the technical view is drawn and the pane reports the file as unreadable

### Requirement: Boundaries are panels that hold what was drawn inside them

Each `boundary` element SHALL be drawn as a panel named by its label. Hints SHALL choose the
panel kind: `generic:vpc` → VPC, `generic:subnet` → public or private subnet (by its label),
`generic:az` → availability zone, `generic:auto-scaling-group` → auto scaling group,
`generic:cluster` → EKS or ECS cluster when its label names one; every other boundary is a plain
panel. Its `members` — manifest elements and visual elements — SHALL be nested in it.

#### Scenario: AWS deployment boundaries

- **GIVEN** the import of a diagram with AWS Cloud › VPC › Availability Zone › Private Subnet, and an Application inside the subnet
- **WHEN** it is drawn
- **THEN** there are nested panels AWS Cloud (plain), VPC (vpc), Availability Zone (availability-zone) and Private Subnet (private-subnet), and the Application is a child of the subnet panel

#### Scenario: A bounded context inside a VPC

- **GIVEN** an `ApplicationService` manifest listed as a member of a VPC boundary
- **WHEN** it is drawn
- **THEN** the ApplicationService panel is a child of the VPC panel and its applications stay children of the ApplicationService panel

### Requirement: Services without a Kind keep their identity

A `service` element whose hint maps to a Structura catalog service SHALL be drawn as that catalog
component; any other SHALL be drawn as an unknown component carrying its label. The hint → service
table SHALL only name catalog ids that exist (pinned by a test).

#### Scenario: Monitoring and tracing

- **GIVEN** sidecar services with hints `aws:cloudwatch` and `aws:xray`
- **WHEN** they are drawn
- **THEN** they are AWS catalog components with `cloudServiceId` `cloudwatch` and `xray`

#### Scenario: Unmapped service

- **GIVEN** a sidecar service with hint `generic:workflow` labelled "Orchestration"
- **WHEN** it is drawn
- **THEN** it is an unknown component named "Orchestration"

### Requirement: Decoration is drawn as text

A `decoration` element with a label of two or more characters SHALL be drawn as a text element
with that label; decoration without one (lines, arrows drawn as shapes, step badges) SHALL not be
drawn.

#### Scenario: Title and note

- **GIVEN** decorations "Microservices on ECS Fargate" (a title) and "TODO: validar com segurança" (a note)
- **WHEN** they are drawn
- **THEN** both are text elements with those texts, shown while the diagram's text layer is on

### Requirement: Edges outside the manifests are drawn

Every sidecar edge whose two ends are drawn SHALL be a connection labelled with its drawn label.
A manifest edge that its sidecar edges name in `collapsedInto` SHALL be drawn as that chain instead
of a direct connection, and the pane SHALL list it as drawn through the chain.

#### Scenario: CDN chain

- **GIVEN** a manifest edge `Channel/users -calls-> LoadBalancer/alb` collapsed from Users → CloudFront → ALB
- **WHEN** it is drawn
- **THEN** there are connections Users → CloudFront and CloudFront → ALB, none directly from Users to the ALB, and the pane lists the manifest edge as drawn via CloudFront

### Requirement: Positions compose across both sidecars

Visual boxes are relative to their `parent` key and layout boxes to their manifest parent; the
drawn position of every element SHALL equal its position in the draw.io page (or its transposed
position), whichever sidecar holds it.

#### Scenario: Element in a nested boundary

- **GIVEN** an Application at page position (420, 310) inside a subnet inside a VPC
- **WHEN** the workspace is drawn
- **THEN** the Application's absolute position on the canvas is (420, 310)

### Requirement: Edits to the visual layer stay in the visual layer

Moving, resizing or deleting a visual element on the canvas SHALL update `opscr.visual.json`
(unsaved until the pane saves) and SHALL never change a manifest; `opscr.layout.json` changes only
for manifest elements a moved boundary carries with it. A visual element SHALL never be offered as
"not in the YAML".

#### Scenario: Move a boundary

- **GIVEN** a bound folder with a VPC boundary panel
- **WHEN** the user moves the panel and saves
- **THEN** the VPC's box in `opscr.visual.json` changes, the elements inside it move with it, and no `*.opscr.yaml` byte changes

#### Scenario: Delete a monitoring hub

- **GIVEN** a CloudWatch component from the visual layer
- **WHEN** the user deletes it and saves
- **THEN** its element and its edges are gone from `opscr.visual.json`

### Requirement: The VSCode preview draws the visual layer

The VSCode preview SHALL read `opscr.visual.json` beside the manifests and draw the same visual
layer the plugin draws.

#### Scenario: Preview of an imported workspace

- **WHEN** the preview opens a workspace imported from draw.io
- **THEN** its boundaries, sidecar services and text are drawn as in the plugin

### Requirement: UI strings are internationalized

Every new pane string SHALL go through i18n with entries in `en` and `pt-BR`.

#### Scenario: Portuguese pane

- **WHEN** the UI language is pt-BR
- **THEN** every visual-layer and import string in the pane is shown in Portuguese

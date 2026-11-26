# element-packs Specification

## Purpose

Element packs let developers (and plugins) add element families, categories, services and SVG
shapes to Structura as declarative data, without editing TypeScript unions, locale files or CSS.

## Requirements

### Requirement: Pack format

An element pack SHALL be a JSON document with: an `id` (lowercase `[a-z0-9-]+`), a `label`
given inline for `en` and `pt-BR`, and at least one entry in `categories` or `shapes`. A
category SHALL have an `id`, a localized `label` and `description`, and an `accent` colour
(hex, with an optional dark-theme hex). A service SHALL have an `id`, a display `name`, the
`category` it belongs to, and an `icon` naming an SVG file of the pack; it MAY have a localized
`description`, `searchKeys` and catalog `concepts`. A shape SHALL have an `id`, a localized
`label`, an SVG outline (`viewBox` plus one or more path `d` strings), and MAY have a default
size and `searchKeys`.

#### Scenario: Valid pack is accepted

- **GIVEN** a pack with id `observability`, one category `metrics` and one service `prometheus`
  in that category with icon `prometheus`
- **WHEN** the pack is registered
- **THEN** registration succeeds and the category is offered as element type
  `observability/metrics`

#### Scenario: Invalid pack is rejected with a precise error

- **GIVEN** a pack whose service references category `logs` that the pack does not declare
- **WHEN** the pack is registered
- **THEN** registration throws an error naming the pack, the service and the missing category,
  and nothing of the pack is registered

#### Scenario: Missing translation is rejected

- **GIVEN** a pack whose category `label` has `en` but no `pt-BR`
- **WHEN** the pack is registered
- **THEN** registration throws, naming the field path of the missing locale

### Requirement: Built-in packs are auto-discovered

Every `pack.json` under the built-in packs folder SHALL be registered at app boot, before
diagrams rehydrate, together with the SVG icons in its `icons/` folder. Adding a family,
category, service or shape to a built-in pack SHALL require no change outside that pack's folder.
A test SHALL validate every built-in pack so an invalid one fails the suite.

#### Scenario: New service from JSON only

- **GIVEN** a developer adds a service entry to a built-in pack and its SVG to the pack's
  `icons/` folder
- **WHEN** the app boots
- **THEN** the service appears in the element catalog under its category with its icon, and
  can be inserted on the canvas

#### Scenario: Icon referenced but missing

- **GIVEN** a built-in pack service whose `icon` has no matching SVG file
- **WHEN** the pack test suite runs
- **THEN** the test fails naming the pack, the service and the missing icon

### Requirement: Pack element type ids are namespaced

Element types contributed by a pack SHALL be `<packId>/<categoryId>` for categories and
`<packId>/<shapeId>` for shapes. A pack SHALL NOT register an id that is already registered
(built-in or another pack), and a pack id SHALL NOT equal an existing family id.

#### Scenario: Colliding pack id

- **GIVEN** the built-in family `aws` is registered
- **WHEN** a pack with id `aws` is registered
- **THEN** registration throws and the `aws` family is unchanged

### Requirement: Pack categories behave as catalog elements

Each pack category SHALL be offered as a catalog element in the same surfaces as built-in
catalog families: the element catalog / palette (one group per pack, services as entries), quick
insert, search (by name, search keys and concepts), the LLM family list and `search_elements`,
and the element inspector. A component created from a service SHALL store the service as its
catalog service id and render as a card with the service icon and the category accent. A
category without services SHALL still be insertable as a generic card of that category.

#### Scenario: Insert a service

- **GIVEN** the `observability` pack is registered
- **WHEN** the user picks "Prometheus" in the element catalog
- **THEN** a node of type `observability/metrics` with catalog service `prometheus` is created
  as one undoable step and shows the Prometheus icon

#### Scenario: LLM can add a pack service

- **WHEN** the assistant searches elements for "prometheus" and adds it
- **THEN** the add is accepted, because the (type, service) pair exists in the registry

### Requirement: Pack shapes render as scalable SVG outlines

Each pack shape SHALL be offered in the pack's palette group and, when inserted, SHALL render
its SVG outline stretched to the node's size, with the node's name as an editable label inside,
the node's accent applied to the outline, and the handles of the diagram's reading direction
(input side in, output side out, per ADR-0013). A shape outline SHALL accept only SVG path
data (commands and numbers), so it can carry no markup, script or URL.

#### Scenario: Resize a shape

- **GIVEN** a `observability/funnel` shape node of 160×80
- **WHEN** the user resizes it to 320×80
- **THEN** the outline is redrawn at 320×80 without clipping and the label stays centred

#### Scenario: Unsafe SVG is not rendered

- **GIVEN** a shape whose path data contains markup such as a `<script>` element
- **WHEN** the pack is registered
- **THEN** registration throws and the shape is not offered

### Requirement: Pack elements export to draw.io

A pack service card SHALL export to draw.io as an image cell carrying its icon when the icon is
known, and otherwise as a passthrough cell labelled with the pack name. A pack shape SHALL
export as an image cell of its SVG outline at the node's geometry, with the node's name as the
cell label.

#### Scenario: Export a pack service

- **GIVEN** a diagram with a Prometheus node from the `observability` pack
- **WHEN** the diagram is exported to draw.io
- **THEN** the node becomes an image cell with the Prometheus icon and the node's name

### Requirement: Pack labels are internationalized

Pack labels and descriptions SHALL be shown in the active locale (`en` or `pt-BR`) and SHALL
switch when the user changes language, through the i18n layer. Service display names are proper
nouns and are shown as written.

#### Scenario: Language switch

- **GIVEN** the app in `en` showing category "Metrics" from a pack whose `pt-BR` label is "Métricas"
- **WHEN** the user switches to `pt-BR`
- **THEN** the catalog shows "Métricas"

### Requirement: Absent pack degrades without data loss

A saved component whose pack type is not registered (pack removed, or plugin disabled) SHALL
render as the `unknown` element with its persisted data unchanged, and SHALL render normally
again once the pack is registered. Creating pack components SHALL go through the store's
component actions, so history is pushed and one undo reverts the insert.

#### Scenario: Pack removed and restored

- **GIVEN** a saved diagram with an `observability/metrics` node
- **WHEN** it is opened in a build without that pack, saved, and opened again with the pack back
- **THEN** the node shows as unknown in the first session and as the Prometheus card in the last,
  with its name, service id and position unchanged

### Requirement: Built-in cloud families are packs with unchanged ids

AWS, GCP, Azure, Kubernetes and OSS SHALL be defined by built-in packs: their categories,
services, labels, descriptions, accents, ordering and concepts SHALL come from the pack JSON.
Their element type ids, catalog service ids and icon names SHALL be exactly those persisted
before the migration, so saved diagrams, presets, draw.io import and the LLM keep working
without a schema migration. Verbatim (non-namespaced) type ids SHALL be accepted only for these
five built-in packs. Every surface that showed these families before (palette, element catalog,
icon pickers, LLM catalog and IR, draw.io export with AWS native icons, card accents in light and
dark theme) SHALL show the same entries after.

#### Scenario: Saved AWS diagram after migration

- **GIVEN** a diagram saved before the migration with an `aws-compute` node whose catalog service is `lambda`
- **WHEN** it is opened after the migration
- **THEN** it renders as the AWS Lambda card with the compute accent and exports with the native AWS Lambda icon

#### Scenario: Adding an AWS service is a JSON edit

- **WHEN** a developer adds `{ "id": "bedrock", "name": "Amazon Bedrock", "category": "aws-ml", "icon": "ArchitectureServiceAmazonBedrock" }` to the AWS pack
- **THEN** Bedrock appears in the AWS catalog group with its icon, with no other file changed

#### Scenario: Verbatim ids are reserved

- **WHEN** a pack other than the five built-in families declares verbatim type ids
- **THEN** registration throws

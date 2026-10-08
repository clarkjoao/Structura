# Spec Delta

## Purpose

Projects an opscr architecture workspace (YAML manifests and their Relationship edges) into the
elements, nesting and edges of a Structura technical diagram, ready for autolayout, so every consumer
draws the same workspace the same way.

## ADDED Requirements

### Requirement: Element identity is kind and name

Each drawn element SHALL be identified by its opscr Kind and `metadata.name`, so the same manifest maps
to the same element on every projection.

#### Scenario: Stable identity across projections

- **GIVEN** a workspace containing `Database` `orders-db`
- **WHEN** the technical view is built twice from the same workspace
- **THEN** both views contain one element with the identity `Database/orders-db`

### Requirement: Containment is drawn as nesting

A `belongsTo` edge SHALL make the source element a child of the target element instead of being drawn
as an edge. An ApplicationService that belongs to a Subdomain SHALL be nested in that Subdomain's Domain.

#### Scenario: Application inside its bounded context

- **GIVEN** `Application/orders-api belongsTo ApplicationService/orders`
- **WHEN** the technical view is built
- **THEN** `Application/orders-api` is a child of `ApplicationService/orders` and no edge is drawn between them

#### Scenario: Bounded context inside its domain through a subdomain

- **GIVEN** `ApplicationService/orders belongsTo Subdomain/ordering` and `Subdomain/ordering belongsTo Domain/commerce`
- **WHEN** the technical view is built
- **THEN** `ApplicationService/orders` is a child of `Domain/commerce`

### Requirement: Domains and bounded contexts are boundaries

Domain and ApplicationService elements SHALL be boundaries (drawn as panels that may hold children),
even when nothing belongs to them.

#### Scenario: Empty bounded context

- **GIVEN** an ApplicationService that no Application belongs to
- **WHEN** the technical view is built
- **THEN** it is a boundary with no children

### Requirement: Technical Kinds map to catalog services by provider

A technical element SHALL use the Structura cloud or open-source catalog service matching its
`spec.provider` when one exists, and SHALL otherwise be a C4 container whose technology names the
provider.

#### Scenario: Provider with a catalog service

- **GIVEN** `Database` `orders-db` with provider `DynamoDB`
- **WHEN** the technical view is built
- **THEN** the element is the AWS database category with the `dynamodb` service

#### Scenario: Provider without a catalog service

- **GIVEN** `Database` `ledger` with provider `ClickHouse`
- **WHEN** the technical view is built
- **THEN** the element is a C4 container with technology `ClickHouse`

### Requirement: Out-of-view Kinds are reported, not drawn

Subdomain, business and organization Kinds SHALL NOT be drawn, and the view SHALL list every manifest it
left out, with its Kind and name.

#### Scenario: Business capability left out

- **GIVEN** a workspace with `BusinessCapability/order-fulfillment`
- **WHEN** the technical view is built
- **THEN** no element is drawn for it and the view lists it as omitted

### Requirement: Flow edges connect drawn elements

Every Relationship edge other than `belongsTo` whose both ends are drawn SHALL become one edge from the
`from` element to the `to` element, carrying its edge type. Edges with an end that is not drawn or does
not exist SHALL be dropped and reported.

#### Scenario: Write edge

- **GIVEN** `Application/orders-api writes Database/orders-db`
- **WHEN** the technical view is built
- **THEN** the view has one edge from `Application/orders-api` to `Database/orders-db` of type `writes`

#### Scenario: Annotation edge to a business Kind

- **GIVEN** `BusinessRule/order-integrity appliesTo Application/orders-api`
- **WHEN** the technical view is built
- **THEN** no edge is drawn and the edge is reported as dropped

#### Scenario: Edge to a missing element

- **GIVEN** an edge whose `to` names a manifest that does not exist
- **WHEN** the technical view is built
- **THEN** no edge is drawn and the edge is reported as dropped

### Requirement: Malformed input degrades instead of failing

Building the view SHALL NOT throw for a workspace the opscr compiler would reject: a manifest without a
usable provider SHALL fall back to a C4 container, and a `belongsTo` that would create a cycle or a
second parent SHALL be ignored and reported.

#### Scenario: Containment cycle

- **GIVEN** `ApplicationService/a belongsTo Domain/x` and `Domain/x belongsTo ApplicationService/a`
- **WHEN** the technical view is built
- **THEN** the view is returned, no element is its own ancestor, and the ignored containment is reported

### Requirement: The view lays out with the shared layout contract

The view SHALL produce a layout graph (element ids, parents, sizes and edges) for the layout engine, and
SHALL place every element from a layout result, with children positioned relative to their parent.

#### Scenario: Nested placement

- **GIVEN** the technical view of the opscr sample workspace laid out by the layout engine
- **WHEN** the view is placed from the layout result
- **THEN** every element has a position and size, and every child lies inside its parent's box

### Requirement: The library stays framework-agnostic

The library SHALL NOT import application features, the plugin API, or the `opscr` package at runtime, so
the app, plugins and editor extensions can share it.

#### Scenario: Import guard

- **WHEN** the library's sources are checked
- **THEN** none imports from `@/features`, `@/plugins` or `opscr`

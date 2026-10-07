# Spec Delta

## ADDED Requirements

### Requirement: Importers create panels and catalog components

An imported component SHALL keep its `type` when it is a C4 type, `panel`, a category of a registered catalog family (AWS, GCP, Azure, OSS…) or a plugin-namespaced type; any other type SHALL degrade to `unknown`. A catalog component SHALL carry the `cloudServiceId` the importer gave, written through the host's single `cloudServiceId` writer, and C4 and catalog components SHALL carry the given `technology`.

#### Scenario: Cloud database with its service

- **GIVEN** an importer returns a component of type `aws-database` with `cloudServiceId: "dynamodb"` and `technology: "DynamoDB"`
- **WHEN** the import runs
- **THEN** the diagram has an `aws-database` component whose `cloudServiceId` is `dynamodb` and whose technology is `DynamoDB`

#### Scenario: Unsupported built-in type degrades

- **GIVEN** an importer returns a component of type `endpoint`
- **WHEN** the import runs
- **THEN** the component is created as `unknown`

### Requirement: Importers nest components

An imported component with a `parentKey` SHALL be created inside the component that key names — another component of the same import or an existing component of the diagram — with its position relative to that parent. When the parent does not exist, cannot hold the child, or the parent keys form a cycle, the component SHALL be created at the top level instead of failing the import.

#### Scenario: Application inside a new panel

- **GIVEN** an importer returns a `panel` with key `orders` and a `container` with key `api` and `parentKey: "orders"`
- **WHEN** the import runs
- **THEN** the container's `parentId` is the new panel's id

#### Scenario: Child of an existing panel

- **GIVEN** the diagram has a panel with id `p1` and an importer returns a component with `parentKey: "p1"`
- **WHEN** the import runs
- **THEN** the new component's `parentId` is `p1`

#### Scenario: Parent cycle

- **GIVEN** an importer returns components `a` with `parentKey: "b"` and `b` with `parentKey: "a"`, both panels
- **WHEN** the import runs
- **THEN** both are created, and neither is its own ancestor

#### Scenario: Missing parent

- **GIVEN** an importer returns a component with `parentKey: "nowhere"`
- **WHEN** the import runs
- **THEN** the component is created at the top level

### Requirement: Imports respect the active diagram version and undo as one step

A plugin import SHALL be committed as a single history step on the active diagram, written to the active diagram version when one is open, so one undo reverts the whole import.

#### Scenario: Nested import undone at once

- **GIVEN** an import that created two panels, five nested components and four connections
- **WHEN** the user undoes once
- **THEN** none of those components and connections remain

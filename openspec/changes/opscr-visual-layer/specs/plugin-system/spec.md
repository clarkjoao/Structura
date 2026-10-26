# Spec Delta

## MODIFIED Requirements

### Requirement: Importers create panels and catalog components

An imported component SHALL keep its `type` when it is a C4 type, `panel`, `text`, a category of a registered catalog family (AWS, GCP, Azure, OSS…) or a plugin-namespaced type; any other type SHALL degrade to `unknown`. A catalog component SHALL carry the `cloudServiceId` the importer gave, written through the host's single `cloudServiceId` writer, and C4 and catalog components SHALL carry the given `technology`. A panel SHALL carry the `panelKind` the importer gave when it is a known panel kind (since API 1.12); an unknown `panelKind` SHALL be dropped. A `text` component's text SHALL be its `name`.

#### Scenario: Cloud database with its service

- **GIVEN** an importer returns a component of type `aws-database` with `cloudServiceId: "dynamodb"` and `technology: "DynamoDB"`
- **WHEN** the import runs
- **THEN** the diagram has an `aws-database` component whose `cloudServiceId` is `dynamodb` and whose technology is `DynamoDB`

#### Scenario: Unsupported built-in type degrades

- **GIVEN** an importer returns a component of type `endpoint`
- **WHEN** the import runs
- **THEN** the component is created as `unknown`

#### Scenario: Panel kind

- **GIVEN** an importer returns a `panel` with `panelKind: "vpc"` and another with `panelKind: "moat"`
- **WHEN** the import runs
- **THEN** the first panel is a VPC panel and the second a default panel

#### Scenario: Text

- **GIVEN** an importer returns a component of type `text` named "Solution Architecture"
- **WHEN** the import runs
- **THEN** the diagram has a text element reading "Solution Architecture"

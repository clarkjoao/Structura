# Spec Delta

## Purpose

Lets a user open an opscr architecture file in Structura and get the technical diagram it describes,
laid out and nested, with anything that could not be drawn reported instead of silently lost.

## ADDED Requirements

### Requirement: opscr files are offered to the importer

The importer SHALL be offered for files ending in `.opscr.yaml` or `.opscr.yml`, and for other `.yaml` /
`.yml` files only when their content declares an `opscr.dev/` apiVersion.

#### Scenario: opscr file

- **WHEN** the user picks `shop.opscr.yaml`
- **THEN** the opscr importer is offered

#### Scenario: Unrelated YAML

- **WHEN** the user picks `docker-compose.yml` with no `opscr.dev/` apiVersion
- **THEN** the opscr importer is not offered

### Requirement: The import draws the technical view

Importing SHALL create one diagram element per drawn node of the technical view, nested as the view
nests them, with Domains and bounded contexts as panels sized to hold their children, technical Kinds
as their catalog components, and one connection per drawn edge labelled with its edge type.

#### Scenario: The opscr sample as one file

- **GIVEN** the opscr sample's manifests concatenated into one file
- **WHEN** it is imported into an empty diagram
- **THEN** the diagram has the two Domain panels, the three bounded-context panels nested in them,
  the Applications nested in their bounded contexts, `orders-db` as an AWS DynamoDB component, and
  one connection per drawn edge

### Requirement: The import is laid out

Every imported element SHALL have a position from the autolayout, root elements placed at the
import anchor and nested elements relative to their panel, so no two root elements overlap.

#### Scenario: No overlapping roots

- **WHEN** the opscr sample is imported
- **THEN** no two top-level elements' boxes overlap

### Requirement: What is not drawn is reported

The import SHALL return a warning for opscr errors in the file, for the Kinds left out of the view,
and for the edges not drawn, and SHALL still import what can be drawn.

#### Scenario: File with an invalid manifest

- **GIVEN** a file where one Database has an unknown field
- **WHEN** it is imported
- **THEN** the valid elements are imported and a warning reports the opscr error

#### Scenario: Not opscr at all

- **GIVEN** a file that is not valid YAML
- **WHEN** it is imported
- **THEN** nothing is created and a warning reports why

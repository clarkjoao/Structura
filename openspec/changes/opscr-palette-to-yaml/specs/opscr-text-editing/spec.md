# Spec Delta

## ADDED Requirements

### Requirement: Palette elements into the YAML

The opscr pane SHALL list the bound diagram's elements that the YAML does not declare, each with a
suggested Kind and provider, and adding one SHALL write its manifest, a `belongsTo` to the panel it
sits in, and edges for its connections to bound elements, keeping the same canvas element.

#### Scenario: A DynamoDB from the palette

- **GIVEN** the user adds an AWS DynamoDB from the palette to a bound diagram
- **WHEN** they click Add to YAML with the suggested Kind Database
- **THEN** a Database manifest with provider DynamoDB is written and the element is no longer
  listed as outside the YAML, without a duplicate on the canvas

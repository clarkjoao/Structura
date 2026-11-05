# Spec Delta

## ADDED Requirements

### Requirement: Catalog service and technology edits

Changing a bound element's catalog service or technology on the canvas SHALL set its manifest's
`spec.provider` when the new value is a provider of the element's Kind, and SHALL otherwise revert
the change on the canvas and say why.

#### Scenario: Lambda to ECS

- **GIVEN** `order-tracker` is an Application drawn as AWS Lambda
- **WHEN** the user picks Amazon ECS as its cloud service
- **THEN** its manifest reads `provider: ECS` and the element stays in place

#### Scenario: Another Kind's service

- **WHEN** the user picks DynamoDB for that Application
- **THEN** the manifest is unchanged and the canvas goes back to AWS Lambda

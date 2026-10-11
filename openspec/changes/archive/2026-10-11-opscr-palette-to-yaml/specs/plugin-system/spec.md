# Spec Delta

## ADDED Requirements

### Requirement: Snapshots expose catalog service and technology

Component snapshots SHALL include the catalog service id and the technology label of the component,
or null.

#### Scenario: A Lambda

- **WHEN** a plugin reads a diagram holding an AWS Lambda with technology "Python"
- **THEN** its snapshot has `cloudServiceId: "lambda"` and `technology: "Python"`

# Spec Delta

## ADDED Requirements

### Requirement: F2 renames an element everywhere

F2 on a manifest's `metadata.name`, or on an edge end's `id`, SHALL rename that element in every
manifest of the bound folder and rename the canvas element in place, keeping its position and
children. A name the same Kind already uses, or an empty one, SHALL be refused.

#### Scenario: F2 on a name

- **WHEN** the user presses F2 on `order-tracker` and enters `order-relay`
- **THEN** the manifest and every edge end read `order-relay`, and the canvas element is renamed
  where it was

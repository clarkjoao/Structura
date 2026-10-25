# Spec Delta

## Purpose

Editing an initiative from the canvas, the way the LLM edits it in the files.

## ADDED Requirements

### Requirement: Canvas edits go to the initiative

While an initiative's Version is shown on the bound diagram, a canvas edit SHALL be written to that
initiative's files: an edited root element is copied whole into the initiative, a deleted one gets a
`metadata.retired` stub, a new connection goes into the initiative's own Relationship, and the lock
records the root version of every copy. Root files SHALL NOT change.

#### Scenario: Rename in an initiative

- **GIVEN** the initiative's Version shown
- **WHEN** the user renames a root element's description on the canvas
- **THEN** the initiative gets a copy of that manifest with the new description, the lock covers it, and the root file is unchanged

#### Scenario: Delete in an initiative

- **WHEN** the user deletes a root element on the canvas
- **THEN** the initiative gets a retired stub for it

### Requirement: Positions go to the initiative's sidecar

Moving a node inside an initiative's Version SHALL write its box to the initiative's
`opscr.layout.json`, keeping only boxes that differ from the root's.

#### Scenario: Move in an initiative

- **WHEN** a node is moved inside the Version
- **THEN** the root sidecar is unchanged and the initiative's sidecar has the new box

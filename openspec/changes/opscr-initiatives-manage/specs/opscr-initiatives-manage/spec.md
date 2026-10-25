# Spec Delta

## ADDED Requirements

### Requirement: An initiative is a Version only where it changes something

An initiative's Version SHALL be kept in a diagram that shows the whole workspace, and in a diagram
that shows an opscr View only when the initiative changes what that View shows (an element added,
changed, moved to another box or retired, or an edge added or removed). A Version whose initiative
no longer changes the View SHALL be removed from that diagram.

#### Scenario: A View the initiative leaves alone

- **GIVEN** the initiative `order-events`, which changes nothing in the View `shop-context`
- **WHEN** View diagrams are on
- **THEN** the diagram of `shop-context` has no `order-events` Version, and the diagram of
  `shop-containers` has one

### Requirement: The pane says which Views each initiative changes

The Overview SHALL list the whole workspace and each View, marking each with the initiatives that
change it and their counts, and SHALL offer the choice between the root and each initiative for the
bound diagram.

#### Scenario: Marks on the View list

- **GIVEN** the initiative `order-events`
- **WHEN** the user opens the Overview
- **THEN** `shop-containers` is marked with Order events and `shop-context` is not

### Requirement: Initiatives are managed from the pane

The Initiatives tab SHALL list the initiatives with their status and changes and SHALL open an
initiative's detail, where its name, status and description can be edited, its Version shown on the
canvas, its changes, Views and files opened, and the initiative promoted or deleted. Edits SHALL be
unsaved until Save.

#### Scenario: Editing the description

- **GIVEN** the detail of `order-events`
- **WHEN** the user edits the description and saves
- **THEN** `initiatives/order-events/initiative.opscr.yaml` has the new `spec.description`

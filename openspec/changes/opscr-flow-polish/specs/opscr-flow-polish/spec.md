# Spec Delta

## ADDED Requirements

### Requirement: New cards are placed clear of drawn cards

When most siblings are kept, a new element SHALL be placed clear of the room a drawn card takes on
the canvas (at least 260 wide and 160 tall), and its panel SHALL grow to hold that room.

#### Scenario: The container View with an initiative

- **GIVEN** the `order-events` initiative shown in the `shop-containers` View diagram
- **WHEN** its Version is drawn
- **THEN** none of its new elements overlaps another box, and each stays inside its panel

### Requirement: The legend counts elements and connections apart

The changes view's legend SHALL count elements added, changed and removed, and connections changed
in any way, separately.

#### Scenario: Counting an initiative

- **GIVEN** a Version that adds 3 elements and 3 connections, changes 1 element and removes 1
  element and 2 connections
- **THEN** the legend reads 3 added, 1 changed, 1 removed, 5 connections

### Requirement: A new initiative is named before it is made

The pane SHALL ask for a new initiative's name and SHALL create its folder named after it, numbered
when the name is taken.

#### Scenario: Naming an initiative

- **WHEN** the user creates "Migração de sessões"
- **THEN** `initiatives/migracao-de-sessoes/initiative.opscr.yaml` has `displayName: "Migração de
  sessões"`, and its detail opens

### Requirement: The header shows the drill-down trail and the Version shown

The diagram header SHALL show the diagrams drilled down through as crumbs that open them again, and
the active Version's name beside the diagram's name.

#### Scenario: Drilled into the component diagram

- **GIVEN** the container diagram on the Version Order events, drilled into Orders API — components
- **THEN** the header reads "Web shop — containers › Orders API — components" with "Order events"
  beside it, and the crumb opens the container diagram

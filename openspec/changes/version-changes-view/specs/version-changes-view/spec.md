# Spec Delta

## Purpose

While a Version is active, the canvas can show what it changes against the base.

## ADDED Requirements

### Requirement: Changes view

With a Version active and compare mode off, the canvas SHALL, while the changes view is on (the
default, remembered per user), outline added elements and connections in green and changed ones in
amber, where changed means content different from the base — a layout override alone SHALL NOT
count. A legend with the counts SHALL show while the Version has changes. The Version SHALL stay
editable.

#### Scenario: Changed and added

- **GIVEN** a Version that edits `orders-api`'s description and adds `order-events`
- **WHEN** it is active with the changes view on
- **THEN** `orders-api` has the amber outline and `order-events` the green one

#### Scenario: Moved only

- **WHEN** a base element is only moved inside the Version
- **THEN** it has no changed outline

### Requirement: Removed elements as ghosts

Elements and connections the Version removes SHALL be drawn where the base has them as ghosts —
faded, outlined in dashed red, the name struck through — that take no selection, drag or
connection. Ghosts SHALL NOT be part of the diagram state: selection, auto-layout, plugin
snapshots, collaboration and exports SHALL NOT see them.

#### Scenario: Retired cache

- **GIVEN** a Version that removes `sessions`
- **WHEN** it is active with the changes view on
- **THEN** `sessions` shows as a ghost at its base position, and `getDiagram` does not list it

### Requirement: What changed

For a changed element or connection selected in its Version, the element panel SHALL list each
field that differs from the base as base value → Version value.

#### Scenario: Description changed

- **WHEN** the user selects `orders-api` in the Version
- **THEN** the panel shows the description as it is in the base and as it is in the Version

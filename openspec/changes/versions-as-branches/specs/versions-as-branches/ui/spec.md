# Spec Delta

## Purpose

Versions read as branches: grouped by status, with what they changed and what conflicts visible.

## ADDED Requirements

### Requirement: Status groups

The Version panel SHALL group Versions by status (`proposed`, `approved`, `in-progress`, `done`,
and a group for Versions without status), and SHALL let the user set the status of a Version not
owned by a plugin. All labels SHALL go through i18n with `en` and `pt-BR` entries.

#### Scenario: Grouped list

- **GIVEN** one Version in progress and one proposed
- **WHEN** the panel opens
- **THEN** each appears under its status heading

### Requirement: Conflict visibility and resolution

A Version with conflicts SHALL show their count; its merge action SHALL be disabled with an
explanation. A conflicted element SHALL show a marker on the canvas and, in the element panel,
"Keep version" and "Use base" actions.

#### Scenario: Resolve from the element panel

- **GIVEN** a conflicted element selected in its Version
- **WHEN** the user chooses "Use base"
- **THEN** the conflict is gone and the element shows the base content

### Requirement: Modified marker

A modified element SHALL show a marker on the canvas while its Version is active.

#### Scenario: Marker

- **WHEN** a base element is edited inside a Version
- **THEN** its node shows the modified marker

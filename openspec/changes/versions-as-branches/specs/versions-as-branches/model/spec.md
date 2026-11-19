# Spec Delta

## Purpose

A Version is a logical branch over the diagram's base: it adds, replaces and removes elements,
remembers which base it copied, and merges back.

## ADDED Requirements

### Requirement: Copy-on-write

With a Version active, an edit to an element the Version did not add SHALL be written to a copy of
that element in the Version (`modifiedComponents` / `modifiedConnections`), recording the base
element's hash once; the base SHALL NOT change. Every such edit SHALL call `pushHistory` before
mutating.

#### Scenario: Rename a base component in a Version

- **GIVEN** a base component "API" and an active Version
- **WHEN** the user renames it to "API v2"
- **THEN** the base still says "API", the Version's `modifiedComponents` holds "API v2", and the canvas shows "API v2"

#### Scenario: Undo

- **WHEN** the user undoes that rename
- **THEN** the Version no longer holds a modified copy

### Requirement: Moving base nodes

With a Version active, moving a base node SHALL write a layout override in the Version's
`nodeLayouts` and SHALL NOT mark the component as modified. Measurement writes SHALL NOT create
overrides.

#### Scenario: Drag a base node

- **WHEN** a base node is dragged in a Version
- **THEN** the base layout is unchanged and the Version's layout for it has the new position

### Requirement: Conflicts

A modified element whose base element's current hash differs from its recorded base hash, or whose
base element no longer exists, SHALL be a conflict. Keeping the Version's copy SHALL record the
current base hash; taking the base SHALL drop the copy.

#### Scenario: Base edited after the copy

- **GIVEN** a Version that modified "API"
- **WHEN** "API" is edited in the base
- **THEN** the Version reports a conflict for "API"

### Requirement: Merge

Merging SHALL be refused while the Version has conflicts. Otherwise it SHALL write added and modified
elements and layout overrides into the base, remove removed elements, and delete the Version.

#### Scenario: Merge with a modified element

- **GIVEN** a Version without conflicts that modified "API"
- **WHEN** it is merged
- **THEN** the base holds the modified "API" and the Version is gone

### Requirement: Stored diagrams unchanged

The new Version fields SHALL be optional; a diagram that does not use them SHALL persist and hash
exactly as before, with no migration.

#### Scenario: Old Version

- **GIVEN** a stored Version with only added and removed elements
- **WHEN** it is loaded and resolved
- **THEN** it resolves as before this change

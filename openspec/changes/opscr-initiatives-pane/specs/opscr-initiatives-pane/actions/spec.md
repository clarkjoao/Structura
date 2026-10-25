# Spec Delta

## Purpose

The Version panel's actions and the pane's list carry out initiative lifecycle operations in the
folder.

## ADDED Requirements

### Requirement: Version actions

For the plugin's Versions the pane SHALL: on create, add `initiatives/initiative-<n>/` with an
`Initiative` (`status: proposed`) and show its Version; on rename, set its `displayName`; on delete,
drop its files; on merge, apply `planPromote` to the buffers or show why it refuses. All changes
SHALL stay unsaved until Save, which SHALL also delete dropped files and folders.

#### Scenario: Merge a done initiative

- **GIVEN** an initiative with `status: done`, no errors and no lock conflict
- **WHEN** the user merges its Version
- **THEN** the root buffers hold the promoted text, the initiative's buffers are gone, and Save writes and deletes accordingly

#### Scenario: Merge refused

- **GIVEN** an initiative with `status: in-progress`
- **WHEN** the user merges its Version
- **THEN** nothing changes and the pane shows `promote/not-done`

### Requirement: Initiatives list

The pane SHALL list the initiatives with their status (editable), lock conflicts (with an accept
action that records the current root versions), a button to show the Version and one to promote.
All strings SHALL be localized (en, pt-BR).

#### Scenario: Accept a root change

- **GIVEN** a lock conflict on an initiative
- **WHEN** the user accepts it
- **THEN** `initiative.lock` records the current root hash and the conflict is gone

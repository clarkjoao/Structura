# Spec: diagram-import-folder-safety

## ADDED Requirements

### Requirement: An imported diagram never points at a missing folder

Every action that inserts a diagram coming from outside the current workspace
(`importDiagram`, `addImportedDiagram`) MUST verify that the diagram's `folderId` resolves to an
existing entry in `state.folders`. When it does not, the action MUST clear `folderId` so the
diagram lands at the workspace root. A `folderId` that does resolve MUST be preserved unchanged.

#### Scenario: Imported diagram carries an unknown folder id

- **GIVEN** a workspace whose `folders` does not contain `"folder-abc"`
- **WHEN** a diagram with `folderId: "folder-abc"` is imported
- **THEN** the stored diagram has no `folderId`
- **AND** it is listed at the workspace root in the dashboard and in the diagram sidebar

#### Scenario: Imported diagram carries a known folder id

- **GIVEN** a workspace whose `folders` contains `"folder-abc"`
- **WHEN** a diagram with `folderId: "folder-abc"` is imported
- **THEN** the stored diagram keeps `folderId: "folder-abc"`
- **AND** it is listed inside that folder

#### Scenario: Imported diagram carries no folder id

- **WHEN** a diagram with `folderId` absent, `null`, or `undefined` is imported
- **THEN** the stored diagram is at the root and no error is raised

### Requirement: Importing into a folder still targets that folder

Importing from a folder context MUST place the diagram in that folder, regardless of the
`folderId` present in the file.

#### Scenario: Import launched from inside a folder

- **GIVEN** the user opens the import modal from folder `"folder-local"`
- **WHEN** a diagram whose file carries `folderId: "folder-remote"` is imported
- **THEN** the stored diagram has `folderId: "folder-local"`

### Requirement: Persisted state repairs orphaned diagrams on load

The persisted store MUST repair workspaces that already contain orphaned diagrams. A migration
at `PERSIST_SCHEMA_VERSION` 12 MUST clear every `folderId` in `state.diagrams` that has no
matching entry in `state.folders`. The migration MUST be idempotent and MUST NOT touch diagrams
whose folder exists or that are already at the root.

#### Scenario: Stored workspace has an orphaned diagram

- **GIVEN** a persisted state at version 11 with a diagram pointing at a deleted folder
- **WHEN** the store rehydrates
- **THEN** that diagram's `folderId` is cleared and it appears at the root
- **AND** diagrams inside existing folders are unchanged

#### Scenario: Migration runs twice

- **WHEN** the migration is applied to an already-migrated state
- **THEN** the state is unchanged

### Requirement: An unknown folder map never unfiles a diagram

Reparenting MUST distinguish "this folder does not exist" from "the set of folders is not
known". Given a null or undefined folder map, the reparenting helpers MUST return the diagram
unchanged rather than clearing `folderId`.

This rules out two failures. Throwing on the missing map aborts any caller that reads a folder
map it does not control — the File System boot swallows such a throw silently and the whole
workspace fails to hydrate. Treating it as an empty map is worse: it unfiles every diagram, and
on a connected workspace folder the sync then rewrites those files to the root on disk.

#### Scenario: Folder map is absent

- **GIVEN** a set of diagrams that carry `folderId` values
- **WHEN** reparenting runs with a null or undefined folder map
- **THEN** no error is raised
- **AND** every diagram keeps its `folderId`

### Requirement: The File System boot path does not reparent

The File System Access boot path MUST NOT apply orphan reparenting. Its folder map comes from
the workspace manifest, which is not validated for that field, and acting on an absent map
would rewrite the user's diagram files on disk. Import-time sanitisation and the persisted-state
migration cover the orphan case without touching a connected folder.

#### Scenario: Connected folder hydrates unchanged

- **GIVEN** a connected workspace folder whose manifest has no `folders` field
- **WHEN** the workspace is loaded at boot
- **THEN** the diagrams hydrate with their `folderId` values untouched
- **AND** the workspace loads normally

### Requirement: No new user-visible strings

This change MUST NOT introduce new translation keys. Recovering a diagram to the root is silent;
no toast, banner, or label is added.

#### Scenario: Import of an orphaned diagram is silent

- **WHEN** a diagram with an unknown `folderId` is imported successfully
- **THEN** the existing success behavior is unchanged and no new message is displayed

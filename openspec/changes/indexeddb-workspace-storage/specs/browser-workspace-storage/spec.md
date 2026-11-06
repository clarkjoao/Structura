# Spec Delta

## Purpose

Where the browser keeps the workspace, so that its size is bounded by the origin's quota instead
of `localStorage`'s ~5 MB, without losing data when it moves, when it is read, or when the tab
closes.

## ADDED Requirements

### Requirement: The workspace is stored in IndexedDB when available

When IndexedDB can be opened, the persisted diagram workspace MUST be read and written through an
`IndexedDbAdapter` implementing `IStoragePort`. Code outside `src/infrastructure/persistence/` MUST
NOT access IndexedDB or `localStorage` for the workspace (ADR-0007). The persisted payload and its
schema version MUST be identical to the one written to `localStorage` before this change.

#### Scenario: A workspace larger than localStorage

- **GIVEN** IndexedDB is available
- **WHEN** the workspace holds diagrams totalling more than 5 MB of JSON
- **THEN** the save succeeds and no quota error is reported
- **AND** after a reload the same workspace is loaded

#### Scenario: IndexedDB is unavailable

- **GIVEN** `indexedDB` is undefined, or opening the database fails or takes longer than 3 s
- **WHEN** the app starts
- **THEN** the workspace is read and written through `LocalStorageAdapter`, as before this change

### Requirement: An existing localStorage workspace is moved without loss

On start, if IndexedDB holds no workspace and `localStorage` holds one, the workspace MUST be
copied to IndexedDB, read back and compared with the source, and the `localStorage` copy MUST be
removed only when they are equal. If any step fails, the `localStorage` copy MUST be left untouched
and the session MUST use `LocalStorageAdapter`. If both stores hold a workspace, neither MUST be
deleted and the IndexedDB copy MUST be used.

#### Scenario: First start after the upgrade

- **GIVEN** `localStorage` holds `structura_diagram-store` and IndexedDB holds nothing
- **WHEN** the app starts
- **THEN** IndexedDB holds the same string
- **AND** `structura_diagram-store` is removed from `localStorage`
- **AND** the dashboard lists the same diagrams as before

#### Scenario: The copy does not read back equal

- **GIVEN** the record read back from IndexedDB differs from the source
- **WHEN** the migration checks it
- **THEN** `structura_diagram-store` stays in `localStorage`
- **AND** the session reads and writes `localStorage`

#### Scenario: Both copies exist

- **GIVEN** IndexedDB and `localStorage` both hold a workspace
- **WHEN** the app starts
- **THEN** the IndexedDB workspace is loaded
- **AND** the `localStorage` workspace is not deleted

### Requirement: Nothing is written before the workspace is read

The app MUST NOT render before the browser workspace boot has finished. The diagram store MUST NOT
write the workspace key before its first read of that key has resolved; writes requested earlier
MUST be dropped.

#### Scenario: A write during a slow read

- **GIVEN** reading the workspace from IndexedDB has not resolved yet
- **WHEN** the store is set
- **THEN** nothing is written to the workspace key
- **AND** once the read resolves, the stored workspace is loaded unchanged

### Requirement: The last edit survives closing the tab

When the page becomes hidden, a pending workspace write MUST be sent to IndexedDB. On `pagehide`
or `beforeunload` with a write still pending, it MUST also be written synchronously to the
`localStorage` key `structura_diagram-store:rescue` with its time, when it fits. On the next start,
a rescue newer than the IndexedDB record MUST replace it; any rescue MUST then be removed.

#### Scenario: Closing right after an edit

- **GIVEN** an edit whose debounced write has not flushed
- **WHEN** the tab is closed
- **THEN** after reopening, the edit is present

#### Scenario: A stale rescue

- **GIVEN** a rescue older than the IndexedDB record
- **WHEN** the app starts
- **THEN** the IndexedDB workspace is loaded
- **AND** the rescue key is removed

### Requirement: Folder sync keeps its browser backup

With a connected folder, the browser copy MUST keep being written as before (including `paused`
and force-save semantics), through whichever adapter the boot selected.

#### Scenario: Force-save while paused

- **GIVEN** a connected folder and `defaultStorage.paused` is true
- **WHEN** the workspace is force-saved
- **THEN** the browser copy is written to the selected adapter

### Requirement: The storage report reflects the real quota

With `IndexedDbAdapter`, the storage health MUST be computed from `navigator.storage.estimate()`:
warning at 80 % and danger at 95 % of the quota. Otherwise the existing `localStorage` measurement
and thresholds apply. Any new user-visible text MUST go through i18n (en and pt-BR).

#### Scenario: Large workspace in IndexedDB

- **GIVEN** the workspace is 6 MB and the origin quota is several GB
- **WHEN** storage health is checked
- **THEN** the level is normal

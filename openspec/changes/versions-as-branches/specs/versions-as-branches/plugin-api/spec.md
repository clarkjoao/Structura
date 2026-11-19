# Spec Delta

## Purpose

Plugins (the opscr pane first) own Versions: they create them from their own source, receive the
user's actions on them, and read what the canvas changed.

## ADDED Requirements

### Requirement: api.versions

The plugin API 1.14.0 SHALL expose `versions.list`, `upsert`, `remove`, `setActive` and `onAction`,
each accepting a target diagram. `upsert` SHALL find the Version by `key` (creating it), mark it
owned by the calling plugin and rebuild its content from the given diff against the current base,
recording base hashes for modified elements, as one history step.

#### Scenario: Upsert twice

- **WHEN** a plugin upserts key "remote-sessions" twice with different diffs
- **THEN** the diagram has one Version with that key, holding the second diff

### Requirement: Plugin-owned actions

For a plugin-owned Version, the panel's merge, rename and delete SHALL be delivered to the owner's
`onAction` handlers instead of changing the store.

#### Scenario: Merge an initiative

- **WHEN** the user clicks Merge on a plugin-owned Version
- **THEN** the plugin receives `{ type: "merge", key }` and the store is unchanged

### Requirement: Active version in snapshots

`getDiagram` SHALL report `activeVersion` (`id`, `key`, `status`) and return the components and
connections as the active Version resolves them.

#### Scenario: Read a Version

- **GIVEN** an active Version that renamed a base component
- **WHEN** a plugin calls `getDiagram`
- **THEN** the component has the new name and `activeVersion.key` is the Version's key

### Requirement: Sub-folders

`PluginFolder.list({ recursive: true })` SHALL return POSIX paths of files in sub-folders; `read`,
`write` and `stats` SHALL accept them; paths that leave the folder SHALL be rejected.

#### Scenario: Read an initiative file

- **WHEN** a plugin reads `initiatives/remote-sessions/initiative.opscr.yaml`
- **THEN** it gets the file's text; `../x` is rejected

### Requirement: Key across linked diagrams

Opening a linked diagram while a Version with a `key` is active SHALL activate the Version with the
same key in the target diagram, or its base when it has none.

#### Scenario: Drill down in an initiative

- **GIVEN** C1 and C2 each with a Version keyed "remote-sessions", active on C1
- **WHEN** the user drills down from C1 to C2
- **THEN** C2 opens with "remote-sessions" active

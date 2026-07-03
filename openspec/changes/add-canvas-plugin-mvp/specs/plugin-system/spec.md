# plugin-system Delta — Canvas Plugin MVP

## ADDED Requirements

### Requirement: Versioned API surface exposed to plugins

The `StructuraPluginApi` object passed to `activate` SHALL expose the API surface's own semver as
a readonly `apiVersion` property, starting at `1.0.0` for the Canvas Plugin MVP. The API version
SHALL be versioned independently from the application version, and manifest `apiVersion` ranges
SHALL be checked against this value at registration.

#### Scenario: apiVersion is readable and matches the checked version

- **GIVEN** an active plugin whose manifest declares `apiVersion: "^1.0"`
- **WHEN** its `activate(api)` runs
- **THEN** `api.apiVersion` is `"1.0.0"` (or a later `1.x`), the same value used for the
  registration compatibility check

### Requirement: Plugin load and activation failures are contained

The system SHALL reject, with a user-visible error, a plugin file that never calls `StructuraPlugin.define`, calls it more than once, or throws at top level, and SHALL NOT leave an install record or any registered contribution behind. If `activate` throws or rejects, the system SHALL roll back every contribution tracked for that plugin, mark the plugin as errored in the manager UI, and keep the application running.

#### Scenario: File without define is rejected cleanly

- **GIVEN** the user picks a JS file that executes without calling `StructuraPlugin.define`
- **WHEN** installation is attempted
- **THEN** the user sees an error, no install record is persisted, and no contribution is
  registered

#### Scenario: Throwing activate rolls back tracked contributions

- **GIVEN** a plugin whose `activate` registers a node type and then throws
- **WHEN** activation runs
- **THEN** the node type is removed from the registry, the plugin is shown as errored, and the
  application continues to function

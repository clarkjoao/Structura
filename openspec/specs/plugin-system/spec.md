# plugin-system Specification

## Purpose

The contract for third-party plugins (backlog item F-02 — originally in `TODO.md`, now in git history; draw.io-inspired): loading, validating, activating, and cleanly removing local-file plugins, and the registration guarantees of each versioned `StructuraPlugin.*` API method. The full RFC (manifest schema, lifecycle, API argument shapes, trust model, distribution, folder layout, DefectDojo/Mermaid validation walkthroughs) lives in `openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md`. Requirements here bind the future Canvas Plugin MVP implementation change (Phase 2).

## Requirements

### Requirement: Manifest validation gates plugin loading

The system SHALL validate a plugin's manifest before the plugin is installed, and SHALL NOT install or execute a plugin whose manifest is missing or invalid. A valid manifest MUST contain: a unique `id`, a `name`, a semver `version`, an `author`, a `description`, a semver-range `apiVersion` compatible with the current StructuraPlugin API version, and a `capabilities` array containing only known capability identifiers.

#### Scenario: Manifest missing required fields

- **GIVEN** the user selects a plugin file whose `define()` call provides a manifest without a `version` field
- **WHEN** installation is attempted
- **THEN** the plugin is not installed, no install record is persisted, none of its contributions are registered, and the user sees an error identifying the invalid/missing field

#### Scenario: Incompatible API version range

- **GIVEN** a plugin manifest declaring `apiVersion: "^9.0"` while the running StructuraPlugin API version is `1.x`
- **WHEN** installation is attempted
- **THEN** the plugin is not activated and the user sees an error stating the required and current API versions

#### Scenario: Duplicate plugin id

- **GIVEN** a plugin with id `structura-plugin-example` is already installed
- **WHEN** the user installs another file whose manifest has the same `id`
- **THEN** the system rejects it as a duplicate (or offers an explicit replace flow) and never has two active plugins with the same id

### Requirement: Explicit user consent before plugin execution

The system SHALL execute plugin code only after the user has explicitly installed the plugin via a deliberate file-selection action, and SHALL NOT load plugin code from any source without such prior consent. Consent given at install SHALL persist for subsequent application startups until the user disables or uninstalls the plugin. Before completing installation, the system SHALL display the manifest's declared capabilities to the user.

#### Scenario: No silent auto-load

- **GIVEN** a plugin file that has never been installed by the user
- **WHEN** the application starts
- **THEN** no code from that file executes

#### Scenario: Consent shown with declared capabilities

- **GIVEN** the user selects a plugin file whose manifest declares `["ui:panels", "network"]`
- **WHEN** the install flow runs
- **THEN** the declared capabilities are displayed to the user before installation completes

#### Scenario: Disabled plugin never executes

- **GIVEN** an installed plugin that the user has toggled to disabled
- **WHEN** the application starts
- **THEN** the plugin's code is not executed and none of its contributions are registered

### Requirement: registerNodeType contract

`StructuraPlugin.registerNodeType(descriptor)` SHALL, on success, make the descriptor's node type available on the canvas through the same registry mechanism as built-in node types (`registerDescriptor()`), with the catch-all descriptor remaining last in match order. The call SHALL throw on a duplicate `rfType`, mirroring the existing registry behavior. The system SHALL reject descriptors whose `rfType` or `componentType` is not namespaced with the plugin's id.

#### Scenario: Successful node type registration

- **GIVEN** an active plugin `structura-plugin-example` calling `registerNodeType` with `rfType: "structura-plugin-example/hexagon"` and a valid descriptor
- **WHEN** the call returns
- **THEN** the node type is resolvable by the canvas registry, renders via the provided component, and the catch-all descriptor still matches last

#### Scenario: Duplicate rfType registration throws

- **GIVEN** a node type with `rfType: "structura-plugin-example/hexagon"` is already registered
- **WHEN** any plugin calls `registerNodeType` with the same `rfType`
- **THEN** the call throws an error naming the conflicting `rfType` and the registry is unchanged

#### Scenario: Non-namespaced rfType rejected

- **GIVEN** an active plugin `structura-plugin-example`
- **WHEN** it calls `registerNodeType` with `rfType: "panel"`
- **THEN** the call throws and no built-in node type is shadowed

### Requirement: registerImporter contract

`StructuraPlugin.registerImporter(handler)` SHALL, on success, make the importer selectable for files matching its declared extensions (and `canImport` predicate, when provided). The call SHALL throw on a duplicate importer `id`. When an import runs, the handler SHALL receive the file contents and a read-only `ImportContext` (existing components, existing connections, anchor position) and SHALL return plain data (`components`, `connections`, `warnings`); the host SHALL normalize and commit the result through store actions with history support, and SHALL surface returned warnings to the user.

#### Scenario: Successful import through a plugin importer

- **GIVEN** an active plugin registered an importer for extension `mmd`
- **WHEN** the user imports a `.mmd` file and the handler returns two components and one connection
- **THEN** the diagram contains the new components and connection, a single undo step reverts the entire import, and any handler warnings are shown

#### Scenario: Duplicate importer id throws

- **GIVEN** an importer with id `mermaid-flowchart` is already registered
- **WHEN** any plugin calls `registerImporter` with the same `id`
- **THEN** the call throws and the existing importer remains in place

### Requirement: registerExporter contract

`StructuraPlugin.registerExporter(handler)` SHALL, on success, make the exporter selectable in the export UI with its declared label, extension, and MIME type. The call SHALL throw on a duplicate exporter `id`. When an export runs, the handler SHALL receive a read-only diagram snapshot and its returned content SHALL be delivered through the host's existing export/download flow.

#### Scenario: Successful export through a plugin exporter

- **GIVEN** an active plugin registered an exporter with id `plantuml`, extension `puml`
- **WHEN** the user exports the current diagram with that exporter
- **THEN** the handler receives a read-only snapshot of that diagram and the user receives a `.puml` file containing the handler's returned content

#### Scenario: Duplicate exporter id throws

- **GIVEN** an exporter with id `plantuml` is already registered
- **WHEN** any plugin calls `registerExporter` with the same `id`
- **THEN** the call throws and the existing exporter remains in place

### Requirement: registerPanel contract

`StructuraPlugin.registerPanel(section)` SHALL, on success, render the panel's component inside the declared host slot (`element-inspector` or `service-registry-import`), wrapped in an error boundary, receiving a `PluginPanelContext` with read-only snapshots and sanctioned mutation functions. The call SHALL throw on a duplicate panel `id`. A runtime error thrown by a plugin panel SHALL NOT break the hosting page.

#### Scenario: Successful panel registration

- **GIVEN** an active plugin registered a panel for slot `service-registry-import`
- **WHEN** the user opens the Service Registry import area
- **THEN** the plugin panel renders in that slot and receives a `PluginPanelContext`

#### Scenario: Crashing panel is contained

- **GIVEN** a registered plugin panel whose component throws during render
- **WHEN** the hosting page renders
- **THEN** the rest of the page renders normally and the failed panel area shows a localized error state

#### Scenario: Duplicate panel id throws

- **GIVEN** a panel with id `defectdojo-import` is already registered
- **WHEN** any plugin calls `registerPanel` with the same `id`
- **THEN** the call throws and the existing panel remains in place

### Requirement: onDiagramChange subscription contract

`StructuraPlugin.onDiagramChange(callback)` SHALL invoke the callback with the diagram id after each committed change to a diagram, and SHALL return an unsubscribe function that stops further invocations. Callbacks SHALL observe committed state only (not intermediate drag states).

#### Scenario: Callback fires on committed change

- **GIVEN** an active plugin subscribed via `onDiagramChange`
- **WHEN** the user renames a component and the change is committed to the store
- **THEN** the callback is invoked with that diagram's id

#### Scenario: Unsubscribe stops callbacks

- **GIVEN** a plugin that called the unsubscribe function returned by `onDiagramChange`
- **WHEN** a subsequent diagram change is committed
- **THEN** the callback is not invoked

### Requirement: No direct store or persistence access from plugin code

Plugin code SHALL interact with application state and persistence exclusively through the `StructuraPlugin.*` API. The API surface SHALL NOT expose the Zustand store, `IStoragePort` adapters, `localStorage`, or React Flow internals. Plugin persistence needs SHALL be served by the plugin-scoped `storage` API (namespaced per plugin id and backed by the application's persistence port), and plugin-initiated data changes SHALL be served by sanctioned mutation functions that apply history (`pushHistory`) before mutating.

#### Scenario: API surface exposes no internals

- **GIVEN** the API object passed to a plugin's `activate`
- **WHEN** its surface is enumerated
- **THEN** it contains only the documented `StructuraPlugin.*` members and no reference to the store, persistence adapters, or the React Flow instance

#### Scenario: Plugin storage is namespaced and port-backed

- **GIVEN** an active plugin `structura-plugin-example` calling `api.storage.set("config", value)`
- **WHEN** the value is persisted
- **THEN** it is stored through the application's persistence port under a key namespaced with the plugin id, and is not readable through another plugin's storage API

#### Scenario: Sanctioned mutation is undoable

- **GIVEN** a plugin panel calling `context.updateComponent(id, patch)`
- **WHEN** the patch is applied
- **THEN** history was pushed before the mutation and a single undo reverts it

### Requirement: Clean unregistration on deactivate and uninstall

When a plugin is deactivated or uninstalled, the system SHALL remove all contributions registered by that plugin — node types, importers, exporters, panels, and event subscriptions — restoring each registry to a state as if the plugin had never registered, while preserving all user data. Diagram components whose node type was provided by the removed plugin SHALL degrade to the `unknown` descriptor without data loss. On uninstall, the system SHALL additionally delete the plugin's install record and its scoped storage namespace.

#### Scenario: Deactivate removes all contributions

- **GIVEN** an active plugin that registered a node type, an importer, a panel, and an `onDiagramChange` subscription
- **WHEN** the user disables the plugin
- **THEN** the node type no longer resolves in the canvas registry, the importer and panel are no longer offered, and the callback is never invoked again

#### Scenario: Components degrade instead of corrupting

- **GIVEN** a saved diagram containing a component whose type was registered by a now-uninstalled plugin
- **WHEN** the diagram is opened
- **THEN** the component renders via the `unknown` descriptor, its persisted data is unchanged, and reinstalling the plugin restores its original rendering

#### Scenario: Uninstall deletes plugin storage

- **GIVEN** an installed plugin that persisted values via `api.storage`
- **WHEN** the user uninstalls the plugin
- **THEN** the plugin's install record and every key in its storage namespace are deleted

### Requirement: Plugin-management UI is internationalized

All user-visible text in host-owned plugin-management UI (plugin manager page, install/consent dialogs, error and degraded states, capability labels) SHALL be resolved through the i18n layer (`t()`) with entries in both `en` and `pt-BR` catalogs; hardcoded user-visible strings are not permitted. Plugin-provided display text (labels, titles) SHALL be accepted as either a plain string or a per-locale map resolved against the active locale.

#### Scenario: Host plugin UI uses i18n catalogs

- **GIVEN** the plugin manager page and its dialogs
- **WHEN** their user-visible strings are audited
- **THEN** every string resolves through `t()` and has entries in both `en.json` and `pt-BR.json`

#### Scenario: Plugin-provided localized label resolves by locale

- **GIVEN** a plugin contribution whose label is `{ en: "Findings", "pt-BR": "Achados" }`
- **WHEN** the UI renders with locale `pt-BR`
- **THEN** the label renders as "Achados", and a plain-string label would render as-is under any locale

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

### Requirement: Diagram read access returns read-only snapshots

The API SHALL expose `getActiveDiagramId()` returning the active diagram's id (or null) and
`getDiagram(diagramId?)` returning a read-only `DiagramSnapshot` of the requested diagram
(defaulting to the active one), or null when the diagram does not exist. Snapshots SHALL be
projections (including each component's `parentId`) and SHALL NOT expose store objects; use of
these methods is declared by the `diagram:read` capability.

#### Scenario: Reading the diagram after a change notification

- **GIVEN** an active plugin subscribed via `onDiagramChange`
- **WHEN** its callback receives a diagram id and calls `api.getDiagram(diagramId)`
- **THEN** it receives a read-only snapshot reflecting the committed state, with components,
  connections and `parentId` fields, and mutating the snapshot has no effect on the diagram

#### Scenario: Unknown diagram id

- **GIVEN** an active plugin
- **WHEN** it calls `api.getDiagram("no-such-id")`
- **THEN** the call returns null and nothing throws

### Requirement: Top-level diagram mutation is whitelisted and undoable

The API SHALL expose `updateComponent(componentId, patch)` applying only whitelisted component
fields to the active diagram through the sanctioned store action (history pushed before the
mutation), and `moveComponents(moves)` applying a batch of `{ id, x, y }` position changes as a
single history step. Both are declared by the `diagram:write` capability. Non-whitelisted patch
fields SHALL be dropped; moves referencing unknown component ids SHALL be ignored without
corrupting state.

#### Scenario: Plugin field patch is undoable

- **GIVEN** an active plugin calling `api.updateComponent(id, { name: "Renamed" })`
- **WHEN** the patch is applied
- **THEN** the component is renamed on the active diagram and a single undo restores the
  previous name

#### Scenario: Batch move is one history step

- **GIVEN** an active plugin calling `api.moveComponents([{ id: a, x: 0, y: 0 }, { id: b, x: 260, y: 0 }])`
- **WHEN** the moves are applied
- **THEN** both components occupy their new positions and a single undo restores both previous
  positions

#### Scenario: Non-whitelisted fields are dropped

- **GIVEN** an active plugin calling `api.updateComponent(id, { name: "Ok", parentId: "hijack" })`
- **WHEN** the patch is applied
- **THEN** the name changes and `parentId` is unchanged

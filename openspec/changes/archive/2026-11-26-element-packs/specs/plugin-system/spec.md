# Spec Delta

## ADDED Requirements

### Requirement: registerElementPack contract

With the `canvas:elements` capability, `api.registerElementPack(pack)` SHALL register an element
pack in the element-pack format, with its icons given inline as SVG strings keyed by icon name.
The pack's `id` SHALL equal the plugin's id; otherwise the call throws and nothing is
registered. An invalid pack SHALL throw with the same errors a built-in pack would. On success
the pack's categories, services and shapes SHALL be offered in every surface a built-in pack's
are, without reloading the app. The API version SHALL be `1.17.0`.

#### Scenario: Plugin adds a family

- **GIVEN** an active plugin `acme-cloud` with capability `canvas:elements`
- **WHEN** it calls `registerElementPack` with a pack `acme-cloud` holding category `compute`
  and service `vm`
- **THEN** the element catalog shows an "Acme Cloud" group with "VM", and inserting it creates a
  node of type `acme-cloud/compute`

#### Scenario: Pack id must match plugin id

- **WHEN** plugin `acme-cloud` calls `registerElementPack` with a pack whose id is `aws`
- **THEN** the call throws and no element is registered

### Requirement: registerShape contract

With the `canvas:elements` capability, `api.registerShape(shape)` SHALL register one SVG shape
in the element-pack shape format as element type `<pluginId>/<shapeId>`, offered in the plugin's
palette group (labelled with the plugin's name when the plugin registered no pack). A duplicate
shape id SHALL throw. A shape outline SHALL accept only SVG path data, and pack icons SHALL
pass the SVG sanitizer.

#### Scenario: Plugin adds a shape

- **GIVEN** an active plugin `acme-cloud`
- **WHEN** it calls `registerShape` with id `cylinder-3d`, a label and an SVG outline
- **THEN** the shape is offered in the palette and inserting it renders the outline with the
  node's name inside

## MODIFIED Requirements

### Requirement: Clean unregistration on deactivate and uninstall

When a plugin is deactivated or uninstalled, the system SHALL remove all contributions registered by that plugin — node types, element packs, shapes, importers, exporters, panels, and event subscriptions — restoring each registry to a state as if the plugin had never registered, while preserving all user data. Diagram components whose node type, pack element or shape was provided by the removed plugin SHALL degrade to the `unknown` descriptor without data loss. On uninstall, the system SHALL additionally delete the plugin's install record and its scoped storage namespace.

#### Scenario: Deactivate removes all contributions

- **GIVEN** an active plugin that registered a node type, an element pack, a shape, an importer, a panel, and an `onDiagramChange` subscription
- **WHEN** the user disables the plugin
- **THEN** the node type, the pack's elements and the shape no longer resolve, they are no longer offered in the palette or element catalog, the importer and panel are no longer offered, and the callback is never invoked again

#### Scenario: Components degrade instead of corrupting

- **GIVEN** a saved diagram containing a component whose type was registered by a now-uninstalled plugin
- **WHEN** the diagram is opened
- **THEN** the component renders via the `unknown` descriptor, its persisted data is unchanged, and reinstalling the plugin restores its original rendering

#### Scenario: Uninstall deletes plugin storage

- **GIVEN** an installed plugin that persisted values via `api.storage`
- **WHEN** the user uninstalls the plugin
- **THEN** the plugin's install record and every key in its storage namespace are deleted

# Spec Delta

## ADDED Requirements

### Requirement: Document pane slot

A plugin with the `ui:panels` capability SHALL be able to register a panel in the `document-pane`
slot. The host SHALL offer each such panel as a toggle in the canvas toolbar, render the open one
docked beside the canvas inside an error boundary, and keep the canvas usable while it is open.

#### Scenario: Opening a document pane

- **GIVEN** a plugin registered a `document-pane` panel titled "opscr"
- **WHEN** the user clicks its toolbar toggle
- **THEN** the panel renders beside the canvas, and clicking the toggle again closes it

#### Scenario: A failing pane does not break the workspace

- **WHEN** the document pane's component throws while rendering
- **THEN** the pane shows an error state and the canvas keeps working

### Requirement: Host code editor for plugins

The API SHALL expose the host's code editor as `api.ui.CodeEditor`, a React component taking a
value, a language, an optional change callback, an optional read-only flag and optional problem
markers (line, message, severity), so a plugin can edit text without bundling an editor.

#### Scenario: Markers on lines

- **GIVEN** a plugin renders `CodeEditor` with a marker on line 3
- **WHEN** the editor mounts
- **THEN** line 3 shows the marker's message with its severity

### Requirement: Folder access for plugins

A plugin with the `files:folder` capability SHALL be able to ask the user to pick a folder under a
binding id, list its files, read and write UTF-8 text files in it, and get the same folder back in
a later session under the same binding id after the user grants permission again. Paths SHALL be
file names inside the picked folder; anything that escapes it SHALL be rejected. The directory
handle SHALL never be exposed to plugin code.

#### Scenario: Remembered folder

- **GIVEN** a plugin picked a folder under binding id `d1` and the page reloads
- **WHEN** the plugin opens binding `d1` again and the user grants permission
- **THEN** it reads the same folder's files without picking it again

#### Scenario: Escaping the folder

- **WHEN** a plugin reads or writes `../secret.txt` or `sub/../../x`
- **THEN** the call is rejected and nothing outside the folder is touched

### Requirement: Batched diagram changes

With the `diagram:write` capability, `api.applyChanges` SHALL add components (importer component
shape: key, type, name, parent key, catalog service, technology, position, size), update their
name, description, technology and catalog service, move and remove components, and add and remove
connections in the active diagram as a single history step, returning the id created for each key.
It SHALL apply the same type policy and normalization as importers, and ignore changes to ids that
do not exist.

#### Scenario: One undo

- **GIVEN** a call that adds two components and a connection, updates one and removes another
- **WHEN** the user undoes once
- **THEN** the diagram is back to how it was before the call

#### Scenario: Unknown ids

- **WHEN** a call removes or updates an id that is not in the diagram
- **THEN** that change is ignored and the rest applies

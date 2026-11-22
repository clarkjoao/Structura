# diagram-kind Specification

## Purpose

Diagram kinds let the editor guide the construction of a particular kind of diagram while the
diagram itself stays an ordinary diagram. This capability owns the kind contract and the kind
fields, the freehand round trip, and how every existing surface treats a diagram that has a kind.

## Requirements

### Requirement: Kinds register through one validated contract

Diagram kinds SHALL be registered through a single registry. A kind contribution SHALL be plain
data plus functions, and SHALL be validated at registration: a duplicate id, an id that is not
lowercase kebab-case (built-ins) or `pluginId:kind-id` (contributed), or a missing conformance
check SHALL fail the registration loudly and leave the registry unchanged. Built-in kinds SHALL
register through the same registry and contract that contributed kinds will use. With no kind
registered, the editor SHALL behave exactly as before this change.

#### Scenario: Duplicate id is refused

- **WHEN** a second kind registers with the id `guided`
- **THEN** registration fails with an error naming the id, and the first kind stays registered

#### Scenario: Zero kinds

- **WHEN** the editor runs with no kind registered
- **THEN** creating, editing, saving and exporting diagrams behaves as before this change, and the new-diagram dialog offers no kind choice

### Requirement: A kind may use any registered element type

A kind SHALL declare the element types (and variants) its palette offers. These MAY include
element types registered by plugins. A kind's conformance check SHALL treat an element whose type
is not registered (shown as unknown) as non-conforming rather than fail.

#### Scenario: Plugin element in a kind

- **WHEN** a kind declares a plugin's element type and that plugin is active
- **THEN** the kind's palette offers it and inserting it works like any built-in element

### Requirement: The kind is metadata over an ordinary diagram

A diagram SHALL carry an optional kind id, an optional kind mode, and an optional kind data
object. When the kind is absent the diagram SHALL be freehand and SHALL behave, save, hash and
export exactly as before this change. The content of a kind diagram SHALL use only elements,
connections and flows that a freehand diagram can hold. The viewer, shared links, every exporter
and persistence SHALL NOT depend on the kind being registered. Kind data SHALL be a JSON object
owned by the kind, no larger than 64 KB serialized, carried unchanged by every save, import,
export, duplication, collaboration snapshot and Version, and SHALL NOT be interpreted by
anything except its kind. Code SHALL test kinds through type guards and the registry, never by
comparing raw strings.

#### Scenario: Existing diagrams stay freehand

- **WHEN** a workspace saved before this change is loaded
- **THEN** every diagram has no kind, behaves as freehand, and its content hash is unchanged

#### Scenario: Kind survives a reload

- **WHEN** a guided diagram is saved and the workspace is reloaded
- **THEN** it is still guided, in the same mode, with the same kind data

### Requirement: An unavailable kind is kept, not dropped

A diagram whose kind id is well-formed but not registered (for example, the contributing plugin is
not installed) SHALL keep its kind id, kind mode and kind data untouched through loads, edits and
saves. It SHALL open in the freehand editor with a notice naming the kind as unavailable. When
the kind becomes available, the diagram SHALL be offered the return to its kind like any other
kind diagram. A malformed kind id, mode or data SHALL be dropped on import without preventing the
rest of the diagram from loading.

#### Scenario: Missing plugin kind

- **WHEN** a diagram with kind `acme-vsm:value-stream` is opened and no such kind is registered
- **THEN** it opens freehand with a notice, is editable, and after saving still has kind `acme-vsm:value-stream`

#### Scenario: Malformed kind

- **WHEN** a diagram file has kind `42` or kind data that is a string
- **THEN** the field is dropped and the diagram loads

### Requirement: The kind is chosen at creation

The new-diagram dialog SHALL offer Freehand, preselected, and each registered kind that can be
created. Creating a kind diagram SHALL apply the kind's creation template as part of the creation.
The diagram SHALL start in the kind's mode.

#### Scenario: Default stays freehand

- **WHEN** the author creates a diagram without touching the kind choice
- **THEN** the diagram is freehand and has no kind stored

### Requirement: A kind diagram can be edited freehand and returned

A kind diagram in kind mode SHALL offer "Edit freehand". Switching SHALL store the freehand kind
mode, give the full freehand editor (all elements, free positioning, recording flows, Manual or
Automatic arrangement), pause the kind's arrangement, derivation, keymap and checks, and keep the
kind id and kind data. It SHALL be one undo step and SHALL move nothing.

A kind diagram in freehand mode SHALL offer "Back to <kind>". It SHALL run the kind's conformance
check on the diagram as it stands. When the check passes, the kind mode SHALL be restored and the
kind's arrangement and derivation SHALL run, all as one undo step. When the check fails, nothing
SHALL change, and the issues SHALL be listed, each one naming the element it concerns and
selecting it on the canvas when clicked.

#### Scenario: Round trip that conforms

- **WHEN** the author switches a guided diagram to freehand, renames two steps, adds a step inside a lane and connects it, then chooses "Back to guided"
- **THEN** the diagram is guided again, re-arranged, its derived flow includes the new step, and one undo returns to the freehand state

#### Scenario: Round trip that does not conform

- **WHEN** the author, in freehand mode, drops a cloud element outside any lane and chooses "Back to guided"
- **THEN** the diagram stays freehand, an issue names that element, and clicking the issue selects it

#### Scenario: Freehand switch moves nothing

- **WHEN** the author chooses "Edit freehand"
- **THEN** no element moves and the undo stack gains exactly one entry

### Requirement: Existing surfaces keep working on kind diagrams

- Plugin diagram snapshots SHALL include the kind id and mode, read-only.
- A plugin structural write (`applyChanges`) to a diagram in kind mode SHALL be accepted and
  followed by the kind's arrangement and derivation in the same undo step.
- A plugin position write (`moveComponents`, or moves inside `applyChanges`) to a diagram in kind
  mode SHALL leave positions unchanged and report the refusal with a reason the plugin can read.
- In freehand mode, plugin writes SHALL behave exactly as on a freehand diagram.
- A diagram created by a plugin SHALL be freehand.
- A plugin panel contribution MAY declare which kinds it applies to. A panel that declares none
  SHALL appear as it does today.
- Assistant patches, pastes and edits made inside an active Version SHALL go through the same
  post-edit path as local edits, and in an active Version their positions SHALL be written to
  that Version.
- In a collaboration session, the kind's arrangement and derivation SHALL run only on the editor
  that made the edit, and a peer's mode switch SHALL be adopted as received.

#### Scenario: Plugin moves a step

- **WHEN** a plugin calls `moveComponents` for a step of a diagram in guided mode
- **THEN** the step does not move and the plugin receives a refusal reason stating that the kind controls layout

#### Scenario: Plugin adds a step

- **WHEN** a plugin uses `applyChanges` to add a step inside a lane of a guided-mode diagram and connect it
- **THEN** the step is placed by the guided arrangement and appears in the derived flow, in one undo step

#### Scenario: Panel scoped to a kind

- **WHEN** a plugin panel declares that it applies to `guided` only
- **THEN** it shows in the inspector of guided diagrams and not of freehand ones

### Requirement: Read-only surfaces render a kind diagram as drawn

The read-only viewer, shared links and exports SHALL render a kind diagram from its stored
positions, exactly like a freehand one, and SHALL NOT need the kind to be registered.

#### Scenario: Viewer without the kind

- **WHEN** a guided diagram is opened through a share link in a build where the guided kind is not registered
- **THEN** its lanes and steps appear where they were placed, and its flow can be read

### Requirement: Kind text is translated and history is kept

Every user-visible string introduced for diagram kinds (dialog choices, mode switch, notices,
conformance issues) SHALL go through the translation layer and SHALL exist in both `en` and
`pt-BR`. A contributed kind's labels SHALL accept localized text the way plugin panels do. Mode
switches SHALL record their undo checkpoint before mutating.

#### Scenario: Locale coverage

- **WHEN** the i18n coverage test runs
- **THEN** every new diagram-kind key exists in both locales

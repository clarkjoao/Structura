# Proposal

## Why

Item 2 of the opscr integration: edit the YAML inside Structura and watch the canvas follow, on the
same files the VSCode preview and Claude Code edit (`.grill/opscr-yaml-diagram-integration.md`). The
importer creates a one-off copy; the preview cannot be edited. A diagram _bound_ to an opscr folder
is the base the bidirectional milestone (canvas → YAML patches, rename, chat) builds on, and it
needs four things plugins cannot do today: show a text editor beside the canvas, read and write a
folder the user chose, and change a diagram in place — add, update and remove what a file
declares — as one undo step.

## What Changes

- **Plugin API 1.4.0** (additive):
  - `document-pane` panel slot: a plugin panel docked beside the canvas, opened and closed from the
    canvas toolbar.
  - `api.ui.CodeEditor`: the host's Monaco editor as a React component (value, language, change
    callback, problem markers), so plugins do not bundle Monaco.
  - `files:folder` capability, `api.files`: pick a folder, list, read and write its text files,
    remembered across sessions per plugin and binding id. Plugins never touch the directory handle.
  - `api.applyChanges(changes)`: add (with nesting and catalog fields, as importer components),
    update, move and remove components and connections in the active diagram as one history step,
    returning the ids of what it created.
- **opscr plugin:** _Bind to opscr folder_ turns the active diagram into the projection of a folder:
  the document pane lists its manifests, edits them in the host editor with opscr problems as
  markers, saves them back to disk, and syncs the canvas as you type — elements the user moved stay
  where they were put, new ones are placed by the stable layout, removed ones disappear.

## Non-Goals

- Canvas → YAML (edits on the canvas are overwritten by the next sync of an element the YAML
  declares — except positions, which the canvas owns). That is the next change.
- The layout sidecar file: positions live in the Structura diagram for now.
- Watching the folder for changes made outside Structura (VSCode, git). A _Reload_ action re-reads it.
- Rename (F2) and the chat context.
- Any change to the existing importer, preview or VSCode extension behaviour.

## Capabilities

### New Capabilities

- `opscr-text-editing`: editing an opscr folder's YAML in Structura with the bound diagram kept in
  sync.

### Modified Capabilities

- `plugin-system`: adds the `document-pane` slot, the host code editor, folder access and batched
  diagram changes to the plugin API.

## Impact

- Host: `features/plugins` (types, API facade, panel slot UI, apply-changes), a folder-access module
  under `infrastructure/persistence`, a `DocumentPaneSlot` in the workspace page, i18n (en, pt-BR).
- `plugins/structura-plugin-opscr`: becomes a React plugin with a document pane.
- Synced plugin type copies; `plugins/README.md`; `CHANGELOG.md`.

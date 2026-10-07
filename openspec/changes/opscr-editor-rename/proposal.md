# Proposal

## Why

The grill decided that the name is the identity and that the in-platform editor offers F2 "Rename
symbol" (`.grill/opscr-yaml-diagram-integration.md`). A rename typed by hand in the text changes
the element's key, so the canvas replaces it (losing its place) and every edge end naming it
dangles. Canvas renames already patch every reference; the editor needs the same.

## What Changes

- **Plugin API 1.5.0** (additive): `api.ui.CodeEditor` takes `rename: { resolve(offset), rename(offset,
newName) }`. F2 opens Monaco's rename box on the symbol the plugin resolves; the plugin applies
  the rename itself and may refuse with a message. The provider answers only for its own editor.
- **opscr plugin:** F2 on a manifest's `metadata.name` or an edge end's `id` renames the element
  in every file (same patch as a canvas rename) and re-keys the binding, so the canvas element is
  renamed in place, keeping its position and children.

## Non-Goals

- Renaming other symbols (labels, Relationship-only references outside `spec.edges`).

## Capabilities

### Modified Capabilities

- `plugin-system`: the host code editor offers plugin-answered rename.
- `opscr-text-editing`: F2 renames an element everywhere.

## Impact

- Host: `PluginCodeEditor` + `editor-rename.ts`, plugin types, i18n (en, pt-BR), API 1.5.0, synced
  plugin type copies, `plugins/README.md`, `CHANGELOG.md`.
- `plugins/structura-plugin-opscr`: `nameAt`, `renameInBinding`, pane wiring, e2e (0.5.0).

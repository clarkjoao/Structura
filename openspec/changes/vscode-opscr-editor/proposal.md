# Proposal

## Why

The moonshot of the opscr integration: edit `.opscr.yaml` in VSCode and see the diagram — and edit
the diagram there too. The grill first kept VSCode read-only because Structura had no embeddable
editable canvas (`.grill/opscr-yaml-diagram-integration.md`). Since then the platform side has
everything a bidirectional binding needs — canvas → YAML patches, undo across both sides, the layout
sidecar, palette and reparenting — but it lives in the plugin's document pane. VSCode users, and the
Claude Code sessions working in the same folder, should get the same editor without leaving it.

## What Changes

1. **Editable embed** (`embed-editor.html`, built with the preview): the full Structura canvas on an
   in-memory diagram, driven over `postMessage` like a remote plugin API — the host applies batched
   changes and receives a snapshot after every committed change (canvas edits, undo/redo).
2. **Shared binding engine**: the plugin's pure modules (YAML text patches, sync plan, reconcile,
   tombstones, folder watch merge, palette adoption) move to `src/lib/opscr-sync`, synced into the
   plugin and the extension (ADR-0009), and the pane's orchestration becomes a headless
   `OpscrEngine` with ports (files, diagram, storage) that both the pane and the extension use.
3. **VSCode editor**: "opscr: Open Diagram Editor" opens the folder's workspace in the editable
   embed. The extension host runs the engine: files are the VSCode documents (unsaved text
   included; canvas edits are `WorkspaceEdit`s, so they are undoable and saved by VSCode), the
   diagram is the webview, the binding lives in the workspace state, and the layout sidecar is
   written next to the manifests.

## Non-Goals

- The chat, the plugin document pane and the palette's Kind list inside VSCode (v1 uses the canvas's
  own element panel; Claude Code is the assistant there).
- Several editors on the same folder at once.

## Capabilities

### Modified Capabilities

- `opscr-preview`: the VSCode extension also offers an editable diagram of a folder.

## Impact

- Host: `src/embed/editor/*`, `embed-editor.html`, embed build; `src/lib/opscr-sync` (moved from the
  plugin), sync scripts.
- Plugin: imports the engine, pane becomes a view over it.
- Extension: new editor panel, engine wiring, e2e.

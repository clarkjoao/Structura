# Proposal

## Why

On regular diagrams the chat's additions arrive as pending: highlighted on the canvas with Keep /
Discard. On an opscr-bound diagram (API 1.6) the chat's change lands directly and silently — the
user has to find what changed, and undoing it means editing the text by hand.

## What Changes

- **Plugin API 1.7.0** (additive): `PluginChatTurnResult.preview` — the components and connections
  a reply created or changed, a title, and optional `keep` / `discard` handlers. The host shows
  them with the existing pending treatment (highlight, Keep/Discard toolbar, suggestion card) and
  fits the canvas to them. Keep calls `keep`; Discard calls `discard`, which may refuse with a
  message (shown as a toast; the change is then kept). Without `discard`, Discard is not offered.
  A new message on that diagram keeps the plugin's previous pending reply.
- **opscr plugin:** after applying a reply it waits for the canvas sync and returns as preview the
  elements it added or replaced and the new connections. Discard restores the manifests to their
  text before that reply — refused once the text has changed since (typed or canvas edits), so
  later work is never thrown away.

## Non-Goals

- Discarding part of a reply (documents can depend on each other).
- Changing the built-in JSON-patch flow.

## Capabilities

### Modified Capabilities

- `plugin-system`: plugin chat replies can be previewed as pending changes.
- `opscr-text-editing`: chat changes are highlighted and can be discarded.

## Impact

- Host: plugin types, `features/llm` (store, plugin turn), canvas pending toolbar and focus.
- `plugins/structura-plugin-opscr`: session apply returns what changed; chat context preview.

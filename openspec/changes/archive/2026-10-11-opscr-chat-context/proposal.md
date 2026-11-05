# Proposal

## Why

Item 3 of the opscr integration: on a diagram bound to an opscr folder, the Structura chat should
edit the YAML with the opscr-architect skill as context, validated by `opscr/core` with an
error-feedback loop — an edit assistant, not the skill's interview
(`.grill/opscr-yaml-diagram-integration.md`). Today the chat only knows Structura's own diagram
patches, which a sync from the YAML would undo on a bound diagram.

## What Changes

- **Plugin API 1.6.0** (additive), capability `llm:context`: `api.registerChatContext({ id,
appliesTo(diagramId), systemPrompt(input), handleReply(text, input) })`. When a registered
  context applies to the active diagram, the chat uses its system prompt instead of the diagram
  one, hands it the model's full reply, shows the reply text it returns, and — when it asks for a
  retry (e.g. validation errors) — sends that back to the model, up to 3 attempts in one turn.
  Regular diagrams keep the current path.
- **opscr plugin:** while a bound folder is open in the pane, the chat answers with the skill
  (generated from the opscr package at build time) and the current manifests as context. The model
  writes whole manifest documents in fenced `yaml file=…` blocks (a document with an existing
  `Kind/name` replaces it in place) and deletions in an `opscr-delete` block; the plugin applies
  them to the pane's buffers as text patches, validates with `opscr/core`, and asks the model to
  fix errors it introduced. The result is unsaved text, synced to the canvas like a typed edit.

## Non-Goals

- Accept/reject previews for plugin replies (the edit is unsaved and undoable instead).
- Chat context when the pane is closed or the folder not connected.
- Tool use / multi-step agents; the skill's interview workflow.

## Capabilities

### Modified Capabilities

- `plugin-system`: plugins can provide the chat's context for diagrams they own.
- `opscr-text-editing`: the chat edits a bound folder's YAML.

## Impact

- Host: `features/plugins` (types, API, chat-context registry, capability), `features/llm` (a
  plugin turn with retries), `plugins/README.md`, `CHANGELOG.md`, synced plugin types.
- `plugins/structura-plugin-opscr`: skill bundling script, reply parser/applier, chat context,
  pane session.

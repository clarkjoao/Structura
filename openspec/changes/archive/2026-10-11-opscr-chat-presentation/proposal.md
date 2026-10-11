# Proposal

## Why

When the opscr plugin owns the chat of a bound diagram (API 1.6), the chat still introduces itself
as "Diagram assistant" with suggestions about AWS reviews: nothing tells the user that messages now
edit the YAML folder.

## What Changes

- **Plugin API 1.8.0** (additive): `PluginChatContext.presentation({ diagramId, locale })` returns a
  title, a subtitle and suggestions; `PluginChatContext.subscribe(listener)` tells the host when
  `appliesTo` or the presentation may have changed. The chat header and empty state use them while
  the context applies, and follow it as it starts or stops applying.
- **opscr plugin:** the chat is "opscr · <folder>", says it edits the manifests, and suggests opscr
  edits (cache, events, rule review, missing owners), in en and pt-BR. It notifies the host when the
  pane opens or closes a folder.

## Capabilities

### Modified Capabilities

- `plugin-system`: plugin chat contexts can present the chat.

## Impact

- Host: plugin types, chat-context registry (change notifications), a presentation hook, the chat
  panel header and empty state. Plugin: session change events, presentation, i18n.

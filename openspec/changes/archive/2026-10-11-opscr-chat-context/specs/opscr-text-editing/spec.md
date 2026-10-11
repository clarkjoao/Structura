# Spec Delta

## ADDED Requirements

### Requirement: The chat edits the bound YAML

While a bound folder is open in the opscr pane, a chat message on that diagram SHALL be answered
with the opscr skill and the folder's manifests as context, and the manifests the model writes or
deletes SHALL be applied to the pane's text as patches, validated by opscr, with new errors sent
back to the model to fix.

#### Scenario: Adding a cache through the chat

- **WHEN** the user asks the chat to add a Redis cache that `orders-api` reads
- **THEN** a Cache manifest and the edge appear in the text (unsaved) and on the canvas, other
  manifests unchanged

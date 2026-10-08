# Spec Delta

## ADDED Requirements

### Requirement: Editable diagram in VSCode

The VSCode extension SHALL open an editable diagram of an opscr folder's workspace. Edits of the
manifests in VSCode editors SHALL update the diagram as they are typed, and edits on the diagram
SHALL be applied to the manifests' documents as undoable edits, using the same rules as the
Structura platform (patches, not regeneration; name is identity; positions in the layout sidecar).

#### Scenario: Rename on the diagram

- **GIVEN** the editor is open on the opscr sample
- **WHEN** the user renames `orders-db` on the diagram
- **THEN** the open `commerce.opscr.yaml` and `relationships.opscr.yaml` documents read `order-store`
  as unsaved edits, and VSCode's undo reverts them

#### Scenario: Typing in the YAML

- **WHEN** the user adds a Cache manifest in a VSCode editor
- **THEN** the diagram shows the Cache without saving

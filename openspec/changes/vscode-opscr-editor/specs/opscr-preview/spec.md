# Spec Delta

## ADDED Requirements

### Requirement: The preview draws only validated YAML

The VSCode preview SHALL draw the folder's workspace only when opscr validates it without errors,
whether the change was typed, saved or written to disk by another tool. While the YAML does not
parse or has errors, the preview SHALL keep its last valid picture and say why in the status bar;
warnings SHALL NOT block. Elements already drawn keep their place and new ones are laid out
automatically.

#### Scenario: Claude Code writes a file

- **GIVEN** an open preview of the opscr sample
- **WHEN** another tool writes a valid `search.opscr.yaml` to the folder
- **THEN** the preview draws `search-api` without the file being opened

#### Scenario: An edit with an opscr error

- **WHEN** the user adds a manifest with an unknown field
- **THEN** the preview keeps its picture, the error is in the Problems panel and the status bar says
  the preview is not updated

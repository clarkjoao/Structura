# Spec Delta

## ADDED Requirements

### Requirement: Preview uses the layout sidecar

The VSCode preview SHALL seed its layout with the folder's `opscr.layout.json` when present, and
re-apply it when the file changes; elements it does not list are placed by the stable layout.

#### Scenario: Sidecar written by Structura

- **GIVEN** an open preview
- **WHEN** Structura saves a sidecar that moves `orders-db`
- **THEN** the preview redraws `orders-db` at the sidecar's position

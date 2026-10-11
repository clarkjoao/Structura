# Spec Delta

## ADDED Requirements

### Requirement: Layout sidecar

The bound diagram's arrangement SHALL be kept in `opscr.layout.json` in the bound folder, keyed by
`Kind/name`, rewritten from the canvas after each sync or canvas change and saved with the
manifests. Elements the canvas does not have yet SHALL be placed at their sidecar box when the
sidecar has one.

#### Scenario: Restoring the arrangement

- **GIVEN** a folder whose sidecar places `orders-db` at (900, 300)
- **WHEN** an empty diagram is bound to the folder
- **THEN** `orders-db` is drawn at (900, 300)

#### Scenario: Dragging updates the sidecar

- **WHEN** the user drags `public-api` and saves
- **THEN** the sidecar on disk holds `public-api`'s new position, and a rename on the canvas
  re-keys its entry

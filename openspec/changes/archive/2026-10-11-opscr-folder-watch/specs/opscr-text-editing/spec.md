# Spec Delta

## ADDED Requirements

### Requirement: The pane follows outside changes

While a bound folder is open, changes made to it outside Structura SHALL reach the pane within a
few seconds: unchanged-in-Structura files reload and the canvas syncs, new and removed files appear
and disappear, and a file with unsaved edits SHALL keep them and offer the folder's version or the
user's. A changed layout sidecar SHALL move the canvas to it.

#### Scenario: Edited in another editor

- **GIVEN** `finance.opscr.yaml` has no unsaved edits in Structura
- **WHEN** another editor adds a Storage manifest to it
- **THEN** the Storage appears on the canvas without a reload

#### Scenario: Edited on both sides

- **GIVEN** `commerce.opscr.yaml` has unsaved edits
- **WHEN** another editor changes it
- **THEN** the pane keeps the unsaved edits and shows the conflict with both choices

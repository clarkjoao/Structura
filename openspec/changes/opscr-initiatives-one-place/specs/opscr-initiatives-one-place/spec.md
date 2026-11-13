# Spec Delta

## ADDED Requirements

### Requirement: Initiatives are managed in the Versions panel

The Versions panel SHALL let the user set the status of a plugin-owned Version; the change SHALL be
delivered to the owning plugin (`{ type: "status", key, status }`) instead of written to the store.
The opscr pane SHALL write it to the Initiative's `spec.status`. The pane's initiative list SHALL
show each initiative's title, status, lock issues with "Accept root", and Promote — and no status
select, Show, New initiative or Show root.

#### Scenario: Status from the Versions panel

- **WHEN** the user sets an initiative's Version to Done in the Versions panel
- **THEN** the initiative's `spec.status` becomes `done` in the buffers, and the Version shows it

### Requirement: Promote previews first

Promoting an initiative, from the pane or from Merge in the Versions panel, SHALL first show what it
does: elements added, changed and retired, edges added and removed, and files written and deleted.
Confirm SHALL apply it to the buffers; Cancel SHALL change nothing. A refused promote SHALL show the
reasons, and offer to mark the initiative done when that is the only one.

#### Scenario: Merge opens the preview

- **GIVEN** a done initiative
- **WHEN** the user chooses Merge on its Version
- **THEN** the pane shows the preview, and nothing is written until Confirm

#### Scenario: Not done yet

- **GIVEN** an initiative in progress
- **WHEN** the user asks to promote it
- **THEN** the preview lists what it would change, says it must be done first, and offers "Mark as done"

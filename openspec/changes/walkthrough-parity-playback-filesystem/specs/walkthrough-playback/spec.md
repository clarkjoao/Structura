## Purpose

How a reader moves through a walkthrough: forward and back within the flow of one scene,
across the boundary into the next scene, and what a step waiting on a branch does to both.
One key means "forward" everywhere, and the reader is always told when a scene has run out.

## ADDED Requirements

### Requirement: One key walks the whole walkthrough

The forward key SHALL advance the reading by one step while the scene's flow has a next
step, and SHALL carry the reader into the next scene once it does not. The reader SHALL NOT
have to learn a second key to reach the end of a walkthrough.

The back key SHALL mirror this: it walks back one step while the reading has history, and
reaches back into the previous scene once it does not.

#### Scenario: Walking inside a scene

- **GIVEN** a walkthrough playing a scene whose flow is on a step that has a next step
- **WHEN** the forward key is pressed
- **THEN** the reading advances to that next step
- **AND** the walkthrough stays on the same scene

#### Scenario: Reaching the end of a scene's flow

- **GIVEN** a walkthrough playing a scene whose flow is on its last step
- **WHEN** the forward key is pressed
- **THEN** the reading does not advance
- **AND** the scene boundary is announced to the reader

#### Scenario: Crossing into the next scene

- **GIVEN** a walkthrough whose scene boundary has been announced
- **WHEN** the forward key is pressed again
- **THEN** the walkthrough moves to the next scene
- **AND** that scene's flow begins at its own first step

### Requirement: A branch point is not an ending

A step that waits on a branch has no next step, but it is a choice the reader has not made
yet, not the end of the scene. The forward key SHALL NOT pick a branch and SHALL NOT
announce the scene boundary while the reading is stopped at one.

This restates, for the walkthrough player, the rule the shared reading already holds: at a
branch point the forward key takes no way.

#### Scenario: Forward at a branch point does nothing

- **GIVEN** a walkthrough playing a scene whose reading is stopped at a branch point
- **WHEN** the forward key is pressed
- **THEN** no branch is taken
- **AND** the scene boundary is not announced
- **AND** the walkthrough stays on the same scene

#### Scenario: The branch still leads onward

- **GIVEN** a reading stopped at a branch point
- **WHEN** the reader chooses a branch and walks it to the last step of the flow
- **THEN** the forward key announces the scene boundary as it would on any other last step

### Requirement: The scene boundary states where the reader is and where they are going

When a scene runs out, the reader SHALL be told which scene of how many has just ended and,
unless it was the last, what the next scene is. The boundary SHALL offer going forward,
going back, and — on the last scene — leaving for the library.

Dismissing the boundary SHALL leave the reader on the last step of the current scene rather
than moving them anywhere.

#### Scenario: Boundary on a middle scene

- **GIVEN** a walkthrough of four scenes whose second scene has just run out
- **WHEN** the boundary is announced
- **THEN** it reports that scene two of four has ended
- **AND** it names the third scene
- **AND** it offers going forward and going back

#### Scenario: Boundary on the last scene

- **GIVEN** a walkthrough whose last scene has just run out
- **WHEN** the boundary is announced
- **THEN** it reports the end of the walkthrough rather than naming a next scene
- **AND** it offers returning to the library

#### Scenario: Dismissing the boundary

- **GIVEN** an announced scene boundary
- **WHEN** the reader dismisses it
- **THEN** the boundary closes
- **AND** the reading is still on the last step of the same scene

### Requirement: Leaving the player keeps the application loaded

Navigation out of the player — finishing a walkthrough, returning to the library from the
boundary, or leaving by the header — SHALL be in-application routing. It SHALL NOT cause a
full document load, which would discard the loaded workspace and the connected folder handle.

#### Scenario: Returning to the library from the boundary

- **GIVEN** an announced scene boundary on the last scene
- **WHEN** the reader chooses to return to the library
- **THEN** the library route is shown
- **AND** the application is not reloaded

### Requirement: Skipping a whole scene remains available and discoverable

A reader SHALL still be able to jump a whole scene without walking its steps. That shortcut
SHALL be presented to the reader rather than left to be guessed, and SHALL NOT be the only
way to cross a scene boundary.

#### Scenario: Skipping forward a scene mid-flow

- **GIVEN** a walkthrough playing the second of four scenes, part-way through its flow
- **WHEN** the skip-scene-forward shortcut is used
- **THEN** the walkthrough moves to the third scene
- **AND** that scene's flow begins at its own first step

#### Scenario: The shortcut is shown

- **GIVEN** a walkthrough being played
- **WHEN** the reader looks at the player's navigation controls
- **THEN** the skip-scene shortcut is described there

### Requirement: The reader is told when a scene reads from a different diagram

Crossing into a scene whose diagram differs from the previous scene's SHALL be announced,
naming the diagram now being read. The announcement SHALL be transient and SHALL NOT
outlive the player: leaving the player before it expires SHALL NOT produce a stray update.

#### Scenario: Consecutive scenes on different diagrams

- **GIVEN** a walkthrough whose second scene reads from a different diagram than its first
- **WHEN** the reader crosses into the second scene
- **THEN** the change of diagram is announced with that diagram's name

#### Scenario: Leaving while the announcement is still showing

- **GIVEN** a change-of-diagram announcement that has not yet expired
- **WHEN** the reader leaves the player
- **THEN** no update is attempted against the departed player

### Requirement: Keys yield to text entry and to the platform

The walkthrough keys SHALL be ignored while focus is in a text input, a text area, a select,
or a content-editable element, so they never fight what the reader is typing. Key handling
SHALL NOT claim combinations the browser or operating system owns.

#### Scenario: Typing in a field

- **GIVEN** a walkthrough being played with focus inside a text field
- **WHEN** an arrow key is pressed
- **THEN** the reading does not move
- **AND** the field receives the keystroke

### Requirement: Every string these surfaces add exists in both locales

Each user-visible string introduced by the player SHALL resolve from the translation
catalogue, with an entry present in both `en` and `pt-BR`. No user-visible string SHALL
depend on an inline fallback for its text.

#### Scenario: Locale coverage

- **WHEN** the translation catalogues are checked for the keys the player reads
- **THEN** every such key is present in both `en` and `pt-BR`

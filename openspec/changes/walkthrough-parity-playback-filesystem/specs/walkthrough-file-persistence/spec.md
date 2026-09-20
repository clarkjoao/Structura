## Purpose

How a walkthrough is written to, read back from, and removed from a connected workspace
folder. A walkthrough lives in its own file beside the diagrams of the folder it explains,
so a folder can be copied, committed or handed on whole — and so deleting those files is a
real removal rather than something the application quietly undoes.

## ADDED Requirements

### Requirement: A walkthrough is one file beside the diagrams it explains

While a workspace folder is connected, each walkthrough SHALL be written as its own file in
the directory of the folder it belongs to — the same directory holding the diagrams of that
folder. A walkthrough with no folder SHALL be written at the workspace root.

The file SHALL be self-contained: everything needed to reconstruct the walkthrough,
including its title, description, author notes, folder, and ordered scenes. It SHALL carry
a kind marker and a schema version so it can be recognised without relying on its name.

Nothing outside the file SHALL reference it. No diagram file and no workspace manifest
field SHALL gain a reference to a walkthrough: the only reference between the two runs from
a walkthrough scene to a diagram, never the other way.

#### Scenario: A walkthrough in a folder

- **GIVEN** a connected workspace folder and a walkthrough belonging to a diagram folder
- **WHEN** the walkthrough is saved
- **THEN** a walkthrough file for it exists in that folder's directory, beside the diagram files
- **AND** that file alone is enough to reconstruct the walkthrough

#### Scenario: A walkthrough with no folder

- **GIVEN** a connected workspace folder and a walkthrough belonging to no folder
- **WHEN** the walkthrough is saved
- **THEN** its file exists at the workspace root

#### Scenario: Diagrams do not know about walkthroughs

- **GIVEN** a workspace with walkthroughs saved to disk
- **WHEN** the diagram files and the workspace manifest are read
- **THEN** none of them references a walkthrough

### Requirement: Walkthrough files are never mistaken for diagrams

A walkthrough file SHALL NOT be offered to diagram validation and SHALL NOT be reported as
an invalid or unreadable diagram. The workspace scan SHALL recognise it by its name, before
reading it, so that recognising it costs nothing at boot.

This SHALL hold whether or not the walkthrough feature is enabled or loaded: a workspace
still carrying walkthrough files after the feature is switched off SHALL scan cleanly.

#### Scenario: Scanning a workspace containing walkthroughs

- **GIVEN** a connected workspace folder containing both diagram files and walkthrough files
- **WHEN** the workspace is scanned
- **THEN** every diagram is found
- **AND** no walkthrough file appears among the invalid files

#### Scenario: Scanning with the feature switched off

- **GIVEN** a workspace containing walkthrough files and the walkthrough feature disabled
- **WHEN** the workspace is scanned
- **THEN** no walkthrough file appears among the invalid files

### Requirement: Moving a walkthrough between folders leaves nothing behind

Changing the folder a walkthrough belongs to SHALL write it into the new folder's directory
and remove the file at its previous location. A workspace SHALL NOT end up holding two files
for one walkthrough.

#### Scenario: Moving a walkthrough

- **GIVEN** a walkthrough saved on disk in one folder's directory
- **WHEN** it is moved to another folder
- **THEN** its file exists in the new folder's directory
- **AND** no file for it remains in the previous one

### Requirement: Deleting a walkthrough in the application deletes its file

Deleting a walkthrough SHALL remove its file from the connected workspace folder. Where the
file cannot be removed, a deletion marker SHALL be left in its place so that the deletion is
not undone the next time the workspace is read.

#### Scenario: Deleting a walkthrough

- **GIVEN** a walkthrough saved on disk
- **WHEN** it is deleted in the application
- **THEN** its file no longer exists in the workspace folder

### Requirement: Deleting the files on disk removes the walkthroughs

A walkthrough that was previously written to a given workspace and is no longer present
there SHALL be treated as deleted, and SHALL NOT be restored from local storage or written
back to disk. Removing the walkthrough files from a workspace folder SHALL therefore be a
complete removal.

Absence SHALL only be read as deletion for a workspace that walkthrough was known to have
been written to. A walkthrough that has never been written to the connected workspace SHALL
be treated as new content and written there, so connecting a different folder never reads as
a deletion.

#### Scenario: Files removed on disk

- **GIVEN** a workspace whose walkthroughs have been written to disk
- **WHEN** the walkthrough files are deleted outside the application and the library is opened
- **THEN** those walkthroughs are gone from the library
- **AND** they are not written back to the workspace folder

#### Scenario: Connecting a workspace that has never held these walkthroughs

- **GIVEN** walkthroughs held locally and a newly connected workspace folder containing none
- **WHEN** the library is opened
- **THEN** those walkthroughs are still present
- **AND** each is written into the newly connected workspace folder

### Requirement: Connecting a folder never loses a walkthrough

Reading walkthroughs back from a connected workspace SHALL reconcile them with the ones held
locally by identity, keeping the more recently updated of the two. Connecting a folder SHALL
NOT discard a walkthrough that exists only locally, whichever way the workspace's own merge
question was answered.

#### Scenario: The same walkthrough on both sides

- **GIVEN** a walkthrough present both locally and on disk, the disk copy being the newer
- **WHEN** the library is opened
- **THEN** the disk copy is the one shown

#### Scenario: A walkthrough only present locally

- **GIVEN** a connected workspace and a walkthrough that exists only locally
- **WHEN** the library is opened
- **THEN** that walkthrough is still present

### Requirement: Disk is a mirror, not a replacement

Local storage SHALL continue to hold every walkthrough whether or not a workspace folder is
connected, so that disconnecting a folder never empties the library. Persistence SHALL go
through the storage port rather than touching browser storage directly.

#### Scenario: Working with no folder connected

- **GIVEN** no connected workspace folder
- **WHEN** a walkthrough is created and the application is reloaded
- **THEN** that walkthrough is still present

#### Scenario: Disconnecting a folder

- **GIVEN** a connected workspace folder with walkthroughs saved to disk
- **WHEN** the folder is disconnected
- **THEN** those walkthroughs are still present in the library

### Requirement: A folder that disappears does not hide its walkthroughs

A walkthrough whose folder no longer exists SHALL be listed at the root rather than becoming
unreachable, matching the rule already applied when a diagram's folder goes missing.

#### Scenario: The folder is deleted

- **GIVEN** a walkthrough belonging to a folder
- **WHEN** that folder no longer exists
- **THEN** the walkthrough is listed at the root of the library

## Purpose

How a walkthrough library is browsed, searched, filtered and organised into the folders it
shares with the diagrams, and what a walkthrough carries on its card and in the surfaces
that create and edit it. Browsing walkthroughs SHALL feel like browsing diagrams, because
they are filed in the same folders.

## ADDED Requirements

### Requirement: The walkthrough library filters the way the workspace does

The library SHALL offer the same means of narrowing a listing that the diagram workspace
offers: a text search, the all / recent / favorites filters, a choice of sort order, and a
choice between a grid and a list.

Search SHALL match a walkthrough's title and its description. The available sort orders
SHALL include name and last edited, and SHALL include the number of scenes as the ordering
that is meaningful for a walkthrough and has no diagram counterpart.

Narrowing SHALL compose with the selected folder rather than replacing it: a search inside a
selected folder searches that folder.

#### Scenario: Searching by description

- **GIVEN** a library holding a walkthrough whose title does not contain a word but whose description does
- **WHEN** that word is searched for
- **THEN** that walkthrough is listed

#### Scenario: Search within a folder

- **GIVEN** a folder is selected and a search term is entered
- **WHEN** the listing is read
- **THEN** only walkthroughs in that folder that match the term are listed

#### Scenario: Sorting by scene count

- **WHEN** the listing is sorted by number of scenes
- **THEN** the walkthroughs are ordered by how many scenes each has

#### Scenario: Switching between grid and list

- **WHEN** the view is switched between grid and list
- **THEN** the same walkthroughs are shown in the chosen presentation

### Requirement: A walkthrough can be marked a favorite

A walkthrough SHALL be markable as a favorite from its card, and the favorites filter SHALL
list exactly the walkthroughs so marked. Favorites SHALL survive a reload. A walkthrough's
favorite status SHALL be independent of any diagram's.

#### Scenario: Marking and filtering

- **GIVEN** a library of several walkthroughs
- **WHEN** one is marked a favorite and the favorites filter is selected
- **THEN** only that walkthrough is listed

#### Scenario: Favorites survive a reload

- **GIVEN** a walkthrough marked as a favorite
- **WHEN** the application is reloaded
- **THEN** it is still marked as a favorite

#### Scenario: Favorites do not cross over

- **GIVEN** a diagram marked as a favorite
- **WHEN** the walkthrough library's favorites filter is selected
- **THEN** that diagram's favorite status has no effect on what is listed

### Requirement: Walkthroughs are filed in the same folders as diagrams

The library SHALL present the folder tree of the workspace, the very folders the diagrams are
filed in, and SHALL NOT keep a folder namespace of its own. Selecting a folder SHALL list the
walkthroughs filed in it.

Each folder SHALL report how many walkthroughs it holds counting its descendants, so a
collapsed folder does not read as empty when its children are not.

A walkthrough SHALL be movable between folders by dragging its card onto a folder.

#### Scenario: Counting descendants

- **GIVEN** a folder holding no walkthroughs itself but whose child folder holds two
- **WHEN** the folder tree is read
- **THEN** that folder reports two

#### Scenario: Filing by dragging

- **GIVEN** a walkthrough listed in the library
- **WHEN** its card is dragged onto a folder in the tree
- **THEN** the walkthrough belongs to that folder
- **AND** it is listed when that folder is selected

#### Scenario: Folders are the workspace's own

- **GIVEN** a folder created from the walkthrough library
- **WHEN** the diagram workspace is opened
- **THEN** that folder is present there

### Requirement: The workspace and the walkthrough library browse through the same components

The folder tree and the filter controls SHALL be one implementation used by both libraries,
parameterised by what each counts and what each accepts as a dropped item. Neither library
SHALL carry a copy of the other's.

Behaviour of the diagram workspace SHALL be unchanged by this: the same folders, counts,
filters, ordering and drag targets as before.

#### Scenario: The diagram workspace is unaffected

- **GIVEN** the diagram workspace
- **WHEN** folders, filters, sorting and dragging a diagram onto a folder are exercised
- **THEN** each behaves as it did before

### Requirement: A walkthrough carries a description and author notes that can be edited

A walkthrough SHALL have a description shown to anyone browsing the library, and author
notes that are not. Both SHALL be editable: the description when the walkthrough is created
and afterwards in the editor, the author notes in the editor.

No field that the library displays SHALL be unreachable from the surfaces that create and
edit a walkthrough.

#### Scenario: Describing a walkthrough as it is created

- **GIVEN** the create-walkthrough surface
- **WHEN** a title and a description are given and the walkthrough is created
- **THEN** its card shows that description

#### Scenario: Editing the description afterwards

- **GIVEN** a walkthrough open in the editor
- **WHEN** its description is changed
- **THEN** the library shows the changed description

#### Scenario: Author notes stay with the author

- **GIVEN** a walkthrough carrying author notes
- **WHEN** it is played
- **THEN** the author notes are not shown to the reader

### Requirement: Editing a walkthrough is not lost by leaving

Changes made in the walkthrough editor SHALL be persisted without the author having to ask.
Leaving the editor SHALL NOT silently discard an edit.

#### Scenario: Leaving the editor after a change

- **GIVEN** a walkthrough open in the editor
- **WHEN** its title is changed and the editor is left without any explicit save
- **THEN** the change is present when the walkthrough is opened again

### Requirement: Every string these surfaces use exists in both locales

Each user-visible string in the library, the create surface, the editor and the folder tree
SHALL resolve from the translation catalogue, with an entry present in both `en` and
`pt-BR`. No user-visible string SHALL depend on an inline fallback for its text.

#### Scenario: Locale coverage

- **WHEN** the translation catalogues are checked for the keys these surfaces read
- **THEN** every such key is present in both `en` and `pt-BR`

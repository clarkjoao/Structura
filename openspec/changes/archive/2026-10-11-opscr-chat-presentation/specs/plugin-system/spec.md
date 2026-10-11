# Spec Delta

## ADDED Requirements

### Requirement: Plugin chat presentation

While a plugin chat context applies to the active diagram and provides a presentation, the chat
header and empty state SHALL show its title, subtitle and suggestions instead of the built-in ones,
and SHALL switch back when the context stops applying, as signalled through its `subscribe`.

#### Scenario: A folder opens

- **GIVEN** the chat panel is open on a diagram with the built-in assistant
- **WHEN** the opscr pane opens the diagram's bound folder
- **THEN** the chat header reads "opscr · <folder>" and the suggestions are opscr edits

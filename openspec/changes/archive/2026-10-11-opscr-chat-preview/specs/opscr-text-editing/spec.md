# Spec Delta

## ADDED Requirements

### Requirement: Chat changes are pending until kept

Elements a chat reply adds or replaces on a bound diagram SHALL be highlighted as pending and
focused. Discard SHALL restore the manifests to their text before that reply, unless the text has
changed since, in which case it SHALL say so and keep the change.

#### Scenario: Discard a chat cache

- **GIVEN** the chat added `search-cache`
- **WHEN** the user clicks Discard
- **THEN** `search-cache` leaves the text and the canvas

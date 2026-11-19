# Spec Delta

## ADDED Requirements

### Requirement: Plugin-answered rename in the host code editor

`api.ui.CodeEditor` SHALL accept a `rename` handler. F2 in that editor SHALL ask the handler for
the symbol at the cursor, open the rename box on it, and pass the new name to the handler, showing
the message the handler refuses with. Where the handler has no symbol, the editor SHALL say that
nothing can be renamed. The handler SHALL never be asked about another editor's text.

#### Scenario: Rename refused

- **GIVEN** a plugin editor whose handler refuses `taken` with "Already used"
- **WHEN** the user renames a symbol to `taken`
- **THEN** the editor shows "Already used" and the text is unchanged

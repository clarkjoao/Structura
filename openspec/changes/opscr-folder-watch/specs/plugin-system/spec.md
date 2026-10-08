# Spec Delta

## ADDED Requirements

### Requirement: Folder stats

`PluginFolder.stats()` SHALL list the folder's top-level files with their last-modified time and
size, sorted by name, without reading their contents.

#### Scenario: A write changes the stats

- **WHEN** a plugin writes `a.yaml` and calls `stats()`
- **THEN** `a.yaml` has a newer last-modified time and its new size

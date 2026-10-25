# Tasks

## 1. opscr core

- [x] 1.1 `initiativeSources` and `initiativeDelta` (+ shared text helpers); verify round trip of the example is a no-op and one test per kind of change

## 2. Host API (1.14, unreleased)

- [x] 2.1 `applyChanges` with `version` / `base`; `getDiagram` with `version`; `PluginFolder.remove`; rename action carries the name; verify tests

## 3. Plugin

- [x] 3.1 Load and watch `initiatives/*/`; root engine and View diagrams ignore them and write the base
- [x] 3.2 `InitiativeVersions`: engines per diagram × initiative, Version create/meta/remove, routing; verify tests with fakes
- [x] 3.3 Pane: initiatives list (status, conflicts, accept, show, promote) and Version actions; Save deletes; i18n
- [x] 3.4 Typecheck, tests, sync-types/shared, build-skill

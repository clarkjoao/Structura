# Tasks

## 1. Model

- [x] 1.1 `versionChanges` (added / changed with fields / removed) with memo; verify unit tests (layout-only copy is no change, removed only if still in base)

## 2. Canvas

- [x] 2.1 `showVersionChanges` UI flag (default on, persisted) and the switch in the Version panel and chip
- [x] 2.2 `changesOverlay`: added / changed outlines when a Version is active and compare mode is off; verify overlay tests
- [x] 2.3 Ghost nodes and edges for removed elements (base layout, parent fallback, inert, under live nodes); verify they are absent from selection, plugin snapshots and auto-layout
- [x] 2.4 Legend with counts; i18n `en` / `pt-BR`

## 3. Element panel

- [x] 3.1 "Changed in <Version>" list of field changes for elements and connections; verify render test

## 4. Verify

- [x] 4.1 Browser check on the opscr initiative (e2e `initiatives.mjs`: ghosts for sessions, amber orders-api, green new elements and edges); typecheck, lint, tests, fallow; docs/features.md

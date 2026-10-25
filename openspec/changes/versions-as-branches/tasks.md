# Tasks

## 1. Model

- [x] 1.1 Optional fields on `VersionDiff`, helpers, `hashElement`; `resolveVersionSnapshot` applies modified; verify old Versions resolve unchanged
- [x] 1.2 Copy-on-write in component / connection updates and node moves; verify store tests incl. undo
- [x] 1.3 Conflicts (`versionConflicts`, keep / take base) and merge with modified, refused on conflicts; verify tests

## 2. UI

- [x] 2.1 Version panel: status groups, status picker, conflict badge, merge disabled; i18n en / pt-BR
- [x] 2.2 Canvas markers (modified, conflict); base nodes movable in a Version; element panel keep / use base
- [x] 2.3 Linked diagram activates the Version with the same key

## 3. Plugin API 1.14.0

- [x] 3.1 `api.versions` (list, upsert, remove, setActive, onAction) and plugin-owned action routing; verify tests
- [x] 3.2 `DiagramSnapshot.activeVersion` and resolved components; verify tests
- [x] 3.3 `PluginFolder` sub-folders (recursive list, nested paths, containment); verify tests
- [x] 3.4 Docs: extension-points, plugin API changelog

## 4. Gates

- [x] 4.1 `npm run typecheck`, `lint`, `format:check`, `test`, `fallow:check`; plugin typechecks

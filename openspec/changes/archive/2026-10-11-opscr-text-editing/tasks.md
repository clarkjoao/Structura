# Tasks

## 1. Host API

- [x] 1.1 `api.applyChanges` (add/update/move/remove components, add/remove connections, one history step) on top of the generated-graph path; verify unit tests for each scenario, including a single undo and unknown ids
- [x] 1.2 Folder access (`infrastructure/persistence/pluginFolders.ts` + `api.files`, capability `files:folder`); verify unit tests with an in-memory directory handle: pick, reopen by binding id, list, read, write, path escapes rejected
- [x] 1.3 `api.ui.CodeEditor` with markers, and the `document-pane` slot with toolbar toggles and an error boundary in the workspace; verify component tests and i18n keys in en and pt-BR
- [x] 1.4 Bump the API to 1.4.0, sync plugin type copies, document the new API in `plugins/README.md` and `CHANGELOG.md`; verify typecheck, lint, format and tests

## 2. opscr plugin

- [x] 2.1 Sync engine: graph diff against the key → id map and the diagram snapshot, previous layout read from the canvas; verify unit tests (add, update, remove, user-deleted element re-added, dragged element kept)
- [x] 2.2 Document pane: bind/reopen folder, file list with unsaved marks, editor with markers, save, reload, debounced sync; verify the plugin builds and typechecks
- [x] 2.3 End to end in a browser on the dev server with the sample in an origin-private folder standing in for the picker: bind, edit adds a Cache, drag kept, delete removes, save writes, undo reverts one sync; verify with a Playwright script and screenshots

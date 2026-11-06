# Tasks

## 1. Adapter

- [x] 1.1 Add `fake-indexeddb` as a dev dependency; add `IndexedDbAdapter` (database `structura-workspace`, store `kv`, records `{ value, savedAt }`, one cached connection closed on `versionchange`); verify with contract tests shared with `LocalStorageAdapter` and `InMemoryAdapter`
- [x] 1.2 Extract the `paused` / force-save / auxiliary-key surface into a `BrowserWorkspaceStorage` interface implemented by both browser adapters; replace the `instanceof LocalStorageAdapter` paused check in `persist.config.ts` (the synchronous unload write keeps its check until 3.2 replaces it); verify the existing persist and folder-sync tests pass unchanged (`storagePort.contract.test.ts`: 25 tests over the three adapters; persistence and store suites 506 tests)

## 2. Boot and migration

- [ ] 2.1 Add `bootBrowserWorkspaceStorage()`: open with a 3 s timeout, migrate (copy, read back, compare, delete), adopt or drop the rescue, select the adapter behind a delegating `defaultStorage`; verify with tests for each path (no IDB, open fails, migration ok, mismatch, both copies, rescue newer / older)
- [ ] 2.2 Await it in `main.tsx` before rendering, and hydrate the diagram store after it; verify the app starts with a migrated workspace on a production build and the dashboard lists the same diagrams

## 3. Write safety

- [ ] 3.1 Drop workspace writes until the first read of the key has resolved; verify with a test whose `getItem` is held open while the store is set
- [ ] 3.2 Leaving: IndexedDB on hidden, IndexedDB plus synchronous rescue on `pagehide` / `beforeunload`; update `flushDiagramStoreToLocalStorageNow` and `flushDiagramStoreToLocalStorageBeforeUnloadSync` (and their names) for both adapters; verify with tests and, on a production build, an edit followed at once by a reload survives

## 4. Quota

- [ ] 4.1 `checkStorageHealth` from `navigator.storage.estimate()` with IndexedDB (80 % / 95 %), unchanged otherwise; verify with tests; any new strings in en and pt-BR

## 5. Folder mode, seeds, docs

- [ ] 5.1 Check folder connect, disconnect, reconnect, merge and clear-local-cache against IndexedDB on a production build; record what was checked
- [ ] 5.2 Cypress: delete the `structura-workspace` database in a global `beforeEach`; seeds keep writing `localStorage`; run the persistence-related specs and the stress specs
- [ ] 5.3 Measure `perf:large` (open, first nodes) against `perf/large-diagrams`; record in `baseline.json`
- [ ] 5.4 Update ADR-0007 (IndexedDB default, `localStorage` fallback, the rescue key, the review rule now covering IndexedDB); run typecheck, lint, format, tests, fallow, `openspec validate --strict`

# Tasks

## 1. Adapter

- [x] 1.1 Add `fake-indexeddb` as a dev dependency; add `IndexedDbAdapter` (database `structura-workspace`, store `kv`, records `{ value, savedAt }`, one cached connection closed on `versionchange`); verify with contract tests shared with `LocalStorageAdapter` and `InMemoryAdapter`
- [x] 1.2 Extract the `paused` / force-save / auxiliary-key surface into a `BrowserWorkspaceStorage` interface implemented by both browser adapters; replace the `instanceof LocalStorageAdapter` paused check in `persist.config.ts` (the synchronous unload write keeps its check until 3.2 replaces it); verify the existing persist and folder-sync tests pass unchanged (`storagePort.contract.test.ts`: 25 tests over the three adapters; persistence and store suites 506 tests)

## 2. Boot and migration

- [x] 2.1 Add `bootWorkspaceStorage()`: open with a 3 s timeout, migrate (copy, read back, compare, delete, mark), adopt or drop the rescue, select the adapter behind `workspaceStorage` (`defaultStorage` stays localStorage for the small keys); verify with tests for each path (`bootWorkspaceStorage.test.ts`, 12: no IDB, open fails, open times out, migration ok, mismatch, write fails, both copies with and without marker, rescue newer / older / alone; `workspaceStorage.test.ts`, 9)
- [x] 2.2 Render in `main.tsx` once `diagramStoreHydrated` settles (read or failed); the store hydrates through `workspaceStorage`, which waits for the boot; verify on a production build: the 1.05 M-char fixture migrates (IndexedDB holds the same length, the localStorage key is gone, marker set), the editor opens it, and with `indexedDB` undefined localStorage is kept and used; no console errors

## 3. Write safety

- [x] 3.1 Drop workspace writes until the first read of the key has resolved, and refuse them (save status error) after a failed read; with nothing stored, hydration no longer runs the in-place migrators over the in-memory state, which a write before the read had frozen (it threw, and the session never saved); verify with `persist.read-before-write.test.ts` (read held open, failed read, empty store after an early write — fails without the fix). `autoArrangeWatcher.test.ts` now waits for hydration: it passed only because hydration used to throw
- [x] 3.2 Leaving: IndexedDB on hidden, IndexedDB plus synchronous rescue on `pagehide` / `beforeunload` (`WorkspaceStorage.writeOnLeave`); `flushDiagramStoreToLocalStorageNow` renamed `flushWorkspaceToBrowserStorageNow`, the unused `flushDiagramStoreToLocalStorageBeforeUnloadSync` removed; verify with tests (pagehide → rescue and record, hidden → record and no rescue) and, on a production build, a panel nudged 100 px and reloaded 50 ms later is at 100 px after the reload

## 4. Quota

- [x] 4.1 `checkStorageHealth` from `navigator.storage.estimate()` with IndexedDB (80 % / 95 %), unchanged otherwise (also when the browser gives no estimate); the banner states the quota (`{{quota}}`: the origin quota, or `storage.localStorageQuota` "~5 MB", en and pt-BR) instead of a fixed "~5 MB"; verify with `storage-monitor.test.ts` (thresholds both ways, critical kept, estimate vs localStorage vs no estimate) and the banner test

## 5. Folder mode, seeds, docs

- [ ] 5.1 Check folder connect, disconnect, reconnect, merge and clear-local-cache against IndexedDB on a production build; record what was checked
- [ ] 5.2 Cypress: delete the `structura-workspace` database in a global `beforeEach`; seeds keep writing `localStorage`; run the persistence-related specs and the stress specs
- [ ] 5.3 Measure `perf:large` (open, first nodes) against `perf/large-diagrams`; record in `baseline.json`
- [ ] 5.4 Update ADR-0007 (IndexedDB default, `localStorage` fallback, the rescue key, the review rule now covering IndexedDB); run typecheck, lint, format, tests, fallow, `openspec validate --strict`

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

- [x] 5.1 Check folder mode against IndexedDB on a production build (directory picker stubbed with an OPFS folder): connect → empty-folder dialog → push writes the manifest and the diagram; reload reconnects; an edit while connected reaches the IndexedDB backup; "Save in browser and disconnect" keeps it and a reload shows the diagram from IndexedDB with no localStorage copy; no console errors. Strings that said "localStorage" for the browser copy now say "browser" (en, pt-BR)
- [x] 5.2 Cypress (`testIsolation` is off, so IndexedDB outlives a test): writing the workspace key to localStorage drops the IndexedDB copy and the marker (`cypress/support/workspace-storage.ts`), so a seed still wins and, without one, the workspace still carries over; `cy.readSavedWorkspace()` for the spec that reads what the app saved. 9 specs pass (stress ×3, node-drag, selection matrix, panel hit geometry, editable edges, context menu, IR generation; 140 tests); the two render-parity specs fail exactly as on `main` and `perf/large-diagrams` (pre-existing); collab specs need the relay and were not run
- [x] 5.3 Measure `perf:large` against `perf/large-diagrams` (`baseline.json`): opening with the one-time migration 193 → 141 ms of long tasks, first nodes 831 → 775 ms; at zoom 1 343 → 219 ms; viewer, pan, zoom and drags unchanged within noise. Second opening with the workspace already in place: first nodes 539 → 524 ms, long tasks 64 → 64 ms
- [x] 5.4 Amend ADR-0007 (IndexedDB default, `localStorage` fallback, migration marker, the rescue key, rollback, the review rule now covering IndexedDB) and the storage rule in AGENTS.md, CONTRIBUTING.md and the architecture overview; run typecheck, lint, format, tests, fallow, `openspec validate --strict`

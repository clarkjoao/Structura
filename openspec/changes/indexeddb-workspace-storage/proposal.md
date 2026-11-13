# Proposal

## Why

The whole workspace (every diagram, flow and layout) is one `localStorage` value,
`structura_diagram-store`. `localStorage` holds about 5 MB per origin, stored as UTF-16, so the
real ceiling is around 2.5 M characters shared with every other key the app writes. The reference
large diagram (`perf:large`, 657 nodes) is 1.05 M characters: four or five of them fill the
browser, and the next save fails with `QuotaExceededError`. ADR-0007 already names the escape: an
IndexedDB adapter behind `IStoragePort`, "prioritized by user pain". Users generating large
diagrams have reached it.

Speed is not the reason. Measured on the fixture, a save costs ~6 ms (stringify 3.5 ms,
`setItem` 2.7 ms) after `large-diagram-performance` moved serialization to the debounced flush.

## What Changes

- The workspace is stored in IndexedDB (database `structura-workspace`), behind a new
  `IndexedDbAdapter` implementing `IStoragePort`. Capacity becomes the browser's origin quota
  (a share of free disk, typically gigabytes) instead of ~5 MB.
- On first start, an existing `localStorage` workspace is copied to IndexedDB, read back and
  compared, and only then removed from `localStorage`. Nothing is lost if any step fails: the app
  keeps running on `localStorage`.
- The app does not render, and the store does not write, until the workspace has been read.
  IndexedDB answers asynchronously; a write before the read would replace the saved workspace with
  an empty one.
- The last save before the tab goes away: the pending write is sent to IndexedDB when the page is
  hidden, and on `pagehide` it is also written synchronously to a small `localStorage` rescue key
  that the next start adopts if it is newer than what IndexedDB holds.
- Browsers without IndexedDB (or where opening it fails, e.g. some private modes) keep using
  `LocalStorageAdapter`, as today.
- The storage monitor reads `navigator.storage.estimate()` when the workspace is in IndexedDB, and
  its warning thresholds become a share of the quota instead of fixed 3 / 4 MB.
- Folder sync (`FileSystemAdapter`) is unchanged: the browser copy stays its silent backup, now in
  IndexedDB. `paused` and force-save keep their meaning.
- ADR-0007 is updated: IndexedDB is the default browser store, `localStorage` the fallback.

## Capabilities

### New Capabilities

- `browser-workspace-storage`: where the browser keeps the workspace, how an existing
  `localStorage` workspace moves to IndexedDB, the read-before-write guarantee, the last save on
  leaving, the fallback, and the quota report.

### Modified Capabilities

None (no existing spec covers browser persistence of the workspace).

## Non-Goals

- Moving small keys (preferences, recent diagrams, integration configs, sync timestamps) out of
  `localStorage`. They are a few KB.
- Moving the icon library or the preview cache. They can grow, but they are separate stores and a
  separate change.
- Splitting the workspace into one record per diagram. One record keeps the zustand persist
  contract and the folder-sync code unchanged; per-diagram records are a later optimization if
  measurement asks for it.
- Cross-tab live sync. Two tabs on the browser workspace overwrite each other today (last write
  wins); this change keeps that behaviour, no better and no worse.
- Requesting persistent storage (`navigator.storage.persist()`); see design Open Questions.
- Any server-side storage (ADR-0007, ADR-0011).

## Impact

- `src/infrastructure/persistence/`: new `IndexedDbAdapter.ts`, a boot step that opens the
  database, migrates and picks the adapter; `defaultStorage` becomes the chosen adapter; the
  `instanceof LocalStorageAdapter` checks become a capability of the port.
- `src/features/diagram/store/persist.config.ts`, `diagram.store.ts`: read-before-write guard,
  last-save-on-leave path, flush helpers.
- `src/main.tsx`: wait for the workspace boot before the first render.
- `src/features/diagram/store/storage-monitor.ts`, `saveStatus.store.ts`: quota from the browser.
- `cypress/support`: seeds keep writing `localStorage` (the migration adopts them); IndexedDB is
  cleared before each test.
- `docs/adr/0007-local-first-persistence.md`.

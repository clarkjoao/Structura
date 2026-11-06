# Design

## Context

- `createDiagramStore` persists through zustand `persist` with `createPersistConfig(storage)`,
  `storage` defaulting to `defaultStorage` (`LocalStorageAdapter`, prefix `structura_`, key
  `diagram-store`). Writes are debounced (`schedulePersist`) and serialized at flush
  (`createDeferredJSONStorage`). On leaving, `flushOnLeave` (`beforeunload`, `pagehide`) writes
  synchronously with `setItemSync`; `visibilitychange` writes asynchronously.
- zustand 5 `persist` calls `setItem` on every `set()`, hydrated or not. Today hydration ends in a
  microtask (the adapter's `getItem` is `async` over a synchronous read), before React or any
  bootstrap writes, so the gap is invisible. With IndexedDB it is several milliseconds.
- Folder mode (`fileSystemBoot.ts`, `useFileSystemStorage.ts`) reads, force-saves and deletes the
  browser copy through `defaultStorage` and toggles `defaultStorage.paused`.
- `llm-threads-idb.ts` already uses IndexedDB, database `structura` at version 1.
- `storage-monitor.ts` sums `localStorage` sizes; `saveStatus.store.ts` warns at 3 MB and 4 MB.

## Goals / Non-Goals

**Goals:** the workspace is limited by the origin quota, not 5 MB; no data is lost moving it, on
a failed open, on a write racing hydration, or on closing the tab; folder mode behaves as today.

**Non-Goals:** see the proposal.

## Decisions

### 1. Its own database

`structura-workspace`, version 1, one object store `kv` with out-of-line keys. Records are
`{ value: string, savedAt: number }`. A separate database keeps `llm-threads-idb.ts` at its own
version: sharing `structura` would need one module owning every object store's upgrade, or an
`open` at the old version fails with `VersionError`.

The value stays the JSON string zustand produces. Storing the object (structured clone) would skip
`JSON.stringify` (3.5 ms on the fixture) but changes the persist contract, folder sync and the
seeds for a few milliseconds.

### 2. `IndexedDbAdapter` keeps the `IStoragePort` contract and the extras folder mode uses

`getItem`/`setItem`/`removeItem`/`keys`/`length`/`save`/`load`/`delete`, plus `paused`,
`forceSave` and the auxiliary-key methods (`setAuxiliaryValue`, `removeAuxiliaryKey`), which keep
writing their small timestamps to `localStorage`. These extras move into a `BrowserWorkspaceStorage`
interface both adapters implement, so `persist.config.ts`, `diagram.store.ts` and folder mode check
a capability instead of `instanceof LocalStorageAdapter`. The connection is opened once and reused;
`onversionchange` closes it.

### 3. Choosing the adapter at boot

`bootBrowserWorkspaceStorage()` runs before the first render (`main.tsx`) and before the diagram
store hydrates:

1. `indexedDB` missing, or `open` failing or taking over 3 s → `LocalStorageAdapter`, as today.
2. Otherwise run the migration (Decision 4) and select `IndexedDbAdapter`.

`defaultStorage` becomes a delegating port whose target is set by the boot, so the many importers of
`defaultStorage` need no change. Until the boot ends its reads wait for it.

### 4. Migration: copy, read back, compare, then delete

If IndexedDB has no `diagram-store` record and `localStorage` has `structura_diagram-store` (or a
legacy key the current fallback lookup finds):

1. `put` the string with `savedAt = now`.
2. Read it back in a new transaction and compare it to the source, character for character.
3. Only if equal, remove the `localStorage` key.

Any failure leaves `localStorage` untouched and the boot falls back to `LocalStorageAdapter` for
this session; the next start tries again. If both copies exist (a tab still running the old build
saved after another tab migrated), IndexedDB is kept, the `localStorage` copy is left in place and
a warning is logged; nothing is deleted.

### 5. Read before write

The persist port drops writes of `diagram-store` until its first `getItem` of that key has
resolved. Anything written before then is about to be replaced by the hydrated state, so dropping
it loses nothing, and writing it would replace the saved workspace. The boot gate (Decision 3)
makes this rare; the guard makes it impossible, including for writes from module-level
bootstraps.

### 6. The last save on leaving

IndexedDB has no synchronous write. Two paths, both already wired by `flushOnLeave`:

- `visibilitychange` → hidden: the pending write goes to IndexedDB. The page is still alive, so the
  transaction completes; this covers closing tabs, switching apps and mobile.
- `pagehide` / `beforeunload` with a write still pending: it goes to IndexedDB (best effort) and,
  synchronously, to `localStorage` key `structura_diagram-store:rescue` as
  `{ savedAt, value }`. If that does not fit the quota, it is skipped.

At boot, a rescue newer than the IndexedDB record's `savedAt` is written to IndexedDB, then
removed. An older one is removed. The rescue is the only time the whole workspace touches
`localStorage` after migration, and it lives for one page load.

### 7. Quota report

With `IndexedDbAdapter`, `checkStorageHealth` uses `navigator.storage.estimate()` (usage / quota)
and warns at 80 % and 95 % of the quota. Without the API, or with `LocalStorageAdapter`, the
current byte sum and 3 / 4 MB thresholds stay.

### 8. Tests and seeds

- Unit tests run the adapter against `fake-indexeddb` (dev dependency) for the contract, the
  migration (success, read-back mismatch, both copies present), the rescue (newer, older,
  absent) and the write guard.
- Cypress seeds keep writing `structura_diagram-store`; a global `beforeEach` deletes the
  `structura-workspace` database, so every test starts from the seed through the migration path.

## Risks / Trade-offs

- **Boot waits for IndexedDB.** Opening and reading ~1 MB is expected to cost tens of
  milliseconds; it is measured (`perf:large` open, first nodes) and must not regress
  `large-diagram-performance`'s numbers by more than noise.
- **A rescue that never runs.** Mobile Safari may kill a backgrounded tab without `pagehide`. The
  `visibilitychange` write covers it, as it does today.
- **Rescue larger than the free `localStorage`.** Then only the best-effort IndexedDB write
  remains on `pagehide`. Only edits from the last debounce window (`PERSIST_DEBOUNCE_MS`) are at
  risk, the same window `beforeunload` covers today.
- **Old build in another tab.** Covered by Decision 4: nothing is deleted when both copies exist.
- **Eviction.** IndexedDB and `localStorage` share the origin's best-effort bucket; moving does not
  change eviction risk.

## Migration Plan

Automatic on the first start of the new build (Decision 4). No schema version change: the
persisted payload is identical, only its location changes.

Rollback: a build from before this change reads `localStorage` only and would start with an empty
workspace (the data stays in IndexedDB, untouched). A rollback therefore ships as a forward fix
that copies the IndexedDB record back to `localStorage` when it fits, not as a plain revert.

## Open Questions

- Whether to call `navigator.storage.persist()`. Chromium grants it silently by heuristics, Firefox
  shows a prompt. Proposed: not in this change.

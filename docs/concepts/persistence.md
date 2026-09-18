# Persistence

Structura is local-first with no backend: the user's browser (or a folder
they choose) holds the only copy of their data. Persistence is therefore
designed with the paranoia of a database engine, not a cache.

## The port

Everything goes through `IStoragePort`
(`src/infrastructure/persistence/IStoragePort.ts`) — async key/value
`save`/`load`/`delete` plus raw string item access. **Nothing outside
`infrastructure/persistence/` touches `localStorage`.** This boundary is what
made three backends possible and keeps future ones (IndexedDB, remote sync)
tractable.

## Adapters

| Adapter | Backing | Use |
| --- | --- | --- |
| `LocalStorageAdapter` | `localStorage` | Default. Synchronous under the hood, quota-limited (~5MB) — hence `storageQuota.ts` monitoring and the storage warning banner. |
| `FileSystemAdapter` | File System Access API | "Connect a folder": workspace as files on disk — user-ownable, git-able, effectively unlimited. Boot/permission flow in `fileSystemBoot.ts` / `requestConnectFolder.ts`. |
| `InMemoryAdapter` | memory | Tests and ephemeral contexts (viewer). |

## Schema versioning — the hard rule

The persisted store is versioned (`PERSIST_SCHEMA_VERSION` in
`features/diagram/store/persist.config.ts`) with a forward-only migration
chain. **Every change to a persisted shape requires a migration + version
bump.** There is no server to repair a user's data; a shape change without a
migration silently corrupts real workspaces. Reviewers should treat a
persisted-type diff without a migration as a blocking defect.

## Folder sync

When a folder is connected, two sources exist (localStorage cache + files),
so sync machinery exists to reconcile them:

- `useFileSystemStorage` / `useFileSystemSync` — read/write orchestration.
- `workspace-manifest-fingerprint.ts` + `folderSyncTimestamp.ts` /
  `localStorageSyncTimestamp.ts` — change detection on both sides.
- `workspace-folder-sync-equality.ts` — structural equality to avoid
  spurious writes.
- `WorkspaceMergeDialog` / `DisconnectConfirmDialog` — the user decides on
  conflicts; the app never silently discards either side.
- `merge-custom-component-templates.ts` — semantic merging for templates.
- `folderSync.ts` — shared `FolderSyncResult` + `isValidFolderId` (skips
  reserved names like `node_modules` / `dist` during root scans).

### localStorage stays active while a folder is connected

`defaultStorage.paused` is **not** set when the user connects a folder.
localStorage continues to receive Zustand persist writes in parallel with
the folder. That is intentional: pausing localStorage was a root cause of
filesystem instability (no browser-side fallback if a folder write failed
mid two-phase commit). Merge/overwrite/push still force-flush a localStorage
backup before mutating the folder. See
`docs/discovery/bug3-filesystem-instability.md` §P0.1.

### Two-phase diagram writes

Folder diagram writes use a prepare/commit protocol (`stagedDiagramWrite.ts`):

1. **Prepare** — write each diagram to `{id}.json.tmp`.
2. **Manifest** — `writeManifestWithRetry` (exponential backoff).
3. **Commit** — rename `.tmp` → `.json`. Prefer `FileSystemFileHandle.move()`
   when available (atomic same-directory rename); otherwise copy+delete.
4. **Rollback** — if the manifest fails, delete staged `.tmp` files. A
   *partial* commit (some renames succeed, others fail) does **not** roll
   back the successes — that would discard the only good copy.
5. **Orphan cleanup** — on connect/reconnect, `cleanupOrphanedTempFiles`
   removes `*.json.tmp` older than five minutes (covers crashes on the
   non-atomic fallback path).

### Bidirectional folder sync

The folder structure is synchronized between the filesystem and the Zustand
store:

**Filesystem → Store:**
- `syncFoldersFromFilesystem()` scans root directories (filtered by
  `isValidFolderId`) and creates missing directories for known store folder IDs.
- Unknown directories are logged, not auto-imported (manifest is source of truth).

**Store → Filesystem:**
- Directory creation for new folders happens on the diagram flush path
  (`resolveDiagramPathSegments` / `getOrCreateDirectory`), not via a separate
  folder watcher (a prior watcher caused React update-depth loops).

**Design decisions:**
- Folder IDs are used as directory names (not folder names) for stability
- Renames don't orphan files since the ID remains the same
- Directories are never auto-deleted for safety

The design stance: **conflicts surface to the user** rather than resolving by
timestamp heuristics. Crude but honest; real multi-writer convergence is
collaboration's job (Yjs), not file sync's.

## What persists where

- Workspace (diagrams, folders, services, templates) → main persist config.
- Custom components, icons, LLM config/threads → their satellite
  stores' persistence (LLM API keys stay client-side in `llm-storage.ts`).
- Undo history, save status, collaboration presence → **never persisted**;
  reconstructable or session-scoped by design.

## Outlook

localStorage quota is the scaling ceiling for browser-only users; when it is
hit in practice, the path is an IndexedDB adapter behind the same port — the
port contract is the insurance that this is an adapter, not a rewrite.
Recorded as [ADR-0007](../adr/0007-local-first-persistence.md).

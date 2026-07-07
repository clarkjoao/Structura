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

The design stance: **conflicts surface to the user** rather than resolving by
timestamp heuristics. Crude but honest; real multi-writer convergence is
collaboration's job (Yjs), not file sync's.

## What persists where

- Workspace (diagrams, folders, services, templates) → main persist config.
- Walkthroughs, custom components, icons, LLM config/threads → their satellite
  stores' persistence (LLM API keys stay client-side in `llm-storage.ts`).
- Undo history, save status, collaboration presence → **never persisted**;
  reconstructable or session-scoped by design.

## Outlook

localStorage quota is the scaling ceiling for browser-only users; when it is
hit in practice, the path is an IndexedDB adapter behind the same port — the
port contract is the insurance that this is an adapter, not a rewrite.
Recorded as [ADR-0007](../adr/0007-local-first-persistence.md).

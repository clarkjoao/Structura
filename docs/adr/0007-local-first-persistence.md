# ADR-0007 — Local-first persistence behind a storage port

**Status:** Accepted (records an existing decision)

## Context

Architecture diagrams are sensitive IP. A hosted backend would create
adoption friction (accounts, procurement, data-residency reviews — acute for
the initial Brazilian enterprise audience), operating costs, and a trust
burden for an open-source tool. The alternative — browser storage — brings
quota limits and "my data is where?" anxiety.

## Decision

Structura is **local-first with no backend**: all data lives client-side,
accessed exclusively through `IStoragePort`
(`infrastructure/persistence/`) with three adapters (LocalStorage default,
FileSystem folder for durable/git-able workspaces, InMemory for
tests/viewer). The persisted schema is versioned with a forward-only
migration chain. The optional Node server is a stateless relay/proxy only and
must never become a data store. Sync conflicts (folder vs. cache) surface to
the user; the app never silently discards a side.

## Consequences

- (+) Zero-friction adoption, total data ownership, no ops burden;
  folder workspaces compose with git for versioning and team sharing.
- (+) The port keeps future backends (IndexedDB for quota, team sync
  services) as adapters, not rewrites.
- (−) The user's browser/folder is the **only copy** — hence the paranoia:
  migrations are mandatory for schema changes, quota is monitored
  (`storageQuota`), merge dialogs interrupt rather than guess.
- (−) No server means no server-side features (auth, comments, webhooks);
  anything needing one must be optional and self-hostable like the relay.
- (−) localStorage quota (~5MB) is a real ceiling for heavy users; the
  planned escape is an IndexedDB adapter, prioritized by user pain.
- Review rules: `localStorage` access outside `infrastructure/persistence/`
  and persisted-shape changes without migration are blocking defects.

## Amendment (2026-11-06) — the workspace moves to IndexedDB

**Context.** Generated diagrams reached ~1 MB of JSON each (657 elements, 711
connections). The whole workspace is one value, so four or five of them filled
localStorage's ~5 MB and the next save failed. Speed was not the issue: a save
costs ~6 ms. The escape this ADR planned was due
(openspec `indexeddb-workspace-storage`).

**Decision.**

- The diagram workspace is stored in IndexedDB (database `structura-workspace`,
  its own, so other IndexedDB users keep their versions) through
  `IndexedDbAdapter`, still behind `IStoragePort`. The persisted payload and its
  schema version are unchanged; only the location moves.
- `workspaceStorage` is the workspace's port. A boot, awaited before the first
  render, picks IndexedDB, or localStorage when IndexedDB is missing, fails or
  does not open in 3 s. `defaultStorage` stays localStorage for small keys
  (presets, integration configs, timestamps).
- An existing localStorage workspace is copied, read back, compared and only
  then deleted; a marker records the completed move. Both copies present with
  the marker: IndexedDB is used and nothing is deleted. Without it: the move is
  redone.
- The store never writes the workspace before it has read it, and a failed
  read is never taken for an empty workspace.
- IndexedDB has no synchronous write, so on `pagehide` the pending workspace is
  also written to the localStorage key `structura_diagram-store:rescue`, adopted
  at the next start when newer than the IndexedDB record, then removed.
- Storage health is measured against the origin quota
  (`navigator.storage.estimate()`) when the workspace is in IndexedDB.

**Consequences.**

- (+) A workspace is bounded by the origin quota (a share of free disk), not
  5 MB.
- (−) The first render waits for IndexedDB to open and be read.
- (−) A build from before this amendment reads localStorage only: rolled back
  after the move, it would start empty (the data stays in IndexedDB). A
  rollback must ship as a forward fix that copies the workspace back.
- (−) The rescue is best effort: if it does not fit in localStorage, the last
  debounce window's edits rely on the IndexedDB write made while the page is
  hidden.
- Review rules: the rule above now reads "`localStorage` or IndexedDB access for
  the workspace outside `infrastructure/persistence/`".

## Amendment: two storage boundaries

- **Workspace**: `IStoragePort` (`workspaceStorage`), unchanged.
- **Key-value preferences**: `infrastructure/persistence/kvStorage.ts` guards
  `localStorage`/`sessionStorage` (private mode, quota) and is the only way for
  the rest of the app to read or write user preferences, caches, one-shot flags
  and integration tokens (`readSecretItem`/`writeSecretItem`, a single seam for
  any later hardening). Keys are unchanged. `createZustandStorage()` backs every
  zustand `persist`.
- An ESLint rule (`no-restricted-globals` / `no-restricted-properties`) forbids
  `localStorage`/`sessionStorage` outside `src/infrastructure/persistence/` and
  tests, so the boundary is enforced rather than documented.
- Behaviour change: a failed preference write (quota) no longer throws into the
  caller; `kvSetItem` returns `false`.

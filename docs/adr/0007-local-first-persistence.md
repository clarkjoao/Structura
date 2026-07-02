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

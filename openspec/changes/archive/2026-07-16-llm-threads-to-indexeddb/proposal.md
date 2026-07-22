## Why

The LLM chat history in Structura has been growing in `localStorage` under `structura:llm:history` since the multi-thread change shipped. Conversations persist forever — every diagram, every session, every provider response — and `localStorage` is the wrong tool for the job on three counts. Quota: browsers cap `localStorage` at ~5–10 MB per origin; `IndexedDB` allows hundreds of MB without a practical ceiling. Concurrency: `localStorage` reads and writes are synchronous and block the main thread; `JSON.parse` of a long conversation log stalls the chat panel on panel-open. Structure: `localStorage` is a single key/value blob, so every read loads the entire diagram history into memory; `IndexedDB` supports indexed queries and per-record transactions. The previous OpenSpec (`llm-multiconnection-and-chat-ux`) noted this as deferred work in its Why section. This change delivers it, keeping the existing public store/UI surface intact — `loadThreadsForDiagram` and `saveThreadsForDiagram` keep their synchronous signatures and read/write a memory cache, while the IDB-backed store-and-load and the localStorage → IDB migration live in a new `llm-threads-idb` module (already drafted at `features/llm/llm-threads-idb.ts`).

## What Changes

- **New `llm-threads-idb` module** (already drafted): wraps a single IndexedDB object store (`structura → llm_threads`) keyed by `diagramId` with `loadThreadsFromIdb`, `saveThreadsToIdb`, `loadAllThreadsFromIdb`, and `migrateThreadsFromLocalStorageToIdb`. Includes a one-shot migration flag (`structura:llm:history:migratedToIdb`) so the legacy read path runs at most once per browser. Schema version is `1`.
- **In-memory cache populated at app boot**: `App.tsx` (or whichever shell owns lifecycle) dispatches an `initChatThreads` action on mount that calls `loadAllThreadsFromIdb` once and hydrates the LLM store. Subsequent `loadThreadsForDiagram(diagramId)` reads are synchronous against the cache; a cache miss falls back to an empty `{ threads: [], activeThreadId: "" }` entry stored back on next save.
- **Dual-write persistence**: every `saveThreadsForDiagram(diagramId, state)` writes to IDB (truth) and best-effort to a localStorage snapshot under the existing key. The snapshot is what a fresh load uses if IDB is unavailable (Safari private mode, quota exceeded) — keeps the user from losing their conversations in those edge cases.
- **Store API stays synchronous**: `loadHistoryForDiagram`, `createThread`, `switchThread`, `renameThread`, `deleteThread`, and the internal `persistActiveThread` keep their sync signatures. No hook, component, or test needs to change beyond the boot-time hydration in `App.tsx`.
- **New spec**: `llm-threads-idb` covers the contract — boot-time hydration, IDB as source of truth, fallback empty state, dual-write, migration flag.

## Capabilities

### New Capabilities

- `llm-threads-idb`: Persistent storage of LLM chat threads (per-diagram conversation history) in IndexedDB, with a one-shot migration from the legacy `localStorage` key and a graceful fallback when IndexedDB is unavailable.

### Modified Capabilities

<!-- None. The `llm-config` and `llm-chat-ux` specs from the previous change are unaffected — they already cover what users see; this change is purely about where the data lives. -->

## Impact

- **New module**: `features/llm/llm-threads-idb.ts` (already drafted in this branch).
- **Modified files**:
  - `features/llm/store.ts`: add `initChatThreads` action that hydrates the cache from IDB once.
  - `features/llm/llm-storage.ts`: `loadThreadsForDiagram`/`saveThreadsForDiagram` route through a memory cache populated by the boot-time hydration; `saveThreadsForDiagram` writes IDB + localStorage snapshot; import and delegate to `llm-threads-idb`.
  - `src/App.tsx` or analogous lifecycle shell: dispatch `initChatThreads()` once on mount.
- **i18n**: none — the user-visible behavior doesn't change.
- **Tests**: new `features/llm/llm-threads-idb.test.ts` for the IDB module (round-trip, migration idempotency, fallback when IDB unavailable). Update `features/llm/llm-storage.test.ts` and `features/llm/store.test.ts` to clear the in-memory cache between tests.
- **Persistence boundary**: the new IDB calls live inside `llm-threads-idb.ts` (a single module under `features/llm/`) — same boundary convention as the existing `llm-storage.ts`. Components continue to use the storage helper.
- **Bundle size**: no new dependency (no `fake-indexeddb`, no `idb` library) — uses the platform `indexedDB` global.
- **API keys stay in `localStorage`** for now — addressed in a follow-up Web Crypto change.

## Non-Goals

- **Not encrypting the conversation content**: messages may contain user-pasted snippets, but they're not credentials. The IDB move is about quota and concurrency, not encryption.
- **Not migrating `apiKey` storage to IDB / Web Crypto in this change**: tracked separately. `LLMConnection` stays in `localStorage` for now.
- **Not adding cross-tab synchronization via `BroadcastChannel`**: the migration is a one-shot on a single tab; cross-tab fan-out is a separate concern.
- **Not bumping the persistence schema version of the diagram store** (managed by `persist.config.ts`): chat history lives outside that keyspace; its own IDB version is `1`.
- **Not removing the localStorage snapshot** in this change: it's the graceful fallback when IDB is unavailable. A follow-up can retire it once telemetry confirms IDB availability.

## Deferred (for follow-up changes, not delivered here)

- Web Crypto / IndexedDB encryption for `LLMConnection.apiKey`.
- Cross-tab synchronization of active thread via `BroadcastChannel`.
- Quota / usage indicators backed by IDB size and per-diagram counts.
- Telemetry to retire the localStorage fallback once IDB availability is verified across supported browsers.

## Acceptance

1. `npm run typecheck`, `npm run lint`, `npm run test` — all green.
2. Manual: with several threads already in `localStorage` (legacy payload), reload the app once — threads appear in the chat panel and are persisted to IDB; a second reload reads from IDB without re-migrating; `localStorage["structura:llm:history:migratedToIdb"]` is `"1"`.
3. Manual: generate ~50 messages across 3 diagrams in a session — opening the chat panel does not freeze the UI; per-diagram query doesn't load the rest of the diagram histories.
4. Manual: in a Safari Private Window (or with `localStorage` quota artificially exceeded), the app still loads chat history from the localStorage snapshot.
5. `llm-threads-idb.test.ts` covers: round-trip read/write, idempotent migration, no-op when flag is already set, graceful fallback when `indexedDB` is undefined.

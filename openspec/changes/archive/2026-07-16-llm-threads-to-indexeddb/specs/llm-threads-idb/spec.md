## ADDED Requirements

### Requirement: Persistent chat threads in IndexedDB

The system SHALL persist LLM chat threads (per-diagram conversation history) inside an IndexedDB database named `structura`, in an object store named `llm_threads` keyed by `diagramId`. The schema version SHALL be `1`. Each record SHALL store a `DiagramThreadState` (a list of threads plus the active thread id for that diagram).

#### Scenario: First load after the change ships, with no legacy payload

- **WHEN** the application starts and the `structura` IndexedDB is empty
- **THEN** the LLM store boots up with empty thread state for the active diagram; `chatThreadsHydrated` is set to `true`; `loadThreadsForDiagram(diagramId)` returns `{ threads: [], activeThreadId: "" }` for any diagram.

#### Scenario: Boot hydrates the cache from IDB

- **WHEN** the application boots and there are records in the `llm_threads` object store
- **THEN** `initChatThreads()` populates the in-memory cache with every persisted `DiagramThreadState`; subsequent `loadThreadsForDiagram(diagramId)` reads come from the cache, not from IDB.

#### Scenario: Legacy localStorage payload migrates once

- **WHEN** the application boots and `localStorage["structura:llm:history"]` contains a legacy threads payload AND `localStorage["structura:llm:history:migratedToIdb"]` is **not** `"1"`
- **THEN** the payload is parsed, each diagram's threads are normalized to the new `DiagramThreadState` shape, written to IDB, and the flag is set to `"1"`; the legacy payload is now redundant (only kept as the fallback snapshot).

#### Scenario: Migration is idempotent

- **WHEN** `migrateThreadsFromLocalStorageToIdb` runs and the flag is already `"1"`
- **THEN** it SHALL be a no-op — no writes to IDB, no changes to the cache.

#### Scenario: IndexedDB unavailable in the runtime

- **WHEN** `indexedDB` is undefined (e.g. Safari Private Window, locked-down profile) OR IDB throws on open
- **THEN** `loadThreadsFromIdb(diagramId)` SHALL return `{ threads: [], activeThreadId: "" }`; `saveThreadsToIdb(diagramId, state)` SHALL silently no-op; `loadAllThreadsFromIdb()` SHALL return `{}`. The localStorage snapshot continues to be read and written as a fallback.

### Requirement: Dual-write persistence

The system SHALL keep the localStorage snapshot (`structura:llm:history`) in sync with IDB **after every write** of a `DiagramThreadState`, as a graceful fallback for runtimes without IDB. IDB remains the source of truth; localStorage is a recovery snapshot.

#### Scenario: Save in a normal runtime

- **WHEN** `saveThreadsForDiagram(diagramId, state)` runs and IDB is available
- **THEN** the in-memory cache entry is updated immediately (synchronous); IDB write is enqueued best-effort; the localStorage snapshot is rewritten with the full set of diagrams present in IDB at the moment of save.

#### Scenario: Save in a no-IDB runtime

- **WHEN** `saveThreadsForDiagram(diagramId, state)` runs and IDB is not available
- **THEN** the cache entry is updated; the localStorage snapshot is the only persisted surface; data is not lost on reload.

### Requirement: Sync store API preserved

The system SHALL keep the existing synchronous shape of the LLM store's thread actions: `loadHistoryForDiagram`, `createThread`, `switchThread`, `renameThread`, `deleteThread`, and the internal `persistActiveThread` continue to read and write through the in-memory cache populated by `initChatThreads()` on application boot. None of the React hooks (`useLLMChat`) or components (`ChatPanel`) shall be required to handle async thread storage.

#### Scenario: Panel opens a diagram after boot hydration has completed

- **WHEN** `useLLMChat` mounts and `activeDiagramId` is the current diagram AND `chatThreadsHydrated === true`
- **THEN** `loadHistoryForDiagram(activeDiagramId)` returns the cached state synchronously and the panel renders the full thread list on the first paint — no loading state.

#### Scenario: Panel opens a diagram before boot hydration has completed

- **WHEN** `useLLMChat` mounts and `chatThreadsHydrated === false`
- **THEN** `loadHistoryForDiagram(activeDiagramId)` falls back to the legacy `localStorage` payload so existing data still appears; once hydration completes it overwrites the cache and a subsequent re-mount or diagram switch reads the IDB-hydrated state.

### Requirement: Cross-process persistence boundary

The new IDB module SHALL live at `features/llm/llm-threads-idb.ts` (single module) and SHALL NOT be imported directly by any React component. Components continue to read/write through `features/llm/llm-storage.ts` helpers and through the LLM store actions — the same persistence boundary established in `llm-config`.

#### Scenario: Components don't touch IndexedDB directly

- **WHEN** grepping for `indexedDB` in `src/features/llm/components/**` and `src/features/canvas/chat/**`
- **THEN** the search SHALL return zero matches — all IDB access lives inside `features/llm/llm-threads-idb.ts`.

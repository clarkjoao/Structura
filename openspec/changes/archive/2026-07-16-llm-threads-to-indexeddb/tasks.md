## 1. Wire the new IDB module into the storage layer

- [x] 1.1 Import `loadThreadsFromIdb`, `loadAllThreadsFromIdb`, `saveThreadsToIdb`, `migrateThreadsFromLocalStorageToIdb` from `./llm-threads-idb` in `features/llm/llm-storage.ts`.
- [x] 1.2 Add an in-memory cache (`Record<string, DiagramThreadState>`) and a hydration flag (`chatThreadsHydrated`) to `llm-storage.ts`, exported via `getChatThreadsCache()` and `setChatThreadsCacheEntry(diagramId, state)` for the store to integrate.
- [x] 1.3 Rewrite `loadThreadsForDiagram(diagramId)`:
  - If `chatThreadsHydrated` is true, return from the cache.
  - If false, fall back to the legacy `localStorage` payload via the existing `migrateLegacyThreads` (preserves behavior before the boot hydration runs).
  - On cache miss (diagramId not in cache after hydration), return `{ threads: [], activeThreadId: "" }`.
- [x] 1.4 Rewrite `saveThreadsForDiagram(diagramId, state)`:
  - Update the cache entry first.
  - Fire-and-forget write to IDB via `saveThreadsToIdb` (no awaited call from the store action; we accept eventual consistency on save).
  - Best-effort update of the localStorage snapshot via the existing helper so the fallback case still has data.
- [x] 1.5 Keep `loadConfigFromLocalStorage`/`saveConfigToLocalStorage` and the connections migration untouched — those still use `localStorage`.

## 2. One-shot migration

- [x] 2.1 On first load after the cache is hydrated (or, more robust, on the first `loadThreadsForDiagram` call after hydration): call `migrateThreadsFromLocalStorageToIdb(localStorage["structura:llm:history"])`. The flag makes this idempotent.
- [x] 2.2 After the migration completes, reload the cache from IDB and overwrite the localStorage snapshot so the fallback path matches.
- [x] 2.3 Document the localStorage shape only as the fallback; the IDB is the source of truth.

## 3. Store integration

- [x] 3.1 Add a new action `initChatThreads()` to `useLLMStore` that:
  - Calls `loadAllThreadsFromIdb()`.
  - On IDB unavailable: feeds `migrateLegacyThreads(localStorage["structura:llm:history"])` into `llm-storage`'s cache.
  - On IDB available: feeds the IDB payload; also runs the legacy migration when the flag is unset, then re-reads IDB.
  - Sets `chatThreadsHydrated = true` in the storage helper.
- [x] 3.2 The action must be **idempotent** — calling it twice in the same session is a no-op the second time.
- [x] 3.3 The existing `loadHistoryForDiagram`, `createThread`, `switchThread`, `renameThread`, `deleteThread`, and `persistActiveThread` continue to call `load/saveThreadsForDiagram` synchronously. No public API change.

## 4. Boot-time hydration in the app shell

- [x] 4.1 Locate the route-level shell that owns `localStorage`/`init` lifecycle (likely `src/App.tsx`, `src/pages/workspace`, or `src/components/AppShell` — verify before editing).
- [x] 4.2 Add a `useEffect(() => { useLLMStore.getState().initChatThreads(); }, [])` in that shell.
- [x] 4.3 Confirm `ChatPanel`'s `useEffect` (the one that already calls `loadHistoryForDiagram(activeDiagram.id)`) still races the boot hydration correctly: if the hydration is in flight when the panel mounts, the panel either waits (via `threadsReady`) or shows an empty chat for ~one paint. No data corruption either way.

## 5. Tests

- [x] 5.1 New `features/llm/llm-threads-idb.test.ts` using a minimal manual mock of `indexedDB` (the platform object) — keep the mock surface small (`open`, `transaction`, `objectStore`, `get`/`put`/`getAll`); fall back to `getAll → {}` and `put → resolve` when IDB is undefined so the test can simulate Safari private mode.
- [x] 5.2 Verify: round-trip write/read with arbitrary `DiagramThreadState`; migration from a legacy JSON payload moves records; second call with the same payload is a no-op (flag); graceful fallback when `indexedDB` is undefined.
- [x] 5.3 Update `features/llm/llm-storage.test.ts` to reset the in-memory cache between tests (use a `resetLLMStorageForTests()` helper).
- [x] 5.4 Update `features/llm/store.test.ts` to seed `initChatThreads` before exercising thread actions.

## 6. Verification

- [x] 6.1 `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [ ] 6.2 Manual: legacy threads present in `localStorage["structura:llm:history"]` (build up a few via the chat), reload the app — threads appear; `localStorage["structura:llm:history:migratedToIdb"]` is `"1"`; opening DevTools → Application → IndexedDB → `structura` → `llm_threads` shows the same diagrams/threads.
- [ ] 6.3 Manual: produce ~50 messages across 3 diagrams; verify the chat panel opening is responsive (no main-thread freeze on `JSON.parse`).
- [ ] 6.4 Manual: disable IndexedDB in DevTools (or open Safari Private Window) — confirm chat still renders from the localStorage snapshot.
- [x] 6.5 Archive this change as `2026-07-16-llm-threads-to-indexeddb` (or current date) once green.

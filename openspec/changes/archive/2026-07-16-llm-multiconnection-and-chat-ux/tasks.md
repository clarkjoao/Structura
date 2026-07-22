## 1. Domain types and storage schema

- [x] 1.1 In `features/llm/types.ts`: extend `LLMProvider` to `"openai" | "anthropic" | "custom"`; add `LLMConnection` (`id`, `name`, `mode`, `provider`, `baseUrl?`, `authHeader?`, `apiKey`, `model`, `extraHeaders?`, `extraParams?`); extend `ConversationThread` with `id: string` and `title: string`; export the new shapes from `features/llm/index.ts`.
- [x] 1.2 In `features/llm/llm-storage.ts`: replace `LLM_CONFIG_STORAGE_KEY` / `PROVIDER_KEY_STORAGE` (still defined inside `LLMSettings.tsx` — see 1.4) with a single `LLM_CONNECTIONS_STORAGE_KEY` payload `{ connections: LLMConnection[]; activeConnectionId: string }`. Add `loadConnections` / `saveConnections` (atomic write). Default state: one `proxy`-mode connection (mirrors today's default) with `activeConnectionId` set.
- [x] 1.3 In `features/llm/llm-storage.ts`: replace `loadThreadFromStorage` / `saveThreadToStorage` with `loadThreadsForDiagram` / `saveThreadsForDiagram` returning/persisting `{ threads: ConversationThread[]; activeThreadId: string }` per diagram. Storage key can stay (`structura:llm:history`) — only its value shape changes.
- [x] 1.4 In `features/llm/llm-storage.ts`: add `migrateLegacyConfig(rawConfig, rawKeys)` and `migrateLegacyThreads(rawThreads)`. Both pure functions with full unit coverage. Behavior described under §2.
- [x] 1.5 Add a `__tests__/llm-storage.test.ts` (next to `patch-parser.test.ts`) covering: (a) no legacy state → default connection; (b) legacy config + keys → migrated single connection preserving mode/provider/apiKey/model; (c) legacy thread per diagram → first thread in new shape, default `activeThreadId`; (d) re-running migration is idempotent.

## 2. OpenAI-compatible transport extraction

- [x] 2.1 Create `features/llm/providers/openai-compatible.ts` exporting `sendOpenAICompatibleMessage({ baseUrl, headers, body, errorOrigin }, onChunk): Promise<string>` — the streaming+SSE parser logic moved verbatim from `providers/openai.ts`. Keep error origin as `"openai" | "custom"` so the `LLMProviderError` stays informative.
- [x] 2.2 Rewrite `features/llm/providers/openai.ts` to a thin wrapper: fixed `baseUrl = "https://api.openai.com/v1"`, fixed headers (`Authorization: Bearer …`, `Content-Type: application/json`), request body with `model`, `max_tokens`, `stream: true`, `messages: [{role:"system",content:systemPrompt}, …messages]`. Delegates to `sendOpenAICompatibleMessage`. Same external signature (`sendMessage(config, messages, systemPrompt, onChunk)`).
- [x] 2.3 Add `features/llm/providers/custom.ts` exporting `sendMessage(config, messages, systemPrompt, onChunk)` that builds the headers (default `Authorization: Bearer <apiKey>`, overridable via `authHeader`) and merges `extraHeaders` + `extraParams` into the request body, then delegates to `sendOpenAICompatibleMessage`.
- [x] 2.4 `providers/anthropic.ts` and `providers/proxy.ts` stay unchanged. The dispatcher in `store.ts` gains `if (provider === "custom") return sendCustomMessage(activeConnection, …);`.

## 3. Curated model presets per provider

- [x] 3.1 Refactor `features/llm/model-presets.ts`: export `MODEL_PRESETS: Record<LLMProvider, ModelPreset[]>` with `openai`, `anthropic`, and `custom: []`. Confirmed up-to-date IDs: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini` for `openai`; `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-sonnet-5` (latest label) for `anthropic`. Drop `o3-mini` (deprecated). Add `deprecated?: boolean` for follow-up sunset dates without forcing removal.
- [x] 3.2 Add a `ModelPreset` helper `getPresetsForProvider(provider)`; `useLLMSettings` and `useLLMSelector` read via the helper, not the bare array.
- [x] 3.3 Add `__tests__/model-presets.test.ts` verifying the indexable record (provider lookups, custom is empty, all entries have non-empty `model`).

## 4. Connection-aware store and thread actions

- [x] 4.1 In `features/llm/store.ts`: state grows with `connections`, `activeConnectionId`, `threadsByDiagram: Record<diagramId, { threads; activeThreadId }>`. `sendMessage` resolves the active connection via `activeConnectionId`; `setLLMConfig` becomes `setActiveConnectionId(id)`; old `setLLMConfig(config: LLMConfig)` keeps the same name to minimize UI churn (resolves into `activeConnectionId`) — see 4.2.
- [x] 4.2 Add `createConnection(draft)`, `updateConnection(id, patch)`, `duplicateConnection(id)`, `removeConnection(id)`, `setActiveConnection(id)` actions. The active connection cannot be removed — the store rejects and the UI prompts to switch first.
- [x] 4.3 Add `createThread(diagramId)`, `switchThread(diagramId, threadId)`, `renameThread(diagramId, threadId, title)`, `deleteThread(diagramId, threadId)` actions. `createThread` generates the title from the first user message (truncate to 60 chars; fallback to "Nova conversa" / "New conversation"). Old `clearHistory` becomes a thin wrapper that calls `createThread` and discards pending state — kept to avoid breaking exports temporarily, removed once the panel uses the new thread primitive directly.
- [x] 4.4 `loadHistoryForDiagram` continues to receive `diagramId` and now also sets the active thread from storage (or the first one if none).

## 5. Settings UI: connection manager + custom-provider fields

- [x] 5.1 Rewrite `features/llm/components/LLMSettings.tsx` to render a connection list (name + provider badge + model) on the left / top, and the selected connection's form on the right / below. Buttons: create new, duplicate, delete (disabled for the active one until user switches), save. Closing the panel persists.
- [x] 5.2 In the per-connection form, replace the bare `Input` for model with a `<select>` populated by `getPresetsForProvider(provider)`. A trailing `<option value="__custom__">{t("llmChat.settings.modelCustom")}</option>` reveals a text input underneath. For `provider === "custom"`, skip the dropdown and render the text input directly (presets are empty).
- [x] 5.3 When `provider === "custom"` (and `mode === "direct"`), render the new fields: `Base URL` (required, validated as `https?://` URL on save), `Auth header name` (default `Authorization`) + `apiKey`, and a collapsed "Advanced" section with two textareas for `extraHeaders` and `extraBodyParams` parsed as JSON on save. On invalid JSON, surface a localized error and block save.
- [x] 5.4 CORS-specific message for `custom` errors: extend the existing `error.cors` key with a provider-conditional note (e.g. "The endpoint must allow browser-origin requests; Structura can't bypass server-side CORS."). Document the addition under §7 i18n.

## 6. Chat footer quick switcher + thread history popover

- [x] 6.1 Rewrite `features/llm/components/LLMSelector.tsx` to iterate over `connections` from the store (instead of `MODEL_PRESETS`). Each entry shows `name` + a small `provider`/`model` badge; selecting switches `activeConnectionId`. Append a separator and a "Manage connections…" entry that calls into the same `onOpenSettings` callback `ChatPanel` already exposes for the gear icon.
- [x] 6.2 In `features/llm/components/ChatPanel.tsx`: replace the `Plus` `onClick = clearHistory` with `createThread(activeDiagramId)`. Add a thread-history popover on the chat title (clickable, lists threads with relative timestamp + active check; actions: switch, rename inline, delete with confirm). Empty state when only one thread exists is still rendered, but the header item can stay disabled.
- [x] 6.3 Wire the new store actions into `useLLMChat.ts` (`features/canvas/chat/`): expose `activeConnection`, `connections`, `setActiveConnection`, `threads`, `activeThread`, `createThread`, `switchThread`, `renameThread`, `deleteThread`, `openSettings`. Keep `clearHistory` as a deprecated alias of `createThread` for now.

## 7. i18n keys (both `en.json` and `pt-BR.json`)

- [x] 7.1 `llmChat.settings.*` — extend with `connectionsTitle`, `connectionNew`, `connectionDuplicate`, `connectionDelete`, `connectionDeleteConfirm`, `cannotDeleteActive`, `connectionName`, `manageConnections`, `modelCustom`, `modelCustomPlaceholder`.
- [x] 7.2 `llmChat.settings.customProvider.*` — `baseUrl`, `baseUrlRequired`, `baseUrlInvalid`, `authHeader`, `apiKeyLabel`, `extraHeaders`, `extraHeadersHint`, `extraBodyParams`, `extraBodyParamsHint`, `extraJsonInvalid`.
- [x] 7.3 `llmChat.error.corsCustom` — provider-conditional guidance for the `custom` flow ("…verifique se o endpoint libera requisições do navegador…").
- [x] 7.4 `llmChat.threads.*` — `historyLabel`, `newThread`, `rename`, `renamePlaceholder`, `delete`, `deleteConfirm`, `empty`, `titleFallback`. Confirm dialog copy lives under `common.confirm` if available, otherwise under `llmChat.threads.deleteConfirm`.
- [x] 7.5 Mirror every new key in both locales; verify spacing/punctuation matches the convention in the surrounding file (colons, double quotes, no trailing commas).

## 8. Overflow fixes in chat panel (no behavior change)

- [x] 8.1 `MentionInput.tsx`: add `whitespace-pre-wrap break-words overflow-x-hidden` (and Tailwind equivalents) to the `contentEditable` `<div>`; confirm the outer `<div className="relative">` wrapper has `min-w-0` so the editor can shrink inside the flex parent.
- [x] 8.2 `MarkdownContent.tsx`: add `break-words` to the root `.text-sm.leading-relaxed` container. Verify inline `<code>` (in `markdownComponents.code`) and the `<p>` renderer also opt into wrapping.
- [x] 8.3 `ChatMessage.tsx`: ensure the inner `max-w-[85%]` bubble has `min-w-0` so the flex parent constrains it; verify URL links inside the markdown renderer don't break out.
- [x] 8.4 `ChatPanel.tsx`: add `overflow-x-hidden` to the scroll container (`overflow-y-auto`) as a safety belt.

## 9. Tests

- [x] 9.1 `llm-storage.test.ts` (see 1.5) — migration equivalence + thread CRUD round-trip.
- [x] 9.2 `model-presets.test.ts` (see 3.3).
- [x] 9.3 `providers/openai-compatible.test.ts` — request assembly for `baseUrl`, header name override (`x-api-key`), extra headers, extra body params merged correctly; error path throws `LLMProviderError` with the supplied `errorOrigin`. Mock `fetch` via `vi.fn`. Don't make real network calls.
- [x] 9.4 Add store-level tests for `createConnection` / `setActiveConnection` / `createThread` / `switchThread` / `renameThread` / `deleteThread` (Zustand actions are pure functions — call them against a freshly-initialised store, assert the in-memory and persisted shape).
- [x] 9.5 Confirm existing `patch-parser.test.ts` and `serializer.test.ts` still pass — neither file is touched, but the type exports they transitively use shift.

## 10. Verification

- [x] 10.1 `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [x] 10.2 Manual: paste a long unbreakable URL into the input — panel does not scroll horizontally; the same URL inside an assistant reply renders wrapped to fit.
- [x] 10.3 Manual: create two connections (Anthropic + custom pointing at an OpenAI-compatible endpoint). Switch between them from the quick selector without opening Settings; confirm the active badge updates and the request carries the right base URL.
- [x] 10.4 Manual: create a thread, send a few messages, click "+" to start a second thread, then reopen the first one — all prior messages are still there.
- [x] 10.5 Manual: open Settings, copy `localStorage` shape before and after creating a connection; confirm the legacy `structura:llm:config` payload is migrated to the new key on first load (no leftover legacy entries).

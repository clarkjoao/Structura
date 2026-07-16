## Why

Today's LLM chat in Structura is usable but inflexible: there is exactly one global configuration (provider + API key + model), the model field is free-text typed by the user, only OpenAI-style and Anthropic-style presets are offered, and "Override OpenAI Base URL"-style setups — the de-facto way to point at OpenRouter, LiteLLM, vLLM, Ollama, or a corporate proxy — are not expressible at all. On the chat side, two related sharp edges bite users: pasting a long URL or token into either the input or an assistant reply produces a horizontal scroll on the chat panel (the `contentEditable` editor and markdown containers do not break words), and clicking "+" deletes the entire conversation permanently — there is no per-diagram thread history. This change introduces named multi-connection LLM configuration (with a real OpenAI-compatible "custom" provider that covers the Cursor-style base-URL override use case), a curated model selector tied to the active provider, multi-thread chat history per diagram, and tightens the chat container so URL-shaped strings wrap instead of overflowing — all without altering the diagram patch protocol (`ADD_NODE`/`UPDATE_NODE`/`ADD_EDGE`/…) or the `AnalysisPanel`.

## What Changes

- **New LLM provider `custom`** (OpenAI-compatible): the user supplies a base URL, an auth header name + token, optional extra request headers, and optional extra body parameters (parsed from a JSON textarea). Errors of kind `cors` on a `custom` connection surface guidance about server-side CORS configuration.
- **Generic OpenAI-compatible transport** extracted from `providers/openai.ts` into a reusable `sendOpenAICompatibleMessage(baseUrl, headers, requestBody, onChunk, errorOrigin)` helper, used by both the preset `openai` provider (hard-coded base URL) and the `custom` provider.
- **Curated, contextual model selector**: `model-presets` becomes `Record<LLMProvider, ModelPreset[]>` indexed by provider. `LLMSettings` renders a `<select>` listing presets for the currently-selected provider plus a final "Other (type manually)" option that reveals a free-text input. The `custom` provider skips the dropdown and stays in free-text mode.
- **Multi-connection named configuration**: introduce `LLMConnection` (id, name, mode, provider, baseUrl?, authHeader?, apiKey, model, extraHeaders?, extraParams?). Persisted shape becomes `{ connections: LLMConnection[]; activeConnectionId: string }`. Existing `structura:llm:config` + `structura:llm:keys` payloads are migrated on load into a first connection — users never lose configuration.
- **Multi-thread chat history per diagram**: `ConversationThread` gains `id` and `title` (derived from the first user message). Storage becomes `Record<diagramId, { threads: ConversationThread[]; activeThreadId: string }>`. Old `Record<diagramId, ConversationThread{messages}>` payloads are migrated into the first thread of each diagram on load. The "+" button creates a new thread instead of wiping history; a thread-history popover (accessible from the chat header) allows switching, renaming, and deleting threads (delete is confirmable and irreversible).
- **Quick model switcher** in the chat footer (`LLMSelector`): lists saved connections (name + provider/model badge); selecting one updates `activeConnectionId` in the store. A "Manage connections…" entry opens the full `LLMSettings` panel.
- **Chat panel layout fixes (no behavior change)**: `MentionInput`, `MarkdownContent`, and the message list container gain explicit word-breaking / horizontal overflow suppression so URL-shaped strings wrap inside the panel. `<pre>` code blocks keep their existing `overflow-x-auto` behavior — only prose wraps.
- **i18n** additions under `llmChat.*` in both `en.json` and `pt-BR.json` for every new label, placeholder, button, error hint, and confirmation.

## Capabilities

### New Capabilities

- `llm-config`: User-facing LLM connection management — multiple named connections, provider selection (`openai` / `anthropic` / `custom`), model selection (preset list per provider + manual override), OpenAI-compatible `custom` transport with configurable base URL / auth header / extra headers / extra body parameters, and the migration from the previous single-config + provider-key storage into the new connection model.
- `llm-chat-ux`: Per-diagram multi-thread chat history (create / switch / rename / delete) plus chat-panel overflow handling — wrapping of long URL-shaped text in both the input and assistant replies, no change to the underlying message protocol.

### Modified Capabilities

<!-- None. The patch protocol and AnalysisPanel are out of scope and untouched. -->

## Impact

- **Domain (`features/llm/types.ts`)**: `LLMProvider` gains `"custom"`; `LLMConfig` is preserved (proxy mode is unchanged) but a new `LLMConnection` interface is added; `ConversationThread` gains `id` and `title`.
- **Storage (`features/llm/llm-storage.ts`)**: schema-key bump from `structura:llm:config` + `structura:llm:keys` to a single `structura:llm:connections` payload; thread storage key changes to a `Record<diagramId, { threads, activeThreadId }>` shape. In-place migration runs at load time (no separate migration schema version needed — the helper test owns the equivalence).
- **Providers (`features/llm/providers/openai.ts`, `anthropic.ts`, new `openai-compatible.ts`)**: shared streaming transport extracted; `openai.ts` becomes a thin preset wrapper; new `custom.ts` (or `openai-compatible.ts`) parameterized on connection.
- **Store (`features/llm/store.ts`)**: state gains `connections`, `activeConnectionId`, per-diagram `threadsByDiagram` and `activeThreadIdByDiagram`; new actions `createConnection`, `updateConnection`, `duplicateConnection`, `removeConnection`, `setActiveConnection`, `createThread(diagramId)`, `switchThread(threadId)`, `renameThread`, `deleteThread`. `clearHistory` is deprecated in favor of `createThread`.
- **UI (`features/llm/components/*` and `features/canvas/chat/*`)**:
  - `LLMSettings.tsx` becomes a connection manager (list + create/edit/duplicate/remove + per-connection form, including the new `custom` fields).
  - `LLMSelector.tsx` reads from `connections` and switches the active one inline; "Manage connections…" entry opens settings.
  - `ChatPanel.tsx` swaps the "+" handler to `createThread` and exposes the thread-history popover in the header.
  - `MentionInput.tsx`, `ChatMessage.tsx`, `MarkdownContent.tsx` add `whitespace-pre-wrap break-words overflow-x-hidden` (and friends) so long unbreakable tokens wrap.
- **i18n (`infrastructure/i18n/locales/en.json`, `pt-BR.json`)**: new keys under `llmChat.*` (settings, connections, threads, custom provider fields, CORS hint, "manage connections", etc.).
- **Tests (`features/llm/*.test.ts`)**: migration tests (legacy config → first connection; legacy thread → first thread of diagram without data loss); thread CRUD; `sendOpenAICompatibleMessage` request assembly (base URL, headers, extra params merged).
- **Persistence boundary**: stays inside `llm-storage.ts` and respects the `IStoragePort` rule — `localStorage` is not touched directly from React components.

## Non-Goals

- **No changes to the diagram patch protocol (`ADD_NODE` / `UPDATE_NODE` / `ADD_EDGE` / `REMOVE_NODE` / `REMOVE_EDGE` / `INSERT_PATTERN` / `AUTO_LAYOUT` / `GET_TAGS`)** or to the `AnalysisPanel`. Their parsers, serializers, and rendering stay untouched.
- **No change to the `proxy` mode** beyond keeping it working — `providers/proxy.ts` remains a mode, not a feature, and gains no new affordances.
- **No themed redesign** — this is a reorganization of affordances (where buttons go, what they reveal). Tokens, color palette, and the existing visual language of `ChatPanel` / `LLMSettings` are preserved.
- **No function-calling / streaming tool-use for the `custom` provider** — the JSON-extra-params textarea is a straight merge into the OpenAI-shaped request body. Endpoints that diverge from the OpenAI streaming shape (e.g. custom event types) may need a follow-up.
- **No collaboration-sync of chat threads** — threads are still per-browser, like connections.
- **No token-by-token streaming of the `custom` SSE format** beyond what the existing OpenAI-compatible reader already supports. Endpoints that emit a non-`data: {choices:[{delta:{content}}]}` shape will fall back to whatever their first chunk yields (this is documented deferred work below).
- **No OAuth / device-code flows** for `custom` — only header-based auth, configurable through the UI.
- **No retroactive history import** beyond the schema migration — users whose chats predate this change keep their one thread per diagram, now reachable through the history popover.

## Deferred (documented for follow-up, not delivered here)

- Streaming-shape detection for non-OpenAI-compatible endpoints (e.g. self-hosted models that emit a different SSE delta structure).
- Cross-tab synchronization of `activeConnectionId` and active thread via `BroadcastChannel`.
- Per-connection usage / quota indicators from each provider's response headers.
- Reusing saved connections in future features outside the chat (e.g. auto-label or "explain this diagram" buttons embedded elsewhere).

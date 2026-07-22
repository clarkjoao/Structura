# llm-chat-ux Specification

## Purpose
TBD - created by archiving change llm-multiconnection-and-chat-ux. Update Purpose after archive.
## Requirements
### Requirement: Multi-thread history per diagram

The system SHALL persist chat history as `Record<diagramId, { threads: ConversationThread[]; activeThreadId: string }>` where each thread carries `id`, `diagramId`, `title` (derived from the first user message; truncated), `messages`, `createdAt`, and `updatedAt`. The diagram's `activeThreadId` SHALL drive which thread is rendered in the chat panel; switching diagrams SHALL switch the active thread independently and MUST NOT collapse threads across diagrams.

#### Scenario: Opening a diagram surfaces its threads

- **WHEN** the user opens a diagram that already has threads persisted
- **THEN** the panel renders the thread whose id matches `activeThreadId`, including all of its messages, in chronological order.

#### Scenario: New chat creates a thread instead of clearing

- **WHEN** the user clicks the "+" button in the chat header
- **THEN** the store calls `createThread(diagramId)`, a new empty `ConversationThread` becomes active, and the previous thread (with all its messages) is preserved in `threads` for that diagram and remains reachable through the history popover.

#### Scenario: Title is derived from the first user message

- **WHEN** the user sends the first message in a freshly created thread
- **THEN** the thread's `title` becomes the first 60 characters of that message (with an ellipsis if truncated); if the user has not yet sent any message, the title SHALL fall back to the localized "New conversation" label.

#### Scenario: Switching threads preserves both message lists

- **WHEN** the user switches from thread A to thread B in the same diagram
- **THEN** the chat panel renders thread B's messages; thread A's messages are unchanged in storage and reappear if the user switches back.

#### Scenario: Renaming a thread

- **WHEN** the user renames an active or inactive thread
- **THEN** the new title is persisted in storage and reflected immediately in the history popover without any message loss.

#### Scenario: Deleting an active thread starts a fresh one

- **WHEN** the user confirms deletion of the active thread
- **THEN** it is removed from `threads`; if other threads remain, the most recent one becomes active; if none remain, `createThread(diagramId)` is called and the new (empty) thread becomes active. Deletion MUST be confirmed by the user before storage is mutated.

### Requirement: Thread history migration

The system SHALL migrate any pre-existing `Record<diagramId, ConversationThread{messages}>` payloads (no `id`, no `title`) into the new per-diagram container. Each legacy thread becomes the first entry of `threads` for its diagram; the previous `activeThreadId` defaults to that thread's id.

#### Scenario: Legacy single-thread payload migrates without data loss

- **WHEN** the storage value is `Record<diagramId, { diagramId, messages: ChatMessage[], updatedAt }>` (no `id` / `title`)
- **THEN** the loader produces `Record<diagramId, { threads: [ConversationThread{id, diagramId, title:"…", messages:<same>, createdAt:updatedAt, updatedAt}], activeThreadId: <that id> }>` and persists the new shape; no message is dropped and no field is silently rewritten.

#### Scenario: Migration is idempotent

- **WHEN** migration runs on data that already conforms to the new shape
- **THEN** the resulting structure is identical and no extra write is performed if the data is unchanged.

#### Scenario: Missing history

- **WHEN** no history payload exists for the active diagram
- **THEN** the panel renders the empty/suggestions state for the new (default) thread; `activeThreadId` is set to the new thread's id.

### Requirement: Quick model switcher in chat

The `LLMSelector` component SHALL list the connections persisted in the LLM connection storage (name + provider/model badge) instead of the static `MODEL_PRESETS` array. Selecting an entry SHALL update `activeConnectionId` in the store immediately and cause the next request to use the chosen connection. A trailing "Manage connections…" entry SHALL open the full Settings panel.

#### Scenario: Selecting a connection switches the active model

- **WHEN** the user picks a different connection in the quick selector
- **THEN** `activeConnectionId` is updated, the displayed label in the selector reflects the new connection, and the next chat request uses that connection's provider, base URL, headers, and model.

#### Scenario: Out-of-sync key from the previous bug is fixed

- **WHEN** the user picks an entry whose `provider` differs from the previously active one
- **THEN** the request uses the new connection's `apiKey` (not the previous connection's key), preventing the latent "wrong key for the chosen provider" bug observed in the old static selector.

#### Scenario: Manage connections opens settings

- **WHEN** the user picks "Manage connections…" in the quick selector
- **THEN** the Settings panel opens on top of the chat panel, without losing the current chat scroll position.

### Requirement: Chat panel overflow handling

The chat panel's input, assistant message container, and message list SHALL wrap long URL-shaped text inside the panel without producing a horizontal scroll. The behavior of the `<pre>` code blocks (`overflow-x-auto`) SHALL be preserved — code blocks keep their horizontal scroll, only prose wraps.

#### Scenario: Long URL in the input does not overflow

- **WHEN** the user types or pastes an unbreakable string into the `MentionInput` editor
- **THEN** the editor wraps the text within the panel's width; no horizontal scroll appears on the panel, on the editor itself, or on the chat container. The same is true for spaces inserted later or mentions inserted around it.

#### Scenario: Long URL in an assistant reply does not overflow

- **WHEN** an assistant message contains a long unbreakable string (URL, path, token)
- **THEN** the markdown renderer wraps the text within the message bubble's `max-w-[85%]` width; the panel's vertical scroll container remains the only scrollable axis. `<pre>` code blocks, if present in the same message, still horizontally scroll locally.

#### Scenario: Wide code blocks keep their scrolling

- **WHEN** a message contains a code block wider than the bubble
- **THEN** the `<pre>` element scrolls horizontally as before (intentional behavior, explicitly preserved); the surrounding prose does not.

### Requirement: Hard-rule survival

This capability SHALL continue to observe project hard rules: i18n (every new label/button/placeholder/confirm is `t("llmChat.*")` with both locales), no `any`, persistence via the storage helper (no `localStorage` access outside `features/llm/llm-storage.ts`), and no mutation of structural diagram state — the patch protocol and `AnalysisPanel` are explicitly untouched.

#### Scenario: New strings have both locales

- **WHEN** new UI strings are introduced
- **THEN** the corresponding `llmChat.*` keys exist in both `en.json` and `pt-BR.json`; a test that enumerates every `t("llmChat.*")` call site and looks the key up in each locale MUST resolve without `undefined`.

#### Scenario: No localStorage leak

- **WHEN** searching `localStorage.` usage across `features/llm/components/**` and `features/canvas/chat/**`
- **THEN** the search SHALL return zero matches — all persistence goes through `features/llm/llm-storage.ts`.


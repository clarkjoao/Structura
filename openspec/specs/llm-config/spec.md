# llm-config Specification

## Purpose

TBD - created by archiving change llm-multiconnection-and-chat-ux. Update Purpose after archive.

## Requirements

### Requirement: Connection storage

The system SHALL persist LLM configuration as a single localStorage payload under `structura:llm:connections` of shape `{ connections: LLMConnection[]; activeConnectionId: string }`. The active connection SHALL be the one used for the next chat request. Every UI string surfaced while reading, writing, or explaining connections SHALL be obtained through `t("llmChat.*")` with entries present in both `en.json` and `pt-BR.json`.

#### Scenario: Default state when nothing has been saved

- **WHEN** the application starts and no `structura:llm:connections` payload exists
- **THEN** the system SHALL create exactly one default connection in `proxy` mode with provider `openai`, model `gpt-4o-mini`, empty `apiKey`, mark it as active, and persist the new payload to storage before the chat is interactive.

#### Scenario: Read and write are atomic

- **WHEN** any code path writes the connection list
- **THEN** the system SHALL serialise the full `{ connections, activeConnectionId }` payload in a single `localStorage.setItem` call — no partial / interleaved writes.

### Requirement: Named connection lifecycle

The system SHALL support creating, updating, duplicating, removing, and activating connections through dedicated store actions. Connections SHALL be identified by a stable `id` (`crypto.randomUUID()`).

#### Scenario: Create a connection

- **WHEN** the user clicks "New connection" in Settings and submits the form
- **THEN** a new `LLMConnection` is appended to `connections`, `activeConnectionId` is updated to the new id, and the payload is persisted.

#### Scenario: Update an existing connection

- **WHEN** the user edits any field of a saved connection and presses Save
- **THEN** the corresponding entry in `connections` is replaced in-place (same `id`, new field values), `activeConnectionId` is unchanged, and the payload is persisted.

#### Scenario: Duplicate a connection

- **WHEN** the user clicks the duplicate action on a connection
- **THEN** a new entry is appended whose fields are copied from the source except `id` (fresh UUID), `name` (suffixed `" (cópia)"` / `" (copy)"`), and `apiKey` is preserved.

#### Scenario: Remove a non-active connection

- **WHEN** the user confirms deletion of a connection that is not the active one
- **THEN** it is removed from `connections`; if it was the only one, a new default connection takes its place; the payload is persisted.

#### Scenario: Removing the active connection is forbidden until the user switches

- **WHEN** the user attempts to delete the active connection without first selecting another
- **THEN** the action SHALL be rejected with a localized message and no storage mutation occurs.

### Requirement: Migration from legacy single-config storage

The system SHALL migrate any pre-existing `structura:llm:config` + `structura:llm:keys` payloads into the new connection storage on first load. Migration SHALL be loss-less for any value the previous model accepted (mode, provider, model, apiKey) and MUST be idempotent — re-running the migration on already-migrated data leaves it unchanged.

#### Scenario: Legacy config + provider keys migrates to a single connection

- **WHEN** the application loads and the only persisted configuration is `{ mode: "direct", provider: "openai", apiKey: "sk-…", model: "gpt-4o" }` plus `{ openai: "sk-…", anthropic: "" }`
- **THEN** the loader SHALL produce `{ connections: [{ id, name: "OpenAI", mode: "direct", provider: "openai", apiKey: "sk-…", model: "gpt-4o" }], activeConnectionId: <that id> }` and persist the new shape, deleting the legacy keys on next save.

#### Scenario: Migration is idempotent

- **WHEN** migration runs on a payload that already conforms to the new shape
- **THEN** the connections, active id, and all field values remain bit-identical and no write is performed if no change was needed.

#### Scenario: Missing legacy data

- **WHEN** neither the new payload nor any legacy payload exists
- **THEN** the loader returns the default connection described above (create + persist path).

### Requirement: Provider `custom` (OpenAI-compatible)

The system SHALL support a `"custom"` provider that calls any HTTP endpoint exposing an OpenAI-shaped `/chat/completions` route. The user SHALL provide `baseUrl` (mandatory, http(s) URL, validated on save), an `authHeader` (default `"Authorization"`), the `apiKey` value (used as the header value with `"Bearer "` prefix unless the header name differs), plus optional `extraHeaders` and `extraBodyParams` JSON objects merged into the request. The transport SHALL stream responses using the existing SSE parser; no extra SDKs may be introduced.

#### Scenario: Successful request assembly for a custom connection

- **WHEN** the active connection has `provider = "custom"`, `baseUrl = "https://proxy.example.com/v1"`, `authHeader = "Authorization"`, `apiKey = "tok"`, `model = "my-model"`, `extraHeaders = { "X-Org": "acme" }`, and `extraBodyParams = { "temperature": 0.2 }`
- **THEN** a `POST` is sent to `https://proxy.example.com/v1/chat/completions` with headers `{ Content-Type: application/json, Authorization: Bearer tok, X-Org: acme }` and a body containing `model`, `messages`, `stream: true`, and `temperature: 0.2` merged in.

#### Scenario: Custom auth header name replaces the default

- **WHEN** the active connection has `authHeader = "x-api-key"` instead of the default
- **THEN** the request uses header `x-api-key` with value equal to `apiKey` (no `"Bearer "` prefix).

#### Scenario: Invalid base URL blocks save

- **WHEN** the user enters a value for `baseUrl` that does not match `^https?://`
- **THEN** Save is disabled and a localized validation message is shown; no storage write occurs.

#### Scenario: Invalid JSON in extra params blocks save

- **WHEN** the user enters text in `extraHeaders` or `extraBodyParams` textareas that does not parse as JSON
- **THEN** Save is disabled, the corresponding textarea shows a localized error, and no storage write occurs.

#### Scenario: CORS error from a custom endpoint

- **WHEN** a request to a `custom` endpoint fails with `kind = "cors"` (browser blocks the response)
- **THEN** the chat panel SHALL display a localized message explaining that the endpoint must allow browser-origin requests and that Structura cannot bypass server-side CORS, with a shortcut back to Settings.

### Requirement: Curated model selection

The system SHALL expose model selection as a `<select>` listing curated presets for the currently selected provider, plus a final "Other (type manually)" entry that reveals a free-text input. Presets SHALL live in a `Record<LLMProvider, ModelPreset[]>` and SHALL be refreshed against each provider's public catalog at the time of the change; deprecated IDs SHALL be marked `deprecated: true` and excluded from the dropdown but still resolvable.

#### Scenario: Switching provider re-filters the preset list

- **WHEN** the user changes the provider from `openai` to `anthropic` in a connection's form
- **THEN** the model select immediately lists only `anthropic` presets (and vice-versa).

#### Scenario: Free-text override

- **WHEN** the user picks "Other (type manually)" in the model select
- **THEN** a text input appears underneath; its value is committed as the connection's `model` on Save.

#### Scenario: Custom provider skips presets

- **WHEN** `provider === "custom"`
- **THEN** the model selector renders only the text input (no curated list, since catalogs are endpoint-specific).

### Requirement: Hard-rule survival

The LLM connection feature SHALL observe project hard rules: no hardcoded user-visible strings (always `t()` with both locales updated); no `any` / no `as unknown as` casts (use type guards or update the types); persistence SHALL continue to flow through the `infrastructure/persistence` boundary — `localStorage` SHALL be touched only inside `features/llm/llm-storage.ts`, never from React components.

#### Scenario: Persistence boundary

- **WHEN** any component outside `features/llm/llm-storage.ts` reads or writes connection data
- **THEN** it does so only through the exported helpers (`loadConnections`, `saveConnections`, etc.); a grep for `localStorage.` in `features/llm/components/**` and `features/canvas/chat/**` MUST return zero results.

#### Scenario: i18n coverage

- **WHEN** the change introduces any new user-facing label
- **THEN** a corresponding key exists in both `en.json` and `pt-BR.json` (verified by a test that loads the `llmChat.*` subtree from each locale and asserts there is no `undefined` when `t(key)` is invoked for every key referenced in code).

> **Reconstructed** on 2026-10-15 from the branch's commits and code. The original Phase 1 brief and PR body were not available; sections follow the Phase 6 body's layout.

# LLM chat upgrade, Phase 1: i18n, thread persistence, error classification, defaults

Base: `main` → branch `fix/llm-chat-phase1` (local only).

Fixes the chat's foundations before the bigger changes: every chat string goes through i18n in both locales, threads are created and saved reliably, errors are classified by mode and HTTP status instead of message text, fresh installs start on a usable default, and `/generate` is unwired from the chat.

## Commits

1. `817fe393` fix(i18n): add missing llmChat keys and remove hardcoded chat strings
2. `e3457f2c` fix(llm): create thread on first send and persist through set()
3. `e65086de` fix(llm): classify errors by mode and status
4. `0fcdf45c` chore(llm): update Anthropic model presets
5. `c770238c` fix(llm): default fresh installs to direct mode and open settings when unusable
6. `49475b80` refactor(llm): unwire /generate from chat
7. `513462ef` refactor(llm): use type guards in chat suggestions and drop the snapshot cast
8. `7232f00e` fix(llm): exclude in-flight placeholder from thread message count
9. `e123fd2a` refactor(llm): remove unused IR generation from chat store
10. `b3bd4dc5` fix(workspace): type DiagramTitle props to match the header selector

## Implementation

- **i18n:** keys that existed only as English `defaultValue` fallbacks are added to `en.json` and `pt-BR.json`; `llmChat.error.*` in `en.json` (which held Portuguese) is translated; dates, plural counts, typing indicator, suggestion fallbacks, default names and the parser fallback use i18n.
- **Threads:** `sendMessage` creates a thread when none is active; persistence returns the next `threadsByDiagram` and commits it with `set()`; the user message is saved on send; the in-flight placeholder is not counted.
- **Errors:** `LLMProviderError` carries `status`, `mode`, `provider` and the raw detail; the kind comes from status + mode + our own timeout. New kinds `proxyUnreachable`, `proxyRejected`, `proxyEndpointNotFound`, `networkOrCors`, `modelNotFound`. Requests run under a 60 s inactivity timeout. Direct Anthropic calls send `anthropic-dangerous-direct-browser-access`.
- **Defaults:** a fresh install starts with a direct connection; `isUsableConnection` gates sending and opens settings instead, keeping the draft. Default proxy URL aligned with `.env.example`.
- **Presets:** Anthropic presets are `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`.
- **`/generate`:** no longer routed from the chat; the IR export button, `/export`, and the store's IR generation state are removed. `src/features/llm/ir/` is untouched.
- **Type guards:** suggestions use `isAwsComponent` / `isPanelComponent` / `isNoteComponent`; the `as unknown as Diagram` snapshot cast is gone.
- `DiagramTitle` prop typing fixed so `main`'s typecheck passes (Collab v3 regression).

## Checks on the tip (`b3bd4dc5`, re-run 2026-10-15)

typecheck pass · test pass (358 files, 3695 tests) · lint 0 errors, 4 pre-existing `react-refresh` warnings in `features/canvas` · build pass.

## Known limitations

- `src/features/llm/ir/` stays in the repo but is unreachable from the chat.
- Error kinds are renamed (`network`, `cors`, `model` → new kinds); any external code matching the old names must update.

## Manual QA (not run)

- [ ] First message from the empty state creates a thread that survives a new conversation and `/clear`.
- [ ] pt-BR UI shows no English chat strings.
- [ ] Unreachable proxy, bad key, unknown model and CORS failures each show the mode-aware message.
- [ ] Fresh install with no key opens settings on send and keeps the draft.

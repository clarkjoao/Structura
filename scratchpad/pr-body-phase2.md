> **Reconstructed** on 2026-10-15 from the branch's commits and code. The original Phase 2 brief and PR body were not available; sections follow the Phase 6 body's layout.

# LLM chat upgrade, Phase 2: message parts, Markdown, cancel, per-turn errors

Base: `fix/llm-chat-phase1` → branch `feat/llm-chat-phase2` (local only).

Chat messages become typed **parts** (text, tool-call, suggestion, error) instead of one content string. Stored threads migrate to the new format. Assistant replies render as GFM Markdown, requests can be cancelled, and a failed turn keeps its message with an inline error and Retry.

## Commits

1. `5b188410` feat(llm): add message parts model
2. `e5ecaf8b` feat(llm): migrate stored threads to message parts
3. `e30907f1` feat(llm): store and render chat messages as parts
4. `c46c6fea` feat(llm): render assistant markdown
5. `0cbf2112` feat(llm): add tool-call part renderer
6. `5f0dca85` feat(llm): cancel in-flight requests
7. `43f60e49` feat(llm): show errors per turn with retry
8. `61419cab` feat(llm): add message actions and restyle suggestion card

## Implementation

- **Parts model** (`message-parts.ts`): a union with a type guard per part, `getMessageText`, `appendTextDelta`, and a stored-message migration. Providers receive `LLMRequestMessage` built from text parts.
- **Migration:** IndexedDB records carry `formatVersion` (`THREAD_FORMAT_VERSION = 2`); legacy content becomes a text part, unknown shapes are kept as text, nothing is dropped, one corrupt record no longer loses the rest; rewrite only after a successful migration.
- **Rendering:** the assistant-ui adapter maps parts; the suggestion card renders from its part; `/copy` serialises parts to Markdown (`message-markdown.ts`).
- **Markdown:** `@assistant-ui/react-markdown` + `remark-gfm`; tables scroll, fenced code has a copy button, links open with `noopener noreferrer`; raw HTML is shown as text.
- **Tool-call renderer** (`ToolCallPart.tsx`): status icon, tool name, MCP badge slot, expandable args/result/error; consecutive calls grouped. Nothing produced tool calls yet in this phase.
- **Cancel:** an `AbortController` per request merged with the inactivity timeout; user cancel keeps partial text, marks the message `cancelled`, shows "Stopped".
- **Per-turn errors:** error part with Retry and, for fixable kinds, Open settings; the global banner and global error state are removed; `rerunAssistantMessage` backs Retry and Regenerate.
- **Actions:** Copy per message, Regenerate on the last one (hidden while its suggestion is pending); suggestion card restyled with +/~/− rows.

## Checks on the tip (`61419cab`, re-run 2026-10-15)

typecheck pass · test pass (3720 passed, 17 skipped; two stress tests timed out only under parallel load and pass in isolation) · lint 0 errors, 4 pre-existing warnings · build pass.

## Known limitations

- Thread migration is one-shot and idempotent; a record that fails to parse is skipped and logged, not repaired.
- Raw HTML in a reply is shown as text, never rendered.

## Manual QA (not run)

- [ ] Threads saved before this phase load with their text intact.
- [ ] Stop mid-stream keeps the partial reply and shows "Stopped".
- [ ] A failed turn shows its error inline; Retry replaces it.
- [ ] Tables, code blocks and links render; HTML shows as text.

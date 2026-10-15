> **Reconstructed** on 2026-10-15 from the branch's commits and code. The original Phase 3 brief and PR body were not available; sections follow the Phase 6 body's layout.

# LLM chat upgrade, Phase 3: AI SDK transport, tool registry, multi-step loop, one-undo suggestions

Base: `feat/llm-chat-phase2` → branch `feat/llm-chat-phase3` (local only).

The chat runs on the Vercel AI SDK with native function calling. A tool registry exposes internal read and write tools, the model runs them in a multi-step loop shown as tool-call parts, and a reply's write calls become one suggestion that applies on Accept as **one undo step**. Adds a connection test and a model picker. Structured analysis is removed on purpose. `features/llm` no longer imports `features/canvas` (except the off-limits `ir/`).

## Commits

1. `5f74de21` feat(llm): route chat through the AI SDK transport
2. `4e6763e2` feat(llm): map SDK errors to structured chat errors
3. `99a3a7ff` feat(llm): add tool registry and internal tools
4. `97751a1c` feat(llm): run tools in a multi-step loop with visible tool calls
5. `042ce048` feat(llm): apply suggestions on accept as one undo step
6. `3eb62c59` refactor(llm): remove canvas imports from the llm feature
7. `8f522092` feat(llm): add connection test and model picker
8. `4e9b989e` perf(llm): load the internal tools on the first turn

## Implementation

- **Transport** (`transport/ai-sdk-transport.ts`): `ai` 7.0.126, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`, loaded with `import()`. Direct OpenAI / Anthropic; custom and proxy via OpenAI-compatible. Cancel and inactivity timeout are merged and passed to the SDK.
- **Errors:** `APICallError` keeps status and body; fetch rejections become `FetchRejectedError` and classify by mode. A reply cut at the token limit is kept and marked truncated.
- **Registry** (`tools/registry.ts`): `ToolDefinition` (name, description, zod schema, `kind` read|write, `source` internal|mcp, `serverId`, `execute`). Internal read tools run; write tools validate and queue into the turn's suggestion draft without touching the store.
- **Loop:** up to `MAX_TOOL_STEPS = 8`; each call is a tool-call part; results reach the model as JSON data framed as data, not instructions. Cancel keeps completed calls, ends the running one as Stopped and discards queued changes.
- **One undo step:** nothing touches the canvas before Accept. `applyChangeBatch` (new `features/diagram/store/slices/change-batch.slice.ts`) applies all changes in one `set()` with `pushHistory` once; a missing target is skipped and shown struck-through. A queued `auto_layout` runs with `history: false` so it undoes with the batch.
- **Boundary:** `DiagramToolHost` (`tools/host.ts`) is implemented in `canvas/chat` and handed to the store; chat hooks move into `features/llm/hooks`; `import-boundary.test.ts` enforces no `features/canvas` imports (excluding `ir/`).
- **Connection test + model picker:** `GET <base>/models` for OpenAI-compatible endpoints; presets for direct providers; a `ModelPicker` in the composer footer.
- **Bundle:** the registry (and zod) load on the first turn.

## Note on `@/features/diagram`

This phase changes `features/diagram/store` (new change-batch slice; `mutateUpdateComponent` / `mutateRemoveElements` extracted; `history` option on layout). This is the one-undo requirement; confirm against the Phase 3 brief that it was allowed.

## Checks on the tip (`4e9b989e`, re-run 2026-10-15)

typecheck pass · test pass (3731 passed, 17 skipped; two stress tests timed out only under parallel load and pass in isolation) · lint 0 errors, 4 pre-existing warnings · build pass.

## Known limitations

- **Proxy contract change:** a proxy is now any OpenAI-compatible endpoint; the old `/llm/chat` contract is gone. Stored proxy connections migrate to `VITE_LLM_PROXY_URL`.
- **Structured analysis removed:** reviews are answered in Markdown; `/analyze` and the analysis panel are gone.
- **No preview before Accept:** the on-canvas Keep/Discard preview is removed.
- **Tool calls are cancelled together on Stop;** only the call in flight receives the abort signal.
- **Tools are extendable only through the registry's `register`;** plugins do not add chat tools.

## Manual QA (not run)

- [ ] Direct OpenAI, direct Anthropic, custom and proxy connections each stream a reply.
- [ ] A request that calls read tools shows the calls and then answers.
- [ ] A write suggestion applies on Accept and Undo reverts it in one step.
- [ ] Test connection lists models or shows the classified error.

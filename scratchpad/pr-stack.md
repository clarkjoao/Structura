# LLM chat upgrade — branch stack

Six stacked local branches from `main`, each with its own PR body. Open and merge in order; each branch is rebased on the previous one, so a phase's PR is small and the diff for the review is what the PR body says.

| # | Branch | Base | Commits | Tip | PR body |
|---|---|---|---|---|---|
| 1 | `fix/llm-chat-phase1` | `main` | 10 | `b3bd4dc5` | (none — branch was created before the scratchpad format) |
| 2 | `feat/llm-chat-phase2` | `fix/llm-chat-phase1` | 8 | `61419cab` | (none) |
| 3 | `feat/llm-chat-phase3` | `feat/llm-chat-phase2` | 8 | `4e9b989e` | (none) |
| 4 | `feat/llm-chat-phase4` | `feat/llm-chat-phase3` | 9 | `8cc6a79d` | `scratchpad/pr-body-phase4.md` |
| 5 | `feat/llm-chat-phase5` | `feat/llm-chat-phase4` | 5 | `843ab81e` | `scratchpad/pr-body-phase5.md` |
| 6 | `feat/llm-chat-phase6` | `feat/llm-chat-phase5` | 5 | `117e3743` | `scratchpad/pr-body-phase6.md` |

Per `no-pr-without-asking`, none of these are pushed and no PRs are open. The user opens PRs in the order they prefer.

## Summary

The upgrade turns the chat from a single-shot text assistant into a multi-step, model-agnostic diagram assistant. The model now runs over the AI SDK transport (Phase 1), the chat renders messages as typed parts (Phase 2), a tool registry and a multi-step loop expose internal read and write tools to the model (Phase 3, with suggestions on Accept as one undo step), the composer is rebuilt around one cmdk menu for `@` mentions and `/` slash commands (Phase 4), skills add named instruction packs with tool allowlists that scope a turn's tool set (Phase 5), and the chat connects to remote MCP servers from the browser, registers their tools, runs them in the loop, and persists all secrets through the storage port (Phase 6). The whole feature lives in `features/llm`, never imports `features/canvas`, and keeps all 1–5 behaviour and tests.

## Known limitations across the six phases

These are the limits the six PR bodies call out. Items flagged with `(MCP)` come from the phase 6 body; the rest pre-date it.

- **CORS-only MCP servers.** A server that does not allow the app's origin through CORS will not work, and the error message says so. The app has no MCP proxy. (MCP)
- **Bearer-token MCP only.** OAuth and other auth flows are not supported in this phase. (MCP)
- **Plugins in the same realm can read remembered tokens.** Remembered tokens are stored in `localStorage` under the same origin as the app, and any other code running on the page (e.g. a plugin in the same realm) can read them. A token that is sensitive enough for that to matter should stay session-only. (MCP)
- **One reconnect, then fail.** A session that keeps dropping fails after one reconnect; the user is told the server is unavailable and the turn continues with the other tools. (MCP)
- **No MCP file watcher.** The tool list refreshes on panel open, on the `tools/list_changed` notification, and on **Refresh**. External changes between those moments are not seen. (MCP)
- **MCP token is typed in plain.** The token field is `type="password"`, but any extension on the page that can read inputs can read it as the user types. (MCP)
- **No plugin origin for the MCP SDK.** The SDK is bundled in the chat's lazy chunk, not loaded as a plugin. Server-driven prompts or schemas cannot extend the chat beyond what the registry exposes. (MCP)
- **No file watcher for workspace skills.** The File System Access API has no change events. Workspace changes made outside the app are picked up when the canvas mounts, when the chat panel opens, and when settings open. (Phase 5)
- **Enabled state keyed by folder name for workspace skills.** Workspace enabled state uses the folder name as the workspace key, the same as sidecar sync. Two folders with the same name share these flags. (Phase 5)
- **`/` blocked by a command chip.** `/` is disabled while a command chip is set (Phase 4 behaviour), so a skill can't be added in that state. (Phase 5)
- **Import normalizes skill files.** An import re-serializes the file, so unknown keys and custom formatting are dropped. (Phase 5)
- **Renames keep the file name for workspace skills.** Renaming a workspace skill keeps its file name, because the path is the id. (Phase 5)
- **Skill chips are not restored.** Switching to another conversation clears the skill chips. Going back does not restore them. (Phase 5)
- **Disabled skills still apply on Retry.** A disabled skill that still exists is still applied on Retry, since only a deleted skill counts as unavailable. (Phase 5)
- **`@diagram` adds only the short instruction.** The full diagram is already in the system prompt on every turn, so `@diagram` takes the short-instruction path (`WHOLE_DIAGRAM_INSTRUCTION`) instead of a re-send. (Phase 4)
- **`MentionRef` label cache can drift.** The cached label on a `MentionRef` is for the chip only; the model never sees a label outside a JSON-encoded context block, and the block is built in `mentions/context-block.ts`. (Phase 4)
- **`@` mention behaviour is panel-driven.** Mentions and skills are added in the composer; the chat hook reads the current mention list on send. They are not stored in the system prompt directly. (Phases 4 and 5)
- **Tool calls are not cancelable across servers.** A model turn that calls multiple tools cancels them all on **Stop**, but a single tool already in flight is the one that gets the abort signal. (Phases 3 and 6)
- **Tool schemas are passed to providers as JSON Schema.** Unsupported schemas (e.g. server-declared schemas that are not plain JSON objects) are skipped and shown as "unsupported schema" in settings. (Phases 3 and 6)
- **Plugin origin for tools.** Internal tools live in `features/llm/tools/`; the only way to extend them is through the registry's `register` call. The plugin system does not add tools to the chat today. (Phases 3 and 5)
- **Migrations are one-shot and idempotent.** The LLM storage migration (Phase 6) runs on the first call to `loadConnections`; a failed migration keeps the old data and logs once. The IDB threads migration (Phase 2) follows the same shape. (Phases 2 and 6)

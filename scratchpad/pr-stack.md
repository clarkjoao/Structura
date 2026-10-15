# LLM chat upgrade — branch stack

Six stacked branches from `main`, each with its own PR body. Open and merge in order. Each branch's commits sit directly on the previous branch's tip, so a phase's PR shows only that phase.

Branches 1–5 were recreated on 2026-10-15 as plain refs at the tips this file recorded (the refs had been lost; the commits had not). `feat/llm-chat-phase6` is the only branch on `origin`. No PRs are open.

| #   | Branch                 | Base                   | Commits | Tip        | PR body                                        |
| --- | ---------------------- | ---------------------- | ------- | ---------- | ---------------------------------------------- |
| 1   | `fix/llm-chat-phase1`  | `main` (`b0aab7da`)    | 10      | `b3bd4dc5` | `scratchpad/pr-body-phase1.md` (reconstructed) |
| 2   | `feat/llm-chat-phase2` | `fix/llm-chat-phase1`  | 8       | `61419cab` | `scratchpad/pr-body-phase2.md` (reconstructed) |
| 3   | `feat/llm-chat-phase3` | `feat/llm-chat-phase2` | 8       | `4e9b989e` | `scratchpad/pr-body-phase3.md` (reconstructed) |
| 4   | `feat/llm-chat-phase4` | `feat/llm-chat-phase3` | 9       | `8cc6a79d` | `scratchpad/pr-body-phase4.md` (reconstructed) |
| 5   | `feat/llm-chat-phase5` | `feat/llm-chat-phase4` | 5       | `843ab81e` | `scratchpad/pr-body-phase5.md` (reconstructed) |
| 6   | `feat/llm-chat-phase6` | `feat/llm-chat-phase5` | 9       | see branch | `scratchpad/pr-body-phase6.md`                 |

Phase 6 has 5 brief commits (`c6dc83d2`…`117e3743`), 2 scratchpad commits, `f6db2ba2` (custom Anthropic protocol + message queue, outside the brief) and `1fe2974c` (fixes the 2 tests `f6db2ba2` broke), plus this file's update.

## Summary

The upgrade turns the chat from a single-shot text assistant into a multi-step, model-agnostic diagram assistant. Phase 1 fixes the foundations: i18n in both locales, reliable thread persistence, errors classified by mode and status, usable defaults, and `/generate` unwired. Phase 2 stores messages as typed parts with Markdown rendering, cancel, and per-turn errors with Retry. Phase 3 moves the chat onto the AI SDK with native function calling: a tool registry of internal read and write tools runs in a multi-step loop, and write calls become one suggestion applied on Accept as a single undo step. Phase 4 rebuilds the composer around one menu for `@` mentions (sent as id refs in a JSON context block) and a `/` command registry. Phase 5 adds skills — workspace or local instruction packs with tool allowlists that scope a turn's tools. Phase 6 connects to remote MCP servers from the browser, runs their tools in the loop as untrusted read-only data, and moves all persisted chat state and secrets behind `IStoragePort`. The feature lives in `features/llm` and imports `features/canvas` only from the untouched `ir/` folder.

## Known limitations across the six phases

- **CORS-only MCP servers;** no MCP proxy. (6)
- **Bearer-token MCP only;** no OAuth. (6)
- **Remembered MCP tokens are readable by same-origin code** (e.g. a plugin in the same realm); keep sensitive tokens session-only. (6)
- **One MCP reconnect, then fail;** the turn continues with the other tools. (6)
- **No MCP change watcher:** tools refresh on panel open, `tools/list_changed`, and Refresh. (6)
- **MCP token field** is `type="password"` but readable by extensions as it is typed. (6)
- **MCP SDK is in the chat's lazy chunk,** not a plugin; servers can't extend the chat beyond the registry. (6)
- **Visual reference for MCP settings was not consulted.** (6)
- **Queued composer messages are memory-only;** a reload drops them. (6, `f6db2ba2`)
- **No file watcher for workspace skills.** (5)
- **Workspace skill enabled state keyed by folder name.** (5)
- **`/` disabled while a command chip is set,** so a skill can't be added then. (5)
- **Skill import re-serializes the file,** dropping unknown keys and formatting. (5)
- **Renaming a workspace skill keeps its file name.** (5)
- **Skill chips are not restored** when switching back to a conversation. (5)
- **A disabled-but-existing skill still applies on Retry.** (5)
- **`@diagram` adds only the short instruction;** the diagram is already in the system prompt. (4)
- **`MentionRef` label cache can drift** (chip only). (4)
- **Mentions are read on send,** not stored in the system prompt. (4)
- **Proxy contract changed** to any OpenAI-compatible endpoint; the old `/llm/chat` contract is gone. (3)
- **Structured analysis and `/analyze` removed;** reviews are Markdown. (3)
- **No on-canvas preview before Accept.** (3)
- **Phase 3 changes `features/diagram/store`** (change-batch slice for one undo step); confirm against the Phase 3 brief. (3)
- **Stop cancels all tool calls,** but only the call in flight receives the abort signal. (3, 6)
- **Unsupported tool schemas are skipped** and shown as "unsupported schema" in settings. (3, 6)
- **Tools extend only through the registry's `register`;** plugins add no chat tools. (3, 5)
- **Storage and thread migrations are one-shot and idempotent;** a failed migration keeps old data and logs once. (2, 6)
- **Raw HTML in replies is shown as text.** (2)
- **`src/features/llm/ir/` remains but is unreachable from the chat.** (1)
- **Error kinds renamed** (`network`, `cors`, `model` → mode-aware kinds). (1)

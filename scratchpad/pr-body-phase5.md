> **Reconstructed** on 2026-10-15 from the branch's commits and code. The original Phase 5 PR body was lost with the session and the Phase 5 brief was not available to this session; sections follow the Phase 6 body's layout.

# LLM chat upgrade, Phase 5: skills

Base: `feat/llm-chat-phase4` → branch `feat/llm-chat-phase5` (local only).

Adds **skills**: named instruction packs with optional tool allowlists. Skills come from the connected workspace folder (`.structura/skills/*.md`) or from local storage through `IStoragePort`, are activated from the `/` menu as sticky chips, and shape each turn's system prompt and tool set. A Skills tab in settings edits, imports and exports them.

## Commits

1. `20a2af74` feat(llm): add skill model and markdown format
2. `f0206bf3` feat(llm): load skills from workspace folder and local storage
3. `a10e7478` feat(llm): activate skills from the command menu
4. `0cf58e54` feat(llm): apply skill instructions and tool allowlists to requests
5. `843ab81e` feat(llm): add skills settings

## Implementation

- **Format** (`skills/skill-format.ts`): Markdown with a front-matter subset parsed without a YAML dependency, validated with zod; typed error with the line; limits are errors, never truncation; `serializeSkillMarkdown` round-trips.
- **Sources** (`skills/skill-sources.ts`): workspace through an injected `SkillFolderHost` (registered only while a folder is connected); local as one `IStoragePort` key per skill plus an index. The store keeps per-file parse errors and the per-user enabled flag of workspace skills keyed by workspace and path.
- **Activation** (`skills/skill-commands.ts`): a Skills section in the `/` menu through the section provider API; sticky skill chips; each user message stores its `SkillRef`s so Retry and Regenerate reuse them; deleted skills are marked unavailable.
- **Requests** (`skills/skill-request.ts`): one delimited block per skill after the app's rules, framed as user instructions that never override safety rules, and a skill cannot close its own block. The tool allowlist is the union of active skills' `tools`; no allowlist means every tool; filtering happens on registry names before the SDK, so Phase 6 `mcp__…` names work.
- **Settings:** list with source badge, enable switch and warnings; editor with tool picker; save to Workspace or Local; delete with confirmation; `.md` import/export; unparsable files listed with line and reason.

## Checks on the tip (`843ab81e`, re-run 2026-10-15)

typecheck pass · test pass (382 files, 3849 tests) · lint 0 errors, 4 pre-existing warnings · build pass.

## Known limitations

- No file watcher for workspace skills; changes are picked up when the canvas mounts, the chat panel opens, or settings open.
- Workspace enabled state is keyed by folder name; two folders with the same name share flags.
- `/` is disabled while a command chip is set, so a skill can't be added in that state.
- Import re-serializes the file; unknown keys and custom formatting are dropped.
- Renaming a workspace skill keeps its file name (the path is the id).
- Skill chips are not restored when switching back to a conversation.
- A disabled skill that still exists is still applied on Retry; only a deleted skill counts as unavailable.

## Manual QA (not run)

- [ ] A `.structura/skills/*.md` file in a connected folder appears in the `/` menu.
- [ ] A skill with `tools: [get_tags]` only offers that tool to the model.
- [ ] A broken skill file shows its line and reason in settings.
- [ ] Import, export, edit and delete work for Local and Workspace skills.

> **Reconstructed** on 2026-10-15 from the branch's commits and code. The original Phase 4 PR body was lost with the session; sections follow the Phase 6 body's layout.

# LLM chat upgrade, Phase 4: composer with chips, `@` mentions, `/` command registry

Base: `feat/llm-chat-phase3` → branch `feat/llm-chat-phase4` (local only).

Rebuilds the composer as one textarea with a chip row and one cmdk menu for both `@` mentions and `/` commands. Mentions are stored as id refs and sent as a JSON-encoded context block; commands come from a registry with section providers that Phase 5 extends with skills.

## Commits

1. `5e833209` feat(llm): store mentions as refs and send them as encoded context
2. `f24a713b` feat(llm): add mention providers
3. `809e5e60` feat(llm): add slash-command registry
4. `0411f9d9` feat(llm): show command suggestions in the empty state
5. `d2927b19` feat(llm): rebuild composer with context chips and one command menu
6. `b9366404` fix(llm): run the chat hook once per panel
7. `a62e07b5` fix(llm): add missing i18n keys for the new composer and banner
8. `e82fb2eb` test(llm): cover composer chips, menus and selection snapshot
9. `8cc6a79d` test(llm): tighten composer tests and labels

## Implementation

- **Mentions:** `MentionRef` (node, edge, flow, selection snapshot, diagram) carries ids; the label is cached for the chip. Each request resolves refs against the current diagram into a JSON block (`mentions/context-block.ts`); names appear only as JSON strings with backticks escaped; a missing element resolves to `{ id, missing }`. Retry and Regenerate resend the original refs.
- **Providers** (`mentions/providers.ts`): Selection, Nodes, Edges, Flows, Diagram — pure functions, prefix matches first, capped sections.
- **Commands** (`commands/registry.ts`): prompt or action commands from section providers; built-ins `/review`, `/explain`, `/well-arch`, `/blast-radius`, `/clear`, `/copy`.
- **Empty state:** up to four context-aware command suggestions; a no-connection banner opens settings.
- **Composer:** chip row (mentions, auto Selection, command), one `ComposerMenu` with sections, highlight, keyboard nav; Backspace on empty removes the last chip; the Selection chip snapshots ids on send.
- **Fix:** the chat hook ran twice per panel; now once.

## Checks on the tip (`8cc6a79d`, re-run 2026-10-15)

typecheck pass · test pass (375 files, 3787 tests) · lint 0 errors, 4 pre-existing warnings · build pass.

## Known limitations

- `@diagram` adds only the short instruction (`WHOLE_DIAGRAM_INSTRUCTION`); the full diagram is already in the system prompt.
- The `MentionRef` label cache can drift; it is used for the chip only, never sent to the model outside the JSON block.
- Mentions are added in the composer and read on send; they are not stored in the system prompt.

## Manual QA (not run)

- [ ] `@` and `/` open the same menu; keyboard navigation works.
- [ ] Selected nodes appear as a Selection chip and are sent as a snapshot.
- [ ] Retry resends the original mentions.

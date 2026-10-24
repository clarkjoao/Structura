# Design

**Host turn.** `sendMessage` looks up the first registered chat context whose `appliesTo` returns
true for the active diagram. If found, a plugin turn runs instead of the diagram-patch path: the
system prompt comes from the plugin; the reply streams as text; at the end the host calls
`handleReply(text, { diagramId, locale, attempt, maxAttempts })`. If it returns `retry` and
attempts remain, the host sends the conversation plus the model's reply and the retry text as the
next user turn (not shown in the thread). The thread keeps the user message and the plugin's
`reply` only, so the next turn's history stays short — the plugin puts the current files in the
system prompt each time. A throwing context is treated as not applying / as an error reply.

**Reply format.** Whole documents rather than diffs: models write YAML documents reliably and diffs
poorly. A document is located by `kind` + `metadata.name`; replacing it splices only its range in
its file, so other documents keep their bytes. Documents without a match are appended to the
named file (created when it does not exist yet, if it is an `*.opscr.yaml` name) or to the first
manifest file.

**Validation loop.** Errors are compared with the workspace's errors before the change (by file,
rule and message); only new ones are sent back. Retries apply on top of the previous attempt's
result. When attempts run out the change is applied anyway and the reply lists the remaining
errors — they are also markers in the editor, and the edit is unsaved and undoable.

**Skill bundling.** `scripts/build-skill.mjs` runs the linked package's `opscr skills build` into a
temp folder and writes `src/generated/opscr-skill.ts` (SKILL.md and references, without the
example workspace). The prompt tells the model to ignore the skill's instructions about running
commands, writing files and interviewing.

**Session.** The pane publishes the bound diagram's id and accessors to its buffers while a folder
is open; the chat context applies only then.

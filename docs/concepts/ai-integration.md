# AI Integration

The Intelligence context (`src/features/llm/`) embeds an assistant that reads
and edits diagrams. Its architecture is built around one rule: **the AI is a
user, not a subsystem** — it acts through the same reviewed, undoable
mutations a human uses.

## The patch contract

The assistant never mutates the store directly. It produces a
`DiagramPatch` — a list of typed actions (`ADD_NODE`, `REMOVE_NODE`,
`UPDATE_NODE` with a `ComponentPatch`, `ADD_EDGE`, `REMOVE_EDGE`) with a
human-readable description:

```
LLM response → patch-parser.ts → DiagramPatch
             → PendingSuggestion (preview nodes/edges on canvas)
             → user accepts → apply-diagram-patch.ts → store actions
                              (one history entry — undo works)
             → user rejects → nothing happened
```

Why this shape:

- **Reviewability.** Every AI change is previewable and individually
  accept/rejectable (`PendingSuggestion`, `PendingNodePreview`).
- **Safety by construction.** The patch vocabulary is closed and validated;
  a hallucinated action type fails parsing (`errors.ts`) instead of
  corrupting state.
- **Convergent evolution.** The patch is the natural seed for a future
  command system and the MCP surface — external tools should get this same
  contract, not store access.

## Context building

`serializer.ts` + `component-catalog.ts` + `prompt-builder.ts` turn the
active diagram into a compact textual model for the prompt;
`mention-serializer.ts` lets users @-mention elements. The serializer is the
inverse discipline of the patch parser: one place that defines what the
model sees, one place that defines what it may do.

Beyond editing, `suggestions.ts` + analysis types (`AnalysisFinding` with
severity/category/recommendation) support architecture-review style output.

## Providers

`providers/` holds `anthropic.ts`, `openai.ts`, and `proxy.ts` behind a
common call shape; `model-presets.ts` maps friendly names to model ids.
Two modes (`LLMMode`): **direct** (user's API key, stored client-side only in
`llm-storage.ts`, calls the provider from the browser) and **proxy** (via the
optional local server for teams that don't distribute keys). Conversation
threads are per-diagram (`ConversationThread`) and persist locally.

This provider seam is already a de-facto extension point; the plugin
preparation formalizes it (AI providers as contributions — see
[extension-points/README.md](../extension-points/README.md)).

## Constraints for future work

- MCP integration must speak the patch/command contract; never expose raw
  store actions to external processes.
- Workspace-wide AI (architecture Q&A across diagrams) is blocked on the
  Model Index — serializing 80 diagrams into a prompt does not scale; a
  queryable model does. Sequence accordingly
  ([roadmap.md](../architecture/roadmap.md)).
- Keep prompts/parsers versioned together; a prompt change that alters the
  action grammar is a breaking change to the parser tests.

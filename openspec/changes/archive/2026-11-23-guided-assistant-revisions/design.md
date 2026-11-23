# Design

## Context

What exists today:

- **The add tool.** The assistant's tool calls are parsed into `DiagramPatchAction`s (`patch-parser.ts`) and held as a `PendingSuggestion` with a whole-patch accept or reject (`SuggestionCard`). `ADD_JOURNEY_OUTLINE` is checked, then applied through `journey-outline.ts`.
- **Canvas preview.** The store already has `pendingPreviews: { suggestionId, nodeIds, edgeIds }`, which highlights existing nodes on the canvas.
- **What `guided-journey-live-text` provides:**
  - `serializeWithIds` (handles `s1…`, with the handle → step id map);
  - `reconcile(ctx, base, edited) → { edit, changes }`;
  - skipping missing ids.

## Goals / Non-Goals

**Goals:**

- One reconcile engine serves the panel and the assistant.
- Partial apply never produces an invalid guided diagram.

**Non-Goals:**

- Ghost rendering of added steps.
- Streaming partial revisions.

## Decisions

### 1. Changes are keyed units with dependency groups

`reconcile` returns `changes: KindTextChange[]`, each with:

- `key`;
- `group`: the key of its dependency group;
- `stepId` (or the new node key);
- `kind`, `before` and `after`;
- `reason?`.

It also gives `editFor(keys: Set<string>) → KindEdit`, which composes only the edit fragments of the selected keys.

The groups are computed once:

- **An added step** forms a group with every connection that touches it. When a connection joins two added steps, the two groups are merged (union-find).
- **A removed step** forms a group with the reconnection of its predecessor to its successor.
- **Renames, scores, phases and kind changes** are singletons.

The UI toggles whole groups. A group's rows are shown together, with one checkbox.

_Alternative considered:_ letting any subset apply and repairing afterwards, for example dropping dangling connections. Rejected: what applies would silently differ from what was reviewed.

### 2. The handle map lives with the suggestion

When the prompt is built, the serialize's handle → id map is kept on the assistant thread turn. The revise action is resolved against _that_ map, not a fresh one. A step renamed on the canvas meanwhile still matches by handle. A missing id becomes "no longer applicable" (decision 4).

### 3. Reasons from comments

The parser already skips `#` comments. The revise path pre-scans `# why:` lines and attaches each to the next step line's handle. Reasons are display-only and never stored in the diagram.

### 4. Re-reconcile on diagram change

The suggestion stores the revised text and the original handle map. A diagram snapshot change re-runs `reconcile` against the current diagram, with a 150 ms debounce like the panel.

- Keys are stable: `kind:stepId[:field]`, or `add:<line handle or line index>`, so the tick state carries over.
- Changes whose id is missing get `stale: true`.

### 5. The card

`SuggestionCard` gets a revision mode for `REVISE_JOURNEY`:

- groups by phase (the reconcile reports each change's phase in the revised journey);
- group checkboxes;
- the reason in muted text;
- "Apply selected (n)";
- "Reject".

Ticked changes are mirrored into `pendingPreviews`. Removals get a distinct preview tone (`remove`), so `PendingNodePreview` gains `tone?: "change" | "remove"`.

## Risks / Trade-offs

- **[Risk]** The model rewrites handles wrongly, for example swapping s3 and s4. → The review list shows the resulting renames, which look odd, and the author unticks them. The prompt instructs the model to keep each handle on its step.
- **[Risk]** Large revisions (hundreds of changes) make the card unwieldy. → Groups collapse by phase, and there is a "Tick all" / "Untick all" per phase. The prompt asks for focused revisions.
- **[Risk]** Token cost: the journey with handles is longer. → Handles are short (`{#s12}`), and the existing 300-line cap still applies.

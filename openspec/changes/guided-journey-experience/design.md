## Context

Kinds keep diagram-wide data in `kindData` (validated JSON, sanitized on import, synced, kept in freehand mode). There is no per-element equivalent.

Part 3 (phases) needs one too: the phase of a step. So does any later business data (owner, SLA). Markers today are a class on a node or edge (`kindMarked`), with no visible content.

## Decisions

### 1. `kindProps` on the component, not a map in `kindData`

The alternative was `kindData.experience: { [stepId]: n }`. It was rejected because data keyed by id goes stale and needs care:

- a copy or paste mints new ids, so the score would be lost;
- a deleted step would leave an orphan entry, needing pruning;
- a version diff would show a diagram-wide change instead of a change on the step.

On the component, the data moves, copies, deletes, versions and syncs with the element for free.

- `kindProps?: JsonObject` sits on `BaseComponent`. The host never reads it; only the active kind does.
- It reuses `diagram-kind.ts`'s JSON validator, with a 4 096-character cap per element, and is dropped when invalid in `normalize-imported-diagram`.
- In `KindEdit`:
  - `add[].kindProps` sets it on a new node;
  - `update[].kindProps: JsonObject | null` replaces it, or clears it with `null`.

  The kind merges the keys itself, which keeps the slice simple.

Guided reads the score through `experienceOf(step): 1..5 | null`, which ignores anything out of range.

### 2. Badges are a generic marker field

`KindMarker.badge?: { text: string; tone: "danger" | "warning" | "success" | "neutral" }`.

- `kindMarkersFor` already memoises markers per snapshot.
- `useCanvasNodes` passes `kindBadge` next to `kindMarked`, and the process node draws it as a small pill at its top-right corner.
- A marker may carry a badge with no message. The "openEnd" and "unlabelledExit" markers keep their class-only look.

Guided emits one marker per scored step:

- `experience`, with its badge;
- `painPoint` instead, for scores of 2 or below. It carries the red badge and the marked class.

### 3. Edits

`guidedSetExperience(diagram, stepId, score | null)` returns `{ update: [{ id, kindProps }] }`, merging the step's other keys, and keeps the step selected. The Journey tab adds a choice section built from it, with 6 options ("—" plus 1 to 5).

### 4. Outline `[n]`

- **Parse:** after the comment is stripped, a trailing `\s\[(\d+)\]$` on a step, decision or end line is read as the score. An n outside 1–5 is the error `experienceOutOfRange`. `escapeOutlineText` escapes `[`.
- **Build:** the score goes into `add[].kindProps`.
- **Serialize:** writes ` [n]` after the name.

### 5. Mermaid

- **Journey import:** `OutlineNode.experience` is set from the score. `setAside` counts sections only.
- **Journey export:** writes the step's score, or 3.
- **Swimlane export:** after the edges, writes `%% experience: s1=2, s4=5` when any step is scored.
- **Swimlane import:** the meaningful-lines pass already drops `%%` lines. The reader looks for that exact prefix first and applies the scores by Mermaid id after the walk, through the `ref` on each `OutlineNode`.

### 6. Mode bar

`KindModeBar` reads the kind's markers (`kindMarkersFor`) and counts those coded `painPoint`. Clicking the chip selects the next one in reading order (`readingOrder`, from the Mermaid serializer moved to `guided.model.ts`) and asks the canvas to frame it through the existing `onSelectElement`.

The kind exposes the code to the host through an optional `focusMarkers?: { code; label: KindText }`. This keeps the bar free of guided specifics.

## Risks

- **`kindProps` is a model field.** Collab sync of a component carries it wholesale, which is acceptable because components already travel whole. Older clients drop an unknown field on write; the `kindData` rollout accepted the same.
- **Emoji rendering differs across platforms.** The number always sits next to the face, so the score stays readable.

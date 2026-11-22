## Why

This is part 2 of the Mermaid track. A journey map answers _who_ does _what_ in _which order_, and also _how it felt_. Mermaid's `journey` gives every task a score from 1 to 5. Service designers mark the low points as **pain points**, because those are where a redesign starts.

Today the guided journey has no place for that:

- part 1 reads a Mermaid journey's scores and drops them;
- an architect walking a journey with the business has nowhere to write "this step hurts".

## What Changes

- **Per-element kind data.** Components gain `kindProps?: JsonObject`: data the diagram's kind owns on one element, opaque to everything else. It works like `kindData` does for the diagram:
  - it is JSON, with a size cap, and sanitized on import;
  - it is kept in freehand mode and moves with the element;
  - it goes away when the element is deleted;
  - it syncs with the component.

  `KindEdit` can set or clear it (`update[].kindProps`, `add[].kindProps`). Guided stores `kindProps.experience` (1–5). Part 3 will store `phase` the same way.

- **Experience in the Journey tab.** A new "Experience" choice runs from 1 to 5, plus "—" to clear it. Picking one is one undo step.
- **A badge on the canvas.** In kind mode, a scored step shows a small badge with the score ("2/5").
  - Steps scored 1–2 are **pain points**: the badge is red, and the step gets the quiet marker "Pain point".
  - 3 is neutral and 4–5 are green.
  - The badge comes through a new generic marker field (`KindMarker.badge`), so the host draws it for any kind.
- **Pain points in the mode bar.** When the journey has any, the guided mode bar shows "N pain points". Each click selects the next one in reading order.
- **Text and Mermaid keep the score.**
  - **Outline:** a step line may end in `[1]`…`[5]`, for example `Cliente: Paga com Pix [2]`. `\[` makes it literal. Copy as Text writes the score back.
  - **Mermaid journey:** the import stores the score instead of setting it aside. The export writes the real score, or 3 for an unscored step.
  - **Mermaid swimlane:** Mermaid has no score here, so the export adds one comment line, `%% experience: s3=2, s5=1`. The import reads that comment back, and Mermaid itself ignores it.
- **The assistant.** The outline section documents `[n]`. The current journey it receives carries the scores, so it can answer "where are the pain points?" and propose fixes.

## Capabilities

### New Capabilities

- `guided-journey-experience`: the experience score, pain points, and how they show and travel through text and Mermaid.

### Modified Capabilities

None of the archived specs change.

- The `diagram-kind` contract delta (`kindProps`, `KindMarker.badge`) lives in this change's spec, as `guided-flow-diagram` is not archived yet.
- `guided-journey-outline` and `guided-mermaid-interchange` gain the score syntax through this change's spec.

## Non-Goals

- **The emotion curve** (a line across the journey). It needs a header band along the reading axis, which part 3 (phases) introduces; it ships there.
- **Scores per actor** (Mermaid has one score per task).
- **Other business data** on steps (owner, duration, SLA). The `kindProps` field makes them cheap later, but they are not in this change.

## Impact

- **Model:**
  - `component.types.ts`: `kindProps`.
  - `diagram-kind.ts`: an `isKindProps` validator, and sanitizing on import in `normalize-imported-diagram.ts`.
  - `kind-edit.types.ts` and `kind.slice.ts`: `kindProps` in `add` and `update`.
- **Kind contract:** `KindMarker.badge?: { text; tone }`. The host draws it in `useCanvasNodes`, with the process node rendering the badge.
- **Guided:**
  - `guided.model.ts` (an `experienceOf` helper);
  - `guided.inspector.ts` (the section);
  - `guided.checks.ts` (badge and pain point);
  - `guided.edits.ts` (`guidedSetExperience`);
  - outline parse, build and serialize (`[n]`);
  - Mermaid parse and serialize (journey scores, the swimlane comment).
- **UI:** `KindModeBar.tsx` (the pain-points chip), and the node badge rendering.
- **LLM:** `prompt-builder.ts`.
- **Locales:** en and pt-BR.
- **Docs:** `docs/concepts/diagram-kinds.md`.

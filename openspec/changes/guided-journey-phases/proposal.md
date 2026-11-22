## Why

This is part 3 of the Mermaid track. A journey map reads along two axes:

- **who** acts: the lanes;
- **when** it happens: the **phases** (Mermaid `journey` sections), such as Discover, Buy, Use or Support.

Today the guided journey has only the first. Part 1 reads a Mermaid journey's sections and drops them, and nothing groups the steps into stages. The emotion curve planned for part 2 also needs somewhere to live along the reading axis.

**Depends on** `guided-journey-experience` (part 2):

- `kindProps` on components, for the phase start;
- the experience score, for the curve.

Implement part 2 first.

## What Changes

- **A phase starts at a step.** A step may carry `kindProps.phase = "Buy"`, meaning "the phase _Buy_ starts here".
  - Every following step belongs to that phase until another start, through its first forward predecessor in reading order.
  - The phase list is therefore the phase starts, in reading order. There is no separate list to keep in sync: renaming a phase edits one step, and removing that step's start merges the phase into the previous one.
  - Steps before the first start belong to no phase.
- **Phases become column bands.**
  - **Arrangement:** a phase's steps occupy contiguous columns. A phase begins after the last column of the previous one, so no step of a later phase sits beside a step of an earlier one.
  - **Header band:** a band runs along the reading axis, above the lanes (left of them when the diagram reads top to bottom). It shows each phase's name over its columns.
  - **Separators:** faint dashed separators cross the lanes between phases.
  - **Selecting:** clicking a phase header selects the step where it starts.
- **The emotion curve.** When any step is scored (part 2), the header band also draws the curve:
  - a line through each scored step's column, in reading order, high for 😄 5 and low for 😞 1;
  - pain points as red dots.

  It is drawn by the host from a generic kind **overlay** (bands plus a polyline), so any kind can use it.

- **Journey tab.** A "Phase" section shows the phase the step is in, and a field "Start a phase here". Typing a name starts one; clearing it removes the start. Each change is one undo step.
- **Text and Mermaid.**
  - **Outline:** a line `## Buy` starts a phase at the next step. Copy as Text writes the `##` lines back.
  - **Mermaid `journey`:**
    - Import: `section X` starts a phase at the next task. The summary no longer sets anything aside.
    - Export: one `section` per phase along the main path, in place of the single section named after the diagram.
  - **Mermaid swimlane:** the export adds `%% phases: s1=Discover, s4=Buy`, which the import reads back.
- **The assistant.** The outline section documents `##`, so it can structure a journey from meeting notes into phases.
- **No more set-aside counts.** Scores (part 2) and sections are both stored now, so the "not kept yet" summary from part 1 is removed.

## Capabilities

### New Capabilities

- `guided-journey-phases`: phases as stages of the journey: their data, arrangement, header band, emotion curve, and how they travel through text and Mermaid.

### Modified Capabilities

None archived. The guided layout delta (contiguous phase columns) and the kind contract delta (`overlay`) are in this change's spec.

## Non-Goals

- **Phases per lane, or phases that overlap.**
- **Coloured phase backgrounds.** Only the header band and separators are drawn, to keep the lanes readable.
- **Reordering phases by drag.** Phases follow the sequence; to reorder them, the author reorders the steps.

## Impact

- **Guided:**
  - `guided.model.ts`: `phaseOf`, `phaseStarts`, and `readingOrder` (shared with the serializers).
  - `guided.arrange.ts`: phase floors in the layering, and room for the header band.
  - `guided.inspector.ts`: the Phase section.
  - `guided.overlay.ts` (new): the bands and the curve.
  - Outline parse, build and serialize (`##`), and the Mermaid parse and serialize (sections, the swimlane comment).
- **Kind contract:** `overlay?: (diagram) => KindOverlay`, which the host draws in a `ViewportPortal` layer (`canvas/chrome/KindOverlayLayer.tsx`), in kind mode only.
- **LLM:** `prompt-builder.ts`.
- **Locales:** en and pt-BR.
- **Docs:** `docs/concepts/diagram-kinds.md`.

# Proposal

## Why

The 1–5 experience score did not prove useful in practice, so the author asked to remove it. Removing it drops one field on every step, a badge on the canvas, a chip in the mode bar, a curve over the phase band, and the `[n]` syntax in text, all of which had to be kept consistent across text, Mermaid and the assistant.

## What Changes

- **BREAKING:** the Journey tab loses its "Experience" field.
- **BREAKING:** the canvas no longer shows the `n/5` badge or pain-point outlines.
- **BREAKING:** the mode bar loses the pain-points chip.
- **BREAKING:** the phase band no longer draws the emotion curve.
- **BREAKING:** the outline no longer reads or writes `[n]`. A trailing `[2]` is now part of the step's name.
- **Mermaid.** `journey` scores are still read and checked, because Mermaid requires them, but they are not stored. The journey export writes every task as 3. The swimlane `%% experience:` comment is neither written nor read.
- **Assistant.** The prompt no longer documents scores or pain points.
- **Contract.** `KindMarker.badge`, `KindBadge`, `focusMarkers` and `KindOverlay.curve` are removed: no kind uses them any more.
- **Kept.** Per-element kind data (`kindProps`) stays. Phases and participants use it. Scores already stored on existing diagrams are ignored.

## Non-Goals

- Deleting the `experience` values already stored in diagrams. They are inert data, and a migration would rewrite every guided diagram for no visible gain.
- Any replacement metric.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `guided-journey-experience`: every score requirement is removed. Only "An element can carry its kind's data" remains, so the spec's Purpose is updated to say it covers per-element kind data.
- `guided-journey-phases`: "The band draws the emotion curve" is removed.

## Impact

- **Guided kind** (`src/features/diagram-kinds/guided`): model, edits, checks, inspector, overlay, outline (parse, build, serialize, reconcile), Mermaid.
- **Contract:** `kind.types.ts` and `markers.ts`.
- **Canvas:**
  - `KindModeBar`;
  - `KindOverlayLayer`;
  - node overlays and badge CSS;
  - `useCanvasNodes`.
- **Exports:** the draw.io decorations.
- **Assistant:** the prompt.
- **Locales:** en and pt-BR keys.
- **Docs:** `docs/concepts/diagram-kinds.md`.
- **Unarchived changes:** the in-flight changes `guided-overlay-fit-export`, `guided-journey-live-text`, `guided-journey-blueprint` and `guided-assistant-revisions` had their spec text edited in place to drop scores.

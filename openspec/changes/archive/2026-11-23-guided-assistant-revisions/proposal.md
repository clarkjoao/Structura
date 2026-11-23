# Proposal

## Why

On a guided journey the assistant can only _add_. Its one tool, `add_journey_outline`, appends an outline, and the suggestion card is all-or-nothing. The most valuable requests change what is already there:

- "improve the pain points";
- "rewrite the steps in the customer's words";
- "split this into phases";
- "update the journey with today's meeting notes".

The assistant cannot express those today: it would duplicate the journey, or fall back to generic node tools that bypass the guided rules. A model that gets one item wrong also forces the author to reject everything.

## What Changes

- **A new tool, `revise_journey(outline, reason?)`.** It is offered on guided diagrams in kind mode. The assistant sends the _whole revised journey_ as an outline that carries the step handles it was given (`{#s4}`). It can also send one short reason per change, as `# why: …` comments placed right above the changed line.
- **The current journey is sent with handles.** The prompt carries the journey written "with ids", so the assistant can refer to existing steps.
- **The result is a reviewable suggestion.** The app reconciles the revision against the journey with the engine from `guided-journey-live-text` and shows a change list:
  - grouped by phase;
  - one row per change (add, remove, rename, kind, lane, score, phase, exits);
  - each row with a checkbox, ticked by default, and the reason when given.
- **Partial accept.** "Apply selected" applies only the ticked changes, as one undo step. Changes that depend on each other tick and untick together. For example, a new step connected only to another new step, or an exit to a new step, goes with that step.
- **Preview.** While the card is pending, the canvas highlights the existing steps the selected changes touch, using the assistant's existing preview, and steps about to be removed are marked.
- **Stale suggestions.** If the journey changes before you apply, the card re-reconciles. Changes whose steps are gone are shown as "no longer applicable" and cannot be ticked.

## Non-Goals

- Ghost nodes on the canvas for steps that would be added. New steps are listed in the card only.
- Letting the assistant change lanes beyond adding them, the line of visibility, or the layout.
- Removing `add_journey_outline`. It stays for "add this part", and the prompt says when to use which.
- Applying a revision without review (an auto-accept setting).

## Capabilities

### New Capabilities

- `guided-assistant-revisions`: the revise tool and its rules, the reviewable change list, partial accept with dependency groups, the preview, and stale handling.

### Modified Capabilities

- `guided-journey-outline`: "The assistant writes journeys as outlines" changes. The current journey is sent with handles, and the assistant gets two tools (add, revise) instead of one.

## Impact

- **`src/features/llm`:**
  - `tools.ts` (new tool);
  - `patch-parser.ts` and `types.ts` (a `REVISE_JOURNEY` action);
  - `journey-outline.ts` (serialize with ids, then check and apply a revision through `reconcile`);
  - `prompt-builder.ts`;
  - `components/SuggestionCard.tsx` (the change-list mode);
  - `store.ts` (selected changes and preview ids per suggestion).
- **`src/features/diagram-kinds/guided`:** the reconcile returns changes with stable keys and their dependency groups, and can apply a subset.
- **Depends on `guided-journey-live-text`:** handles, `serializeWithIds` and `reconcile`.
- **i18n:** en and pt-BR for the change rows, groups and stale labels.

# Proposal

## Why

Guided journeys already work top to bottom:

- lanes become columns;
- steps flow downwards;
- phases sit on the left.

But the only way to get there is Organizar → Direction → Vertical, and few people look there. A journey with many lanes, or one that will be read on a portrait screen or in a document, should be able to start vertical, switch from where the journey is edited, and keep a Mermaid block's own direction.

## What Changes

- **At creation.** Creating a guided diagram offers the direction, Horizontal (lanes as rows) or Vertical (lanes as columns), with a small picture of each.
- **From the mode bar.** The guided mode bar shows a direction toggle (→ / ↓). It runs the same switch as the Organizar menu and is one undo step.
- **From Mermaid.** Pasting a Mermaid `swimlane-beta`/`flowchart` block whose header says `TB`/`TD`/`BT` into a journey that has only its start step makes the journey vertical. `LR`/`RL` makes it horizontal. An existing journey keeps its direction.
- **Parity.** Everything added recently behaves the same top to bottom:
  - the phase band;
  - the line of visibility;
  - participant tags;
  - the Text panel;
  - framing;
  - the draw.io export.

  Tests pin this.

## Non-Goals

- Bottom-to-top or right-to-left journeys.
- A per-lane direction.
- Changing freehand diagrams' direction controls.

## Capabilities

### New Capabilities

- `guided-vertical-journeys`: choosing and switching a guided journey's direction (creation, mode bar, Mermaid) and the parity guarantees.

### Modified Capabilities

None.

## Impact

- **Creation:** `src/pages/dashboard/AddDiagramDialog.tsx` gets the direction choice, used when the kind declares `directions` support. `createKindDiagram` takes the direction.
- **Mode bar:** `KindModeBar` gets the toggle, reusing the Organizar direction action from `useAutoLayout` / `applyDiagramAutoLayout` (writeDirection).
- **Mermaid:** `guided.mermaid.parse.ts` reads the header direction. The capture build returns `direction?`, which the host applies only when the journey is empty.
- **Tests:** TB parity tests across the guided suites.
- **Other:** en and pt-BR keys and the docs.

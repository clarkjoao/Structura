# Decision: Remove the Walkthroughs feature

**Date:** 2026-08-26
**Status:** Decided, executed
**Tag:** `pre-remove-walkthroughs` (commit `6b3d9a1`)

## What Walkthroughs was

Walkthroughs was a cross-diagram narrative feature. A `Walkthrough` was an
ordered set of `WalkthroughStep`s, each step pinned to a diagram and a step
within one of that diagram's flows. The idea: let an architect record or
hand-author a path through several diagrams and play it back as a guided
tour — onboarding, incident retrospectives, executive walkthroughs.

The previous name for the same bounded context was `Journeys`. The rename to
`Walkthroughs` landed in 2026-07-07
(`openspec/changes/archive/2026-07-07-rename-journey-to-walkthrough/`); the
intent of that rename was to disambiguate from BPMN journeys and marketing
funnels. The change being recorded here is a full removal of the feature,
not a pause, and not a flag.

## What it did well

- It had a working VCR-style player: prev/next, play, record, jump-to-step.
- It was the only built-in way to link several diagrams into one linear
  narrative without leaving the canvas.
- The cross-diagram `WalkthroughStep` model — a step is a `(diagramId,
  flowId, stepId)` triple — was small and clean, and the local-first
  persistence (separate Zustand store, separate `structura-walkthroughs.json`
  in the connected-folder sync) avoided bloating the diagram-store.
- The canvas highlight integration re-used the Flow highlight pipeline: a
  walkthrough step was rendered as a flow playback over a different diagram,
  which kept the player surface small.

## What didn't work

- **The mental model fought the rest of the app.** Walkthroughs are
  narratives, not diagrams, but the editor lived next to the diagram editor
  and reached into the same canvas (custom `WalkthroughEditorCanvas`,
  `useWalkthroughViewportSync`, badge in `CustomNode`, `WalkthroughsInDiagramPanel`).
  That coupling made the canvas feature harder to evolve; every canvas
  change had to be re-validated against walkthroughs playback.
- **The cross-diagram step pointer was too rigid.** A step recorded against
  `(diagramId, flowId, stepId)` broke the moment any of those moved or
  was renamed, and the migration story for that was never finished. So
  recorded tours degraded silently.
- **Recording produced long, fragile step lists.** Recording serialized
  *every* `recordHandleClick` and step transition; tours grew to dozens of
  steps that the author rarely re-watched and that no one else edited.
- **Sharing a walkthrough still required sharing the underlying diagrams.**
  The narrative was only meaningful when the audience had read access to
  every diagram the tour touched. There was no portable artifact.
- **Adoption was low relative to the surface area it added to the canvas.**
  A new node-type, a player bar, a panel, two pages, an editor canvas, a
  custom-store, a custom migration, two test files, custom i18n, and a
  descriptor field (`journeysByComponentId`) — for a feature that almost
  never appeared in a flow.

Unknowns (not derivable from the repo): absolute usage numbers, retention
after creation, and how many of the existing user-saved diagrams contain
walkthrough data. The first two are not recorded anywhere in the codebase;
the third is bounded — walkthroughs live in a separate store and separate
file, so a `diagram-store` v12 file never embeds walkthroughs and opens
unchanged after this removal.

## Why we removed it

- The Flow work that is planned next is expected to subsume the *useful*
  part of walkthroughs (guided playback of recorded flows) without the
  cross-diagram storytelling. Anything Walkthroughs did that Flow does not,
  the team has decided to leave for a future, redesigned pass.
- The cost of *keeping* the feature is paid every time the canvas, the
  custom-node pipeline, the descriptor, the i18n catalog, or the
  persistence layer changes. The cost of *removing* it is paid once.
- The rename `Journeys → Walkthroughs` had already removed the only reason
  the legacy name was worth keeping around (terminology alignment with
  BPMN / marketing usage), so the rationale that originally kept the
  bounded context alive no longer applies.

## What this PR is not

- It is not a pause. There is no feature flag, no commented code, no
  `legacyWalkthroughApi`, no preserved i18n keys. The git history is the
  safety net.
- It is not a refactor. Code that touched walkthroughs but is still valid
  (the Flow highlight pipeline, the custom-node `data` shape, the
  `useCanvasGraphState` hook) keeps the same shape — only the walkthrough
  *inputs* are gone.
- It does not touch Scenes, Compare Mode, Flow, or the LLM pipeline. They
  do not import from `features/walkthroughs`; the only places that did are
  the same places the PR removes.

## What may want to come back, and from where

When the team picks the work back up, the inputs are:

1. The Flow playback UI (`features/canvas/flow/`) and its recorder panel.
2. The cross-diagram *diagram-link* model in `features/diagram` (a step is
   just a node with a `linkedDiagramId`; the rest is glue).
3. The player patterns the old feature established (VCR-style prev/next,
   viewport fit, current-step highlight) — these are reusable, not
   feature-specific.
4. The Flow highlight pipeline (`flowState.ts`) — already shared.

What should not be revived unchanged: the `Walkthrough` data model, the
separate satellite store, the `WalkthroughEditorCanvas` page, the
`/walkthroughs` routes, the `journeysByComponentId` descriptor field, the
`WalkthroughsInDiagramPanel`, and the `useWalkthroughPlayer` /
`useWalkthroughGlobalPlayer` hooks. If any of those return, they will
return as something re-shaped against the Flow + diagram-link substrate.

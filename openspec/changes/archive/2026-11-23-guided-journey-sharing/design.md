# Design

## Context

- **Text formats.** `KindTextCapture.formats` already lists the "Copy as…" formats.
- **Walkthroughs.** A walkthrough is a list of scenes (`diagramId`, `flowId`, `label`), and `useWalkthroughStore.save` persists it.
- **The derived flow.** `guided.derive.ts` keeps one flow equal to the step graph, with its id in `kindData.flowId`.
- **The assistant.** The store's `sendMessage(text, context)` drives the chat, and revisions already come back reviewable.

## Decisions

### 1. The document is a text format

It is `{ id: "document", label, serialize }`. It walks the journey in the outline's reading order (the serializer's emit order) and groups the steps by `guidedPhases`. Download reuses `downloadFile` with `text/markdown`.

### 2. Phase flows are derived like the journey flow

`kindData.phaseFlowIds: Record<startId, flowId>`. Derivation creates, updates or removes one flow per phase start. The steps are the phase's steps in reading order, and the transitions are those inside the phase. Exits leaving the phase end the flow there.

They are named "<diagram> — <phase>" and marked derived, so the flow panel lists them as read-only, like the journey flow.

_Alternative considered:_ scenes that point at the journey flow with a step range. Rejected: the walkthrough model has no range, and adding one touches the player.

### 3. "Present by phase" upserts

The walkthrough is found by a `sourceDiagramId` + `kind: "phases"` marker in its description metadata. If none is found, a new one is created. Its scenes are replaced with the current phases, then it opens in the player.

### 4. Review presets

Each preset is an i18n string. The bar opens the chat panel through the existing chat open event and calls `sendMessage(preset, context)`. The guided prompt already tells the assistant to use `revise_journey`.

### 5. Templates are outlines

`DiagramKindDescriptor.templates?: Array<{ id, label, outline: KindText }>`. The outline text is translated, and Portuguese names stay natural. Creation builds the template's outline after the start step, through `buildOutline`, as one edit. "Paste meeting notes" is a host-side option that opens the assistant with the notes.

## Risks / Trade-offs

- **[Risk]** Phase flows clutter the flow list. → **Mitigation:** they are grouped under the journey flow, collapsed, read-only.
- **[Risk]** Template text changes with the language at creation time. → Accepted: a template is a starting point, not a live link.

## As implemented

- **Behind the walkthrough flag.** Walkthroughs are behind `VITE_ENABLE_WALKTHROUGHS`, off by default. "Present by phase" is offered only when the flag is on, and the walkthrough module is imported on demand, so it stays out of the canvas chunk when the flag is off.
- **The review menu is always offered** in editable kind mode. With no working connection, the assistant answers with its usual error.
- **Templates are part of creation.** They are not a separate undo step. `tidyTemplate` drops the blank lanes and moves the start into the template's first lane.

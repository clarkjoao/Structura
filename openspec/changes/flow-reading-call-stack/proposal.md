## Why

Reading a flow today is a flat list. `FlowReadingRail` renders every step at the same indent, so a
request and its response are drawn as siblings and everything that happened _inside_ that call looks
like it happened _after_ it. On a nine-step script that is a nuisance; on a sixty-step script across
four services it makes the rail unreadable — the reader has to hold the nesting in their head.

The nesting is already in the data and nothing reads it as such: `FlowStep.payloadDirection`
(`src/features/diagram/model/flow.types.ts:33`) is a push/pop marker. A `request` on a connection
opens a call that is still owed a return; the matching `response` closes it. Deriving a call stack
from those pairs turns the rail into the one reading surface developers already know how to operate —
VS Code's Call Stack and Variables panes — and unlocks the control that actually makes a long script
readable: **step over**, which reads a call's result without reading its interior.

The second half is the contract. `FlowStep.payload` exists but is ephemeral: `buildEdges.ts:131`
hands it to the active edge and the bubble disappears on the next step. A developer following a step
cannot see the shape being sent, and has no way at all to see what is expected back — which is the
question they are usually there to answer.

## What Changes

1. **Derived call stack.** New pure derivation in `src/features/diagram/utils/flow-call-stack.ts`
   pairs `request` steps with the `response` that closes them and assigns every reachable step a
   call depth, an opened frame and a closed frame. No new required field; a script that carries no
   `payloadDirection` derives depth `0` throughout and is unchanged.

2. **Indented spine.** `buildReadingSpine` rows carry `callDepth`; `FlowReadingRail` draws one
   continuous vertical guide per open frame, so a frame's _extent_ is visible, not only that a row
   sits deeper. Step numbers stay in a fixed mono gutter; only content indents.

3. **Frame breadcrumb.** The scene names the callers still waiting — `Cliente › API › Pagamentos` —
   each segment stepping out to that frame. Absent at depth 0.

4. **Step over / step out.** Two controls in the rail footer, next to `Próximo`. Step over jumps from
   a call to the step that closes it, appending every skipped step to `history` so state and the
   walked spine stay correct. Step out jumps to where the current frame returns. Each is rendered
   only when it has a target.

5. **Derived return row.** A frame that closes with no authored response step gets a light
   `↩ volta para «caller»` row in the spine. Derived for display only — never written into
   `flow.steps`.

6. **Variables panel.** A collapsible drawer above the rail footer, in the shape of VS Code's
   Variables pane: collapsible roots, nested objects with indent guides, values coloured by JSON
   type. Three roots — **Envia** (this step's `payload` parsed as JSON), **Espera receber** (the
   payload of the step that closes this frame, or an explicit `expects`), **Estado** (the running
   object folded from each step's `context.sets`, grouped by frame). Absent when no root has content.

7. **New optional step field.** `FlowStep.context?: { sets?, reads?, expects? }`. Every member
   optional; a script without it behaves exactly as today. Not breaking — additive on an optional
   field, and `flow-migration.ts` needs no new branch.

8. **An editor for `context`.** Found by asking whether the running object could be reached at all:
   it could not. `FlowScriptRow` edits eight fields and `context` was not among them, so the field,
   its three consumers and the whole fold shipped with no way for anyone to author one. The script
   panel gains the values a step introduces, the keys it consumes, the expected body — and a
   one-gesture "take the keys from this body", since a call's own payload is usually what the step
   contributes.

9. **Two data paths taught to say "request".** Found while verifying, not planned: no path in the
   product produced a pairable pair. The Mermaid sequence importer wrote `payloadDirection` only on
   the way back (`import-mermaid-sequence.ts:257`), so every imported response answered a call
   nobody had made; and the seed's own response step named no connection, so it closed nothing.
   Both are corrected here, because without them the feature is inert on every flow that exists.

10. **The block keyword promoted out of the label.** Found while reviewing: the Mermaid importer
    wrote `alt` / `par` / `loop` into `conditionLabel`, so the only record of what a block _was_ sat
    in the field meant for the author's question — destroying the block's own name on the way in, and
    making the exporter sniff a magic string on the way out, where anything but those six words
    silently became `alt`. A branch point now declares `conditionKind`, the script panel offers the
    six kinds, and the reading draws the one distinction that matters from it: a `par` forks into
    threads that all run, and presenting them as a choice describes a different flow.

## Capabilities

### New Capabilities

- `flow-reading-call-stack`: deriving call frames from request/response pairing, and everything the
  reading does with them — depth, indentation, breadcrumb, step over / step out, derived returns,
  and how inconsistent pairings are reported rather than guessed.
- `flow-reading-variables`: the Variables drawer — the Envia / Espera receber / Estado roots, the
  `context` field that feeds Estado, JSON-vs-text payload handling, and provenance of each value.
- `flow-branch-point-kind`: what a branch point _is_, as a field rather than a keyword smuggled
  through the author's question — and the one difference the reading draws from it, between taking
  one way out and taking all of them.

### Modified Capabilities

<!-- None. The reading rail is not covered by an existing spec; both capabilities above are new. -->

## Non-Goals

- **No expression language and no evaluation.** `context` values are example data, written as text.
  Nothing is computed, templated, or validated against a schema. A condition displays the value it
  reads; it does not evaluate the question.
- **No schema validation.** `Espera receber` is a contract _preview_, not a check that runs. The one
  comparison in scope is the explicit-`expects` vs actual-response diff, and it reports, never blocks.
- **No named example runs.** Values live on the step and there is exactly one run per script. The
  field shape must not preclude moving them under a run id later, but that change is not this one.
- **No recorder changes.** `useFlowRecording` still writes only `componentId` / `connectionId` /
  `handleId`. Every script recorded in-app therefore derives a flat stack until a separate change
  teaches the recorder direction — importing or authoring by hand are the two ways to get a paired
  script until then.
- **No fork/join traversal.** `conditionKind` is now in scope (see What Changes 10) and the reading
  says which branch points fork into threads, but the reading still holds one cursor: it walks one
  thread at a time. Giving it several — running threads side by side, a join where they meet, an
  aggregate latency that is a `max` rather than a sum — is the change that builds on this one.
- **No canvas changes.** Highlighting the components with open frames is deliberately out of scope;
  the reading rail is the whole surface of this change.
- **No changes to `FlowStepNavigator`,** which remains as the viewer's floating card.

## Impact

**New files**

- `src/features/diagram/utils/flow-call-stack.ts` + test — the pairing walk and frame model.
- `src/features/diagram/utils/flow-condition-kind.ts` + test — the kind, its default, and whether a
  branch point's ways out all happen.
- `src/features/canvas/flow/conditionKinds.ts` — the glyph, the colour and the six label keys.
- `src/features/canvas/flow/reading/readingVariables.ts` + test — the three roots and the fold.
- `src/features/canvas/flow/reading/FlowVariablesPanel.tsx` + test — the drawer and the JSON tree.
- `src/features/canvas/flow/reading/JsonTree.tsx` — presentational, no flow knowledge.

**Modified**

- `src/features/diagram/model/flow.types.ts` — additive `FlowStepContext`, `FlowStep.context`.
- `src/features/canvas/flow/reading/readingSpine.ts` — `callDepth`, `opensFrame`, `closesFrame`,
  derived return rows on `ReadingRow`.
- `src/features/canvas/flow/reading/FlowReadingRail.tsx` — guides, breadcrumb, footer controls,
  drawer mount.
- `src/features/canvas/flow/reading/FlowReadingScene.tsx` — breadcrumb slot; condition shows the
  value it reads.
- `src/features/canvas/flow/useFlowModePlayback.ts` — `stepOver` / `stepOut` on the playback slice.
- `src/features/canvas/flow/flowMode.types.ts` — the two new actions on `FlowMode`.
- `src/pages/workspace/WorkspaceContent.tsx` — pass the two new handlers to the rail.
- `src/infrastructure/i18n/locales/{en,pt-BR}.json` — new `flowReading.*` keys, both locales.

**Also modified** (see What Changes 8)

- `src/features/diagram/utils/import-mermaid-sequence.ts` — an outward message is a request.
- `src/fixtures/seeds/urlshort-example.ts` — the context script's response names its connection.

**Also modified** (see What Changes 10)

- `src/features/diagram/model/flow.types.ts` — `FlowConditionKind`, `FlowStep.conditionKind`.
- `src/features/diagram/utils/flow-migration.ts` — a keyword in the label is promoted on load.
- `src/features/diagram/utils/flow-mermaid.ts` — the exporter reads the field, not the label.
- `src/features/diagram/utils/import-mermaid-sequence.ts` — the importer writes the field and stops
  overwriting the label.
- `src/features/diagram/utils/flow-condition.ts` — the kind goes with the last branch.
- `src/features/canvas/flow/script/FlowScriptRow.tsx` — the six kinds, on the row.
- `src/features/canvas/flow/reading/{readingSpine,readingScene,FlowReadingRail,FlowReadingScene}` —
  the mark, the prompt, the threads already read, and the name of a block nobody titled.
- `src/features/canvas/flow/{FlowStepNavigator,recorder/BranchSelectView,script/FlowScriptList}.tsx`
  — the same mark and the same fallback, so one vocabulary is used everywhere.
- `src/features/canvas/flow/flowMode.types.ts` — `seen` beside `history` on a reading.
- `src/features/canvas/flow/useFlowModePlayback.ts` — every transition records where it landed.
- `src/pages/workspace/WorkspaceContent.tsx` — pass `seen` to the rail.

**Unaffected by design**

- `src/features/diagram` stays React-free; the whole derivation is pure functions over `Flow`.
- Persistence: no new storage shape, no `IStoragePort` change, no migration branch.
- Mermaid _export_ is untouched, and `context` has no Mermaid representation — it round-trips as
  absent.

# Design

## Context

See proposal.md for the motivation and the three commitments (kinds are an extension point, a
kind is not a file format, custom components and experiences are foreseen).

The parts of the code this change builds on:

- **Diagram model.** `Diagram` (`features/diagram/model/diagram.types.ts`) has no kind. Its
  `direction?: "TB"` field is the precedent for an optional, absent-means-old field: no
  `PERSIST_SCHEMA_VERSION` bump (currently 16), sanitized on import.
- **Elements.** The element registry ([ADR-0010](../../../docs/adr/0010-element-registry.md))
  owns every element type, built-ins and plugin render descriptors alike. Flowchart shapes are one
  `process-node` element with a `flowShape` variant. Lanes are `panel` with
  `PanelKind.Swimlane`, with children attached through `parentId`. Unregistered types render as
  `unknown`.
- **Flows.** A flow is a step graph in `diagram.snapshot.flows` (`docs/concepts/flow.md`).
  `flow-edit.ts` has sewing and `checkFlowInvariants`.
- **Layout.** There is one engine and one applicator (`layoutEngine.ts`, `applyLayoutResult.ts`),
  and ELK knows no lanes. `axis.ts` mirrors the graph for top-to-bottom. `incrementalPlacement.ts`
  exists because a full ELK run moved 72% of the nodes on a single insert.
- **Plugins.** API `1.15.0` (`plugin.types.ts`). `getDiagram` returns a snapshot,
  `moveComponents` returns `void`, and `applyChanges` returns a result. Panels fill slots, and
  `llm:context` has the precedent of an `appliesTo(diagramId)` predicate.
- **Extension-point rules** (`docs/architecture/extension-points.md`): contributions are data
  plus functions, registries validate at registration, every contract gets a context object,
  built-ins go through the same mechanism, and nothing degrades with zero contributions. "Diagram
  types (profiles)" is listed 🔴. "Validators", "Layout providers" and "Commands" are 🔴 too, and
  a kind touches all three.
- **Hot path.** `useLocalNodes` already supports non-draggable nodes (`adoptsStorePosition`).

## Goals / Non-Goals

**Goals:**

- A kind contract that a second built-in kind, and later a plugin, can implement without touching
  canvas code.
- The diagram's content is always a valid freehand diagram, so the kind can always be suspended,
  missing, or restored.
- Every existing write path (UI, plugins, assistant, paste, Versions, collab) passes through one
  post-edit hook, so a kind cannot be bypassed and does not need to be special-cased per feature.
- Freehand diagrams take today's code paths and keep today's hashes.

**Non-Goals:**

- `registerDiagramKind` on the plugin API (follow-up). The contract below is shaped for it.
- A command registry. Kind commands are a deliberately small subset it can absorb.

## Decisions

### D1. Three optional fields; the content stays ordinary

```ts
interface Diagram {
  // …
  kind?: string; // "guided" | "<pluginId>:<kind-id>"
  kindMode?: "freehand"; // absent = the kind's own editor
  kindData?: JsonObject; // owned by the kind, opaque to everything else, ≤ 64 KB
}
```

There is no schema bump, following the `direction` precedent. One sanitizer
(`sanitizeKindFields`) runs on every inbound path. It keeps a well-formed `kind` even when it is
not registered (commitment 2: a missing plugin must not destroy data), keeps `kindMode` only when
it is `"freehand"`, and keeps `kindData` only when it is a plain JSON object under the cap.

Guided uses `kindData = { flowId }`. Nothing else is stored: lanes, steps and their order are read
back from ordinary elements (D5), which is what makes the round trip possible.

_Alternatives:_

- A literal union `kind?: "guided"`. Rejected: an unknown future or plugin kind would be dropped
  by older or plugin-less builds.
- Guided-specific fields on `Component` (a lane index, a step order). Rejected: a freehand edit
  would leave them stale, and the round trip would have to reconcile two truths.

### D2. `DiagramKindDescriptor`: one contract, every hook optional except conformance

```ts
interface DiagramKindDescriptor {
  id: string; // validated, see spec
  label: LocalizedText;
  description?: LocalizedText;
  icon: IconRef;
  creatable: boolean;
  elements: ReadonlyArray<{ type: string; variant?: string }>; // palette; may name plugin types
  interaction: { nodesDraggable: boolean; resizable: boolean; arrangeModeChoice: boolean };
  create?(ctx: KindContext): KindEdit; // creation template
  conforms(diagram: DiagramModel, ctx: KindContext): KindIssue[]; // required
  arrange?(diagram: DiagramModel, ctx: KindContext): Promise<KindArrangement>;
  derive?(diagram: DiagramModel, ctx: KindContext): KindEdit; // e.g. derived flows
  checks?(diagram: DiagramModel): KindMarker[]; // quiet markers
  commands?: ReadonlyArray<KindCommand>; // { id, label, keys?, when, run(ctx) }
}
```

- **`KindContext`** is the only thing a kind sees: a read-only diagram, the element registry
  lookup, the layout engine (`layout()` and the axis helpers), i18n `t`, and `edit`, a
  transaction builder that produces a `KindEdit`. A kind never imports the store. This follows
  extension rule 3, and it is the same boundary a plugin will get.
- **`KindEdit`** is a declarative change set: add, update, remove, connect, move and flows, the
  same vocabulary as the plugin `PluginDiagramChanges`. Because the vocabulary is shared, the
  host applies kind edits and plugin `applyChanges` with the same applicator. A built-in and a
  future plugin kind are therefore held to the same rules.
- **Custom components:** `elements` may list plugin element types. If the plugin is missing they
  render as `unknown`, and `conforms` reports them instead of failing.
- **Custom experience:** `commands` (keymap plus context menu entries), `checks` (markers),
  `arrange` (layout provider) and the plugin panel `appliesTo` (D7) together cover the
  "experience". Every one of them is optional, so a minimal kind is a palette plus a conformance
  check.
- The registry lives in `features/diagram/kinds/registry.ts`. Guided registers from
  `features/diagram/kinds/bootstrap.ts`, alongside the element bootstrap. Its React-free parts
  (conformance, derivation, edits) sit in `kinds/guided/`, and its keymap and markers are bound
  in `features/canvas` via `commands`/`checks`.

_Alternative:_ hard-code guided now and generalise later. Rejected: commitment 1, and the
extension-point rules say a contract proven only by a later second kind tends to leak the first
kind's assumptions.

### D3. Policy resolution: `resolveKindPolicy(diagram)`

| Diagram                                   | Policy                                       |
| ----------------------------------------- | -------------------------------------------- |
| no `kind`                                 | freehand (today)                             |
| `kind` registered, no `kindMode`          | the kind's descriptor                        |
| `kind` registered, `kindMode: "freehand"` | freehand, with a "Back to <kind>" affordance |
| `kind` not registered                     | freehand, with an "unavailable kind" notice  |

Canvas, palette, keyboard, Arrange menu, flows panel and plugin write paths consult only this
resolver, which is memoised per diagram id and registry version. No feature reads `kind`
directly, and a guard test enforces it, like `handleSides.guard.test.ts`.

### D4. One kind watcher for every writer (revised during apply)

ELK runs asynchronously, so an arrangement cannot share the edit's `set()`. The automatic mode
already solves this, and the kind follows it (`canvas/hooks/autoArrangeWatcher.ts`). A **kind
watcher** subscribes to the store and compares the active diagram's `structuralSignature`. Any
structural change is treated as an edit: one from the UI, a plugin's `applyChanges`, an assistant
patch, a paste or a Version edit. Undo/redo (`_lastUndoRedoAt`) and a peer's change
(`_lastRemoteWriteAt`) only rebaseline. Once the edits settle, the watcher runs the kind's
`derive` and `arrange` and writes both **without a history entry**. The flow is written with
`history: false`, and positions through `applyAutoLayout(…, { history: false })`. The checkpoint
taken by the edit already holds the old structure, flow and positions, so one undo reverts all
three: that is the spec's "one undo step".

- The guided actions also write a **provisional position** synchronously: the new step is placed
  one column after its predecessor, in its lane's band. The step therefore appears in place at
  once and the arrangement only refines it. The guided debounce is short (≈50 ms, against the
  automatic mode's 400 ms).
- A diagram written while it is not open (a plugin targeting another `diagramId`) is arranged
  when it is next opened. After each run the watcher stores `kindData.arrangedSignature`, and on
  opening it arranges once if the current signature differs.
- `derive` is pure and synchronous, and the watcher runs it before `arrange`, so the arranged
  positions and the flow come from the same structure.

Plugin `moveComponents` and the move entries of `applyChanges` check the policy's
`nodesDraggable` first. When it is false they leave positions as they are and report
`{ refused: "kind_controls_layout" }`. `moveComponents` changes from `void` to returning that
result, which is source-compatible for JavaScript callers and additive in the types (API
`1.16.0`). Inside an active Version, positions go through the same `applyAutoLayout` path, so
they land in `VersionDiff.nodeLayouts`.

_Alternative considered first:_ an `afterStructuralEdit` hook called from every slice inside the
edit's `set()`. It was rejected during apply because the asynchronous ELK pass cannot run inside
`set()`, and because calling it from every writer is exactly the plumbing the watcher avoids.

### D5. Guided conformance and lane order read back from geometry

`conforms` implements the spec's rule list over ordinary elements. Lane order is the lanes'
order along the cross axis, which is `y` left to right and `x` top to bottom after `axis.ts`
mirroring. Step order is the connection graph. This is why guided needs no stored order and why
a freehand reorder of lanes is respected on return.

### D6. Lane-banded arrangement: longest-path layers, bands for placement (revised during apply)

1. **Order.** A walk from the start step finds back-edges (retries) and leaves them out of the
   layering. Each step's layer (its column) is its longest path from a root over the forward
   edges, and its order inside the layer is the walk's discovery order, with exits in reading
   order.
2. **Placement.** Along the axis, each column is as wide as its widest step, separated by the
   density's column gap. Across the axis, lanes are stacked bands, each as deep as its tallest
   column stack plus padding. Steps sharing a lane and a column stack in discovery order, centred
   in the band. Lanes span every column, and the first lane keeps its origin.

The arrangement is written in along/across coordinates and mapped to x/y at the end. Top to
bottom is therefore the same arrangement mirrored, not a second one (ADR-0013's no-fork rule).
Edge routes are left to the canvas's default routing with fixed sides.

_Why not ELK (the first plan):_ ELK layered does not report layer indices. Recovering them from
x positions is fragile when steps have different widths, and the ELK round trip is asynchronous.
The longest-path layering was the planned fallback, and it was adopted outright: it is
synchronous, deterministic, and stable by construction. Appending a step only adds a layer at the
end, and inserting one only pushes the steps after it, so no column floor is needed. What it
gives up is crossing minimisation inside a column, which matters little once lanes already split
the steps across the axis.

Measured (`guided.layout.test.ts`, average of 5 runs in Vitest on the dev machine): about 2 ms for
100 steps and about 1.5 ms for 300, far under the 50 ms budget per edit.

### D7. Plugin panels can scope to kinds

`PanelContribution` gains `appliesTo?: { kinds?: string[] }`. When it is absent, the panel
behaves as today, so the change is additive. `"freehand"` is accepted as a pseudo-kind for
"diagrams with no kind". `DiagramSnapshot` gains `kind?`, `kindMode?` and `kindAvailable`, read
only. `kindData` is not exposed in this change. It belongs to its kind, and plugin access to it
waits for plugin kinds.

### D8. Derived flow (guided `derive`)

The derived flow is a pure function `deriveGuidedFlow(diagram, previous)`. It keys flow steps by
`componentId`, rebuilds `next`, `branches` and `entryStepId`, and copies the content fields
(`description`, `note`, `payload`, `payloadDirection`, `duration`, `isAsync`, `context`, state
`sets`/`reads`) from the previous step with the same `componentId`. The flow id lives in
`kindData.flowId`. If that flow is missing on return, a new one is created and the id rewritten.
`checkFlowInvariants` is asserted in tests.

### D9. Interaction details (guided)

- The keymap is declared as guided `commands`: `Tab` adds the next step, `Shift+Tab` adds a
  branch, `Alt+↑/↓` moves a step between lanes, and `Delete` deletes and sews. It is active only
  with canvas focus, a single step selected and no text editor open. `Esc` clears the selection
  and gives normal `Tab` focus navigation back.
- Inline label editing opens on the new step with its placeholder selected ("fast first": no
  prompts).
- The palette maps to `FLOW_PALETTE` entries for task, start, end, event, decision, subprocess,
  data store and document.
- Quiet checks are guided `checks`, computed by a selector memoised on snapshot identity and read
  by renderers through the identity-cached projection (canvas hot-path rule). The viewer and the
  exporters never call them.

## Risks / Trade-offs

- [The kind contract is a long-term commitment] → it stays internal in this change, and plugin
  exposure is a separate spec once a second kind has exercised it.
- [A full ELK run per keystroke is slow on big maps] → measure at 100 and 300 steps. If it is
  too slow, use the scoped order pass or the longest-path fallback (D6).
- [A plugin that relied on `moveComponents` silently succeeding] → it only changes for kind-mode
  diagrams, which do not exist before this change, and the refusal is explicit and documented.
- [Freehand edits that break the derived flow's topology] → return re-derives from the steps and
  says so before applying (spec). Recorded flows are untouched.
- [Unavailable-kind diagrams accumulate edits that later fail conformance] → expected. The return
  lists the issues and the diagram stays freehand.
- [Concurrent peers compute arrangements from different intermediate states] → last writer's
  positions win, as with any concurrent move. An e2e test covers two peers appending.
- [`Tab` overrides focus navigation] → scoped as in D9 and listed in the shortcuts dialog.
- [Cut + paste of a step loses its derived-flow content] → paste mints new ids. Accepted and
  documented.

## Migration Plan

No data migration: all three fields are optional and absent means freehand. Builds from before
this change keep unknown top-level diagram fields (`normalizeImportedDiagram` spreads the rest,
folder files are written whole), so a guided diagram opened there keeps its kind fields. The kind
is diagram-level, so a Version neither carries nor changes it. The plugin API moves
to `1.16.0` (additive). Rollback means not registering the guided kind: guided diagrams then open
freehand with the unavailable notice and keep their kind for a later build.

## Open Questions

- The default lane names (copy, settled in i18n review).
- A lane-kind icon in the swimlane header (actor vs system). This is visual only.

# Proposal

## Why

Every Structura diagram today is freehand: the author places shapes, then records a flow over
them, and a walkthrough strings flows together. For mapping how data or value moves through a
journey (a checkout, an HTTP request across services, an onboarding) that order is backwards. The
author draws twice, the layout knows nothing about the sequence, and two people map the same
journey in two unrelated pictures. The walkthrough tried to address this and did not, because the
flow stayed a layer over a free drawing instead of being the drawing.

A **guided** diagram flips it: the author writes the sequence of steps, lanes say who or what does
each one, and the picture is always derived from that, so every map of this kind reads the same.
It is BPMN-inspired (lanes, tasks, events, exclusive decisions) but aimed at software journeys and
data flows, not industrial process modelling.

Guided is the first of several diagram kinds, so it is built on three commitments that outlive it:

1. **Kinds are an extension point.** Other kinds (VSM, Step Functions, service blueprint, …) and
   plugin-contributed kinds register the same way guided does.
2. **A kind guides construction; it is not a file format.** A diagram of any kind is a valid
   freehand diagram made of the elements that already exist. It can be opened and edited
   freehand at any time, and returned to its kind when it still conforms.
3. **Custom components and custom experiences are foreseen.** A kind may use element types from
   plugins and contribute its own commands, checks and panels, without breaking plugins,
   versions, collaboration, the assistant, imports or exports.

## What Changes

- **Diagram-kind registry.** An internal contract (`DiagramKindDescriptor`: plain data plus pure
  functions, validated at registration) that decides a diagram's palette, creation template,
  conformance rules, arrangement, derived flows, interaction policy, commands, checks and panel
  applicability. Freehand is the implicit default when no kind is set, and it behaves exactly as
  today. Guided registers through the same contract (dogfooding).
- **Kind on the diagram, as metadata.** `Diagram.kind` holds a kind id (built-in, or namespaced
  `pluginId:kindId`), `Diagram.kindMode` records that the diagram is being edited freehand, and
  `Diagram.kindData` is an opaque JSON object the kind owns. Storage, viewer and exporters ignore
  all three. A diagram whose kind is not available (for example, a plugin that is not installed)
  keeps its kind untouched and opens freehand with a notice.
- **Round trip.** "Edit freehand" switches a kind diagram to the full freehand editor and pauses
  the kind (one undo step). "Back to guided" runs the kind's conformance check. When it passes,
  the kind resumes, re-arranges and re-derives, all as one undo step. When it fails, the issues
  are listed and the diagram stays freehand.
- **Guided kind.**
  - **Lanes and steps.** Lanes are the existing swimlane panels, and steps are the existing
    flowchart shapes inside them. Nothing new goes on the element registry.
  - **Keyboard authoring.** `Tab` adds the next step, `Shift+Tab` adds a branch (inserting a
    decision first when needed), `Alt+↑/↓` moves a step to another lane, and `Delete` removes a
    step and reconnects its neighbours. No prompts.
  - **Positions.** A lane-banded arrangement places every step after each edit, honouring the
    reading direction (ADR-0013) and the layout density. Steps cannot be dragged while in guided
    mode.
  - **Derived flow.** One flow is kept in sync with the step graph, so reading, playback, the
    shared reading and walkthrough scenes work on it unchanged.
  - **Quiet checks.** Markers flag decision exits without a label and steps that can never reach
    an end, without blocking anything.
- **Compatibility rules** for the existing extension surfaces:
  - Plugin reads see the kind fields.
  - Plugin structural writes to a guided-mode diagram are followed by the kind's arrangement.
  - Plugin position writes to a guided-mode diagram are refused with a stated reason.
  - Plugin panels can declare which kinds they apply to (additive, plugin API minor bump).
  - Plugin-created diagrams stay freehand.
  - Assistant edits, Version edits and pastes go through the same post-edit path as local edits.
- An ADR records diagram kinds as an extension point and settles the vision's open question
  ("profile vs plugin").

## Capabilities

### New Capabilities

- `diagram-kind`: the kind registry contract, the kind fields on a diagram, creation, the
  freehand round trip with conformance, unavailable kinds, read-only surfaces, and compatibility
  with plugins, Versions, collaboration and the assistant.
- `guided-flow-authoring`: lanes and steps in a guided diagram, covering the keyboard gestures,
  the restricted palette, the absence of free positioning while in guided mode, deletion that
  reconnects, and the quiet checks.
- `guided-flow-layout`: the lane-banded arrangement that places every step of a guided diagram
  after each structural edit, on either reading axis.
- `guided-flow-derivation`: the flow a guided diagram keeps in sync with its steps, what
  re-derivation preserves, and how the flow behaves in freehand mode and on return.

### Modified Capabilities

None. Existing requirements (auto-layout, reading direction, flow authoring, plugin system,
walkthrough) keep their behaviour for freehand diagrams. Kind-specific behaviour, and how existing
surfaces treat kind diagrams, is stated in the new capabilities. The plugin API change is
additive only (one optional field on panel contributions, kind fields on diagram snapshots).

## Non-Goals

- Exposing `registerDiagramKind` to third-party plugins. The contract is designed to be
  plugin-safe, and its plugin exposure (capability, API version, docs) is a follow-up change.
- Any kind other than guided.
- Starting a guided diagram from an existing freehand diagram that was never guided (the
  conformance check makes this possible later, but it is not offered now).
- A general command system. Kind commands are a narrow contract that a future command registry
  can absorb.
- Parallel gateways (AND split and join), timers, message flows between pools, and BPMN XML
  import or export. Back-edges for retries remain possible as ordinary connections.
- Dragging a step to reorder it or move it between lanes in guided mode.
- C4, cloud or other architecture nodes inside a guided diagram.
- The assistant generating guided diagrams, and guided-specific Mermaid or draw.io exports (they
  export as an ordinary diagram).
- Replacing or removing the walkthrough feature.

## Impact

- `features/diagram/model`: `Diagram.kind`, `kindMode` and `kindData`, guards, and one shared
  sanitizer on every inbound path (JSON, folder sync, share link, collab snapshot, plugin
  `getDiagram` snapshot).
- New `features/diagram/kinds/`: registry, contract types, `KindContext`, and the guided
  descriptor's domain parts (conformance, derivation, edit operations).
- `features/diagram/store/slices`: kind mode switch and guided actions.
- `features/canvas/hooks`: a kind watcher that derives and arranges after any structural edit
  (local, plugin, assistant, paste, Version), modelled on the automatic-mode watcher.
- `features/canvas/layout`: a lane-banded strategy on the existing ELK pipeline and
  `layout/axis.ts`.
- `features/canvas`: kind-aware palette, keymap, drag policy, check markers, the mode switch UI,
  and the kind choice in the new-diagram dialog.
- `features/plugins`: diagram snapshots carry the kind fields, panel contributions gain an
  optional `appliesTo`, `moveComponents` and `applyChanges` respect the kind's policy, and
  `STRUCTURA_PLUGIN_API_VERSION` gets a minor bump.
- i18n: new keys in `en.json` and `pt-BR.json`.
- Docs: ADR-0014, `docs/concepts/diagram-kinds.md`, `docs/architecture/extension-points.md`
  (Diagram types row), and `docs/architecture/vision.md` §8–9.
- No new dependencies and no backend.

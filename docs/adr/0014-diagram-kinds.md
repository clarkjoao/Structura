# ADR-0014 — Diagram kinds: metadata that guides construction over an ordinary diagram

**Status:** Accepted

## Context

Every Structura diagram is freehand. A request for a guided, standardised journey/data-flow
diagram (BPMN-inspired, see `openspec/changes/archive/2026-11-22-guided-flow-diagram`) is the first time the editor
has had to behave differently depending on what *kind* of diagram is open. The vision
(`docs/architecture/vision.md` §8) lists "diagram profiles" (VSM, Saga) as a
later move, and §9 left open whether a profile is a plugin or a bundle of node types, validators
and palette entries.

These constraints shape the decision:

1. More kinds will follow, built-in and contributed by plugins.
2. A diagram built with a kind must stay editable freehand, and must be able to return to its
   kind when it still conforms.
3. Kinds will want custom components and custom experiences (commands, checks, panels). None of
   that may break the existing extension surfaces: plugins, Versions, collaboration, the
   assistant, imports and exports.

## Decision

**A kind is metadata over an ordinary diagram, never a file format.**

- `Diagram.kind` (an id), `Diagram.kindMode` (`"freehand"` while edited freehand) and
  `Diagram.kindData` (a JSON object the kind owns) are optional fields. Absent means freehand,
  and the diagram hashes and exports as before.
- The content of a kind diagram is made only of elements, connections and flows a freehand
  diagram can hold. The viewer, every exporter and persistence work without the kind being
  registered.
- A well-formed kind id is **kept** when nothing registers it, for example when the plugin is
  missing. The diagram opens freehand with a notice and keeps its kind for a build that has it.
  A malformed id is dropped (`sanitizeKindFields`, on every inbound path).

**A kind is a bundle of policies, registered through one contract** (`features/diagram-kinds`,
`DiagramKindDescriptor`). This answers §9: a kind is not new elements. It is:

- the palette it offers (any registered element type, plugin types included);
- a required conformance check;
- an optional creation template, derivation (for example a derived flow), arrangement, quiet
  checks and commands;
- an interaction policy (drag, resize, the arrange-mode choice, recording flows).

A kind reads the world only through a `KindContext`. It returns declarative `KindEdit` change
sets in the plugin `applyChanges` vocabulary plus re-parenting, re-wiring, relabelling, flows
and kind data, and the store applies them Version-aware with the same draft helpers. Built-in
kinds register through the same registry a plugin kind will use.

**Every feature asks `resolveKindPolicy(diagram)`**, never `diagram.kind`, and
`kind-reads.guard.test.ts` holds that. The four states are freehand, kind, kind-freehand and
kind-unavailable.

**Kinds run after edits through one watcher**, not through hooks in every writer. Like the
automatic arrange mode, a kind watcher detects structural changes to the active diagram (from the
UI, a plugin, the assistant, a paste or a Version edit). It skips undo/redo and peers' changes,
then runs the kind's derivation and arrangement without a history entry of their own. One undo
of the edit reverts all of it.

**Round trip.** "Edit freehand" sets `kindMode` (one undo step, nothing moves). "Back to <kind>"
runs the conformance check. On a pass, it clears `kindMode` and re-derives in one undo step. On a
failure, nothing changes and the issues are listed.

**Plugin compatibility.** Diagram snapshots carry the kind id, mode and availability. Panels may
scope to kinds (`appliesTo.kinds`). Position writes to a diagram in kind mode are refused with a
reason, and structural writes are followed by the kind's arrangement. Plugin-created diagrams
stay freehand. Exposing `registerDiagramKind` to plugins is a separate, later decision: the
contract is shaped for it, but stays internal until a second kind has exercised it.

## Consequences

- One more place to look before changing editor behaviour: the policy. In exchange, a second
  kind is a descriptor, not a set of `if`s across the canvas.
- Kind-specific stored state must live in `kindData` or be readable back from ordinary content.
  The guided kind stores only its derived flow's id and an arrangement signature; lanes and
  order are read from geometry and connections. This is what makes the round trip possible.
- The collaboration relays (Node and Go) declare `kind`, `kindMode` and `kindData` as doc
  fields. An older relay does not carry them, so its peers see the diagram freehand, and the
  host's kind is left untouched.
- The plugin API moves to 1.16.0. The change is additive, but `moveComponents` now returns a
  result.

## Alternatives considered

- **A literal union `kind?: "guided"`.** Rejected: a build or a peer without a kind would drop
  it and lose data.
- **Kind-specific fields on components (lane index, step order).** Rejected: a freehand edit
  would leave them stale.
- **A hook inside every writer's `set()`.** Rejected: the ELK pass is asynchronous, and the
  watcher covers every writer without plumbing.
- **Kinds as plugins only.** Deferred: built-in kinds need the contract first, and the plugin
  surface is a long-term commitment best made after a second kind.

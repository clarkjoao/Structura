# Structura — Architecture Vision

**Status:** Living document. Changes go through the [ADR](../adr/) or
[spec](../../specs/README.md) process when they alter a decision recorded there.

---

## 1. What Structura is becoming

Structura started as a C4 diagram editor. It is evolving into an
**Architecture Modeling Platform**: the place where an engineering team
models, documents, discusses, and evolves its software architecture across the
whole lifecycle — discovery, design, technical discussion, documentation,
implementation planning, review, onboarding, and evolution.

The guiding metaphor is **"the VS Code of software architecture modeling"** —
not in UI, but in shape: a small, stable core that ships batteries included,
plus well-defined extension points through which most capabilities (diagram
types, importers, panels, AI providers) are contributed rather than hardcoded.

### What Structura is *not*

- Not an infinite whiteboard. Every element on the canvas means something.
- Not a generic UML tool or BPM suite.
- Not a design application or Figma replacement.

These exclusions are load-bearing. Most feature requests that get declined
will be declined because accepting them would push Structura toward one of
these; when in doubt, ask "does this help a team reason about *their
architecture*, or does it just help them draw?"

### Audience and language

The primary audience today is Brazilian developers; the project is
international. **English is canonical** for code, comments, commit messages,
documentation, and architecture. UI strings go through i18n (`en`, `pt-BR`);
seed/demo content may stay Portuguese.

---

## 2. Platform goals

1. **Source of truth.** Architecture information lives in Structura and stays
   trustworthy — elements have identity, references don't silently break, and
   what a diagram shows can be relied on in a design review.
2. **Low floor, high ceiling.** Sketching a system in the first five minutes
   must stay effortless; a two-year-old workspace with 80 diagrams must stay
   navigable and consistent.
3. **Extensible by contribution.** Adding a diagram type, importer, or panel
   should mean *adding files against a published contract*, not editing core
   type unions and switch statements.
4. **Local-first and private by default.** No backend, no account, no data
   leaving the machine unless the user explicitly shares or collaborates.
5. **Contributor experience as a feature.** A newcomer should be able to ship
   a new node type in an afternoon by following a guide, without reading the
   whole codebase.

---

## 3. Architectural principles

These extend the hard rules in [AGENTS.md](../../AGENTS.md):

1. **Incremental evolution over rewrites.** Every architectural move must be
   shippable in slices that keep `main` releasable.
2. **The Core stays small.** Core = the model, the store, the canvas engine,
   persistence, and the extension registries. Everything else should be
   expressible as a contribution to a registry.
3. **The Canvas is domain-agnostic.** The canvas renders nodes and edges and
   handles interaction. It must not know what a "container" or an "SQS queue"
   *means*. Business semantics enter through descriptors, never through
   conditionals inside canvas code.
4. **Registries over conditionals.** When behavior varies by type, resolve a
   descriptor from a registry (`NODE_TYPE_REGISTRY` is the template). A
   `switch` on a component type outside a descriptor is a code smell.
5. **Composition over inheritance.** Descriptors, slices, and adapters are
   plain objects composed together; there are no class hierarchies to extend.
6. **Explicit APIs over internal coupling.** Features talk to each other
   through the store's public actions/selectors and through registries — never
   by importing another feature's internals.
7. **React Flow stays behind the canvas abstraction.** Only
   `features/canvas` imports `@xyflow/react`. The domain layer
   (`features/diagram`) has no React at all. This is what makes the renderer
   replaceable and the model testable.
8. **Stable extension points over internal access.** When something needs to
   hook into the core, we widen a published contract, not export an internal.

---

## 4. Bounded contexts

The `src/features/*` layout already approximates bounded contexts. Naming them
explicitly, with their responsibilities and allowed dependencies:

| Context | Location | Responsibility | May depend on |
| --- | --- | --- | --- |
| **Model** | `features/diagram` | Domain types (Component, Connection, Flow, Diagram, Scene), type guards, the Zustand store (slices/selectors), pure model utilities. **No React.** | nothing app-level |
| **Canvas** | `features/canvas` | React Flow rendering, node/edge descriptors, toolbar, panels, interaction, flow playback UI. Domain-agnostic engine + descriptor contributions. | Model |
| **Workspace** | `pages/`, `infrastructure/persistence` | Folders, dashboard, model explorer, storage adapters (`IStoragePort`), sync, migrations. | Model |
| **Interchange** | `lib/export-service`, mermaid import utils | Converting to/from external formats (draw.io, Mermaid, Structurizr, JSON). Boundary converters only — no format knowledge leaks inward. | Model |
| **Catalogs** | `features/cloud`, `lib/catalogs` | AWS/GCP/Azure service catalogs and icons; pattern and panel catalogs. Data, not behavior. | Model |
| **Collaboration** | `features/collaboration`, `server/` | Yjs/WebSocket sync, presence, patches. The optional Node server is a relay, never a source of truth. | Model |
| **Intelligence** | `features/llm` | Diagram assistant: providers (Anthropic/OpenAI/proxy), prompt building, patch parsing, applying `DiagramPatch` actions to the store. | Model |
| **Storytelling** | `features/journeys`, flows in Model | Cross-diagram narrative: journeys, flow recording/playback. | Model, Canvas (player UI) |
| **Sharing** | `features/viewer`, share/embed utils | Read-only viewer for shared diagrams. | Model, Canvas |

Dependency rule: **everything may depend on Model; Model depends on nothing.**
Contexts do not import each other's internals; cross-context needs go through
the store or a registry. (Today `features/custom-components` and
`features/icons` are satellite contexts of Model — user-defined templates and
icon libraries — and follow the same rule.)

---

## 5. Domain model

The current domain model, as shipped (see
[concepts/core-concepts.md](../concepts/core-concepts.md) for detail):

```
Workspace (implicit — the persisted store)
├── Folder*                      hierarchical organization, optional domain tag
├── Diagram*
│   ├── snapshot: ModelDraft     ← semantic content
│   │   ├── Component*           typed union (C4, panel, note, api-group, endpoint,
│   │   │                         db-table, json-viewer, svg, flow-node, external-element,
│   │   │                         cloud categories…)
│   │   ├── Connection*          source/target + intent, direction, transport, style
│   │   ├── Flow*                recorded step sequences within a diagram
│   │   └── IconDefinition*      diagram-local icon library
│   ├── nodeLayouts / edgeLayouts / viewport   ← view state
│   └── Scene*                   named diffs over the snapshot (what-if / compare)
├── ServiceDefinition*           workspace-level service registry
├── UserTemplate*                reusable multi-component templates
└── Journey*                     cross-diagram step sequences (own store)
```

Two properties of this model matter for everything below:

1. **Semantics and layout are already separated** *inside* a diagram:
   `Diagram.snapshot` holds meaning, `nodeLayouts`/`edgeLayouts`/`viewport`
   hold presentation. Undo/redo snapshots `ModelDraft`, not pixels.
2. **Identity is diagram-scoped.** A component exists *in* a diagram. Concepts
   that need cross-diagram identity have grown ad-hoc bridges:
   `Component.linkedDiagramId` (drill-down), `ExternalElementComponent`
   (references), `registryServiceId` (service registry), journeys
   (cross-diagram narrative). These are four different partial answers to the
   same missing abstraction.

---

## 6. The open question: diagrams as source of truth, or a model with diagram views?

This is the most consequential decision for the next five years, so both
options are analyzed honestly.

### Option A — Diagrams remain the source of truth (status quo)

Each diagram owns its components. Cross-diagram features keep using explicit
link fields.

- **Pros:** Zero migration. Matches how users think while sketching ("this is
  *my* drawing"). Deleting a diagram has obvious semantics. Free-form and
  semantic elements coexist trivially. Undo/redo, scenes, collaboration all
  stay diagram-scoped and simple.
- **Cons:** The same real-world system drawn in five diagrams is five
  unrelated components — renames don't propagate, the Architecture Map can
  only be heuristic, AI has no workspace-wide graph to reason over, and
  "source of truth" degrades as workspaces grow. Every future cross-diagram
  feature invents another bridge field.

### Option B — An Architecture Model as source of truth; diagrams become views

A workspace-level model (elements + relationships) is authoritative;
diagrams select model elements and lay them out (the Structurizr approach).

- **Pros:** Real identity: rename once, propagates everywhere. Architecture
  Map, cross-diagram references, drill-down, and AI all become queries over
  one graph. Model-level validation becomes possible. This is what "source of
  truth for architecture discussions" ultimately requires.
- **Cons:** It is a different product to *use*: every sketch gesture must
  answer "is this a new element or a reference to an existing one?", which
  taxes the five-minute experience. Many component types are presentational
  (notes, SVG, JSON viewers, panels) and have no business being in a model.
  Migration of existing workspaces is hard, and a big-bang rewrite violates
  principle #1.

### Recommendation: B as destination, reached through a hybrid — **"model as index, diagrams as documents"**

Neither pure option serves the vision. Pure A caps the product; pure B is a
rewrite that sacrifices the sketching UX that makes Structura pleasant.
The recommended path:

1. **Two-tier ontology.** Split component types into **semantic elements**
   (systems, containers, components, cloud services, API groups, db tables —
   things that denote architecture) and **annotations** (notes, panels, SVG,
   JSON viewers — things that decorate a diagram). Only semantic elements ever
   get model identity. Annotations stay diagram-local forever.
2. **Derived Model Index first.** Build a workspace-level index *derived* from
   diagrams: elements unified by `registryServiceId`, explicit links, and
   user-confirmed matches. The existing Model Explorer page and service
   registry are the seed. At this stage diagrams are still the source of
   truth; the index is a read model powering search, the Architecture Map, and
   AI context. This ships value with zero migration.
3. **Promote identity gradually.** Let users *promote* a diagram component to
   a model element (or link it to an existing one). Promoted elements share
   identity across diagrams — a rename propagates. Unpromoted components keep
   working exactly as today. Diagrams remain documents that own layout,
   annotations, scenes, and narrative.
4. **Only then decide** whether the model becomes fully authoritative. By that
   point real usage data exists, and the migration is a ratchet users opted
   into rather than a cliff.

This is recorded as [ADR-0004](../adr/0004-diagram-model.md), and step 2–3 is
the subject of the first major spec
([specs/0001-architecture-model](../../specs/README.md#spec-index)).

---

## 7. Extension boundaries

Where the platform is open, where it is closed, and where it is currently
closed but must open (the full inventory lives in
[extension-points/README.md](../extension-points/README.md)):

**Open today (registry exists):**
- Canvas node rendering — `NodeTypeDescriptor` registry with
  `registerDescriptor()` (`features/canvas/nodes/node-types/`).
- Cloud providers — `features/cloud/registry` (AWS/GCP/Azure catalogs).
- Storage backends — `IStoragePort` adapters (LocalStorage, FileSystem,
  InMemory).
- LLM providers — `features/llm/providers` (Anthropic, OpenAI, proxy).

**Closed today, must open (in dependency order):**
1. **The `ComponentType` union** (`features/diagram/model/component.types.ts`).
   This is the single biggest extensibility bottleneck: cloud category IDs
   already leak into the domain union, `ComponentPatch` grows with every
   type, and adding a type touches the core. The domain needs its own
   descriptor concept mirroring the canvas one.
2. **Commands.** Mutations are store actions called ad hoc from UI. A command
   registry (id, title, handler, context) is the prerequisite for pluggable
   toolbars, context menus, keyboard shortcuts, the palette, and MCP.
3. **Importers/exporters** — hardcoded format list in `lib/export-service`.
4. **Toolbar, element picker, context menus, inspector panels** — hardcoded
   composition in `features/canvas`.
5. **Validators, layout providers, themes, diagram types (profiles).**

**Deliberately closed (core, not extensible):**
- The store's transactional semantics (history, persistence, migration).
- The canvas interaction engine (drag, selection, parenting).
- The persistence schema and its migration chain.

---

## 8. Long-term evolution strategy

Sequenced so each step is useful alone and none blocks `main`:

| Horizon | Move | Why this order |
| --- | --- | --- |
| Now | **Docs, ADRs, SDD process** (this phase) | Alignment before construction. |
| Next | **Domain component descriptors** — open the `ComponentType` bottleneck | Everything on the roadmap (VSM, Step Functions, Saga) is blocked on cheap new element types. |
| Next | **Command system** | Second-most-shared dependency: UI extensibility, shortcuts, palette, MCP all sit on it. |
| Then | **Derived Model Index** (vision §6, step 2) | Unblocks Architecture Map, cross-diagram references, better AI — without migration. |
| Then | **Contribution-point plugin architecture** (build-time, no runtime loader) | Formalizes the registries into one coherent Extension API. See [plugin-system-preparation.md](plugin-system-preparation.md). |
| Later | **Diagram profiles** — VSM, Step Functions, Saga as contributed diagram types | Proof that the extension surface is real; each profile ships as a plugin. |
| Later | **Identity promotion** (vision §6, step 3), then reassess model-first | The product decides, informed by usage. |

Non-goals for this horizon: a plugin marketplace, a runtime plugin loader,
sandboxed third-party code, and a hosted backend. Each would be premature —
see the security discussion in
[plugin-system-preparation.md](plugin-system-preparation.md).

---

## 9. Open questions (tracked, not assumed)

- **Model Index unification heuristics:** how aggressively should the index
  auto-match components across diagrams (by name? service id only?) before
  asking the user? (→ spec 0001)
- **Collaboration vs. model identity:** Yjs currently syncs diagram-scoped
  state; a workspace model adds a second consistency domain. Does the model
  sync as one Yjs doc, or per-element? (→ spec 0001, risks section)
- **Profile vs. plugin boundary:** is a "diagram type" (VSM) one plugin or a
  bundle of node types + validators + palette entries? (→ spec on plugin
  contribution points)
- **Mermaid-inspired text DSLs:** first-class authoring mode or import-only?
  Text authoring pulls toward model-first faster than the canvas does.
- **pt-BR content ecosystem:** how do community templates/catalogs carry
  translations without making i18n a plugin-author burden?

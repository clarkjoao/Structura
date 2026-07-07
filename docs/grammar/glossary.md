# Structura Glossary

The canonical vocabulary of the Structura modeling language. Every term here
maps to a specific concept in the codebase; if a term is used differently
elsewhere, **that is a bug** worth fixing in the same PR.

> **Status:** Living document. Changes go through the [OpenSpec](../../openspec/)
> process when they alter a domain term, and through a normal PR otherwise.
> This document is normative for naming; if code and glossary disagree, **fix
> the code or fix the glossary in the same PR** — never both drift apart.

---

## How to read this document

- **Canonical term** — the single name used in code, UI, and docs.
- **Status** — `current` (in use), `proposed` (this document recommends a
  change but it has not shipped), or `deprecated` (still in code/i18n/data
  but slated for removal; an alias to the canonical term is shown).
- **Counterpoint** — terms that look similar but mean something different.
  Read this before proposing a new concept, to avoid naming collisions.
- **Reference** — file paths and types where the concept lives today.

If you are adding a new feature, search the glossary first. If your concept
already has a name, reuse it. If it does not, propose one here in the PR
that introduces the concept — name the concept **before** naming the file.

---

## Part 1 — Workspace and core entities

### Workspace

**Status:** `proposed` (currently implicit; the persisted store state)

**Definition:** The top-level container for everything a user authors. Holds
diagrams, folders, the service catalog, user templates, walkthroughs, and
(in the future) capabilities, personas, and ADRs. A workspace is what gets
synced to a local folder or merged on import; it is the unit of persistence.

**Reference:** Implicit today in `AppState`
(`src/features/diagram/store/store.types.ts`); will become a named type
in a future spec.

**Counterpoint:** Not the same as a **Diagram** (one document inside the
workspace), and not the same as a **Tenant** (which only exists if/when
Structura Cloud ships — `ADR-0007` keeps the cloud as a separate product).

---

### Diagram

**Status:** `current`

**Definition:** An authoring document. Holds semantic content
(`snapshot: ModelDraft`) and view state (`nodeLayouts`, `edgeLayouts`,
`viewport`). Belongs to a folder; participates in a profile; can be
referenced by other diagrams and by walkthroughs.

**Reference:** `Diagram` in
`src/features/diagram/model/diagram.types.ts`.

**Counterpoint:** Not the same as a **Model** (the bounded context in
`features/diagram`), not the same as a **Scene** (a variant of a diagram),
and not the same as a **Workspace** (the whole container).

---

### Folder

**Status:** `current`

**Definition:** Hierarchical organization for diagrams. Plain `parentId`
chain; optional `domain` tag for cross-folder grouping.

**Reference:** `Folder` in
`src/features/diagram/model/diagram.types.ts`.

---

## Part 2 — Modeling concepts

### Profile

**Status:** `proposed` (Wave 1, per `architecture/roadmap-analysis.md`)

**Definition:** A contributed bundle that defines a diagram vocabulary:
allowed component types, palette, validators, layout provider, default
viewport, and constraints. Examples: `c4-context`, `c4-container`,
`deployment`, `domain`, `vsm`, `saga`. Profiles are contributions, not
hardcoded enum values.

**Reference:** Planned; will replace the free-string `Diagram.level` field
(`src/features/diagram/model/diagram.types.ts:56`).

**Counterpoint:** Not the same as a "diagram type" enum — a profile is an
object that can be contributed by a plugin, an enterprise pack, or a
community template. It is the unit of vocabulary, not of routing.

---

### Component

**Status:** `current`

**Definition:** A typed element on a diagram. A discriminated union over
`ComponentType` (~14 built-in variants: C4 elements, structural elements,
content elements, flowchart process nodes, references, an `unknown`
escape hatch, and cloud category ids).

**Reference:** `Component` and `ComponentType` in
`src/features/diagram/model/component.types.ts`.

**Counterpoint:**

- Not the same as a **Node** (which is the React Flow renderer of a
  Component; lives in `features/canvas/nodes/`).
- Not the same as a **Service** (a workspace-level production unit; lives
  in the Service Catalog).
- Not the same as a **Capability** (a workspace-level business concept;
  planned, does not exist yet).

---

### Connection

**Status:** `current`

**Definition:** A semantic relationship between two Components. Carries
`label`, `technology`, `intent`, `direction`, `transportPreset`, and
(legacy, being moved) `style`.

**Reference:** `Connection` in
`src/features/diagram/model/connection.types.ts`.

**Counterpoint:**

- Not the same as an **Edge** (which is the React Flow renderer of a
  Connection; lives in `features/canvas/edges/`).
- Not the same as a **Flow** (which is a recorded sequence of steps, not
  a single relationship).

---

### Flow

**Status:** `current`

**Definition:** A recorded sequence of steps *within* a single diagram.
Used for step-by-step playback and Mermaid sequence diagram export.
Lives inside `Diagram.snapshot.flows`.

**Reference:** `Flow` and `FlowStep` in
`src/features/diagram/model/flow.types.ts`.

**Counterpoint:**

- **Not** the same as a `ProcessNode` (a Component of type
  `"process-node"`, used in Mermaid-style flowcharts). When you mean the
  component, say **"process node"** — never "flow node".
- **Not** the same as a **Walkthrough** (which crosses diagrams).
- **Not** the same as a **Data Flow** (a future profile, `dataflow`, that
  reuses `Flow` for its playback but with stronger constraints).

---

### Process Node

**Status:** `proposed` (currently `type: "processos"` in the union;
  `FlowNodeComponent` in code; Portuguese leftover)

**Definition:** A Component of type `process-node` representing a single
node of a Mermaid-style flowchart (rectangle, rounded, stadium, diamond,
hexagon, parallelogram, cylinder, circle, subroutine).

**Reference:** `FlowNodeComponent` in
`src/features/diagram/model/component.types.ts:202`; descriptor at
`src/features/canvas/nodes/node-types/flownode.descriptor.ts`.

**Aliases:** `FlowNode` (deprecated — name collides with `Flow`),
`processos` (deprecated — Portuguese; violates the `AGENTS.md` language
policy).

**Counterpoint:** Always disambiguate from `Flow` (the sequence). The two
share no semantics; they happen to share a root word.

---

## Part 3 — Identity and cross-diagram references

### Service

**Status:** `current`

**Definition:** A workspace-level production unit — a system,
microservice, or job that runs in production. The strongest existing
form of cross-diagram identity in Structura: a Service can be linked to
many Components across diagrams, and renaming a Service propagates to
all linked Components.

**Reference:** `ServiceDefinition` in
`src/features/diagram/model/service.types.ts`; held in
`state.serviceCatalog` (formerly `serviceRegistry`).

**Counterpoint:**

- **Not** the same as a C4 "Service" in the strict sense. Structura's
  Service sits between Capability (planned) and Container — it is "a unit
  of production that implements one or more Capabilities", not "a top-level
  system that delivers value to users". When C4 precision matters, say
  "C4 Service" or "top-level system".
- **Not** the same as a **Component** of C4 type `"system"` or
  `"container"`. Those are diagrammatic entities; a Service is a real
  production thing.

---

### Service Catalog

**Status:** `current` (renamed from `serviceRegistry` in
  `openspec/changes/rename-service-registry-to-service-catalog/`,
  shipped under `PERSIST_SCHEMA_VERSION` 8; the legacy
  `useRegistryActions` and `useServiceRegistry` aliases remain for one
  release)

**Definition:** The workspace-level collection of Services. Implemented
as `state.serviceCatalog: Record<id, ServiceDefinition>`. UI lives at
`/catalog` (the URL was already `/catalog`; only the internal page
component, hook, and i18n keys were renamed).

**Reference:** `src/features/diagram/store/slices/services.slice.ts`;
page `src/pages/serviceCatalog/`; hook `useCatalogActions` in
`src/features/diagram/store/diagram.store.ts`.

**Aliases:** `serviceRegistry` (deprecated; runtime data migrated on
load), `useRegistryActions` (deprecated; alias of `useCatalogActions`),
`useServiceRegistry` (deprecated; alias of `useServiceCatalog`),
i18n `nav.registry` and `elementPicker.registry` (deprecated; resolve
to "Services"/"Serviços" via the new `services` keys).

**Why rename:** the word *registry* in Structura currently means at least
six different things — plugin registry, node type registry, panel
registry, IO registry, import registry, service registry. *Catalog* is
already the established term for AWS/GCP/Azure icon packs
(`src/lib/catalogs/`), and it describes the actual UX (a navigable
catalog of services with cards, search, filters, import panels).

---

### Component Link

**Status:** `current`

**Definition:** A reference from a Component to a Service in the catalog,
stored as `Component.serviceId`. The reverse direction ("which Components
link to this Service?") is derived on demand and is not stored.

**Reference:** `BaseComponent.serviceId` in
`src/features/diagram/model/component.types.ts:50`.

**Counterpoint:**

- **Not** the same as `BaseComponent.linkedDiagramId` (drill-down: "this
  Component has a child Diagram").
- **Not** the same as `ExternalElementComponent.referenceDiagramId`
  (cross-diagram mirror: "this Component represents an element of
  another Diagram").

---

### External Element

**Status:** `current`

**Definition:** A Component of type `"external-element"` that represents
an element of another Diagram. The user sees it as a placeholder
pointing at the source. Used in C4 drill-up: a Container in one Diagram
can be drawn as an External Element in a higher-level Diagram.

**Reference:** `ExternalElementComponent` in
`src/features/diagram/model/component.types.ts:208`.

**Counterpoint:** Not the same as a **Drill-Down** (which is navigation
along the abstraction axis within the same logical element), and not the
same as a **Component Link** (which is a link to a Service in the
catalog).

---

## Part 4 — Variants and narrative

### Scene

**Status:** `current`

**Definition:** A named diff over a Diagram's snapshot, used to express
variants (e.g. "production" vs "staging", or "as-designed" vs "as-built").
The base Diagram stays the source of truth; the Scene adds/removes
Components and Connections and overrides layout.

**Reference:** `SceneDiff` in
`src/features/diagram/model/diagram.types.ts:129`; slice at
`src/features/diagram/store/slices/scenes.slice.ts`; compare mode in
the Canvas.

**Counterpoint:** Three distinct axes of variation must not be confused:

| Axis | Mechanism | Lives in |
| --- | --- | --- |
| Variant (env, scenario) | **Scene** | `Diagram.scenes` |
| Abstraction (C4 levels) | **Drill-Down** | `BaseComponent.linkedDiagramId` |
| Narrative (walk-through) | **Walkthrough** | Service catalog (planned), `features/walkthroughs/` |

---

### Drill-Down

**Status:** `current`

**Definition:** Navigation from a Component in one Diagram to a child
Diagram that details it. The child Diagram is the source; the parent
Component stores the link as `linkedDiagramId`. Used by C4 Level 1 → 2 →
3 navigation.

**Reference:** `BaseComponent.linkedDiagramId` in
`src/features/diagram/model/component.types.ts:51`.

**Counterpoint:** Not the same as an **External Element** (which is a
reference in the *opposite* direction, from a low-level Diagram up to a
placeholder in a higher-level one). The two use different mechanisms and
should not be merged.

---

### Walkthrough

**Status:** `current` (renamed from `Journey` in
  `openspec/changes/rename-journey-to-walkthrough/`, shipped under
  `PERSIST_SCHEMA_VERSION` 9; the legacy `Journey*` aliases remain for
  one release)

**Definition:** A curated or recorded sequence of steps across one or more
Diagrams. Each step points at a Diagram and optionally at a Flow within
that Diagram. Used for onboarding, demos, incident retrospectives, and
executive walkthroughs. Has a VCR-style player (prev/next, play, record).

**Reference:** `Walkthrough` in `src/features/walkthroughs/types.ts`;
player at `src/features/walkthroughs/components/WalkthroughPlayerBar.tsx`.

**Aliases:** `Journey` (deprecated; types and hooks re-exported from
`features/walkthroughs`), `nav.journeys` (deprecated; resolves to
"Walkthroughs" via `nav.walkthroughs`).

**Counterpoint:**

- **Not** a Customer Journey. Customer Journey is a UX concept
  (persona × touchpoint × emotion) that Structura does not model today.
  When that feature is added, the term *Journey* is free to use.
- **Not** a BPMN process. Steps are pointers to diagrams, not activities
  with gateways and timers.
- **Not** a Scene (Scene is a variant of a single Diagram; Walkthrough is
  a sequence across multiple).
- **Not** a Flow (Flow is recorded within one Diagram; Walkthrough is
  recorded across Diagrams, optionally invoking Flows).

---

## Part 5 — Auxiliary concepts

### UserTemplate

**Status:** `current`

**Definition:** A user-authored, reusable multi-component fragment
(components + connections with index-based wiring, positions relativized)
that can be instantiated on any Diagram. Provenance-tracked on
instantiated Components via `templateId`.

**Reference:** `UserTemplate` in
`src/features/diagram/model/diagram.types.ts:112`; slice at
`src/features/diagram/store/slices/userTemplates.slice.ts`.

**Counterpoint:**

- **Not** the same as a **Pattern** (built-in, curated, shipped with
  Structura; lives in `lib/catalogs/patterns.ts`).
- **Not** the same as a **Component** (a single typed element on a
  Diagram). A UserTemplate is a fragment that, when instantiated,
  produces multiple Components and Connections.

---

### Pattern

**Status:** `current`

**Definition:** A built-in, curated, multi-component fragment shipped
with Structura (e.g. "Three-tier web app", "Event-driven with queue").
Lives in `lib/catalogs/patterns.ts`.

**Reference:** `src/lib/catalogs/patterns.ts`; slice at
`src/features/diagram/store/slices/patterns.slice.ts`.

**Counterpoint:** User-authored reusable fragments are `UserTemplate`;
built-in curated ones are `Pattern`. The distinction is who authored
the fragment and where it lives.

---

### ADR *(planned, Wave 4)*

**Status:** `proposed` (not yet a type)

**Definition:** Architectural Decision Record — a workspace-level entity
capturing a decision (status, context, decision, consequences) with
optional links to Diagrams, Components, and Flows that the decision
affects. MADR-style.

**Reference:** Roadmap item "In-app ADR records linked to diagrams and
components (MADR-style, exportable)" in `ROADMAP.md`.

**Counterpoint:** Not the same as a local **Decision** annotation on a
Connection (planned, for "why is this edge sync and not async?"). A
Decision can be promoted to an ADR but lives locally until promoted.

---

### Capability *(planned, Wave 1)*

**Status:** `proposed` (not yet a type)

**Definition:** A workspace-level concept describing what a system does
for the business ("emit invoice", "authenticate user", "forecast
demand"). Capabilities are parents of Services (a Service implements one
or more Capabilities). Modeled by profile `business-capability`.

**Reference:** Proposed in `docs/architecture/vision.md` §6 follow-up;
not yet a type.

**Counterpoint:**

- **Not** the same as a **Service** (a production unit; implements
  Capabilities).
- **Not** the same as a **Domain** (a string tag for grouping; a
  Capability is a first-class concept, not a tag).

---

### Persona *(planned)*

**Status:** `proposed` (not yet a type)

**Definition:** A workspace-level entity representing a profile of a user
("Maria, controller at a mid-sized retailer, daily user of the NFSe
module"). Used in Customer Journeys (planned) and in capability
mapping.

**Reference:** Proposed; no file yet.

**Counterpoint:** **Not** the same as a C4 `person` Component (which is an
external actor on a Diagram — a generic human or system). Persona is a
user profile; C4 person is a diagrammatic actor. The two are
related but distinct.

---

## Part 6 — Tagging and organization

### Domain

**Status:** `current`

**Definition:** An optional string tag on a Diagram, Folder, or
Walkthrough that groups elements by business domain ("billing",
"logistics", "auth"). Free-form today; candidates for typing in a
future tag-scheme system.

**Reference:** `Diagram.domain`, `Folder.domain`, `Journey.domain`
in respective model files.

**Counterpoint:** Not the same as a typed **Tag** scheme (planned). For
now, `domain` is the only typed-string field with consistent meaning
across entities.

---

### Tag

**Status:** `current`

**Definition:** A free-form string label on a Component, Service, or
Walkthrough. Used for search and filtering.

**Reference:** `Component.tags`, `ServiceDefinition.tags`,
`Journey.tags`.

**Counterpoint:** Not the same as a **Domain** (a single string on a
Diagram/Folder). Tags are per-entity and free-form; Domain is a
cross-entity grouping field.

---

## Part 7 — Architectural terms (overloaded — disambiguate)

### Model

**Status:** `current` (three legitimate uses — disambiguate in context)

**Definition:** The word *Model* is overloaded in Structura. Always
disambiguate in writing:

- **the Model** — the bounded context at `src/features/diagram/`,
  containing types, guards, the store (slices/selectors), and pure
  utilities. No React. See `architecture/overview.md` §4.
- **ModelDraft** — the semantic snapshot of a Diagram, type
  `Diagram.snapshot: ModelDraft`. This is the unit of undo/redo and
  interchange.
- **Model Explorer** *(page)* — the workspace view page at
  `src/pages/modelExplorer/`. **Planned rename to `Workspace`**.

**Counterpoint:** "Model" in a C4 context means the architecture model
(systems, containers, components). Structura uses *Diagram* for that
today. Do not say "model" when you mean "diagram".

---

### Snapshot

**Status:** `current` (three legitimate uses — disambiguate in context)

**Definition:**

- **ModelDraft** — semantic content of a Diagram (`components`,
  `connections`, `flows`, `iconLibrary`).
- **DiagramSnapshot** — a history entry: `ModelDraft` + `nodeLayouts` +
  `edgeLayouts` + `timestamp`. The unit of undo/redo. See
  `src/features/diagram/store/store.types.ts:14`.
- **ComponentSnapshot** — a read-only plugin-API view of a single
  Component. See `src/features/plugins/snapshots.ts`.

**Counterpoint:** Snapshots are immutable, dated, and consumed by undo
or by external readers. Do not say "snapshot" when you mean "the
current state" — that is just "the store".

---

## Part 8 — Process and persistence terms

### Persistence *(port)*

**Status:** `current`

**Definition:** Everything that touches `localStorage` (or a folder, or
IndexedDB in the future) goes through `IStoragePort`
(`src/infrastructure/persistence/IStoragePort.ts`). Three adapters today:
`LocalStorageAdapter`, `FileSystemAdapter`, `InMemoryAdapter`.

**Reference:** `src/infrastructure/persistence/`,
`docs/concepts/persistence.md`, `ADR-0007`.

**Counterpoint:** Not the same as **Interchange** (export/import of
external formats; lives in `lib/export-service/`). Persistence is
about *where* the data lives; Interchange is about *what shape* it
takes for an outside consumer.

---

### Interchange

**Status:** `current`

**Definition:** The boundary that converts between Structura's model and
external formats (draw.io, Mermaid, Structurizr, native JSON). Format
knowledge never leaks inward — the model has no idea draw.io exists.

**Reference:** `src/lib/export-service/`,
`docs/concepts/import-export.md`, `ADR-0006`.

---

### Schema Version

**Status:** `current`

**Definition:** The version of the persisted store shape, tracked by
`PERSIST_SCHEMA_VERSION` in
`src/features/diagram/store/persist.config.ts`. Every change to a
persisted shape requires a forward-only migration and a version bump;
reviewers treat a persisted-type diff without a migration as a
blocking defect.

**Reference:** `ADR-0002`, `docs/concepts/persistence.md`.

---

## Appendix A — Renaming roadmap (status of all proposed renames)

| # | From | To | Tier | Status |
| --- | --- | --- | --- | --- |
| 1 | `processos` (ComponentType) | `process-node` | 1 | shipped (PERSIST_SCHEMA_VERSION 7) |
| 2 | `registryServiceId` (field) | *(remove or unify with `serviceId`)* | 1 | **rejected as dead field** — it is live in plugin snapshots and template instancing. Unification with `serviceId` is a separate spec. |
| 3 | `serviceRegistry` (state, i18n, page) | `serviceCatalog` | 2 | shipped (PERSIST_SCHEMA_VERSION 8) |
| 4 | `ModelExplorer` (page) | `Workspace` | 2 | shipped |
| 5 | `Journey` (entity, route, i18n) | `Walkthrough` | 3 | shipped (PERSIST_SCHEMA_VERSION 9) |
| 6 | `ExternalElementComponent.linkedDiagramId` | `referenceDiagramId` | 3 | proposed |
| 7 | `CustomComponentRepository.ts` | `customComponentTemplateStore.ts` | 4 | cosmetic, optional |

Each rename ships as its own OpenSpec change with a forward-only
migration where persisted data is affected. Tier 1 is small and can
ship together; Tier 2 and Tier 3 each warrant their own change with
review.

---

## Appendix B — Terms that are likely to land but are not yet named

These concepts are referenced in `architecture/vision.md` and
`architecture/roadmap-analysis.md` but have not been introduced. When
they land, they should adopt these names (or supersede them with a
glossary update in the same PR):

- **Profile** (planned Wave 1) — see Part 2.
- **Capability** (planned Wave 1) — see Part 5.
- **Persona** (planned) — see Part 5.
- **ADR** (planned Wave 4) — see Part 5.
- **Decision** *(local annotation)* — a per-Connection note that may be
  promoted to an ADR. Not yet named.
- **Constraint** *(profile-level rule)* — e.g. "C4 Context diagrams may
  have at most 12 elements". Not yet named.
- **Validator** *(profile-level check)* — runs against a Diagram to
  produce errors/warnings/hints. Not yet named.

If you introduce one of these, **add it to this glossary in the same
PR** with `Status: proposed` and a note about the implementation PR.

---

_Last updated: <today>._

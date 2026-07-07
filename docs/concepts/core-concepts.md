# Core Concepts

The domain vocabulary. Everything here lives in `src/features/diagram/model/`
unless noted. If a term is used differently elsewhere in the codebase, that is
a bug worth fixing.

## Workspace

The implicit top-level unit: everything the persisted store holds — diagrams,
folders, service registry, user templates (plus journeys, custom components,
and icons in their satellite stores). A workspace is what gets synced to a
local folder or merged on import. There is no `Workspace` type today; it is
the store state itself (`AppState` in `store/store.types.ts`).

## Diagram

`Diagram` (`model/diagram.types.ts`) is the authoring document. It cleanly
separates two kinds of state:

- **Semantic content** — `snapshot: ModelDraft` = components + connections +
  flows + a diagram-local icon library. This is what undo/redo snapshots and
  what interchange (import/export) operates on.
- **View state** — `nodeLayouts`, `edgeLayouts`, `viewport`. Positions, sizes,
  waypoints, camera. Deliberately *outside* the snapshot so that meaning and
  presentation can evolve separately (`DiagramModel = Omit<Diagram, "viewport">`).

A diagram has a C4-ish `level` (`context` | `container` | `component` | free
string), an optional `domain`, and lives in an optional `Folder`.

**Why this split matters:** it is the seed of the long-term "model as index,
diagrams as views" direction ([vision §6](../architecture/vision.md)) — the
codebase already refuses to conflate what something *is* with where it is
drawn.

## Component

`Component` is a discriminated union over `type` (~14 variants): C4 elements
(`person`, `system`, `container`, `component`), structural elements (`panel`,
swimlane panels, `api-group`), content elements (`note`, `svg`, `db-table`,
`json-viewer`), flowchart nodes (`processos`), references
(`external-element`), an escape hatch (`unknown`), and cloud categories
(AWS/GCP/Azure category ids).

Shared fields (`BaseComponent`): identity, name/description, `parentId`
(panel nesting), lock/hide flags, tags, `handleOrder`, and three
cross-diagram bridge fields — `linkedDiagramId` (drill-down),
`serviceId`/`registryServiceId` (service registry), `templateId` (provenance).

**Rules:** always narrow with the type guards in `component.guards.ts`
(`isPanelComponent(c)`, never `c.type === "panel"`). The union is closed
today; opening it is the platform's top extensibility priority
([vision §7](../architecture/vision.md)).

### Semantic elements vs. annotations

An important informal distinction the type system does not yet encode:
*semantic* components denote architecture (systems, containers, cloud
services, api-groups, db-tables); *annotation* components decorate a diagram
(notes, panels, svg, json-viewer). Only semantic components will ever
participate in workspace-level identity. Keep the distinction in mind when
adding types.

## Connection

`Connection` (`model/connection.types.ts`) is a semantic relationship between
two components: `label`, `technology`, `intent` (`dependency` | `call` |
`event` | `data-flow` | `async-message`), `direction`, transport preset, and
an optional `style` (edge style, markers, waypoints, animation). Note that
style — including waypoints — currently lives *on the connection*, not in
`edgeLayouts`; see [edge-system.md](edge-system.md) for why that is a known
wrinkle.

## Flow

A `Flow` (`model/flow.types.ts`) is a recorded step sequence *within* one
diagram — "request comes in here, then hits this, then branches" — used by the
flow recorder/player and exportable to Mermaid. Flows live inside the
diagram's snapshot.

## Scene

A `SceneDiff` is a named diff over the diagram snapshot: added/removed
components and connections plus layout overrides. Scenes power what-if
variants and compare mode without forking the diagram. Because a scene is a
*diff*, the base diagram stays the single source and scenes stay cheap.

## Journey

A `Journey` (`features/journeys`) is a **cross-diagram** narrative: ordered
steps, each pointing at a diagram and optionally a flow. Journeys are the
storytelling layer (onboarding walkthroughs, incident retrospectives). They
live in their own store, outside any diagram.

> **Naming note.** The term `Journey` is overloaded in software (UX Customer
> Journey, BPMN journey, marketing journey) and the Structura feature is
> none of those — it is a recorded/curated walkthrough of diagrams. The
> glossary marks `Journey` as `deprecated` in favor of `Walkthrough`; see
> [../grammar/glossary.md](../grammar/glossary.md) § Walkthrough.

## Service (catalog)

`ServiceDefinition` (`model/service.types.ts`) is a **workspace-level**
catalog of real services. Components link to it via `serviceId`. This
is the strongest existing form of cross-diagram identity and the natural seed
of the future Model Index.

> **Naming note.** The state field is currently `state.serviceRegistry` and
> the page is at `/serviceRegistry`. The glossary marks both as
> `deprecated` in favor of `serviceCatalog` and `/services`; see
> [../grammar/glossary.md](../grammar/glossary.md) § Service Catalog.

## User template / Custom component

`UserTemplate` is a reusable multi-component fragment (components +
connections with index-based wiring, positions relativized). Templates are
provenance-tracked on instantiated components via `templateId`.

## Folder

Plain hierarchy (`parentId`) with an optional `domain` tag, used by the
dashboard and model explorer for organization.

## Icon

`IconDefinition` supports three sources (`svg`, `lucide`, `aws`). Each diagram
snapshot carries the icons it uses (`iconLibrary`) so a shared/exported
diagram is self-contained.

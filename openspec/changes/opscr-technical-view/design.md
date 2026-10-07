# Design

## Context

- opscr now ships a file-system-free core (`opscr/core`, repo `asc`) that parses and validates a
  workspace from YAML text. It is not on npm yet; local development uses `npm link`, so nothing under
  `src/` that CI typechecks or tests may import it.
- Structura already has the pieces a projection lands on: panels (`type: "panel"`), cloud components
  (`aws-*`, `gcp-*`, `azure-*`, `oss-*` categories with `catalogServiceId`), C4 shapes, a plain layout
  contract (`features/canvas/layout/contract.ts`) and an ELK engine behind `layout(graph)`.
- ADR-0009 already solved "the app and a plugin need the same pure code": a framework-agnostic module
  in `src/lib/` with an import guard, copied into plugins by a `sync-shared` script.

## Goals / Non-Goals

**Goals:**

- One pure function from an opscr workspace to a technical view, deterministic for the same input.
- Element vocabulary expressed as Structura component types and catalog service ids, so an adapter can
  build components without a second mapping table.
- Sizing policy for the layout graph owned by the projection, not by its callers.

**Non-Goals:**

- Running a layout engine inside the library: callers bring `layout()` (the app's ELK engine, or their
  own copy), because ELK is a heavy dependency and a worker in some hosts.
- Building `Component` objects or touching the store: that is each adapter's job.

## Decisions

**Location: `src/lib/opscr-mapping/`, guarded like `export-core`.** A test fails if a source file
imports `@/features`, `@/plugins` or `opscr`. Alternatives: a package in the `asc` repo (would make
opscr depend on Structura's element vocabulary), or `src/features/opscr` (pulls app code into a plugin
bundle).

**Structural input, no runtime dependency on opscr.** The input type describes only what the projection
reads: manifests with `kind`, `metadata.name`, `spec`, and Relationship `spec.edges[]`. An `opscr/core`
`Workspace` satisfies it structurally, so adapters pass it straight through, and the app's CI never
needs opscr installed. Alternative: `import type` from `opscr` — still breaks `tsc` in CI without the
package.

**Output: a neutral view, not `Component`s.**

```
TechnicalView {
  nodes:   ViewNode[]    // id "Kind/name", kind, name, description, parentId, isBoundary, element
  edges:   ViewEdge[]    // id, sourceId, targetId, type (calls, writes, …), description
  omitted: { kind, name }[]
  dropped: { from, to, type, reason }[]        // edges not drawn, and ignored containments
}
element = { type: ComponentType-compatible string, catalogServiceId?, technology?, panelKind? }
```

The view carries Structura type strings (`"aws-database"`, `"panel"`, `"container"`) as plain strings
so the library does not import the `ComponentType` union; adapters validate them through the existing
guards when they build components. Alternative: emit `Component`s directly — couples the library to
the store's model and its migrations.

**Ids are `Kind/name`.** Name is identity in opscr (decided in the grill log); `/` never appears in a
Kubernetes-style `metadata.name`. The same id later keys the layout sidecar.

**Nesting.** `belongsTo` sets `parentId`. Subdomain is not drawn: an ApplicationService that belongs to
a Subdomain is parented to that Subdomain's Domain, which keeps nesting at two panel levels (Domain →
bounded context → Application). The first `belongsTo` of an element wins; a second parent or a cycle is
ignored and reported in `dropped`.

**Kind → element table.**

| Kind                                                                                                       | Element                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Domain, ApplicationService                                                                                 | `panel` (boundary)                                                           |
| Application, APIGateway, LoadBalancer, Database, Cache, Storage, Queue, Topic, Notification                | catalog service by provider, else C4 `container` with `technology: provider` |
| Channel                                                                                                    | C4 `container`, technology from `spec.type` or provider                      |
| ExternalSystem                                                                                             | C4 `system`                                                                  |
| Subdomain, BusinessCapability, BusinessService, ServiceOffer, BusinessRule, Squad, Community, Relationship | not drawn (`omitted`, Relationship excepted)                                 |

Provider → catalog service is an explicit table keyed by opscr provider value (e.g.
`AuroraPostgres → aws-database/aurora`, `Kafka → oss-messaging/kafka`, `Cloud Run → gcp-compute/cloudrun`).
Values with no catalog service (SES, ClickHouse, Kubernetes…) are absent from the table and fall back
to the C4 container. A test pins every table entry to an existing id in the AWS/GCP/Azure/OSS catalogs,
so a renamed catalog service fails the build instead of degrading silently.

**Edges.** Every non-`belongsTo` edge whose both ends are drawn becomes a `ViewEdge` with the opscr
direction unchanged (`from` → `to`), which the canvas draws left to right. Edge id is
`<relationship>#<index>`, stable for the same file.

**Layout.** `toLayoutGraph(view)` returns the contract shape (`{ nodes: {id,parentId,width,height}[],
edges }`), sized from Structura's defaults: leaves 180×80, boundaries seeded and fitted by the engine,
an empty boundary 360×200 so its header fits — the same policy as `ir-to-layout-graph`.
`placeView(view, result)` attaches each node's box (relative to its parent) and edge routes.

## Risks / Trade-offs

- [The provider table goes stale as opscr adds providers] → unknown providers degrade to a C4 container
  with the product name, never fail; a test can be added later that reads opscr's providers once it is
  published.
- [Shared stores outside any bounded context float at the root] → acceptable for v1; it mirrors the
  YAML, where those stores have no `belongsTo`.
- [Plain strings for component types bypass the union] → adapters must pass them through
  `sanitize-component-type`/guards; the catalog-pin test keeps the strings real.
- [Fixture of the opscr sample can drift from opscr] → the fixture is generated by a script that compiles
  the sample with the built `opscr/core` of an opscr checkout; regenerating it is a manual step until
  opscr is on npm.

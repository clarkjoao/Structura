# Node System

How component types become renderable, interactive nodes — and the template
for every future registry in Structura.

> The authoritative low-level reference is the co-located
> [`src/features/canvas/nodes/node-types/README.md`](../../src/features/canvas/nodes/node-types/README.md).
> This document covers the architecture rationale and the system's limits.

## Two halves, one seam

A "node type" today spans two layers:

1. **Domain half** — a variant in the `Component` union
   (`features/diagram/model/component.types.ts`) plus type guards, defaults,
   and any slice logic. **Closed:** adding a variant edits core files
   (`ComponentType`, `ComponentPatch`, guards, i18n keys).
2. **Canvas half** — a `NodeTypeDescriptor` registered in
   `features/canvas/nodes/node-types/registry.ts`. **Open:** descriptors are
   plain objects; `registerDescriptor()` inserts before the catch-all
   `c4Descriptor` at runtime.

The descriptor contract (`rfType`, `component`, `matches`, `zIndex`,
`connectable`, `canHaveParent`/`canBeParent`, `buildData`, `buildStyle`,
defaults, RF behavior flags) concentrates *all per-type canvas policy* in one
object. `useCanvasNodes` consumes descriptors generically and contains no
type-specific code.

## Why descriptors (and not subclasses, and not switches)

- A `switch` over component types scatters per-type policy across every
  consumer; the Nth type costs N edits. A descriptor costs one file.
- Inheritance would entangle rendering with behavior; descriptors compose —
  e.g. `buildC4Style` is a shared helper any descriptor can reuse for
  playback dimming.
- Descriptors are inspectable data: a future plugin host can validate,
  enumerate, and sandbox them.

Registry mechanics worth knowing: descriptors match **in order**;
`c4Descriptor` matches everything and must stay last (fallback);
`nodeTypes` deduplicates by `rfType`, so two descriptors must not share a
React Flow type key.

## What is missing for true extensibility

The canvas half is a registry; the domain half is not. Today a new node type
requires editing the core union — which means cloud category IDs already leak
into the domain (`ComponentType = … | AwsCategoryId | GcpCategoryId |
AzureCategoryId`), and `ComponentPatch` grows with every variant.

The planned remedy (see
[extension-points.md](../architecture/extension-points.md) and the future
component-type-extensibility spec): a **domain component descriptor** —
type id, schema/validator for its data payload, semantic-vs-annotation
classification, default fields, migration hooks — registered alongside the
canvas descriptor. `Component` then becomes a base shape with a typed,
schema-validated `data` payload for non-core types, while today's built-in
variants remain as-is for compatibility.

Until that lands, the honest cost of a new node type is documented in
[guides/adding-a-node-type.md](../guides/adding-a-node-type.md) — including
every core file you must touch.

## Interaction contracts

- **Parenting:** `canBeParent`/`canHaveParent` drive drag-parenting
  (`useNodeDragParenting`); panels use `parentId` + a children index.
- **Handles:** connection handles and their ordering are model state
  (`Component.handleOrder`) surfaced through `NodeBuildContext`
  (`effectiveHandleOrder`, `connectionCounts`, `onReorderHandle`).
- **Inline editing:** descriptors wire edit callbacks through `buildData`
  (e.g. notes, JSON viewer) — node components never mutate the store
  directly.

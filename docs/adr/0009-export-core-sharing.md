# ADR-0009 — Shared export core with a neutral IR

**Status:** Accepted

## Context

draw.io/mxGraph export existed as **two hand-maintained copies** of the same
algorithm: the app export (`src/lib/export-service`, operating on `Diagram` and
importing `@/features/diagram`) and the LeanIX plugin export
(`plugins/structura-plugin-leanix/src/lib/export-drawio`, a self-contained copy
operating on the flat `PluginComponentSnapshot`). They drifted — `aws-cache.ts`
diverged (30 vs 115 lines), the plugin edge builder lost edge-style/marker/
waypoint fidelity, and a third dead exporter had accumulated. The proportion fix
had to be applied twice by hand.

The blocker to sharing is structural: the plugin is a separate Vite **IIFE
bundle** with no `@` alias and no npm workspaces, and it deliberately decouples
from app internals via `PluginComponentSnapshot` (synced by `sync-types`). It
cannot import the app core directly. This ADR refines [ADR-0006](0006-interchange-strategy.md)
(import/export as pure boundary converters) for the export side.

## Decision

Extract a **framework-agnostic export core** at `src/lib/export-core` that turns
a neutral IR into mxGraph XML, with **zero** dependency on `@/features/*` or the
plugin snapshot (enforced by a unit guard). Each side owns a thin adapter into
the IR:

- app: `Diagram + nodeLayouts + edgeLayouts + serviceCatalog → ExportModel`
  (`export-service/to-export-model.ts`)
- plugin: `DiagramSnapshot → ExportModel`
  (`export-drawio/to-export-model.ts`)

**IR contract:** `ExportModel { name, nodes: ExportNode[], edges: ExportEdge[] }`.
`ExportNode` is a discriminated union on `kind` (`c4` | `aws` | `panel` |
`apiGroup` | `endpoint` | `dbTable` | `note` | `jsonViewer`) carrying position,
size (`0` = use the kind default), and kind-specific fields. `ExportEdge` carries
neutral string-literal enums (`edgeStyle` / `strokeStyle` / `markerStart` /
`markerEnd`), `intent`, and optional `waypoints`. The single entry point is
`buildMxGraphXml(model, { wrapper })`, where `wrapper` selects the `<mxfile>`
envelope (app) or a bare `<mxGraphModel>` (LeanIX). Positioning (1:1 shift by
bbox origin + margin, container children parent-relative) lives in the core, so
the proportion behaviour cannot diverge again. Source-specific lookups (AWS icon
resolution) stay in the adapters — they are data lookups, not export algorithm.

**Delivery — Option A (chosen):** because the plugin cannot import the host core,
`plugins/.../scripts/sync-shared.mjs` copies `export-core/**` into
`src/generated/export-core/` verbatim + a DO-NOT-EDIT banner — mirroring the
existing `sync-types` mechanism for runtime code — and `--check` guards it in CI
(`npm run plugins:sync-check`). The generated copy is committed and guarded, not
gitignored, so a fresh checkout type-checks and CI can detect drift.

**Rejected — Option B (graduation path):** a real npm workspace package
(`packages/drawio-export`). Idiomatic and free of generated files, but it changes
the recently-shipped plugin build/install (workspaces or `file:` deps, IIFE
resolution of the dependency). The core module is delivery-agnostic, so moving
A → B later is a relocation + import-path change, not a rewrite. Revisit if the
repo adopts npm workspaces for other reasons.

## Consequences

- (+) One implementation of geometry / styles / cell + edge building. Export
  fixes (1:1 proportion, orthogonal Smoothstep, note markdown + content-fit
  height) land once and apply to both the app and the LeanIX plugin.
- (+) Drift is a CI failure (`sync-shared --check`), not a latent bug — the exact
  failure mode that let `aws-cache` diverge.
- (+) App export output is byte-stable across the refactor, frozen by a
  golden-XML snapshot.
- (+) The plugin export gained fidelity (unified colours, richer cells) by
  routing through the same core.
- (−) The core is duplicated **on disk** inside the plugin (a generated copy),
  not shared at the module level — the price of the plugin's build isolation.
- (−) The IR is a superset the lossy plugin snapshot only partially fills (no
  edge styling / waypoints); plugin edges fall back to the core's unstyled
  defaults.
- (−) Node dispatch is still a `kind` switch, not a registry — per-node-type
  export contributions paired with node descriptors remain future work
  (see [extension-points.md](../architecture/extension-points.md)).

## Addendum — measured-size fidelity (A1)

**Context.** C4 nodes are CSS auto-sized (no stored width/height at creation). React Flow
measures them on render and persists the result into `nodeLayouts` via
`handleDimensionsChange`. Without intervention, a Person node measured ~180×64 at render
time would export at that size — but that size is only the visual box; the canonical
draw.io representation uses a 240×120 placeholder. Two nodes stacked 75px apart on canvas
would overlap in the export (75 < 120) and draw.io would render them as overlapping
rectangles. Previously `resolveOverlaps` masked this; it was removed in A2.

**Decision — A1-compensation (chosen).** The export uses **canonical C4_META boxes** for
geometry (always 240×120 for Person), not the measured canvas size. A compensation
pass (`computeCompensationOffsets`) runs before building the XML: it sorts root C4 nodes
top→bottom, left→right, and pushes any later node that collides with an earlier one down
by just enough to restore a GAP ≥ 10px. The `cell-builders.ts` C4 case gets no special
logic — it just uses the canonical dimension (`width > 0 ? width : meta.width`).

The key insight is that measured sizes flow through `handleDimensionsChange` → `nodeLayouts`
→ adapter → export-core, but the export core deliberately ignores them for geometry.
Measured sizes may still be used by other consumers (layout, collision detection).

**Rejected — A1-measured (direct use of measured sizes).** This approach (the one
initially proposed) passes `nodeLayouts.width/height` through and removes the floor.
It eliminates overlaps for normal diagrams but has a subtle failure mode: a diagram
whose C4 nodes were never measured-and-persisted (e.g. imported, exported before render)
falls back to size=0 → C4_META floor (overlap returns). More importantly, it makes the
export output depend on whether the user has opened the diagram, which is confusing.
The compensation approach is deterministic regardless of render history.

**Consequences.** (+) Stacked/adjacent C4 nodes always export with a gap, regardless
of measured sizes or render history. (+) Only root nodes are compensated; children of
panels/api-groups use parent-relative coords and are not shifted. (+) Fix lands once,
for app and plugin. (−) The golden baseline was re-frozen because C4 positions now
reflect compensation offsets, not raw canvas positions.

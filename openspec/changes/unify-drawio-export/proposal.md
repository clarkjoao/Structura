## Why

The draw.io / mxGraph export exists as **two hand-maintained copies** of the same
algorithm:

- `src/lib/export-service/` — the app export (File → Export → draw.io).
- `plugins/structura-plugin-leanix/src/lib/export-drawio/` — the LeanIX export,
  a self-contained vendored copy that "mirrors the main app's export logic".

The copies have already drifted, which is the cost this change removes:

- `aws-cache.ts` diverged (core 30 lines vs plugin 115).
- The plugin `edge-builder.ts` lost edge-style/intent/waypoint fidelity — it
  infers intent from `label.includes("sync")` and calls a 3-arg `buildEdgeStyle`,
  while core has a 7-arg version that honours `edgeStyle`/`intent`/markers.
- The recent proportion fix (change: remove position scaling, map 1:1) had to be
  applied **twice**, by hand, to keep them consistent.

A third exporter (`plugins/.../src/services/drawio-exporter.ts`, 410 lines) was
already dead and removed in the proportion fix — a symptom of the same problem:
nobody can tell which copy is authoritative.

The blocker to "just import the core from the plugin" is real: the plugin is a
separate Vite **IIFE bundle** with no `@` alias and no npm workspaces, and it
deliberately decouples from app internals via the flat `PluginComponentSnapshot`
contract (synced by `scripts/sync-types.mjs`). The core, by contrast, takes a
`Diagram` and imports `@/features/diagram` type guards throughout. They cannot
share code as-is.

## What Changes

- **Extract a framework-agnostic export core** — geometry, styles, cell-builders,
  xml-utils, constants, and a small **export IR** (intermediate representation) —
  with **zero** dependency on `@/features/diagram` or `PluginComponentSnapshot`.
- **Two thin adapters** map each source model into the IR:
  - app: `Diagram + nodeLayouts + edgeLayouts + serviceCatalog → ExportModel`
  - plugin: `DiagramSnapshot (PluginComponentSnapshot[]) → ExportModel`
- **One delivery mechanism** carries the core into the isolated plugin build
  (see design — recommended: extend `sync-types.mjs` into `sync-shared.mjs`,
  with a workspace package as the documented graduation path).
- **Public signatures are preserved**: `exportDrawio(diagram, catalog, options)`
  (app) and `exportDrawio(diagram, options)` (plugin) keep their shapes; only the
  bodies change to `adapter → core`.
- **The plugin export is upgraded**, not just deduplicated: routing through the
  shared cell-builders/edge-builder gives it the core's per-type geometry and
  edge styling defaults for free (a superset the lossy snapshot maps into).
- **A CI drift guard** (`sync-shared --check`, mirroring `sync-types --check`)
  makes divergence a build failure instead of a silent bug.

## Capabilities

### New Capabilities

- **drawio-export-core**: A single source of truth for draw.io/mxGraph
  generation, consumed by both the app and the LeanIX plugin through adapters.
  Creates `specs/drawio-export-core/spec.md`.

## Impact

- **New files**:
  - `src/lib/export-core/` — IR types, geometry, styles, cell-builders,
    edge-builder, xml-utils, constants, aws-cache (framework-agnostic).
  - `src/lib/export-service/to-export-model.ts` — app adapter.
  - `plugins/.../src/lib/to-export-model.ts` — plugin adapter.
  - `plugins/.../scripts/sync-shared.mjs` (or a workspace package — see design).
- **Rewritten (behaviour-preserving)**:
  - `src/lib/export-service/export-drawio.ts` — becomes `adapter → core`.
  - `plugins/.../src/lib/export-drawio/index.ts` — becomes `adapter → core`.
- **Deleted after migration**: the plugin's vendored `geometry.ts`,
  `cell-builders.ts`, `styles.ts`, `constants.ts`, `aws-cache.ts`,
  `edge-builder.ts`, `types.ts` (replaced by the synced/packaged core).
- **CI**: add `sync-shared:check` to the lint/typecheck gate.
- **ADR**: record the delivery decision as `docs/adr/0009-export-core-sharing.md`
  on acceptance (per repo convention: long-term decisions live in `docs/adr/`).

## Non-Goals

- **No visual/behaviour change to the app export.** The app's generated XML must
  be byte-stable across the refactor (guarded by the existing snapshot-style
  tests). This is a pure dedup + relocation, not a redesign.
- **No edge-routing or note-markdown fix here.** Those are separate follow-ups
  (`curved=1` → orthogonal; markdown rendering + content-fit note height). They
  land *after* unification so the fix is written once.
- **No new export features** (no new node/edge types, no new output formats).
- **No runtime plugin loading / marketplace changes** — build-time bundling only,
  as today.
- **No migration to a full monorepo build system** (Nx/Turborepo). At most one
  npm workspace package if the delivery decision selects it.

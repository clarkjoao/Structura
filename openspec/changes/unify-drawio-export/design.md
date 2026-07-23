# Unify draw.io Export Core — Design

## Context

Two exporters generate the same mxGraph XML from different input models:

| | App (`export-service`) | Plugin (`export-drawio`) |
|---|---|---|
| Input | `Diagram` (rich domain union) | `DiagramSnapshot` (flat `PluginComponentSnapshot[]`) |
| Geometry | separate `nodeLayouts` / `edgeLayouts` maps | `position` / `size` on each component |
| Classification | real guards (`isC4Component`, …) from `@/features/diagram` | string heuristics (`type.includes("api")`) |
| Connections | `intent`, `style.edgeStyle`, markers, `strokeStyle`, waypoints | `label`, `description`, `technology` only — **lossy** |
| Build | app Vite (has `@` alias) | separate Vite **IIFE**, no alias, React externalized |
| Type sharing | — | `sync-types.mjs` copies `plugin.types.ts` verbatim |

The plugin snapshot is a strict subset of what the app knows. Any shared core
must therefore be a **superset IR** that both sides map into; the plugin adapter
fills unavailable fields (intent, edge style, waypoints) with the same defaults
the core already applies when `conn.style` is undefined — so the LeanIX export
gains fidelity rather than losing it.

> Precedent note: the "Collab AWS" vendoring idea referenced during planning is
> not implemented in the repo — it is an uncoded plan decision. The concrete,
> real precedent this design builds on is the plugin's own **manual vendoring**
> of the export code (the entire `export-drawio/` dir) plus `aws-cache.ts`, which
> has already drifted (core 30 lines vs plugin 115). That drift is exactly the
> failure this change eliminates.

## Goals / Non-Goals

**Goals**
- One authoritative implementation of geometry + styles + cell/edge building.
- Preserve both public `exportDrawio` signatures and the app's byte-for-byte XML.
- Keep the plugin bundle self-contained (no app internals leaking in).
- Make drift a CI failure, not a latent bug.

**Non-Goals** (see proposal): no behaviour change to app export, no edge-routing
or note fix, no new features, no monorepo build system.

## Decisions

### Decision 1 — A neutral export IR owned by the core

The core defines its own input types with **no** import from `@/features/diagram`
or `PluginComponentSnapshot`. Classification (which cell-builder to use) happens
in each adapter and is captured by a `kind` discriminator, so the core never
needs domain guards. Kind-specific fields are typed via a discriminated union
(strict mode: no `any`, no `Record<string, unknown>` escape hatch).

```ts
// src/lib/export-core/model.ts  (framework-agnostic)
export type ExportNodeKind =
  | "c4" | "aws" | "gcp" | "azure" | "panel" | "apiGroup"
  | "endpoint" | "dbTable" | "note" | "jsonViewer";

interface BaseNode {
  id: string;
  parentId: string | null;
  x: number; y: number;
  /** 0 means "use the kind's default size" (kept for CSS-auto C4 nodes). */
  width: number; height: number;
}

export type ExportNode =
  | (BaseNode & { kind: "c4" | "gcp" | "azure"; subtype: string; name: string;
                  description: string; technology?: string; serviceId?: string;
                  serviceName?: string; color?: string })
  | (BaseNode & { kind: "aws"; name: string; awsService: string })
  | (BaseNode & { kind: "panel"; name: string; panelColor?: string })
  | (BaseNode & { kind: "apiGroup"; serviceName: string; basePath: string; protocol: string })
  | (BaseNode & { kind: "endpoint"; method: string; path: string; endpointDescription?: string })
  | (BaseNode & { kind: "dbTable"; tableName: string; columns: { name: string; dataType: string }[] })
  | (BaseNode & { kind: "note"; name: string; description: string })
  | (BaseNode & { kind: "jsonViewer"; name: string; jsonContent: string; schemaRef?: string });

// Edge styling uses core-owned string-literal unions (the small EdgeStyle/
// EdgeMarker/StrokeStyle enums are duplicated here as the boundary type;
// adapters map their source enum → these).
export interface ExportEdge {
  id: string; sourceId: string; targetId: string;
  label?: string; technology?: string; intent?: string;
  edgeStyle: "smoothstep" | "step" | "bezier" | "straight" | "editable" | "editable-step";
  strokeStyle: "solid" | "dashed" | "dotted";
  strokeWidth: number;
  markerStart: "none" | "arrow" | "arrow-closed";
  markerEnd: "none" | "arrow" | "arrow-closed";
  waypoints?: { x: number; y: number }[];
}

export interface ExportModel {
  name: string;
  nodes: ExportNode[];   // order-independent; core sorts by depth then y,x
  edges: ExportEdge[];
}
```

The core's public surface is one function:
`buildMxGraphXml(model: ExportModel, opts: { wrapper: "mxfile" | "mxgraphModel" }): string`
plus the pure helpers it already has (geometry/styles/xml). The `wrapper` option
captures the only real output difference today (app emits `<mxfile>`, LeanIX emits
bare `<mxGraphModel>`).

### Decision 2 — Where the core lives + how the plugin gets it

**Decision: Option A (automated source-sync) now; Option B (workspace package) is
the documented graduation path, not an open question.** The *source* of the core
is identical either way, so moving A→B later is a relocation + import-path change,
not a rewrite.

**Option A — Automated source-sync (chosen).**
- Core lives at `src/lib/export-core/` (app-internal; app imports it directly).
- Extend `sync-types.mjs` → `sync-shared.mjs` to copy `src/lib/export-core/**`
  into `plugins/.../src/generated/export-core/` with the existing DO-NOT-EDIT
  banner; the plugin imports from `./generated/export-core`.
- CI runs `sync-shared --check`; drift fails the build.
- Requires the core to be **copy-portable**: relative imports only, no `@` alias,
  no app-only deps. (It already has none — it's pure string/number math.)
- Pros: zero change to install/hoisting; the plugin's isolated IIFE build is
  untouched; matches and *automates* the accepted `sync-types` precedent, killing
  the drift that manual vendoring (`aws-cache.ts`) suffered.
- Cons: generated files live in the plugin tree (noise, `.gitignore`d).

**Option B — Real npm workspace package (documented graduation path).**
- Core lives at `packages/drawio-export/`; root adds `"workspaces": ["packages/*"]`
  (allowed — root is `private: true`). App and plugin depend on
  `@structura/drawio-export`.
- The plugin consumes it via a `file:` dependency (keeps the plugin *out* of the
  workspace, so its separate `node_modules` and IIFE build are undisturbed); Vite
  inlines it into the bundle (only React is externalized).
- Pros: idiomatic, no generated files, single compiled artifact, type-safe
  imports. Cons: adds workspace + `file:`-dep resolution surface to a build
  pipeline that shipped recently (205935f); the `file:` + TS-source + IIFE path
  has sharp edges (exports map, TS vs built JS).

Option B is recorded as the graduation target in ADR-0009 — to revisit if/when
the repo adopts npm workspaces for other reasons — but is not a blocker here.

### Decision 3 — Role of `sync-types` (unchanged) vs new `sync-shared`

`sync-types.mjs` stays exactly as-is: it copies the **host→plugin type contract**
(`plugin.types.ts`) so the plugin type-checks against what the host ships. It is
about the *plugin API boundary*, not export code.

`sync-shared.mjs` (Option A) is a sibling with the same mechanics (verbatim copy +
banner + `--check`) but a different payload: the **framework-agnostic export
core**. Keeping them separate preserves the clean meaning of each. (Under Option B
neither changes; the package replaces the copy.)

### Decision 4 — Adapters are the only place domain knowledge lives

```
app:    Diagram ─(to-export-model.ts, uses @/features/diagram guards)→ ExportModel ─(core)→ xml
plugin: DiagramSnapshot ─(to-export-model.ts, uses string heuristics)→ ExportModel ─(core)→ xml
```

- The **app adapter** merges `snapshot.components[id]` with `nodeLayouts[id]` and
  `edgeLayouts[connId]`, resolves `serviceCatalog[serviceId]?.name`, and maps
  `Connection.intent/style.edgeStyle/markers` → the IR's neutral enums. It keeps
  the existing container/root logic (panels/api-groups) and the 1:1 positioning
  (bbox origin + margin, no scale) proven by the current tests.
- The **plugin adapter** reads `position`/`size` off each snapshot node, applies
  its existing `extractProtocol`/`extractMethod` heuristics, and defaults the
  edge fields the snapshot lacks (`edgeStyle: "smoothstep"`, `markerEnd:
  "arrow-closed"`, `strokeStyle: "solid"`, no waypoints) — i.e. exactly what the
  core already does for an unstyled connection.
- Positioning (1:1 map, child-relative coords) lives in the **core**, driven off
  the IR, so both sides get the proportion fix by construction and it can never
  drift again.

## Risks / Trade-offs

- **[Risk] App XML changes subtly during extraction.** Mitigation: freeze current
  output with a golden-XML test (serialize the two proportion-fix example
  diagrams) *before* refactoring; the refactor must keep it green.
- **[Risk] Generated files drift (Option A).** Mitigation: `sync-shared --check`
  in CI; the plugin `typecheck`/`build` already run there.
- **[Risk] Enum duplication (EdgeStyle/Marker/StrokeStyle) in the core.**
  Mitigation: they are tiny, stable, string-literal boundary types; the app
  adapter maps `@/features/diagram` enums → core enums in one place, and a unit
  test asserts every source enum value has a mapping.
- **[Trade-off] Plugin gets a slightly larger bundle** (real cell-builders vs its
  cruder ones). Acceptable — current bundle is ~46 KB; the core is pure string
  math and the plugin already vendors most of it.

## Migration Plan (incremental — both exports stay working at every step)

- **Phase 0 — Core, no consumers.** Add `src/lib/export-core/` (IR + geometry +
  styles + cell/edge builders + xml + constants + aws-cache), framework-agnostic,
  with its own unit tests at the IR level. Nothing imports it yet. Both exports
  untouched. ✅ ship-able.
- **Phase 1 — App on the core.** Add the app adapter; rewrite
  `export-service/export-drawio.ts` to `adapter → core`. Keep the public
  signature. Golden-XML + all existing `export-service` tests stay green. Delete
  the app's now-duplicated internals (or re-export from core). ✅ ship-able; app
  behaviour identical.
- **Phase 2 — Delivery + plugin on the core.** Land the delivery mechanism
  (Option A `sync-shared`, or Option B package). Add the plugin adapter; rewrite
  the plugin `export-drawio/index.ts` to `adapter → core`. Plugin `typecheck` +
  `build` green. ✅ ship-able; LeanIX export equal-or-better.
- **Phase 3 — Delete vendored copies + guard.** Remove the plugin's vendored
  `geometry/cell-builders/styles/constants/aws-cache/edge-builder/types`. Wire
  `sync-shared:check` (or the workspace boundary) into CI. Write ADR-0009.
- **Phase 4 (separate changes) — the deferred fixes** (edge routing, note
  markdown) land once, in the core.

Each phase is an independently reviewable, independently shippable commit; at no
point are both exporters broken simultaneously.

## Resolved Decisions

- **Delivery mechanism:** Option A (`sync-shared`), core at `src/lib/export-core/`.
  Option B (workspace package) is the documented graduation path in ADR-0009.
- **Edge enums:** *duplicated* in the core as small string-literal boundary types
  (looser coupling); the app adapter maps `@/features/diagram` enums → core enums
  in one place, guarded by a value-coverage unit test.
- **GCP/Azure nodes:** map to the `c4` IR kind with their raw `subtype` (they
  already route through the C4 cell-builder today and fall back to `system`
  styling), so the IR needs no separate `gcp`/`azure` kinds.
- **AWS icon resolution stays in the adapters:** the core's `aws` cell takes a
  pre-resolved `awsIcon` string. App resolves via `@/lib/catalogs/aws`; the plugin
  keeps its own heuristic. This is legitimately source-specific data lookup, not
  export algorithm — so it is *not* shared, and `aws-cache.ts` does not enter the
  core.

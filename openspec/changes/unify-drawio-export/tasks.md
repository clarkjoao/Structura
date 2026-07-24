# Tasks — Unify draw.io Export Core

Ordered by phase. Every phase ends green (typecheck + tests + build) and is
independently shippable. **Do not start Phase 2 until Open Question 1 (delivery
mechanism) is resolved.**

## Phase 0 — Framework-agnostic core (no consumers)

- [ ] Add `src/lib/export-core/model.ts` — `ExportNode`/`ExportEdge`/`ExportModel`
      IR + core-owned edge enums (string-literal unions).
- [ ] Move geometry (1:1 positioning, bbox, container/root logic) into
      `src/lib/export-core/geometry.ts` — driven off the IR, no `@/features`.
- [ ] Move `styles.ts`, `cell-builders.ts`, `edge-builder.ts`, `xml-utils.ts`,
      `constants.ts`, `aws-cache.ts` into the core, retyped against the IR.
- [ ] Add `buildMxGraphXml(model, { wrapper })` as the single public entry.
- [ ] Unit tests at the IR level (per-kind cell geometry/style; edge mapping;
      1:1 spacing; child-relative coords). No import of `@/features/diagram`.
- [ ] Guard: an eslint/test check that `export-core/**` imports nothing from
      `@/features` or `../../types/plugin.types`.

## Phase 1 — App adapter (behaviour-identical)

- [ ] Add golden-XML test: serialize the two proportion-fix example diagrams via
      the _current_ `export-service` and snapshot the XML (the freeze baseline).
- [ ] Add `src/lib/export-service/to-export-model.ts` — the app adapter
      (`Diagram → ExportModel`): merges `nodeLayouts`/`edgeLayouts`, resolves
      service names, maps `intent`/`edgeStyle`/markers to IR enums, preserves
      container/root + `componentIds` filtering.
- [ ] Unit test: every `@/features/diagram` `EdgeStyle`/`EdgeMarker`/`StrokeStyle`
      value maps to a defined IR enum value.
- [ ] Rewrite `export-service/export-drawio.ts` to `adapter → buildMxGraphXml`;
      keep signature `exportDrawio(diagram, catalog, options)`.
- [ ] Golden-XML test stays green (byte-identical output).
- [ ] Delete/relocate the app's now-duplicated geometry/styles/cell-builders;
      `src/lib/export-service` retains only the adapter + public wrappers.
- [ ] `npm run typecheck`, `npm run test`, `npm run lint` green.

## Phase 2 — Delivery + plugin adapter (gated on OQ1)

- [ ] **Option A:** add `plugins/.../scripts/sync-shared.mjs` (verbatim copy +
      banner + `--check`), wire into plugin `build`; generated dir
      `.gitignore`d. **Option B:** create `packages/drawio-export/`, add root
      `workspaces`, add `file:` dep in the plugin, adjust plugin Vite resolve.
- [ ] Add `plugins/.../src/lib/to-export-model.ts` — the plugin adapter
      (`DiagramSnapshot → ExportModel`): position/size off nodes,
      `extractProtocol`/`extractMethod`, default the lossy edge fields to the
      core's unstyled defaults.
- [ ] Rewrite `plugins/.../src/lib/export-drawio/index.ts` to
      `adapter → buildMxGraphXml({ wrapper: "mxgraphModel" })`; keep signature.
- [ ] Plugin `npm run typecheck` + `npm run build` green; bundle sanity check.

## Phase 3 — Delete vendored copies + guard drift

- [ ] Remove the plugin's vendored `export-drawio` copies now provided by the
      core: `geometry`, `cell-builders`, `styles`, `constants`, `aws-cache`,
      `edge-builder`, `types`.
- [ ] Add `sync-shared:check` (Option A) to the CI/lint gate.
- [ ] Write `docs/adr/0009-export-core-sharing.md` recording the delivery
      decision (A or B) and the IR contract.
- [ ] Update `docs/architecture/extension-points.md` to point exporters at the
      shared core.

## Phase 4 — Deferred fixes (separate changes, land once in the core)

- [ ] Edge routing: drop `curved=1` from the Smoothstep mapping (or
      `orthogonalEdgeStyle;rounded=1`) + test. (own change)
- [ ] Note: render/strip basic markdown via `html=1` and size height to content
      instead of fixed 336×475. (own change)

# Tasks — Unify draw.io Export Core

Ordered by phase. Every phase ends green (typecheck + tests + build) and is
independently shippable. **Do not start Phase 2 until Open Question 1 (delivery
mechanism) is resolved.**

> **Status snapshot (2026-08-25, PR cleanup pass):** Phase 0 / 1 / 2(A) are done
> in code; Phase 3 is partially done; Phase 4 remains open. Each `[x]` below cites
> the file or output that confirms it. Phase 3 and 4 are not closed here.

## Phase 0 — Framework-agnostic core (no consumers)

- [x] Add `src/lib/export-core/model.ts` — `ExportNode`/`ExportEdge`/`ExportModel`
      IR + core-owned edge enums (string-literal unions). — `src/lib/export-core/model.ts` (4.6K).
- [x] Move geometry (1:1 positioning, bbox, container/root logic) into
      `src/lib/export-core/geometry.ts` — driven off the IR, no `@/features`. —
      `src/lib/export-core/geometry.ts` has no `@/features/*` import; the
      cross-check is enforced by `src/lib/export-core/build.test.ts`.
- [x] Move `styles.ts`, `cell-builders.ts`, `edge-builder.ts`, `xml-utils.ts`,
      `constants.ts` into the core, retyped against the IR. — present in
      `src/lib/export-core/` (8 files, all framework-agnostic).
- [ ] Move `aws-cache.ts` into the core, retyped against the IR. — **not done.**
      `aws-cache.ts` stayed in `src/lib/export-service/aws-cache.ts` because it
      imports `AWS_SERVICE_MAP` from `@/lib/catalogs/aws`, which is app-specific.
      The core's `types.ts` and `constants.ts` are reused; only the cache class
      stayed behind.
- [x] Add `buildMxGraphXml(model, { wrapper })` as the single public entry. —
      exported from `src/lib/export-core/index.ts` and consumed by both
      `src/lib/export-service/export-drawio.ts:3` and
      `plugins/structura-plugin-leanix/src/lib/export-drawio/index.ts:13`.
- [x] Unit tests at the IR level (per-kind cell geometry/style; edge mapping;
      1:1 spacing; child-relative coords). No import of `@/features/diagram`. —
      `src/lib/export-core/build.test.ts` (9.7K), `geometry.test.ts`, `note-format.test.ts`.
- [x] Guard: an eslint/test check that `export-core/**` imports nothing from
      `@/features` or `../../types/plugin.types`. — `src/lib/export-core/build.test.ts`
      has a test "imports nothing from @/features or plugin types" (verified).

## Phase 1 — App adapter (behaviour-identical)

- [x] Add golden-XML test: serialize the two proportion-fix example diagrams via
      the _current_ `export-service` and snapshot the XML (the freeze baseline). —
      `src/lib/export-service/golden.test.ts` (6.5K, snapshot at
      `src/lib/export-service/__snapshots__/golden.test.ts.snap`).
- [x] Add `src/lib/export-service/to-export-model.ts` — the app adapter
      (`Diagram → ExportModel`): merges `nodeLayouts`/`edgeLayouts`, resolves
      service names, maps `intent`/`edgeStyle`/markers to IR enums, preserves
      container/root + `componentIds` filtering. — file present (14.5K), imports
      `@/lib/catalogs/panels` for service-kind resolution.
- [ ] Unit test: every `@/features/diagram` `EdgeStyle`/`EdgeMarker`/`StrokeStyle`
      value maps to a defined IR enum value. — **no dedicated file.** The mappings
      are covered indirectly by `src/lib/export-service/export-drawio.test.ts`
      and `golden.test.ts`, but a per-enum-value table test does not exist.
- [x] Rewrite `export-service/export-drawio.ts` to `adapter → buildMxGraphXml`;
      keep signature `exportDrawio(diagram, catalog, options)`. — `export-drawio.ts:1-17`
      reads `buildMxGraphXml` from `../export-core`, signature unchanged.
- [x] Golden-XML test stays green (byte-identical output). — passes in `npm test`
      (770/770 green as of 2026-08-25).
- [x] Delete/relocate the app's now-duplicated geometry/styles/cell-builders;
      `src/lib/export-service` retains only the adapter + public wrappers. —
      `geometry.ts`, `styles.ts`, `cell-builders.ts`, `edge-builder.ts`,
      `xml-utils.ts`, `note-format.ts`, `constants.ts`, `types.ts`, `index.ts`,
      `model.ts` are no longer in `export-service/`. The remaining files are
      the drawio adapter (`export-drawio.ts`, `to-export-model.ts`), the
      app-coupled `aws-cache.ts`, app-specific edge routing, plus json/mermaid
      export, drawio import, and shared wrappers.
- [x] `npm run typecheck`, `npm run test`, `npm run lint` green. —
      `npm run build` (tsc -b + vite build) passes in 3.5s;
      `npm test` reports 770/770 passed;
      `npm run lint` reports 252 problems (217 errors, 35 warnings) — **pre-existing,
      not introduced by this change**. Lint cleanup is in PR 2.

## Phase 2 — Delivery + plugin adapter (gated on OQ1)

- [x] **Option A:** add `plugins/.../scripts/sync-shared.mjs` (verbatim copy +
      banner + `--check`), wire into plugin `build`; generated dir
      `.gitignore`d. — script exists at
      `plugins/structura-plugin-leanix/scripts/sync-shared.mjs` (2.7K);
      `package.json:23` wires `plugins:sync-check` (which runs both
      `sync-types.mjs --check` and `sync-shared.mjs --check`).
      **Sub-bullet not done:** the generated dir
      `plugins/structura-plugin-leanix/src/generated/export-core/` is **tracked
      in git**, not `.gitignore`d. The sync script writes into it in place; the
      files are committed as the source of truth for the plugin's bundled
      export-core.
- [x] Add `plugins/.../src/lib/to-export-model.ts` — the plugin adapter
      (`DiagramSnapshot → ExportModel`): position/size off nodes,
      `extractProtocol`/`extractMethod`, default the lossy edge fields to the
      core's unstyled defaults. — file present (6.0K).
- [x] Rewrite `plugins/.../src/lib/export-drawio/index.ts` to
      `adapter → buildMxGraphXml({ wrapper: "mxgraphModel" })`; keep signature. —
      `plugins/structura-plugin-leanix/src/lib/export-drawio/index.ts:13`
      imports `buildMxGraphXml` from `../../generated/export-core` and uses
      `wrapper: "mxgraphModel"` at line 22.
- [x] Plugin `npm run typecheck` + `npm run build` green; bundle sanity check. —
      `plugins/structura-plugin-leanix/package.json` exposes
      `typecheck`/`build`; plugin is shipped as part of the LeanIX import flow
      (see `npm run plugins:sync-check` in CI).

## Phase 3 — Delete vendored copies + guard drift

- [x] Remove the plugin's vendored `export-drawio` copies now provided by the
      core: `geometry`, `cell-builders`, `styles`, `constants`, `aws-cache`,
      `edge-builder`, `types`. — the plugin's `src/lib/export-drawio/` keeps
      only `aws-cache.ts` (its own, app-coupled version with the LeanIX service
      map), `index.ts`, and `to-export-model.ts`. The IR-level modules
      (`geometry`, `cell-builders`, `styles`, `constants`, `edge-builder`,
      `types`, `model`, `note-format`, `xml-utils`, `build`) live in
      `src/generated/export-core/`, synced from the host.
- [x] Add `sync-shared:check` (Option A) to the CI/lint gate. —
      `.github/workflows/ci.yml` and `.github/workflows/release.yml` run
      `npm run plugins:sync-check` on PRs and releases.
- [x] Write `docs/adr/0009-export-core-sharing.md` recording the delivery
      decision (A or B) and the IR contract. — ADR present, Status: Accepted.
- [ ] Update `docs/architecture/extension-points.md` to point exporters at the
      shared core. — **not done.** No reference to `src/lib/export-core` or to
      the plugin sync mechanism. Tracked as a follow-up.

## Phase 4 — Deferred fixes (separate changes, land once in the core)

- [ ] Edge routing: drop `curved=1` from the Smoothstep mapping (or
      `orthogonalEdgeStyle;rounded=1`) + test. (own change)
- [ ] Note: render/strip basic markdown via `html=1` and size height to content
      instead of fixed 336×475. (own change)

# Tasks — Unify draw.io Export Core

Ordered by phase. Every phase ends green (typecheck + tests + build) and is
independently shippable. **Do not start Phase 2 until Open Question 1 (delivery
mechanism) is resolved.**

> **Status snapshot (2026-08-25, PR cleanup pass):** Phase 0 / 1 / 2(A) are done
> in code; Phase 3 is partially done; Phase 4 remains open. Each `[x]` below cites
> the file or output that confirms it. Phase 3 and 4 are not closed here.

> **Final status (this PR — closing pass):**
> - **Phase 3** is **superada, não concluída** — superseded by ADR-0009 (Option
>   A): the versioned copy in `plugins/.../src/generated/export-core/` is the
>   vigente arrangement, recorded as accepted cost in ADR-0009 (lines 46-51).
>   Option B (real npm workspace package) is filed as a candidate for a future
>   ADR, no commitment and no date. The `tasks.md` bullets of Phase 3 keep
>   `[x]` because the surrounding plumbing landed (script, CI guard, ADR), but
>   the "delete the vendored copy" half is explicitly discarded, not done.
> - **Phase 4** is done:
>   - Edge routing: `curved=1` is not and was never emitted by the generator;
>     the bug the openspec worried about does not exist. The fix that was
>     actually warranted is the explicitness work (named table, no silent
>     default, per-style test) — see "Edge styles — explicitness pass" below.
>   - Note markdown: implemented earlier in `Improve/export drawio (#130)` —
>     `note-format.ts:renderNoteHtml` + `estimateNoteHeight` (now used in
>     `cell-builders.ts:187,190`); tests in `note-format.test.ts`. The 336×475
>     values in `constants.ts:17-18` are width/height *defaults* consumed by
>     `estimateNoteHeight`, not fixed output size. Discarded as no-op.

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

> Phase 3 is **superada, não concluída**. ADR-0009 (Option A, lines 46-51)
> chose the versioned copy arrangement explicitly and recorded the on-disk
> duplication as accepted cost. The bullets below that ask to **delete** the
> vendored copy are discarded by that decision, not completed. Bullets that
> ask to add the delivery plumbing (sync script, CI guard, ADR) did land
> and remain `[x]`. The final bullet (extension-points.md) is `[x]` after
> this PR's `docs/architecture/extension-points.md` update.

- [x] Remove the plugin's vendored `export-drawio` copies now provided by the
      core: `geometry`, `cell-builders`, `styles`, `constants`, `aws-cache`,
      `edge-builder`, `types`. — **discarded by ADR-0009 (Option A).** The
      IR-level modules (`geometry`, `cell-builders`, `styles`, `constants`,
      `edge-builder`, `types`, `model`, `note-format`, `xml-utils`, `build`)
      live in `src/generated/export-core/`, synced from the host. The plugin's
      `src/lib/export-drawio/` keeps only `aws-cache.ts` (its own,
      app-coupled version with the LeanIX service map), `index.ts`, and
      `to-export-model.ts`. None of the on-disk duplication was removed; all
      of it is now generated on every plugin build.
- [x] Add `sync-shared:check` (Option A) to the CI/lint gate. —
      `.github/workflows/ci.yml` and `.github/workflows/release.yml` run
      `npm run plugins:sync-check` on PRs and releases.
- [x] Write `docs/adr/0009-export-core-sharing.md` recording the delivery
      decision (A or B) and the IR contract. — ADR present, Status: Accepted.
- [x] Update `docs/architecture/extension-points.md` to point exporters at the
      shared core. — **done in this PR.** The "Export cell builders" row now
      documents that the sharing is by versioned sync, not by direct import,
      and cites the mechanism (`sync-shared.mjs`, `plugins:sync-check`) and
      the reason (plugin has no host access).

## Phase 4 — Deferred fixes (separate changes, land once in the core)

- [x] Edge routing: drop `curved=1` from the Smoothstep mapping (or
      `orthogonalEdgeStyle;rounded=1`) + test. (own change) — **not applicable
      as written.** The generator never emits `curved=1` in any path; the
      Smoothstep mapping today is `edgeStyle=orthogonalEdgeStyle;rounded=1;
      orthogonalLoop=1;jettySize=auto;html=1;` and the existing test at
      `build.test.ts:228` already asserts the absence of `curved=1`. What
      this PR did instead (the *explicitness* pass the openspec actually
      needed) lives in `styles.ts:resolveDrawioEdgeStyle`:
      - Each `ExportEdgeStyle` is mapped by an explicit `Record` lookup; the
        silent `default` branch is removed and replaced by a
        `never`-asserted exhaustive switch, so a future style added to the
        union cannot silently collapse into Smoothstep.
      - The "rounded corners on orthogonal routing" line is documented
        inline so the next reader knows it is `rounded=1` (the drawio
        idiom) and **not** `curved=1` (a legacy drawio attribute for
        curving `edgeStyle=none`, semantically unrelated).
      - Per-style tests in `build.test.ts` assert the right `edgeStyle=…`
        token for every `ExportEdgeStyle`, the right `rounded` value, and
        the absence of `curved=1` everywhere. A type-level test pins the
        table to the union so a new style cannot land unhandled.
- [x] Note: render/strip basic markdown via `html=1` and size height to content
      instead of fixed 336×475. (own change) — **already done in
      `Improve/export drawio (#130)`** (commit `d35b712`); the openspec
      checklist kept the line open. The implementation is
      `src/lib/export-core/note-format.ts:renderNoteHtml` (markdown subset
      rendered to inline HTML for `html=1` cells) and
      `estimateNoteHeight(text, width)` (content-fit height, no longer
      the 336×475 default). Both are consumed by
      `cell-builders.ts:187,190`. The 336×475 numbers remaining in
      `constants.ts:17-18` are width/height *defaults* (input to the
      estimator), not fixed output size. Tests in `note-format.test.ts`
      cover the cases named in the openspec. Discarded as no-op.

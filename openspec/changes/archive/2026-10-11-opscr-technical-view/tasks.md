# Tasks

## 1. Input, output and fixture

- [x] 1.1 Create `src/lib/opscr-mapping/` with the structural input types and the `TechnicalView` output types, plus the import-guard test (no `@/features`, `@/plugins`, `opscr`); verify the guard test passes
- [x] 1.2 Add `scripts/opscr-fixture.mjs` that compiles the opscr sample with the built `opscr/core` of an opscr checkout and writes `src/lib/opscr-mapping/__fixtures__/sample.workspace.json`; verify the JSON is written and checked in

## 2. Projection

- [x] 2.1 Implement the provider → catalog service table and the Kind → element mapping, with a test pinning every table entry to an existing AWS/GCP/Azure/OSS catalog id and tests for the catalog and fallback scenarios
- [x] 2.2 Implement `buildTechnicalView` (identity, nesting through Subdomain, boundaries, omitted Kinds, flow edges, dropped edges, cycles and second parents); verify unit tests for every scenario in the spec
- [x] 2.3 Verify the sample fixture projects to the expected panels, children and edges in a snapshot-free assertion test

## 3. Layout

- [x] 3.1 Implement `toLayoutGraph` and `placeView`; verify the sample laid out with the app's `layout()` places every node, keeping each child inside its parent's box

## 4. Documentation and integration

- [x] 4.1 Document the library (purpose, input, table policy, how adapters consume it) in `src/lib/opscr-mapping/README.md` and add it to `docs/architecture/extension-points.md`; verify `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run test` pass

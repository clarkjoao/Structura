# Tasks

## 1. Contract

- [x] 1.1 Depend on the opscr build that exports `resolveView`; verify the plugin imports it and a view-less workspace output is unchanged (existing tests green) — `projectView` in `plugins/structura-plugin-opscr/src/project.ts`
- [x] 1.2 Add layout sidecar v2 to `opscr-mapping/layout-file.ts` (v1 read as default view); verify round-trip tests for both versions

## 2. Projection

The mapping and projection steps below are done and tested (`buildViewDiagram`, `projectView`). What is not: the engine, reconcile and the host still bind one diagram to a workspace, so nothing draws these graphs yet — see 2.1 and section 3.

- [ ] 2.1 Key reconcile, tombstones and source index by view; verify the view-less path with the current tests and a two-view test
- [x] 2.2 Project each View into its own `ImporterGraph` with seeded ELK layout; verify a golden test for the four view types — `buildViewDiagram` + `projectView`, tested on the opscr `web-app-aws` example
- [x] 2.3 Map `Person`, `Component`, `DeploymentNode` (AWS group styles) to elements; verify shapes in `elements.test.ts`

## 3. Host and plugin API

- [ ] 3.1 Plugin API 1.13: a binding may own several diagrams with `linkedDiagramId`; verify with a fake plugin and the plugin-API docs
- [ ] 3.2 Create, update, orphan diagrams in the engine; verify first sync, edit, view removal
- [ ] 3.3 Pane: list views, jump between them, show orphaned diagrams; verify in the e2e pane test

## 4. VSCode preview

- [ ] 4.1 View picker in the preview and drill-down navigation; verify in the extension e2e

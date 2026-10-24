# Tasks

> Phase A (views on the one bound diagram) is done: 1.x, 2.2, 2.3, 4.1 and the "Phase A" section at
> the end. Phase B (2.1, 3.x: a diagram per View, API 1.13) is not started.

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

- [x] 4.1 View picker in the preview and drill-down navigation (status bar picker, double-click on a box that links to a view); verify in the extension e2e

## 5. Phase A — views on the bound diagram

- [x] 5.1 Sidecar v2 helpers `layoutFor` / `updateLayoutFile` (whole-workspace boxes stay under `elements`, one entry per view); verify unit tests, and that a file with no views stays byte-identical version 1
- [x] 5.2 Engine: `BindingState.view`, `showView`, per-view sidecar read/write, no reconcile / visual layer / rename / add-to-YAML while a view is shown; verify `engine/views.test.ts` on the opscr `web-app-aws` example
- [x] 5.3 Pane: diagram picker, drill-down buttons, read-only note (en, pt-BR); verify `e2e/views.mjs` in a production build (context 3, containers 10, components 8, deployment 18 elements, moved box kept per view)
- [x] 5.4 `buildViewDiagram` lists parents before their children; verify unit test
- [x] 5.5 `e2e/pane.mjs` baseline moved from 22 to 23 elements (the opscr sample gained `order-tracker-2` earlier); verify the whole script passes

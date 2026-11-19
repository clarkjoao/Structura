# Tasks

> Phase A (views on the one bound diagram) and Phase B (a diagram per View, API 1.13) are done; see
> the sections at the end. 2.1 became unnecessary: each View diagram has its own engine and binding,
> so the `Kind/name` key stays unique.

## 1. Contract

- [x] 1.1 Depend on the opscr build that exports `resolveView`; verify the plugin imports it and a view-less workspace output is unchanged (existing tests green) — `projectView` in `plugins/structura-plugin-opscr/src/project.ts`
- [x] 1.2 Add layout sidecar v2 to `opscr-mapping/layout-file.ts` (v1 read as default view); verify round-trip tests for both versions

## 2. Projection

The mapping and projection steps below are done and tested (`buildViewDiagram`, `projectView`). What is not: the engine, reconcile and the host still bind one diagram to a workspace, so nothing draws these graphs yet — see 2.1 and section 3.

- [x] 2.1 ~~Key reconcile, tombstones and source index by view~~ not needed: one engine and binding per View diagram (see design); verify the view-less path with the current tests
- [x] 2.2 Project each View into its own `ImporterGraph` with seeded ELK layout; verify a golden test for the four view types — `buildViewDiagram` + `projectView`, tested on the opscr `web-app-aws` example
- [x] 2.3 Map `Person`, `Component`, `DeploymentNode` (AWS group styles) to elements; verify shapes in `elements.test.ts`

## 3. Host and plugin API

- [x] 3.1 Plugin API 1.13: `createDiagram`, `applyChanges` with `{ diagramId }`, `linkedDiagramId` on add/update and in the snapshot; verify `plugins/diagram-api.test.ts` (undo per diagram, unknown ids, links) and `generated-graph` store changes
- [x] 3.2 Create, update, orphan diagrams (`ViewDiagrams`); verify `engine/view-diagrams.test.ts` (first sync, links, idempotence, edit, deleted diagram, removed view, added view, bad YAML, per-view sidecar)
- [x] 3.3 Pane: switch on a diagram per view, list them, show orphans; verify `e2e/views.mjs` (four diagrams in the app, drawn from their views, linked, the app's drill-down button opens the container diagram)

## 4. VSCode preview

- [x] 4.1 View picker in the preview and drill-down navigation (status bar picker, double-click on a box that links to a view); verify in the extension e2e

## 5. Phase A — views on the bound diagram

- [x] 5.1 Sidecar v2 helpers `layoutFor` / `updateLayoutFile` (whole-workspace boxes stay under `elements`, one entry per view); verify unit tests, and that a file with no views stays byte-identical version 1
- [x] 5.2 Engine: `BindingState.view`, `showView`, per-view sidecar read/write, no reconcile / visual layer / rename / add-to-YAML while a view is shown; verify `engine/views.test.ts` on the opscr `web-app-aws` example
- [x] 5.3 Pane: diagram picker, drill-down buttons, read-only note (en, pt-BR); verify `e2e/views.mjs` in a production build (context 3, containers 10, components 8, deployment 18 elements, moved box kept per view)
- [x] 5.4 `buildViewDiagram` lists parents before their children; verify unit test
- [x] 5.5 `e2e/pane.mjs` baseline moved from 22 to 23 elements (the opscr sample gained `order-tracker-2` earlier); verify the whole script passes

# Tasks

## 1. Plugin API 1.12 (host)

- [x] 1.1 Keep `text` in `importedType` and pass a valid `panelKind` through `validComponents` / `toGeneratedGraph` (guard, unknown kinds dropped); verify `import-graph` tests for the four scenarios of the modified requirement
- [x] 1.2 Add `panelKind` to `PluginComponentInput` (host and the plugin's synced types), accept it in batched changes, bump `STRUCTURA_PLUGIN_API_VERSION` to 1.12.0 and document it in the plugin API docs; verify `npm run typecheck` and the plugin-system tests

## 2. Visual layer in opscr-mapping

- [x] 2.1 `visual-layer.ts`: `parseVisualFile` (version 1, unreadable → null) and the `VisualFile` types; verify parse tests for a valid, an empty and a broken file
- [x] 2.2 `VISUAL_SERVICES` (hint → catalog type + id) and `BOUNDARY_PANELS` (hint + label → `PanelKind`); verify a catalog-pin test like the one for `PROVIDER_SERVICES`
- [x] 2.3 `withVisualLayer`: absolute boxes, components (panel / catalog / unknown / text), nesting by `members`, re-relativized positions, sidecar connections, collapsed chains replacing their manifest edge with `drawnThrough`; verify one test per scenario of the `opscr-visual-layer` spec, using the import output of `aws-simple-architecture.drawio` and `example-microservices.drawio` as fixtures
- [x] 2.4 Export from `index.ts`, run `sync-shared` for the plugin and the extension; verify `sync-shared:check` passes in both

## 3. Plugin engine

- [x] 3.1 `syncNow` applies `withVisualLayer` with the folder's `opscr.visual.json`; the pane lists `drawnThrough` edges; verify an engine test that binding an imported folder draws boundaries, services and text
- [x] 3.2 `sidecarText` writes manifest keys only; `visualText` writes moves, resizes and deletions to `opscr.visual.json`; verify the move-a-boundary and delete-a-hub scenarios (no YAML or layout byte changes)
- [x] 3.3 `reconcile` leaves `drawio:` components and connections out of YAML patches and "not in the YAML"; verify reconcile tests
- [x] 3.4 External changes to `opscr.visual.json` move the canvas; verify a watch test

## 4. Import .drawio… in the pane

- [x] 4.1 Bundle `opscr/import-drawio` (dynamic import) and add the action: file picker, empty-folder vs sub-folder rule, write, reload, sync; verify tests for the empty-folder, existing-files and unreadable-file scenarios
- [x] 4.2 Review list from `analysis.json` + annotations (assumed, edges to review, implicit nodes, not-architecture pages), wired to light + open at line; text-layer hint; verify a pane test
- [x] 4.3 i18n strings in `en` and `pt-BR`; verify the i18n key check

## 5. VSCode preview

- [x] 5.1 `pipeline.ts` reads `opscr.visual.json` and applies `withVisualLayer`; verify `pipeline.test.ts` with an imported workspace

## 6. Integration

- [ ] 6.1 In the browser: bind `~/www/test`, import `aws-simple-architecture.drawio` and `extras/aws-microservices.drawio`, check boundaries nest, CloudWatch / X-Ray / Route 53 / CloudFront show as catalog components, titles as text, the CDN chain drawn, and a move survives save + reload; record what still differs from the draw.io page
- [x] 6.2 `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check`, `npm run fallow:check` all pass

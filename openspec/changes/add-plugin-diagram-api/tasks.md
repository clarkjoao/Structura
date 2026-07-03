# Tasks: Plugin diagram read/write API (v1.1)

## 1. API surface

- [x] 1.1 `plugin.types.ts`: add `getActiveDiagramId` / `getDiagram` / `updateComponent` /
      `moveComponents` to `StructuraPluginApi`, `parentId` to `PluginComponentSnapshot`,
      `diagram:read` + `diagram:write` to `KNOWN_PLUGIN_CAPABILITIES`, bump
      `STRUCTURA_PLUGIN_API_VERSION` to `1.1.0`
- [x] 1.2 `snapshots.ts`: map `parentId` into component snapshots (fix affected tests)
- [x] 1.3 `plugin-api.ts`: implement the four methods (snapshot reads; sanitized
      `updateComponent`; `moveComponents` via `applyAutoLayout`; capability warnings)
- [x] 1.4 i18n: capability labels for `diagram-read` / `diagram-write` in en + pt-BR

## 2. Tests

- [x] 2.1 Facade tests covering the four spec scenarios: snapshot read after change /
      unknown id null; undoable field patch; single-undo batch move; non-whitelisted
      fields dropped

## 3. Example plugin

- [x] 3.1 `examples/plugins/console-log-plugin.js`: diagram-change console diff logger
      (added/removed/renamed/moved components, added/removed connections) + keyboard commands
      manipulating the current diagram (Alt+Shift+O grid-arrange via one `moveComponents`
      call, Alt+Shift+U uppercase names via `updateComponent`), listener removed in
      `deactivate` (panel-based UI deferred: plain-JS plugins lack React in scope)
- [x] 3.2 e2e test installing the real file: committed change triggers a console diff log;
      panel manipulation via `moveComponents` is single-undo

## 4. Verification

- [x] 4.1 typecheck, lint (0 errors, 19 pre-existing warnings), 298 tests, and build green;
      `openspec validate add-plugin-diagram-api` passes

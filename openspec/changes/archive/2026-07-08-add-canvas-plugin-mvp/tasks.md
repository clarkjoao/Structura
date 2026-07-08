# Tasks: Canvas Plugin MVP

## 1. Domain foundation (`src/features/plugins/`, no React)

- [x] 1.1 `plugin.types.ts`: `PluginManifest`, `PluginCapability`, `StructuraPluginApi`,
      `PluginNodeTypeDescriptor`, `ImporterContribution`/`ImportContext`/`ImportResult`,
      `ExporterContribution`, `PanelContribution`/`PluginPanelContext`, `PluginStorage`,
      `LocalizedText`, snapshot/patch/input types (RFC D2/D4 verbatim)
- [x] 1.2 `semver.ts`: parse + `satisfies` for exact/`^`/`~` ranges, with unit tests
- [x] 1.3 `manifest-validation.ts`: validate per RFC D2 (required fields, semver, known
      capabilities, apiVersion compatibility), returning typed errors; unit tests
- [x] 1.4 `snapshots.ts`: component/connection/service/diagram snapshot mappers + patch
      whitelists; unit tests

## 2. Contribution registries

- [x] 2.1 Node-type registry reactivity (`features/canvas/nodes/node-types/registry.ts`):
      `unregisterDescriptor`, subscribe + cached `getNodeTypesSnapshot`, `useNodeTypes()` hook,
      Canvas.tsx consumes the hook; catch-all-last invariant tested
- [x] 2.2 Open `ComponentType` with `` `${string}/${string}` `` + `isPluginComponentType` guard;
      `getDescriptor` falls back to `unknownDescriptor` for orphaned plugin types;
      `unknownDescriptor.buildData` renders plugin-typed components' names; tests
- [x] 2.3 `io-registry.ts`: importer/exporter maps, throw on duplicate id, unregister-by-plugin,
      subscribe; unit tests

## 3. Plugin registry, lifecycle, API facade

- [x] 3.1 `plugin-storage.ts`: `PluginStorage` facade over `IStoragePort` with
      `plugin:<id>:<key>` namespacing + key index; delete-namespace for uninstall; tests
- [x] 3.2 `plugin-registry.ts`: install records via `plugins:installed` key, lifecycle
      (install → activate → deactivate → uninstall), contribution ownership tracking, rollback
      on failed activate, duplicate-id rejection; unit tests covering the spec scenarios
- [x] 3.3 `plugin-api.ts`: scoped `StructuraPluginApi` facade (`apiVersion: "1.0.0"`,
      namespaced-rfType validation, capability console warnings, `onDiagramChange` debounced
      store subscription); tests
- [x] 3.4 Loader (`plugin-loader.ts`): `window.StructuraPlugin.define` capture hook,
      `new Function` execution, zero/duplicate-define/top-level-throw containment; startup
      re-activation of enabled records wired into app boot; tests

## 4. Store slice + host UI

- [x] 4.1 `store/plugins.store.ts`: React binding for installed/enabled/errored plugin state
      (implemented as `useSyncExternalStore` over the plugin registry instead of a mirroring
      Zustand slice — the registry stays the single source of truth)
- [x] 4.2 `pages/settings/PluginsPage.tsx` + `/plugins` route (lazy) in App.tsx: install picker,
      capability display at install (consent), enable/disable toggle, uninstall, errored badge
- [x] 4.3 i18n: `plugins.*` keys in `en.json` and `pt-BR.json`; `resolveLocalizedText` helper

## 5. Host integration of contributions

- [x] 5.1 Export flow (`pages/modelExplorer`): plugin exporters listed alongside built-in
      formats; handler receives read-only `DiagramSnapshot`; result through existing
      download/zip flow
- [x] 5.2 Import flow (`pages/ImportModal.tsx`): plugin importers as dynamic tabs (extensions +
      `canImport` sniffing); `ImportResult` normalized and committed via store actions with
      `pushHistory`; warnings surfaced
- [x] 5.3 `PluginPanelSlot` (error boundary + `PluginPanelContext` with `updateComponent` /
      `updateService` through slices): mounted in ElementPanel (`element-inspector`) and
      Service Registry import area (`service-registry-import`)

## 6. Example plugin + verification

- [x] 6.1 `examples/plugins/structura-plugin-mermaid-import.js` exercising manifest, importer
      registration, `ImportContext` dedupe, warnings
- [x] 6.2 Full verification: typecheck, lint (0 errors; all warnings pre-existing), 292 tests,
      and production build green. The end-to-end pass (install the real example plugin file,
      import a `.mmd` file with dedupe + warnings, single undo reverts, disable/uninstall cleans
      registries) is automated in `src/features/plugins/example-plugin.e2e.test.ts`; a browser
      click-through was not performed in this session

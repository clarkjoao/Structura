## 1. Glossary and spec housekeeping

- [ ] 1.1 In `docs/grammar/glossary.md`, change the `Service Catalog` entry's `Aliases` from `serviceRegistry` (proposed) to `serviceRegistry` (deprecated), and remove the entry from Appendix A's "proposed" column to "shipped" (or remove the row, depending on Appendix style). The renaming roadmap entry now reads "shipped" rather than "proposed".
- [ ] 1.2 In `docs/concepts/core-concepts.md`, drop the "Naming note" caveat block under the Service (catalog) section.
- [ ] 1.3 In `docs/architecture/vision.md` and `docs/architecture/roadmap-analysis.md`, search for the literal string "service registry" / "Service Registry" / "registry of services" in narrative paragraphs and update to "service catalog" / "Service Catalog". Leave file paths and code identifiers intact.

## 2. State, store, and persistence migration

- [ ] 2.1 In `features/diagram/store/store.types.ts`, rename the `AppState` field `serviceRegistry: Record<string, ServiceDefinition>` to `serviceCatalog: Record<string, ServiceDefinition>`. Add a `serviceRegistry?: never` deprecation comment if TypeScript allows; otherwise leave the runtime check at the migration step.
- [ ] 2.2 In `features/diagram/store/persist.config.ts`, bump `PERSIST_SCHEMA_VERSION` from 7 to 8. Add `migrateServiceRegistryToServiceCatalog(state)` that does `state.serviceCatalog ??= state.serviceRegistry ?? {}; delete state.serviceRegistry;`. Add the call after `migrateProcessNodeTypeToProcessNode` in `mergePersistedState`.
- [ ] 2.3 In `features/diagram/store/persist.config.ts`, update `partializeState` to read `state.serviceCatalog` instead of `state.serviceRegistry`. The persisted JSON shape from v8 onwards no longer contains a `serviceRegistry` key.
- [ ] 2.4 In `features/diagram/store/diagram.store.ts`, rename the `useRegistryActions` hook to `useCatalogActions`. Add a deprecated alias `useRegistryActions = useCatalogActions` re-exported from `features/diagram` with a JSDoc `@deprecated` tag pointing at the new name.
- [ ] 2.5 If `createDiagramStore` (the test initializer) seeds the state with a `serviceRegistry` field, update it to `serviceCatalog`. If the seed is keyed off `state.serviceRegistry` anywhere else, update.

## 3. Selectors and feature barrel

- [ ] 3.1 In `features/diagram/store/selectors/registry.selectors.ts`, rename the file to `catalog.selectors.ts` via `git mv` (preserves history). Inside, rename `useServiceRegistry` to `useServiceCatalog`. Keep `useAllServices`, `useService`, `useServiceIds` unchanged.
- [ ] 3.2 In `features/diagram/index.ts`, update the re-export path from `./store/selectors/registry.selectors` to `./store/selectors/catalog.selectors`. Add a deprecated re-export `useServiceRegistry` from the new file (or from a tiny shim) so external code keeps compiling.
- [ ] 3.3 In `features/diagram/index.ts`, update the re-export of `useRegistryActions` to also export `useCatalogActions`. Keep the deprecated alias.

## 4. Page folder move

- [ ] 4.1 `git mv src/pages/serviceRegistry/ src/pages/serviceCatalog/`. Verify history with `git log --follow`.
- [ ] 4.2 Inside the folder, rename `registryLabels.ts` to `catalogLabels.ts` and `registry.constants.ts` to `catalog.constants.ts`. Update their internal references (the constant `REGISTRY_` prefixes can stay or be renamed; either way the file is what counts for navigation).
- [ ] 4.3 Rename the default export `ServiceRegistryPage` to `ServiceCatalogPage`. Update all internal references.
- [ ] 4.4 In `src/App.tsx`, update the lazy import and JSX usage. The route `/catalog` is unchanged.

## 5. i18n

- [ ] 5.1 In `src/infrastructure/i18n/locales/en.json` and `pt-BR.json`, rename the keys listed in `design.md` § i18n. Keep a deprecated alias entry under each renamed key (e.g. both `nav.services` and `nav.registry` resolve to "Services" in `en.json`) for at least one release. Update string values from "Registry" / "Registry of …" to "Services" / "Services — …".
- [ ] 5.2 In `src/infrastructure/i18n/locales/en.json` and `pt-BR.json`, audit any other `*Registry*` or `*registry*` substring in user-facing values and update wording. Do not change the keys where the alias relationship is the only thing keeping them around; let the deprecated aliases carry the same value.

## 6. Tests

- [ ] 6.1 Update `findComponentsByServiceId.test.ts` and any other test that builds a fixture with a `serviceRegistry` key: rename the field.
- [ ] 6.2 Add a unit test in `src/features/diagram/store/persist.config.test.ts` (or co-locate with `persist.config.ts`) covering the v7 → v8 migration: load a v7 fixture with `serviceRegistry`, assert migrated to `serviceCatalog`, original key absent, values intact. Add an idempotency test: load an already-v8 fixture, assert no double-rename.
- [ ] 6.3 Update or remove any test that imports `useRegistryActions` / `useServiceRegistry` to use the new names. Deprecated-alias smoke test optional (a single import-and-call is enough).

## 7. Plugin surface

- [ ] 7.1 In `src/features/plugins/components/PluginPanelSlot.tsx`, the panel-slot id `service-registry-import` stays as a string. Only update the user-facing label that the slot displays (now reads from `services.*` keys).
- [ ] 7.2 In `src/features/plugins/plugin.types.ts` and `plugin-api.ts`, scan for the English phrases "service registry" / "Service Registry" in docstrings, JSDoc, and serialized type alias names. Update prose to "service catalog" / "Service Catalog". Do not change capability identifiers or version strings.

## 8. Verification

- [ ] 8.1 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [ ] 8.2 Manually load a workspace saved at v6, confirm the catalog page renders with the previous services and the navigation shows "Services" (not "Registry"). Save the workspace, reload, confirm the persisted state has `serviceCatalog` only and no `serviceRegistry` key.
- [ ] 8.3 Manually load a workspace saved at v8 to confirm idempotency: the v8 state must remain unchanged after a save/reload cycle.
- [ ] 8.4 Spot-check `/catalog` URL works, the GitHub and DefectDojo import flows still pre-fill the service form, and the "No services yet." empty state renders (instead of the old "No services in the registry yet.").

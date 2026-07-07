## Why

Structura exposes a workspace-level catalog of production services (real systems, microservices, jobs that run in production) and links diagram Components to entries in that catalog. The conceptual name for this collection is **Service Catalog** — it is the single source of truth for cross-diagram service identity, and the strongest existing form of identity the product has today. The persisted store field, the page component, the action hook, and (most visibly) the navigation entry are all named `Registry` instead. The word "registry" in Structura already means at least six different things — plugin registry, node-type registry, panel registry, IO registry, import registry, service registry — so the name has lost semantic force. Meanwhile `lib/catalogs/` is the established term for AWS/GCP/Azure icon packs, and the URL of the corresponding page is already `/catalog`. This change aligns the public name (state, hook, i18n, page component) with the glossary's `Service Catalog` entry and removes the name collision with the other "registries" in the codebase.

## What Changes

- **Persisted state**: `state.serviceRegistry` is renamed to `state.serviceCatalog`. A forward-only migration in `persist.config.ts` copies the data across under a bumped `PERSIST_SCHEMA_VERSION` 7 → 8. Workspaces on v6 or v7 load and migrate without data loss.
- **Hook**: `useRegistryActions()` is renamed to `useCatalogActions()`. The legacy name remains as a deprecated alias that delegates to the new one for at least one release.
- **Selectors**: `useServiceRegistry()` is renamed to `useServiceCatalog()`. Alias kept. The other selectors (`useAllServices`, `useService`, `useServiceIds`) keep their names because they are about services, not about the catalog itself.
- **Page component**: `src/pages/serviceRegistry/` is renamed to `src/pages/serviceCatalog/`. The default export `ServiceRegistryPage` is renamed to `ServiceCatalogPage`. The lazy import in `App.tsx` is updated; the URL `/catalog` stays unchanged.
- **i18n**: every user-facing `registry` / `Registry` string in `en.json` and `pt-BR.json` is renamed to `services` / `Services`. The two locale files are the only place where the user-facing label changes. Affected namespaces include `nav.registry`, `pages.registry.*`, `dashboard.sectionRegistry`, `dashboard.viewAllRegistry`, `elementPicker.registry`, `elementPicker.viewAllRegistry`, `elementPicker.searchPlaceholder`, `elementPicker.searchPlaceholderUnified`, `elementPicker.registryEmpty`, `elementPicker.openRegistry`, and the root `registry.*` namespace. Legacy keys remain as deprecated aliases that resolve to the same values, so external plugin panels reading the i18n catalog still work.
- **No entity rename**: `ServiceDefinition` (the type of a single entry) keeps its name. `registryServiceId` (the cross-reference field on `Component`) is **not** part of this change — see Non-Goals.

## Capabilities

### New Capabilities

_None — the change touches an existing concept that the plugin-system spec already covers in passing._

### Modified Capabilities

- `plugin-system`: the registry of plugin-contributed UI panels mentions `service-registry-import` as a panel-slot id. That id is not changed (it is a stable contract for plugin authors), but the user-facing label associated with the slot is updated to "Services".

## Impact

- **Domain (`features/diagram`)**:
  - `store/store.types.ts`: `serviceRegistry` field renamed to `serviceCatalog`.
  - `store/diagram.store.ts`: `useRegistryActions` renamed to `useCatalogActions`; the `createDiagramStore` initializer (used by tests) updated.
  - `store/selectors/registry.selectors.ts`: file renamed to `catalog.selectors.ts`; exports `useServiceCatalog` (new) and `useServiceRegistry` (deprecated alias).
  - `store/persist.config.ts`: bump `PERSIST_SCHEMA_VERSION` 7 → 8; add `migrateServiceRegistryToServiceCatalog`; update the `partializeState` field name and the `mergePersistedState` bootstrap.
  - `index.ts` of the feature: re-export the new names; keep the old names as deprecated re-exports.
- **Page (`src/pages/`)**:
  - Move `src/pages/serviceRegistry/` → `src/pages/serviceCatalog/`.
  - Default export `ServiceRegistryPage` → `ServiceCatalogPage`. `ServiceCard` and `DetailPanel` keep their names (they describe the entity, not the catalog).
  - `src/App.tsx`: lazy import and JSX usage updated; the route `/catalog` stays.
- **i18n**:
  - `en.json` and `pt-BR.json`: rename keys `nav.registry` → `nav.services`, `pages.registry.*` → `pages.services.*`, `registry.*` → `services.*`, and the loose `*Registry*` / `*registry*` keys in `dashboard.*` and `elementPicker.*`. Each renamed key keeps a deprecated alias pointing at the same value for at least one release.
  - `findComponentsByServiceId` and other utils keep their names (they reference the entity, not the catalog).
- **Plugins**:
  - `src/features/plugins/components/PluginPanelSlot.tsx`: panel-slot id `service-registry-import` is preserved as a stable string; the displayed label reads from the new `services.*` keys.
  - `src/features/plugins/plugin.types.ts` and `plugin-api.ts`: if any docstring, type alias, or capability string mentions "service registry" in user-facing English, it is updated to "service catalog" / "Services". Capability identifiers and serialized plugin contracts are unchanged.
- **Tests**:
  - `findComponentsByServiceId.test.ts` and any other test that names a registry-shaped fixture: update field name in fixtures.
  - Selector tests, if any: use the new hook name.
- **Docs**:
  - `docs/grammar/glossary.md`: this change moves `serviceRegistry` from `proposed` to `deprecated` and adds a one-line note about the migration in the rename roadmap appendix.
  - `docs/concepts/core-concepts.md`: drop the "naming note" caveat on the Service (catalog) section.
  - `docs/architecture/vision.md` and `docs/architecture/roadmap-analysis.md`: any reference to "service registry" in narrative text is updated to "service catalog". Code references and file paths are left intact (they will be replaced in the implementation commit).
- **Persistence semantics**:
  - Old workspaces: `state.serviceRegistry` keys are copied to `state.serviceCatalog`; the old key is dropped from the persisted state. No data loss.
  - New workspaces: the in-memory initial state is `serviceCatalog: {}` (or seed data); the field is excluded from the partialize output if empty, matching today's behavior for `serviceRegistry`.

## Non-Goals

- Not renaming `ServiceDefinition` (the type of a single entry). The entity is still "Service"; the change is about the _catalog that holds services_. If we ever want to rename the entity itself (e.g. to `ProductionUnit` to disambiguate from C4 "Service"), that is a separate spec.
- Not touching `Component.registryServiceId`. The field has live consumers (plugin snapshots, custom-component template instancing) and unifying it with `serviceId` is a separate, later change. See the rename-roadmap appendix in the glossary.
- Not changing the URL `/catalog`. The route is the only place where the user-facing product already says "Catalog"; renaming it to `/services` would be a breaking change for bookmarks without payoff.
- Not migrating plugin manifests or external plugin code. Plugin authors who read `state.serviceRegistry` directly (without going through the `StructuraPlugin` API) will see a hard failure on the next plugin-system version and will need to update — but that path is already discouraged by the plugin-system spec.
- Not refactoring the `services` slice itself. The slice, the linked-component reconciliation, and the integration with GitHub/DefectDojo are out of scope; only the names change.
- Not introducing a new entity. This is a rename, not a model change.

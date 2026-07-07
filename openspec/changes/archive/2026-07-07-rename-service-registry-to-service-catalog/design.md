# Design — rename service registry to service catalog

## Scope boundary

The change is **a rename**, not a refactor. The slice logic in
`services.slice.ts`, the linked-component reconciliation
(`syncLinkedComponentsFromRegistry`), the integration with GitHub and
DefectDojo, and the per-Component `serviceId` / `registryServiceId` fields
are all out of scope. The change touches only:

1. The state field name (`serviceRegistry` → `serviceCatalog`).
2. The hook name (`useRegistryActions` → `useCatalogActions`).
3. The selector name (`useServiceRegistry` → `useServiceCatalog`).
4. The page folder, default export, and lazy-import binding.
5. The i18n key names that produce user-facing English (the underlying
   values also change from "Registry" to "Services").
6. The persisted JSON shape under a bumped schema version.

The single decision that was not obvious: what to call the user-facing
page label. We chose "Services" (matching the entity name and the
existing `nav.services` for journeys) rather than "Service Catalog" or
"Catalog". The URL stays `/catalog`; the navigation entry stays
"Services"; the page component is `ServiceCatalogPage`. This is the
glossary's split: catalog is the conceptual collection, Services is the
user-facing label.

## Persistence migration

Schema version 7 → 8. The migration function
`migrateServiceRegistryToServiceCatalog` does the following on the
state object loaded by `mergePersistedState`:

```
state.serviceCatalog ??= state.serviceRegistry ?? {};
delete state.serviceRegistry;
```

This is purely a rename of the dictionary key. The values inside
(`ServiceDefinition` objects) are unchanged, so any consumer that
deserializes a service and re-emits it through the same slice is
unaffected.

The migration is idempotent: if `serviceCatalog` already exists (e.g. a
workspace saved at v8 is re-read at v8), the right-hand side is
short-circuited, and the `delete` of `serviceRegistry` is a no-op.

`partializeState` is updated to read `state.serviceCatalog` (the field
that exists post-migration). The v8-onwards JSON shape therefore no
longer contains a `serviceRegistry` key. The migration is the only
place where both names appear together.

## Hook and selector rename

`useRegistryActions` becomes `useCatalogActions`. Both names are
exported from `features/diagram` for at least one release:

```ts
// new
export const useCatalogActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
    })),
  );

// deprecated alias — to be removed in a future major
/** @deprecated Use `useCatalogActions`. */
export const useRegistryActions = useCatalogActions;
```

Same pattern for `useServiceRegistry` → `useServiceCatalog`. The
internal selector file is renamed `registry.selectors.ts` →
`catalog.selectors.ts`, and the deprecated alias is re-exported from
`features/diagram` so existing imports keep compiling.

## Page component

`src/pages/serviceRegistry/` is moved to `src/pages/serviceCatalog/`
via `git mv` (preserves rename history in git). The default export is
renamed `ServiceRegistryPage` → `ServiceCatalogPage`. Subcomponents
inside the folder (`ServiceCard`, `DetailPanel`, `ManualCreateForm`,
`findComponentsByServiceId`, `serviceUsage`, `registryLabels`,
`registry.constants`) are renamed where the name contains
"Registry":

- `registryLabels.ts` → `catalogLabels.ts`
- `registry.constants.ts` → `catalog.constants.ts`
- `findComponentsByServiceId.{ts,test.ts}` keep their name (they are
  about services, not the catalog)
- `ServiceCard`, `DetailPanel`, `ManualCreateForm` keep their names
  (they describe the entity)

`App.tsx`:

```diff
- const ServiceRegistry = lazy(() => import("@/pages/serviceRegistry"));
+ const ServiceCatalog = lazy(() => import("@/pages/serviceCatalog"));
  ...
- <Route path="/catalog" element={<ServiceRegistry />} />
+ <Route path="/catalog" element={<ServiceCatalog />} />
```

The URL `/catalog` is unchanged.

## i18n

The two locale files (`en.json`, `pt-BR.json`) are updated together.
The renames in each file are:

| Old key                                  | New key                         | en value                                      | pt-BR value                                    |
| ---------------------------------------- | ------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `nav.registry`                           | `nav.services`                  | "Services"                                    | "Serviços"                                     |
| `nav.journeys` (unchanged)               | —                               | "Journeys"                                    | "Jornadas"                                     |
| `pages.registry.title`                   | `pages.services.title`          | "Services"                                    | "Serviços"                                     |
| `pages.registry.subtitle`                | `pages.services.subtitle`       | "Catalog of…"                                 | "Catálogo de…"                                 |
| `pages.registry.*` (other)               | `pages.services.*`              | (mirror)                                      | (mirror)                                       |
| `registry.title` (root)                  | `services.title` (root)         | "Services"                                    | "Serviços"                                     |
| `registry.*` (root, other)               | `services.*` (root)             | (mirror)                                      | (mirror)                                       |
| `dashboard.sectionRegistry`              | `dashboard.sectionServices`     | "Services"                                    | "Serviços"                                     |
| `dashboard.viewAllRegistry`              | `dashboard.viewAllServices`     | "View all in Services"                        | "Ver todos em Serviços"                        |
| `dashboard.registry`                     | `dashboard.services`            | "Services"                                    | "Serviços"                                     |
| `elementPicker.viewAllRegistry`          | `elementPicker.viewAllServices` | "View all in Services"                        | "Ver todos em Serviços"                        |
| `elementPicker.registry`                 | `elementPicker.services`        | "Services"                                    | "Serviços"                                     |
| `elementPicker.searchPlaceholder`        | (string update only)            | "Search elements and services..."             | "Buscar elementos e serviços..."               |
| `elementPicker.searchPlaceholderUnified` | (string update only)            | "Search elements, AWS, GCP, Azure, services…" | "Buscar elementos, AWS, GCP, Azure, serviços…" |
| `elementPicker.registryEmpty`            | `elementPicker.servicesEmpty`   | "No services yet."                            | "Nenhum serviço ainda."                        |
| `elementPicker.openRegistry`             | `elementPicker.openServices`    | "Open services"                               | "Abrir serviços"                               |

The deprecated aliases stay in the locale files for at least one
release:

```json
{
  "nav": {
    "services": "Services",
    "registry": "Services"
  }
}
```

i18next `t()` resolves both keys to the same string, so any code that
still reads `t("nav.registry")` keeps working with no behavior change.

## File path conventions

The state field and the hook are renames; the persistence field name
in the JSON store is renamed via migration. No URL changes. No
breaking change for the persisted file other than the renamed key
(which is migrated on read). The plugin-system contract is unchanged
(`service-registry-import` panel-slot id stays as a string).

## Verification

A workspace saved at v6 (or v7) and reopened at v8 should:

1. Migrate `serviceRegistry` → `serviceCatalog` transparently on load.
2. Render the Service Catalog page at `/catalog` with all entries
   intact.
3. Show "Services" in the navigation entry (instead of "Registry").
4. Show "No services yet." (instead of "No services in the registry
   yet.") when the catalog is empty.
5. Continue to use `addService`, `updateService`, `removeService`,
   `linkComponentToService` from `useCatalogActions` (and from the
   deprecated `useRegistryActions` for at least one release).
6. Round-trip cleanly: save at v8, reload, find no `serviceRegistry`
   key in the persisted state and the entries still in
   `serviceCatalog`.

The unit test for the migration asserts all six properties on a v6
fixture, an empty v7 fixture, and an already-v8 fixture (idempotency).

## Open question

Should `useCatalogActions` and `useServiceCatalog` (new) be exported
from the diagram barrel with the deprecated aliases at the same time,
or should the deprecated aliases live in a `compat` subpath? The
proposal assumes the same barrel; if the maintainer prefers
`@/features/diagram/compat` to keep the public surface lean, that is a
small refactor in the implementation step.

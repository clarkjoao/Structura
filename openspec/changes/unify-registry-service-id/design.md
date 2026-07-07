# Design — unify Component.serviceId and registryServiceId

## Scope boundary

The change is a **field unification** on `Component`. The fix is
mechanical: the two fields become one. The persisted state is
migrated forward. No new entity, no new model concept.

## Type change

`Component` (in `features/diagram/model/component.types.ts`):

```diff
  interface BaseComponent {
    id: string;
    name: string;
    ...
-   serviceId?: string;
+   serviceId?: string;
    linkedDiagramId?: string;
-   registryServiceId?: string;
    ...
  }
```

`registryServiceId` is removed. The same edit propagates to
`ComponentPatch` and `TypedComponentPatch` (where it was a member
of the union).

`UserTemplate` (in `features/custom-components/types.ts`):

```diff
  interface CustomComponentTemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    createdAt: number;
-   registryServiceId?: string;
+   serviceId?: string;
    data: Record<string, unknown>;
  }
```

The custom-component template shape gains a single canonical
`serviceId` field. The fix is in lockstep with the Component
fix so the template instancing path is also unified.

## Migration

`persist.config.ts` adds:

```ts
function migrateUnifyRegistryServiceId(state: Partial<DiagramStore>): void {
  const migrate = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      const ext = comp as unknown as Record<string, unknown>;
      const legacy = ext.registryServiceId;
      if (typeof legacy === "string" && legacy.length > 0) {
        if (ext.serviceId === undefined || ext.serviceId === "") {
          ext.serviceId = legacy;
        }
        delete ext.registryServiceId;
      } else {
        delete ext.registryServiceId;
      }
    }
  };
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrate(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrate(scene.addedComponents);
    }
  }
}
```

The migration is idempotent: an already-v11 state has no
`registryServiceId` field, so the `delete` is a no-op and the
`if (typeof legacy === "string")` body is short-circuited.

`PERSIST_SCHEMA_VERSION` bumps 10 → 11. The walkthroughs store
does not need a bump because it doesn't carry `Component` records.

## Consumer updates

- `services.slice.ts:removeService`: only the canonical
  `comp.serviceId` field is checked and deleted.
- `services.slice.ts:linkComponentToService`: continues to read/write
  `comp.serviceId`. The bug it had (missing the
  `registryServiceId` value) is structurally impossible.
- `plugins/snapshots.ts:toComponentSnapshot`: `serviceId: component.serviceId ?? null`.
  The `?? component.registryServiceId` fallback is removed.
- `custom-components/utils/custom-component-template.utils.ts`:
  `createTemplateDataFromNode` reads `domainComponent.serviceId`
  directly. `buildComponentPatchFromTemplate` writes
  `patch.serviceId` directly. The `delete patch.registryServiceId`
  line is gone.
- `custom-components/hooks/useCustomComponentLibrary.ts`: the filter
  checks `template.serviceId` against the service registry.
- `Canvas.tsx`: any code that writes the unified field from
  template data uses `serviceId`.
- `fixtures/seeds/urlshort-example.ts`: any Component that has
  `registryServiceId: "svc-..."` is rewritten to `serviceId: "svc-..."`.

## Type guards

No change. `isExternalElementComponent`, `isPanelComponent`, etc.
narrow on `type`, not on the field name. The bug is at the
mutation site, not at the read site.

## Verification

A workspace saved at v10 and reopened at v11 should:

1. Migrate every Component with `registryServiceId` to have the
   same value in `serviceId` (if `serviceId` is empty), then drop
   `registryServiceId`.
2. Round-trip cleanly: save at v11, reload, find no
   `registryServiceId` field on any Component.
3. The cross-diagram identity that depended on the legacy field
   (the serviceRegistry linkage via `linkComponentToService`)
   continues to work — and now works correctly for Components
   that were created via the custom-component template instancing
   path, which used to silently lose the link.

The unit test asserts all three properties on a v10 fixture with
mixed `serviceId` / `registryServiceId` / both / neither
combinations, an empty v11 fixture, and an already-v11 fixture
(idempotency).

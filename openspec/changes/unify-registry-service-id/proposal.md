## Why

`Component` has two fields that both reference a `Service` in the
catalog:

- `Component.serviceId` — the canonical "this Component is linked
  to a Service" reference. Used by `services.slice.ts` for the
  link/unlink actions, for the linked-component reconciliation
  (`syncLinkedComponentsFromRegistry`), and for cross-diagram
  identity.
- `Component.registryServiceId` — a legacy field that the custom-
  component template instancing path uses to pre-fill the link
  when a `UserTemplate` (with a `registryServiceId`) is dropped
  onto the canvas. `plugins/snapshots.ts` also reads it as the
  preferred source for the plugin-side service id.

The two fields have the same intent and the same shape. They exist
in parallel only because `UserTemplate.registryServiceId` was
introduced before the canvas template instancing path was
rewritten to use `serviceId`. The result is a real bug:

- `services.slice.ts:linkComponentToService` reads `comp.serviceId`.
  If a Component was created via template with `registryServiceId`
  set (Canvas.tsx writes that field), the link action does **not**
  see the value, and the user has to re-link manually.
- `plugins/snapshots.ts` prefers `registryServiceId` over
  `serviceId`, so plugin authors see a different service id than
  the user does.
- The `custom-component-template.utils.ts` builder explicitly
  copies `template.registryServiceId` into `patch.serviceId` and
  then deletes `patch.registryServiceId` — confirming that the two
  fields carry the same information.

This change unifies them: `serviceId` becomes the single canonical
field, `registryServiceId` is removed from `Component`. The bug is
fixed and the field is no longer overloaded.

The fix is mechanical but touches several files because the
template instancing path writes `registryServiceId` directly. The
persisted state has `registryServiceId` values that need to be
migrated forward.

## What Changes

- `Component.registryServiceId` is removed. The `ComponentPatch` and
  `TypedComponentPatch` unions no longer mention it.
- `Component.serviceId` becomes the only field that points to a
  Service in the catalog. Its semantics are unchanged.
- `UserTemplate.registryServiceId` is renamed to `serviceId` in the
  template shape; the custom-component builder reads and writes the
  canonical field directly. (See note below on whether to do this
  in lockstep.)
- `services.slice.ts:linkComponentToService` continues to read/write
  `comp.serviceId`. The bug it had is now structurally impossible:
  there is no second field to disagree.
- `plugins/snapshots.ts` reads `component.serviceId` directly.
- The forward-only migration in `persist.config.ts` reads any
  `registryServiceId` value on a Component, copies it to
  `serviceId` if `serviceId` is empty, then deletes the old
  field. Bumps `PERSIST_SCHEMA_VERSION` 10 → 11. Idempotent.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `plugin-system`: the snapshot shape returned by plugin API
  exposes `serviceId` only. The legacy `registryServiceId` field
  is gone from the persisted state. Plugin authors who read
  `component.registryServiceId` directly will need to update to
  `component.serviceId`.

## Impact

- **Domain (`features/diagram`)**:
  - `model/component.types.ts`: `BaseComponent` and all variant
    interfaces lose the `registryServiceId?: string` field.
    `ComponentPatch` and `TypedComponentPatch` lose their `registryServiceId`
    member.
  - `store/slices/services.slice.ts`: `removeService` deletes only
    `comp.serviceId` (the only field). The serviceId-setter path is
    unchanged.
  - `store/persist.config.ts`: bump `PERSIST_SCHEMA_VERSION` 10 → 11.
    Add `migrateUnifyRegistryServiceId` that walks every
    `Diagram.snapshot.components` and `SceneDiff.addedComponents`,
    copies `registryServiceId` to `serviceId` if `serviceId` is
    empty, and deletes `registryServiceId`. Idempotent.
  - `index.ts` of the feature: no new exports; the public API is
    shape-compatible.
- **Custom components (`features/custom-components`)**:
  - `types.ts`: `CustomComponentTemplate.registryServiceId` is renamed
    to `serviceId`.
  - `utils/custom-component-template.utils.ts`: `createTemplateDataFromNode`
    and `buildComponentPatchFromTemplate` operate on the unified
    `serviceId` field. The `delete patch.registryServiceId` line
    goes away.
  - `hooks/useCustomComponentLibrary.ts`: the filter that checks
    `template.registryServiceId` against the service registry uses
    the unified field name.
- **Canvas**:
  - `Canvas.tsx`: any code that writes `registryServiceId` from
    template data now writes `serviceId` (the template shape has
    been unified).
- **Fixtures**:
  - `fixtures/seeds/urlshort-example.ts`: any Component with
    `registryServiceId: "svc-..."` becomes `serviceId: "svc-..."`.
- **Plugins**:
  - `features/plugins/snapshots.ts`: `toComponentSnapshot` reads
    `component.serviceId` directly. The `registryServiceId ?? serviceId`
    fallback is gone.

## Non-Goals

- Not changing the `ServiceDefinition` type or the Service Catalog
  data model. The fix is at the Component level.
- Not removing the `ServiceDefinition.sources` field (the migration
  for `source` → `sources` was a separate, earlier change).
- Not changing the public URL `/catalog` or the page component.
- Not changing the editor for Component properties; the inspector
  panels already use `serviceId`.
- Not introducing a new entity. This is a unification, not a model
  change.

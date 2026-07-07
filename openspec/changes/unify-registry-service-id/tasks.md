## 1. Glossary and spec housekeeping

- [ ] 1.1 In `docs/grammar/glossary.md`, Appendix A: the row that proposed removing `registryServiceId` is corrected: the field was live (used by plugin snapshots and custom-component template instancing) and is now unified with `serviceId` instead of removed. Update the entry to "shipped (PERSIST_SCHEMA_VERSION 11)" with a note that this is a unification, not a removal.

## 2. Type and field changes

- [ ] 2.1 In `features/diagram/model/component.types.ts`, remove `registryServiceId?: string` from `BaseComponent`. Update `ComponentPatch` and `TypedComponentPatch` to drop the `registryServiceId` member.
- [ ] 2.2 In `features/custom-components/types.ts`, rename `CustomComponentTemplate.registryServiceId` to `serviceId`.
- [ ] 2.3 In `features/diagram/store/slices/services.slice.ts`, `removeService` only checks/deletes `comp.serviceId` (the unified field). `linkComponentToService` is unchanged.

## 3. Persistence migration

- [ ] 3.1 In `features/diagram/store/persist.config.ts`, bump `PERSIST_SCHEMA_VERSION` 10 → 11. Add `migrateUnifyRegistryServiceId(state)` that walks every `Diagram.snapshot.components` and `SceneDiff.addedComponents`, copies `registryServiceId` to `serviceId` if `serviceId` is empty, and deletes `registryServiceId`. Idempotent. Add the call after `migrateExternalElementLinkedDiagramId` in `mergePersistedState`.

## 4. Consumer updates

- [ ] 4.1 `features/plugins/snapshots.ts:toComponentSnapshot`: `serviceId: component.serviceId ?? null`. Remove the `?? component.registryServiceId` fallback.
- [ ] 4.2 `features/custom-components/utils/custom-component-template.utils.ts`: `createTemplateDataFromNode` reads `domainComponent.serviceId` directly. `buildComponentPatchFromTemplate` writes `patch.serviceId` directly. The `delete patch.registryServiceId` line is gone. The `ALLOWED_COMPONENT_PATCH_KEYS` allowlist drops `registryServiceId` (since the field no longer exists on `Component`).
- [ ] 4.3 `features/custom-components/hooks/useCustomComponentLibrary.ts`: the filter checks `template.serviceId` against the service registry.
- [ ] 4.4 `src/features/canvas/Canvas.tsx`: any code that writes the unified field from template data uses `serviceId`.
- [ ] 4.5 `src/fixtures/seeds/urlshort-example.ts`: any Component that has `registryServiceId: "svc-..."` is rewritten to `serviceId: "svc-..."`.

## 5. Tests

- [ ] 5.1 Add a unit test for the v10 → v11 migration covering: Component with only `registryServiceId` (migrates to `serviceId`), Component with only `serviceId` (unchanged), Component with both (legacy dropped, `serviceId` kept), Component with neither (no-op). Add an idempotency test on an already-v11 fixture.
- [ ] 5.2 Add or update a regression test for `linkComponentToService` that simulates the bug: a Component created via template instancing with `registryServiceId` set should now be correctly linked via the unified `serviceId` field.

## 6. Verification

- [ ] 6.1 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [ ] 6.2 Manually load a workspace saved at v10 with at least one Component that has `registryServiceId` set, confirm the field is renamed and the value is preserved on `serviceId`. Save the workspace, reload, confirm the persisted state has no `registryServiceId` field.
- [ ] 6.3 Spot-check the previously-broken case: create a custom-component template with a `serviceId` (= old `registryServiceId`), drop it on the canvas, confirm the Component is now linked to the Service without a manual re-link.

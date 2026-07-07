## 1. Glossary and spec housekeeping

- [ ] 1.1 In `docs/grammar/glossary.md`, Appendix A row for `ExternalElementComponent.linkedDiagramId` → `referenceDiagramId` moves from `proposed` to `shipped (PERSIST_SCHEMA_VERSION 10)`.

## 2. Type and field rename

- [ ] 2.1 In `features/diagram/model/component.types.ts`, rename the `linkedDiagramId` field on `ExternalElementComponent` to `referenceDiagramId`. Update the JSDoc on the field if any. `BaseComponent.linkedDiagramId` is unchanged.

## 3. Persistence migration

- [ ] 3.1 In `features/diagram/store/persist.config.ts`, bump `PERSIST_SCHEMA_VERSION` 9 → 10. Add `migrateExternalElementLinkedDiagramId(state)` that walks `state.diagrams[*].snapshot.components` and `state.diagrams[*].scenes[*].addedComponents`, copies `linkedDiagramId` into `referenceDiagramId` for any `ExternalElementComponent`, and deletes the old field. Idempotent: an already-v10 state is a no-op. Add the call after `migrateServiceRegistryToServiceCatalog` in `mergePersistedState`.

## 4. Consumer updates

- [ ] 4.1 `features/diagram/store/slices/services.slice.ts`: in `linkComponentToDiagram`, write `referenceDiagramId` after narrowing to `ExternalElementComponent`.
- [ ] 4.2 `features/diagram/utils/import-mermaid-flowchart.ts` and `import-mermaid-sequence.ts`: any construction of an `ExternalElementComponent` writes the new field.
- [ ] 4.3 `features/diagram/utils/normalize-imported-diagram.ts`: any reconstruction logic uses the new field.
- [ ] 4.4 `features/canvas/hooks/useCanvasGraphState.ts`, `useCanvasDiagramNavigation.ts`, `features/canvas/Canvas.tsx`, `features/canvas/nodes/useCanvasNodes.ts`: any read of `linkedDiagramId` is type-narrowed first; for `ExternalElementComponent` instances the field is `referenceDiagramId`.
- [ ] 4.5 `lib/export-service/import-drawio.ts` and `export-drawio.ts`: the draw.io mapper for external elements reads/writes the new field.
- [ ] 4.6 `features/canvas/panels/ElementPanel/ComponentPanel.tsx` and `panels/JourneysInDiagramPanel.tsx`: any inspector panel that surfaces the external-element link field uses the new name.

## 5. Tests

- [ ] 5.1 Add a unit test for the v9 → v10 migration: load a v9 fixture with an `ExternalElementComponent` carrying `linkedDiagramId`, assert the migrated state has `referenceDiagramId` with the same value and the old field is absent. Add an idempotency test: load an already-v10 fixture, assert no double-rename.
- [ ] 5.2 Update or remove any test that constructs an `ExternalElementComponent` with `linkedDiagramId` to use `referenceDiagramId`.

## 6. Verification

- [ ] 6.1 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [ ] 6.2 Manually load a workspace saved at v9, confirm drill-up navigation still works (the new field is read), drill-down navigation still works (the old `BaseComponent.linkedDiagramId` is unaffected), and the persisted state has no `linkedDiagramId` field on any external-element component.
- [ ] 6.3 Manually load a workspace saved at v10 to confirm idempotency: the v10 state must remain unchanged after a save/reload cycle.

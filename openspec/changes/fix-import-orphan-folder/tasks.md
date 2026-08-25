## 1. Shared helper

- [x] 1.1 Create `src/features/diagram/store/helpers/reparent-orphan-diagram.ts` exporting
      `reparentOrphanDiagram(diagram: Diagram, folders: Record<string, Folder>): Diagram` —
      returns the same reference when nothing changes, otherwise a copy without `folderId`
- [x] 1.2 Export a `reparentOrphanDiagrams(diagrams, folders)` map variant for the migration and
      the boot path
- [x] 1.3 Unit tests: unknown folder → cleared; known folder → preserved (same reference);
      `undefined` / `null` → untouched; empty `folders` → all cleared

## 2. Store slice

- [x] 2.1 `diagram.slice.ts` — apply `reparentOrphanDiagram` inside `importDiagram` before writing
- [x] 2.2 `diagram.slice.ts` — apply it inside `addImportedDiagram` too (viewer / shared-diagram path)
- [x] 2.3 Test in `src/features/diagram/store/slices/` covering `importDiagram` with a folder id
      that is absent from the store

## 3. Persist migration

- [x] 3.1 `persist.config.ts` — add `migrateReparentOrphanDiagrams(state)` following the shape of
      `migrateUnifyRegistryServiceId`
- [x] 3.2 Wire it into `mergePersistedState`, where the v7–v11 migrations actually run
      (the `migrate` hook only carries the v5/v6 ones); it is idempotent, so it runs on every load
- [x] 3.3 Bump `PERSIST_SCHEMA_VERSION` 11 → 12
- [x] 3.4 Test: v11 state with an orphan → repaired; running twice → no-op

## 4. File System boot

- [x] 4.1 `fileSystemBoot.ts` — apply `reparentOrphanDiagrams` to `hydrated.diagrams` against
      `workspace.folders` in the `useDiagramStore.setState` at the fresh-load branch
- [x] 4.2 Check the reconnect / merge branches for the same hazard and apply where relevant

## 5. Import hook cleanup

- [x] 5.1 `useWorkspaceImport.ts` — drop `folderId` explicitly in `renameForImport` so the
      intent is readable at the call site (the store guard stays as the real enforcement)
- [x] 5.2 Confirm `moveDiagram(imported.id, targetFolderId)` still runs for folder-scoped imports

## 6. Verification

- [x] 6.1 `npm run typecheck && npm run lint && npm run test && npm run format:check`
- [ ] 6.2 Manual: export a diagram from a folder, delete the folder, re-import → diagram at root
- [ ] 6.3 Manual: import from inside a folder → diagram in that folder
- [ ] 6.4 Manual: hand-edit `localStorage["diagram-store"]` to point a diagram at a bogus folder,
      reload → diagram back at the root

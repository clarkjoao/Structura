## Why

Importing a diagram JSON that was exported from a folder makes the diagram disappear.

`useWorkspaceImport.finishImport` (`src/pages/useWorkspaceImport.ts:40`) keeps the `folderId`
carried inside the file, and `importDiagram` (`src/features/diagram/store/slices/diagram.slice.ts:56`)
stores it verbatim. The target workspace does not have that folder, so the diagram ends up
attached to a folder id that resolves to nothing: the dashboard filters with
`(d.folderId ?? null) === selectedFolderId` (`src/pages/dashboard/index.tsx:142`) and
`DiagramSidebar.getDiagramsInFolder` does the same (`src/features/canvas/navigation/DiagramSidebar.tsx:38`),
so the diagram renders neither at the root nor inside any folder. It is only visible right
after the import because `finishImport` navigates straight to `/model/:id`.

The same hazard exists for every other import path (`CollabRoom`, `CollabRoomToolbar`,
`SharedDiagramView` all call `importDiagram` / `addImportedDiagram`), and workspaces that
already imported such a file are stuck with invisible diagrams.

## What Changes

1. **Sanitize on write, in the store.** `validateDiagramFile` and `normalizeImportedDiagram` are
   pure and workspace-unaware; the store knows `state.folders`. `importDiagram` and
   `addImportedDiagram` drop a `folderId` that has no matching folder, dropping the diagram at
   the root. This covers all import paths at once.
2. **Shared pure helper** `reparentOrphanDiagram(diagram, folders)` so the slice, the persist
   migration, and the File System boot path all apply the same rule.
3. **Persist migration v12** (`PERSIST_SCHEMA_VERSION` 11 → 12) that reparents already-orphaned
   diagrams back to the root, rescuing workspaces that are broken today.
4. **File System boot** applies the same helper when it merges diagrams and folders read from
   separate files.

Importing *into* a folder is unaffected: `finishImport` already calls
`moveDiagram(imported.id, targetFolderId)` after the import when a target folder is given.

## Non-Goals

- Recreating the missing folder from the imported file. The file carries only a `folderId`
  string, not the folder record (name, parent chain), so there is nothing to recreate from.
- Exporting folder metadata inside the diagram JSON.
- Changing how the dashboard or the sidebar filter diagrams.
- Touching the workspace-level (multi-diagram) File System sync/merge semantics beyond applying
  the same orphan rule.

## Capabilities

### New Capabilities

- `diagram-import-folder-safety`: a diagram entering the store from an import always points at a
  folder that exists in the receiving workspace, or at the root. Covers the import actions, the
  persisted-state migration, and the File System boot hydration.

## Impact

- **Modified files**: `src/features/diagram/store/slices/diagram.slice.ts`,
  `src/features/diagram/store/persist.config.ts` (migration + version bump),
  `src/infrastructure/persistence/fileSystemBoot.ts`, `src/pages/useWorkspaceImport.ts`.
- **New files**: `src/features/diagram/store/helpers/reparent-orphan-diagram.ts` (+ test).
- **No new dependencies. No new i18n keys** — the diagram silently lands at the root, which is
  where the user expects an imported file to appear.
- **Persisted schema**: `PERSIST_SCHEMA_VERSION` 11 → 12.

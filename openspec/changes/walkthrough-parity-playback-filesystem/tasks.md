# Tasks

Groups land in order; each group leaves `npm run typecheck && npm run lint && npm run test`
green on its own. See `design.md — Migration Plan` for why this order.

## 1. Shared folder tree and filter toolbar

- [x] 1.1 Create `src/components/folders/FolderTree.tsx` from `src/pages/FolderTree.tsx`, taking `countFor(folderId)`, `onDropItem`, `dragMimeType` and `canDeleteFolder` as props instead of `diagrams`; verify by rendering it in a unit test with a stub `countFor` and asserting the count shown on a parent folder includes its descendants
- [x] 1.2 Move `/workspace` onto the shared tree, passing a `countFor` that wraps the existing `countAllDescendantDiagrams`; verify `npm run test` passes with the existing dashboard/workspace tests untouched
- [x] 1.3 Create `src/components/filters/LibraryFilterToolbar.tsx` from `WorkspaceFilterToolbar`, taking the chip set and the sort keys as props; verify by unit test that a caller-supplied sort key list renders and fires `onSort` with that key
- [x] 1.4 Move `/workspace` onto `LibraryFilterToolbar` and delete `src/pages/dashboard/WorkspaceFilterToolbar.tsx` and `src/pages/FolderTree.tsx`; verify `rg "pages/FolderTree|WorkspaceFilterToolbar" src` returns nothing and the workspace tests pass
- [x] 1.5 Move the walkthrough library onto both shared components and delete `src/features/walkthrough/components/WalkthroughFolderTree.tsx`; verify the library lists, selects folders and shows recursive counts, and that `rg "WalkthroughFolderTree" src` returns nothing

## 2. Walkthrough library parity

- [x] 2.1 Wire search, the all/recent chips, sort (name / last edited / scene count) and grid-list into `WalkthroughLibraryPage`, composing with the selected folder; verify by unit test that a term matching only a description lists that walkthrough, and that searching inside a selected folder does not list matches from other folders
- [x] 2.2 Add a list presentation for walkthroughs alongside the existing card grid; verify switching the view shows the same walkthroughs in both
- [x] 2.3 Add `src/features/walkthrough/favoriteWalkthroughs.ts` mirroring `favoriteDiagrams.ts`, a star on `WalkthroughCard`, and the favorites chip; verify by unit test that marking then reading back returns the id, and that diagram favorites do not affect the walkthrough listing
- [x] 2.4 Make walkthrough cards draggable onto folders via `onDropItem` with a walkthrough-specific `dragMimeType`; verify a dropped card changes `folderId` and that a dragged diagram is not accepted by the walkthrough tree
- [x] 2.5 Treat a `folderId` naming a missing folder as root in the library's listing and counts; verify by unit test that a walkthrough whose folder was deleted is listed under "All"

## 3. Viewer edge callbacks and the scene boundary

- [x] 3.1 Add `onReachedFlowEnd` / `onReachedFlowStart` to `ViewerCanvas` and make the forward key three-branch (advance / branch point does nothing / report the end); verify by test that forward at a branch point neither takes a branch nor fires `onReachedFlowEnd`, and that forward on the last step fires it exactly once
- [x] 3.2 Wire `onReachedFlowEnd` in `WalkthroughPlayerPage` to raise `SceneEndOverlay`, and give the overlay its own forward / back / dismiss keys; verify by test that forward on the last step of scene 1 raises the boundary and a second forward lands on scene 2 at its first step
- [x] 3.3 Have the boundary name the next scene, report "scene N of M", and on the last scene offer the library via `navigate` instead of `window.location.href`; verify by test that the last scene's boundary offers the library and that no full document load occurs
- [x] 3.4 Clear the diagram-transition `setTimeout` on unmount in `WalkthroughPlayerPage`; verify by test that unmounting before it expires produces no update warning
- [x] 3.5 Surface the skip-a-scene shortcut in the player footer, keeping `⌘`+arrow working; verify the footer names the shortcut and that it still jumps a whole scene from mid-flow

## 4. Sidecar persistence primitives

- [x] 4.1 Add `src/infrastructure/persistence/sidecarFiles.ts` with `SIDECAR_SUFFIXES` and `isSidecarFileName`, commented that the list must outlive the walkthrough feature; verify by unit test that `wt_1.walkthrough.json` matches and `d-abc.json` does not
- [x] 4.2 Make `_scanDirectory` and `_scanAllDiagrams` skip sidecar names before validating; verify by test that a scan of a directory holding one diagram and one walkthrough file finds the diagram and reports zero invalid files
- [x] 4.3 Extract `resolveFolderPathSegments(folderId, folders)` and refactor `resolveDiagramPathSegments` onto it; verify existing `FileSystemAdapter` tests pass and a nested folder id chain resolves identically
- [x] 4.4 Add `writeSidecar`, `deleteSidecarAtSegments` and `scanSidecars(suffix)` to `FileSystemAdapter`; verify by test that a written sidecar is found by `scanSidecars` with its path segments and disappears after delete

## 5. Generic sidecar sync engine

- [x] 5.1 Add `src/infrastructure/persistence/createSidecarSync.ts` with debounce, proactive `checkPermission`, and write/delete of changed items; verify by test that two rapid changes produce one write and that a permission failure writes nothing
- [x] 5.2 Add move detection (delete at old segments, write at new) to the engine; verify by test that changing an item's `folderId` leaves exactly one file, in the new directory
- [x] 5.3 Add the per-workspace synced-id set, persisted through `IStoragePort`; verify by test that the key is workspace-scoped and that ids accumulate across flushes
- [x] 5.4 Implement the three-case hydration reconciliation; verify by test, one per row of the table in `design.md`: on disk → adopt newer by `updatedAt`; absent and never synced here → written to disk; absent and previously synced here → deleted locally and **not** rewritten
- [x] 5.5 Verify the removability guarantee end to end: write items, delete the files outside the engine, hydrate, and assert the items are gone locally and no file reappears

## 6. Walkthrough file sync

- [x] 6.1 Add `src/features/walkthrough/model/walkthroughFile.ts` with the `kind` / `schemaVersion` envelope, `toFile` / `fromFile`, and a guard that rejects a wrong kind or a future version; verify by unit test that a round trip is lossless and a malformed file is rejected rather than throwing
- [x] 6.2 Add `src/features/walkthrough/persistence/walkthroughFileSync.ts` instantiating `createSidecarSync` against the walkthrough store, started when the module loads and only while a folder is connected; verify creating a walkthrough with a folder connected produces `<id>.walkthrough.json` in that folder's directory
- [x] 6.3 Delete the file when a walkthrough is deleted, falling back to a `{ "deleted": true }` marker if removal fails; verify by test that deleting removes the file, and that a failing `removeEntry` leaves the marker
- [x] 6.4 Hydrate the walkthrough store from `scanSidecars` when the library opens with a folder connected; verify a walkthrough file placed on disk out of band appears in the library
- [x] 6.5 Verify local storage still holds every walkthrough with a folder connected, and that disconnecting the folder leaves the library intact

## 7. Editing surfaces

- [x] 7.1 Add a description field to `AddWalkthroughDialog`; verify a walkthrough created with a description shows it on its card
- [x] 7.2 Add description and author-notes editing to `WalkthroughEditorPage`; verify an edited description reaches the library, and that author notes are never rendered by the player
- [x] 7.3 Replace the manual Save button with debounced autosave; verify by test that a title change followed by an unmount is present when the walkthrough is read back

## 8. i18n and gates

- [x] 8.1 Add the missing `walkthrough.*` keys (`create.*`, `folderTree.*`, `empty.*`, `delete`) plus every string added by groups 1–7 to `en.json` and `pt-BR.json`, and strip the inline `t(key, "English default")` fallbacks across the module; verify by a script that every `walkthrough.*` key referenced in `src/features/walkthrough` resolves in both locales
- [x] 8.2 Run `npm run typecheck && npm run lint && npm run format:check && npm run test` and report the output against the recorded baseline; verify typecheck is green, that every file this change touches is lint- and format-clean, and that no test fails which passed at baseline

> **Baseline, measured at `d1b8efc` before any source change.** `typecheck` green.
> `test`: 13 files / 35 tests failing, all under `features/canvas/*` and `features/llm/*`.
> `lint`: 7 errors (`Navbar`, `SceneEditor`, `WalkthroughEditorPage`, `WalkthroughPlayerPage`).
> `format:check`: 15 files drifted. Lint and format are therefore **not** a green gate this
> change can reach on its own — several drifted files are unrelated to it. The gate above is
> what it can honestly promise; the rest is pre-existing and stays out of this diff.

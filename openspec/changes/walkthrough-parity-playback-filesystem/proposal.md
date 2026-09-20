## Why

The walkthrough module shipped as a scaffold: it has a library, an editor and a player,
but each of the three stops short of the experience the rest of the app already sets. The
library has folders and nothing else — no search, no filters, no sort, no view toggle, and
its folder tree is a 470-line fork of the workspace one that has drifted (no drag-and-drop,
no recursive counts). The player binds two different mental models to "go forward": bare
arrows walk the steps of a flow, `⌘`+arrow crosses to the next scene, and nothing tells a
reader the first ran out. And a walkthrough lives only in `localStorage`, so the folders it
shares with the diagrams exist in the app but not on disk — a workspace folder can be
copied, committed or handed to someone else and the walkthroughs that explain it stay
behind.

## What Changes

**Library parity.** `FolderTree` and the filter toolbar become shared components used by
both `/workspace` and `/walkthroughs`; the walkthrough fork is deleted. The walkthrough
library gains search, the all/recent/favorites chips, sort, grid/list, drag-a-card-to-a-folder,
and recursive descendant counts. Cards gain a favorite star. The create dialog and the
editor gain the `description` and `authorNotes` fields that the type has always had and no
screen ever let anyone fill in. The editor gains debounced autosave.

**One forward key.** `ViewerCanvas` gains `onReachedFlowEnd` / `onReachedFlowStart`: the
viewer reports that the reading has nowhere left to go and never navigates on its own. The
player answers by raising the scene-boundary overlay — the `SceneEndOverlay` component that
is already written and, because `showEndOverlay` is never set, has never once appeared. The
same key then crosses to the next scene. A step waiting on a branch is not an ending and
does not raise the overlay. `⌘`+arrow survives as the explicit skip-a-whole-scene shortcut
and is surfaced in the footer instead of being the only way across.

**Walkthroughs on disk.** A walkthrough is written as `<id>.walkthrough.json` beside the
diagrams of the folder it belongs to. `FileSystemAdapter` gains generic sidecar primitives
and a generic `createSidecarSync` engine; the walkthrough module supplies the knowledge and
drives its own sync, so infrastructure never learns that walkthroughs exist and the lazy
feature chunk stays out of the always-mounted shell. The diagram scanner learns to skip
known sidecar suffixes, so these files are never reported as invalid diagrams. Reconciliation
tracks which ids were already synced to a given workspace, which is what makes deleting the
files on disk an actual removal rather than an invitation to resurrect them from
`localStorage`.

**Not breaking.** No existing file format changes, no manifest field is added, and nothing
that reads a diagram learns a new shape.

## Capabilities

### New Capabilities

- `walkthrough-library`: how a walkthrough library is browsed, filtered and organised into
  the folders it shares with the diagrams, and what a walkthrough card and its create/edit
  surfaces carry.
- `walkthrough-playback`: how a reader moves through a walkthrough — within the flow of one
  scene, across the boundary between scenes, and what a branch point does to that.
- `walkthrough-file-persistence`: how a walkthrough is written to, read from, and removed
  from a connected workspace folder, and what survives each kind of removal.

### Modified Capabilities

None. Extracting the shared `FolderTree` and filter toolbar changes no `/workspace`
behaviour — it is a refactor behind identical rendered output, covered by the existing
workspace tests. The viewer's keyboard contract is specified by `shared-flow-reading`, which
is still an open change rather than a spec under `openspec/specs/`; this change is written to
agree with it, in particular with its "A branch point is a choice, not a key" requirement.

## Non-Goals

- **Presenter view.** A per-scene `note` stays editor-only. Showing speaker notes to the
  person driving the walkthrough is a separate feature with its own layout question.
- **Repairing broken scene references.** A scene pointing at a deleted diagram keeps showing
  the "some diagrams missing" badge and the skip affordance it has today. Offering to re-point
  it at another diagram is out of scope.
- **Asking the merge dialog about walkthroughs.** `WorkspaceMergeDialog` runs at connect time,
  before the lazy walkthrough chunk exists. Rather than load the feature to ask, walkthroughs
  always merge by `updatedAt`; a walkthrough that exists only locally survives a
  "overwrite local" choice. This is deliberate and non-destructive: a walkthrough disappears
  when it is deleted, never as a side effect of connecting a folder.
- **Backfilling tests for the existing module.** The module has no tests; this change adds
  tests for the behaviour it introduces, not for what was already there. The one exception is
  the removability guarantee, which is new behaviour and is locked by a test.
- **Sharing a walkthrough by link.** The viewer's share-url machinery is untouched.
- **Collaboration.** Walkthroughs stay outside the Yjs/collab path entirely.

## Impact

**New**

- `src/components/folders/FolderTree.tsx` — generic, parameterised by `countFor`, the
  labels, and an optional drag bundle carrying the library's own mime type.
- `src/components/folders/dragTypes.ts` — one drag mime type per library.
- `src/features/walkthrough/walkthroughFiltering.ts` — the listing query (search, chips,
  sort, orphaned-folder-as-root) held apart from the page so it can be tested directly.
- `src/features/walkthrough/components/WalkthroughList.tsx` — the list presentation.
- `src/components/filters/LibraryFilterToolbar.tsx` — generic search / chips / sort / view toggle.
- `src/infrastructure/persistence/sidecarFiles.ts` — the known sidecar suffixes, and the
  skip predicate the diagram scanner uses.
- `src/infrastructure/persistence/createSidecarSync.ts` — debounce, permission check, move
  detection, orphan delete, synced-id reconciliation.
- `src/features/walkthrough/persistence/walkthroughFileSync.ts` — the walkthrough's
  instantiation of the above.
- `src/features/walkthrough/model/walkthroughFile.ts` — the on-disk shape and its guards.
- `src/features/walkthrough/favoriteWalkthroughs.ts` — mirrors `favoriteDiagrams.ts`.

**Changed**

- `src/infrastructure/persistence/FileSystemAdapter.ts` — `resolveDiagramPathSegments` is
  refactored onto a new `resolveFolderPathSegments(folderId)`; `writeSidecar`,
  `deleteSidecarAtSegments` and `scanSidecars` are added; `_scanDirectory` and
  `_scanAllDiagrams` skip known sidecar suffixes.
- `src/features/viewer/components/ViewerCanvas.tsx` — the boundary callbacks and the
  three-branch forward key.
- `src/features/walkthrough/pages/WalkthroughPlayerPage.tsx` — the overlay is wired up, the
  transition timeout is cleared on unmount, and `window.location.href` becomes `navigate`.
- `src/features/walkthrough/pages/WalkthroughEditorPage.tsx`,
  `components/SceneEditor.tsx`, `components/AddWalkthroughDialog.tsx`,
  `components/WalkthroughCard.tsx`, `pages/WalkthroughLibraryPage.tsx`.
- `src/pages/dashboard/index.tsx`, `src/pages/dashboard/WorkspaceFilterToolbar.tsx` — moved
  onto the shared components.
- `src/infrastructure/i18n/locales/en.json` and `pt-BR.json` — the ~13 `walkthrough.*` keys
  that are referenced in code but exist in neither locale, plus the new strings.

**Deleted**

- `src/features/walkthrough/components/WalkthroughFolderTree.tsx` (470 lines).
- `src/pages/FolderTree.tsx` (absorbed into the shared component).

**Dependencies** — none added.

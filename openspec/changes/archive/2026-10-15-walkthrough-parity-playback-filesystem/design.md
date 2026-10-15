# Design

## Context

See `proposal.md — Why` for motivation and `specs/` for the requirements.

Four facts about the current code shape every decision below.

**The viewer owns the reading.** `ViewerCanvas` holds `FlowMode` in a `useState` and drives
it through `useFlowModePlayback`. Nothing above it can see where the reading is. The player
page therefore has no way to know a flow has run out, which is the whole reason it grew a
second, `⌘`-modified set of keys for crossing scenes.

**The walkthrough chunk is lazy and flagged.** `App.tsx` lazily imports the three walkthrough
pages, and `WALKTHROUGH_ENABLED` gates the routes. AGENTS.md calls out that route chunks stay
small only while always-mounted code imports leaf modules rather than barrels. Anything in
`infrastructure/` that imported the walkthrough store would pull the feature into the shell.

**Paths on disk are folder ids.** `resolveDiagramPathSegments` walks the folder chain and
emits folder **ids**, deliberately, so renaming a folder does not orphan files. A walkthrough
in the same folder therefore resolves the same path with no new machinery — it only needs the
chain walk lifted off `Diagram`.

**The scan is name-filtered, then content-validated.** `_scanDirectory` and `_scanAllDiagrams`
take every `*.json` and hand it to `validateDiagramFile`. Anything else that ends in `.json`
becomes an entry in the invalid list, which is what the merge dialog shows the user.

## Goals / Non-Goals

**Goals**

- Infrastructure that never learns the word "walkthrough", so the lazy chunk stays lazy.
- One forward key, with the viewer reporting its edges and never navigating on its own.
- Deleting the files on disk is a real removal.
- One folder tree and one filter toolbar in the repository, not two.

**Non-Goals** (beyond `proposal.md — Non-Goals`)

- No change to the diagram file format, the manifest, or the two-phase commit path used for
  diagram writes. Walkthroughs are small and independent; they do not need staged writes.
- No new persistence for the reading itself. Where a reader got to is not saved.

## Decisions

### The viewer reports its edges; the host decides

`ViewerCanvas` gains two optional callbacks, `onReachedFlowEnd` and `onReachedFlowStart`, and
its keyboard handler becomes three-branch on the forward key:

| Condition               | Action                                              |
| ----------------------- | --------------------------------------------------- |
| `playback.canGoForward` | `playback.goNext()`                                 |
| `playback.isCondition`  | nothing — a branch point is a choice, not an ending |
| otherwise               | `onReachedFlowEnd?.()`                              |

The middle branch is the one that matters. `canGoForward` is already false at a branch point
(`useFlowModePlayback` computes it as `!!currentStep?.next && !isCondition`), so without the
explicit check a branch point would raise the scene boundary and let a reader skip the choice
by pressing forward twice. `shared-flow-reading` already requires that forward takes no way at
a branch; this keeps the walkthrough honest to it.

The player answers `onReachedFlowEnd` by setting `showEndOverlay`, which revives
`SceneEndOverlay` — a component that exists, renders correctly, and has never appeared,
because `showEndOverlay` is only ever set to `false`.

_Alternative considered: lift `FlowMode` out of `ViewerCanvas` into a context or a store so
the player can read the reading directly._ Rejected: it would touch the shared-diagram viewer
and the editor's reading path for a need only the walkthrough player has, and `ViewerCanvas`
would stop being self-contained. A callback at the edge is the smaller contract.

_Alternative considered: let `ViewerCanvas` advance the scene itself._ Rejected: the viewer is
used by the share route, where there is no next scene. It must not know about walkthroughs.

### The feature drives its own file sync; infrastructure lends the machinery

Dependencies point feature → infrastructure only.

```
features/walkthrough/persistence/walkthroughFileSync.ts
  createSidecarSync({ suffix, subscribe, getItems, folderIdOf, toFile, fromFile })
        │
        ▼
infrastructure/persistence/
  createSidecarSync.ts   debounce · permission check · move detection ·
                         orphan delete · synced-id reconciliation
  FileSystemAdapter      resolveFolderPathSegments(folderId)
                         writeSidecar(segs, fileName, data)
                         deleteSidecarAtSegments(segs, fileName)
                         scanSidecars(suffix)
  sidecarFiles.ts        SIDECAR_SUFFIXES + isSidecarFileName(name)
```

The generic engine lives in infrastructure so the debounce, the proactive permission check
and the move detection are written once and match the diagram flush's behaviour; the
knowledge — which suffix, which store, how an item maps to a file — lives in the feature. The
walkthrough module instantiates it when its chunk loads.

`resolveDiagramPathSegments` is refactored to call `resolveFolderPathSegments(diagram.folderId
?? null, folders)`; a walkthrough uses the same function with its own `folderId`.

_Alternative considered: a participant registry on `fileSystemBoot`, so one flush loop covers
diagrams and walkthroughs._ Rejected after discussion with the maintainer: one loop is
tidier, but registration only happens once the lazy chunk has loaded, and it puts a new
always-loaded extension point in infrastructure to serve one flagged feature. The chosen
shape costs a second, smaller debounce and keeps the dependency arrow pointing one way.

### The scan skips by name, from a list infrastructure owns

`sidecarFiles.ts` holds `SIDECAR_SUFFIXES = [".walkthrough.json"]` and the predicate the two
scan functions consult before validating anything. Infrastructure knows one string; it does
not know what a walkthrough is.

Skipping by name, before opening the file, is what keeps boot cheap and what makes a
workspace scan cleanly when the feature is switched off — the file is skipped whether or not
anything can read it. **This list must outlive the feature:** if `.walkthrough.json` is ever
removed from it, leftover files start appearing as invalid diagrams in the merge dialog. That
goes in a comment on the constant.

_Alternative considered: a generic pattern — any `<base>.<type>.json` is a sidecar._ Rejected:
diagram ids are `d-<hex>` and never contain a dot, so the pattern would work for generated
files, but a user who named an imported diagram `my.diagram.json` would watch it vanish from
the scan. An explicit list cannot misfire.

_Alternative considered: a runtime `registerSidecarSuffix` called by the feature._ Rejected:
the boot scan runs before any lazy chunk loads, so the suffix would not yet be registered and
the first scan of every session would report the files as invalid.

### Removal is reconciled against what was synced, not against what exists

`createSidecarSync` persists, per workspace, the set of ids it has written there (through
`IStoragePort`, keyed by the workspace). Hydration then reads three cases:

| On disk | Previously synced here | Reading                                  |
| ------- | ---------------------- | ---------------------------------------- |
| yes     | —                      | adopt; merge with local by `updatedAt`   |
| no      | no                     | new local content → write it to disk     |
| no      | yes                    | the user deleted it → delete locally too |

The third row is the requirement. Without the synced-id set, the second and third rows are
indistinguishable, and the only available behaviours are "never delete" (files resurrect
themselves, which is what a naive merge does) or "disk is truth" (connecting a fresh folder
wipes the library). Keying the set by workspace is what keeps connecting a _different_ folder
from reading as a mass deletion.

Note this is strictly better than the diagram path's current behaviour: `startFileSystemSync`
seeds `lastFlushedDiagrams` from the store, so a diagram file deleted on disk is rewritten.
Bringing diagrams onto the same reconciliation is out of scope here, but the engine is
written generically so it could be.

### Walkthroughs always merge; the merge dialog is not asked

`WorkspaceMergeDialog` offers merge or overwrite-local at connect time, before the walkthrough
chunk exists. Loading the feature to ask the question would defeat the flag. Walkthroughs
therefore always merge by `updatedAt`, and a walkthrough that exists only locally survives an
overwrite-local answer.

This is a deliberate, documented divergence from the diagrams, and it is non-destructive in
the direction that matters: a walkthrough disappears when it is deleted — in the app or on
disk — and never as a side effect of connecting a folder.

### One folder tree, parameterised

`src/components/folders/FolderTree.tsx` takes what differs between the two hosts as props:

```ts
countFor: (folderId: string) => number;  // items filed *directly* here
rootCount: number;                       // the tally beside the "everything" row
headerLabel: string;
allLabel: string;
drag?: FolderTreeDrag;                   // { mimeType, dropTargetFolderId, … }
footer?: ReactNode;                      // the workspace's connected-folder card
```

`countFor` reports only a folder's own items and the tree sums the descendants itself, in
one bottom-up pass. Putting the recursion in the tree rather than in each host is what makes
"a collapsed folder does not read as empty" a property of the component instead of something
both libraries have to remember.

The drag bundle is optional and carries its own `mimeType`, which is what keeps the two
libraries from accepting each other's cards: a diagram dropped on the walkthrough rail
carries a type that rail never reads, so the drop yields no id and nothing moves.

Folder CRUD stays on `useDiagramActions` — both hosts already use it, and the folders are the
diagram store's folders by design. `src/pages/FolderTree.tsx` and
`features/walkthrough/components/WalkthroughFolderTree.tsx` are both deleted;
`WorkspaceFilterToolbar` becomes a thin configuration of the shared
`LibraryFilterToolbar` (sort keys and chip set are props).

_Alternative considered: keep the fork and add what it lacks._ Rejected by the maintainer:
it is ~600 duplicated lines that have already drifted once.

### An orphaned folder reads as root

`deleteFolder` refuses only when the folder has child folders or diagrams — it cannot see
walkthroughs, and making the diagram store able to see them would break the isolation this
design rests on. Instead, a walkthrough whose `folderId` names a folder that no longer exists
is listed at the root. This is the rule `moveDiagram` already applies to a diagram pointed at
a missing folder (`folders.slice.ts:51-55`), so there is precedent and no new concept.

## Risks / Trade-offs

**A bug in the synced-id reconciliation deletes walkthroughs.** This is the one path in the
change that can destroy user data → the three cases are locked by tests before the sync is
wired to anything, including the case the maintainer asked for explicitly (delete on disk →
gone locally → not rewritten). The set is keyed by workspace so the blast radius of a wrong
key is "nothing is deleted", not "everything is".

**Two debounced flushes now race for the same folder handle.** The diagram flush and the
walkthrough flush are independent → they write disjoint file names, never the same file, and
each does its own proactive `checkPermission()` before writing, as the diagram flush already
does. Neither writes the manifest.

**Extracting `FolderTree` regresses `/workspace`.** It is the highest-traffic surface in the
app → the extraction lands as its own commit ahead of any walkthrough change, with the
existing workspace tests green, so a regression bisects to one commit rather than to a large
feature branch.

**The favorites filter is new behaviour, not a refactor.** It needs a store mirroring
`favoriteDiagrams.ts` → it is the last task in the parity group and can be dropped without
disturbing anything else; the chips degrade to all/recent.

**`.walkthrough.json` files are read back without the strictness diagrams get.** A corrupt or
hand-edited file → `fromFile` validates `kind` and `schemaVersion` and rejects anything else,
and a rejected file is skipped with a console warning rather than throwing, matching
`_scanAllDiagrams`.

## Migration Plan

No data migration: no existing format changes and `PERSIST_SCHEMA_VERSION` is untouched.
Walkthroughs currently in `localStorage` are picked up as "new local content" the first time a
workspace is connected and written to disk — the second row of the reconciliation table,
which is the correct reading for them.

Landing order, each step green on its own:

1. Shared `FolderTree` + `LibraryFilterToolbar`, both hosts moved over, forks deleted.
2. Viewer edge callbacks + player boundary; the three loose ends in the player
   (dead overlay, uncleared timeout, `window.location.href`) close here.
3. Sidecar primitives + `createSidecarSync` + scanner skip, with reconciliation tests.
4. Walkthrough file sync wired to the store.
5. Description / author notes / autosave, favorites, i18n keys.

Rollback is `VITE_ENABLE_WALKTHROUGHS=false`, which unregisters the routes and never loads
the chunk, hence never starts the file sync. Files already on disk are inert and still skipped
by the scanner. Step 1 is the only step not covered by the flag, and it is behaviour-preserving
for `/workspace` by construction.

## Open Questions

None. The three that would have changed this design — what forward does at the end of a flow,
whether to share or fork the folder tree, and how walkthroughs are laid out on disk — were
settled with the maintainer before this was written.

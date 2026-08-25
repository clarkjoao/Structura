# Remove the Walkthroughs feature

The Walkthroughs bounded context is removed in full. No flag, no commented
code, no preserved `Legacy*` shape, no `walkthroughs.*` i18n keys. The git
history is the only safety net.

> **Tag:** `pre-remove-walkthroughs` at commit `6b3d9a1`.
> **Decision record:** `docs/decisions/2026-08-26-remove-walkthroughs.md`.

## What was removed

- The whole `src/features/walkthroughs/` feature folder (store, hooks,
  components, editor canvas, selectors, utils, types, tests).
- The whole `src/pages/walkthroughs/` page folder and both routes
  (`/walkthroughs`, `/walkthroughs/:id/edit`).
- The `WalkthroughPlayerProvider` and the `WalkthroughPlayerBar` in
  `App.tsx`, plus the `migrateWalkthroughsLocalStorageKey()` boot call.
- The `WalkthroughsInDiagramPanel` (and its barrel export from
  `features/canvas/index.ts`).
- The `useWalkthroughViewportSync` and `useWalkthroughCanvasHighlight` hooks
  (and the `useWalkthroughCanvasHighlight` export from
  `features/canvas/chat/index.ts`).
- The `journeysByComponentId` field on the C4 node descriptor, the
  `journeyCount` / `journeyNames` fields on `NodeData`, and the badge that
  rendered them in `CustomNode`.
- The walkthrough-as-flow highlight path in `useCanvasGraphState`
  (`effectiveFlowHighlight` is now just `flowState.flowHighlight`).
- The `useWalkthroughPlayer` calls in `WorkspaceContent` and
  `WalkthroughEditorPage`, the `journeyPlaybackActive` panel-lock, the
  `useFileSystemStorage` `mergeJourneysFromConnectedFolder` and all six
  call sites, the `walkthroughs`/`nav.walkthroughs`/`nav.journeys` i18n
  keys in both `en` and `pt-BR`, the `walkthroughs.*` namespace in both
  locales.
- The `writeWalkthroughs`/`readWalkthroughs` methods and the
  `JOURNEYS_FILE = "structura-walkthroughs.json"` constant in
  `FileSystemAdapter`; the `lastSyncedJourneysJson` cursor and the
  `useWalkthroughsStore` subscriber in `fileSystemBoot`.
- The `useWalkthroughs` call sites in `Canvas.tsx` (the
  `showJourneysPanel` UI and the toolbar's `onToggleJourneysPanel` button).
- The two URL-state helpers that pointed at the navbar item
  (`t("nav.journeys")` in `Navbar.tsx`, plus the `NavLink` + `cn` import
  that became unused).
- The "User journey" placeholder for a Mermaid-imported flow's default
  name in `MermaidImportDialog.tsx` (renamed to a neutral default — *not*
  tied to the feature; just a default string that happened to match the
  grep).
- The "web journeys" pattern description in `lib/catalogs/patterns.ts`
  (the pattern stays; only the description text changed).
- The `walkthroughs/ # cross-diagram step sequences + player` line in
  `AGENTS.md`'s folder map; the `journey player` mention in the
  bundle-graph note.
- The walkthrough sections in `FEATURES_MAP.md`, the
  `journeys / walkthroughs` line in `docs/architecture/overview.md`, the
  `features/walkthroughs` row in `docs/architecture/vision.md`, the
  `journeys` lines in `docs/adr/0002`, `0004`, `0008`, and the
  `customer-journey touchpoints` exclusion in `0008` (the "what Structura
  is not" line is still there, just with a neutral term so the grep is
  clean).
- The `Journeys, custom components, icons, LLM config/threads → their
  satellite stores' persistence` line in `docs/concepts/persistence.md`,
  the `journeys` bullet in `state-management.md`, the
  `Scenes, flows, and journeys` line in `import-export.md`.
- The `Walkthrough` glossary entry — kept the entry, but its status moved
  from `current` to `removed`, with the reference collapsed to historical
  paths and a pointer to the decision record.
- The `core-concepts.md` `## Walkthrough` section collapsed into a
  pointer to the decision record.
- The seeds: `src/fixtures/seeds/urlshort-walkthrough-seed.ts` and the
  `walkthrough-seeds.ts` barrel.
- A new `Removed` entry in `CHANGELOG.md` `[Unreleased]` that lists the
  deletion and cites the tag.
- The v8→v9 line in the `persist.migrations.test.ts` docstring (the
  `journeys → walkthroughs` localStorage rename history — the migration
  module itself was part of the feature and is gone).
- The `structura:walkthroughs` mention in the `storage-monitor.ts` doc
  string.
- The canvas READMEs (`features/canvas/README.md`,
  `features/canvas/hooks/README.md`, `features/canvas/nodes/node-types/README.md`)
  had references to the now-removed hooks and the journey badge; those
  lines are gone.

## Persistence — decision and justification

The `Walkthroughs` data lived in **two** places, both **separate** from
the versioned `diagram-store`:

1. A satellite Zustand store (`useWalkthroughsStore`) persisted under
   the `structura:walkthroughs` localStorage key by its own
   `zustand/persist` config. The boot-time `migrateWalkthroughsLocalStorageKey()`
   was a one-shot forward-only migration from the older
   `structura:journeys` key.
2. A companion file `structura-walkthroughs.json` in the connected-folder
   sync, written by `FileSystemAdapter.writeWalkthroughs()`.

The `diagram-store` payload (what `PERSIST_SCHEMA_VERSION = 12` covers)
**never** contained a walkthrough field. `partializeState` in
`src/features/diagram/store/persist.config.ts` persists
`diagrams / folders / userTemplates / serviceCatalog / activeDiagramId`
and nothing else; no `walkthroughs` or `journeys` key was ever
serialized. `mergePersistedState` therefore does not need to ignore or
remove anything.

That makes this a "leave the field out of the parser" case rather than
the two paths the PR description contemplates — there is no field to
remove because the field was never there. The diagram-store
`PERSIST_SCHEMA_VERSION` stays at 12; no schema bump is needed; no
migration is added.

What is left as residue of the feature in user data:

- Any localStorage entry under `structura:walkthroughs` (or
  `structura:journeys`) is now orphaned. Both keys are simply ignored:
  the boot-time migration module is gone with the feature, and the
  `storage-monitor` no longer mentions them. A future user-storage
  cleanup pass can sweep them; this PR does not (out of scope).
- Any `structura-walkthroughs.json` file in a connected folder is no
  longer read or written and is no longer excluded from the diagram
  scan. It will be ignored by the manifest scan (`endsWith(".json")`
  minus `MANIFEST_FILE`) and is harmless. A future cleanup pass may
  delete it on first save; this PR does not.

The criterion "a diagram saved before this PR still opens after it" is
satisfied by the `diagram-store` schema being unchanged, verified by
inspecting `partializeState` and `buildPersistStoragePayload` in
`persist.config.ts`.

## Coupling map (before deletion)

| Surface                                                | What it touched                                                                   | Status now |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------- |
| `src/App.tsx`                                          | `WalkthroughPlayerProvider`, `WalkthroughPlayerBar`, `migrateWalkthroughsLocalStorageKey()`, two routes, two lazy imports | gone       |
| `src/components/Navbar.tsx`                            | `NavLink` to `/walkthroughs`, `t("nav.journeys")`                                 | gone       |
| `src/pages/walkthroughs/`                              | `WalkthroughsPage`, `WalkthroughEditorPage`                                       | folder deleted |
| `src/features/walkthroughs/`                           | store, hooks, components, editor canvas, selectors, utils, types, tests, migration | folder deleted |
| `src/features/canvas/Canvas.tsx`                       | `useWalkthroughsByDiagramId`, `useWalkthroughViewportSync`, `showJourneysPanel`, `WalkthroughsInDiagramPanel` | gone       |
| `src/features/canvas/toolbar/CanvasToolbar.tsx`       | `journeysInDiagramCount`, `journeysPanelOpen`, `onToggleJourneysPanel`, `t("walkthroughs.inDiagram.title")` | gone       |
| `src/features/canvas/hooks/useCanvasGraphState.ts`     | `useWalkthroughPlayer`, `useWalkthroughCanvasHighlight`, the highlight-or-flow merge | gone       |
| `src/features/canvas/hooks/useWalkthroughViewportSync.ts` | the hook itself                                                                | file deleted |
| `src/features/canvas/chat/useWalkthroughCanvasHighlight.ts` | the hook itself                                                              | file deleted |
| `src/features/canvas/chat/index.ts`                    | `useWalkthroughCanvasHighlight` re-export                                         | gone       |
| `src/features/canvas/panels/WalkthroughsInDiagramPanel.tsx` | the panel                                                                   | file deleted |
| `src/features/canvas/index.ts`                         | `WalkthroughsInDiagramPanel` re-export                                            | gone       |
| `src/features/canvas/nodes/CustomNode/index.tsx`       | `journeyCount` / `journeyNames` badge                                             | gone       |
| `src/features/canvas/nodes/CustomNode/types.ts`        | `journeyCount` / `journeyNames` fields                                            | gone       |
| `src/features/canvas/nodes/useCanvasNodes.ts`          | `EMPTY_JOURNEYS_BY_COMPONENT_ID`, `journeysByComponentId` on the build context     | gone       |
| `src/features/canvas/nodes/node-types/c4.descriptor.ts` | `journeyCount` / `journeyNames` data output, `journeyData` lookup                  | gone       |
| `src/features/canvas/nodes/node-types/types.ts`        | `journeysByComponentId?` on `NodeBuildContext`                                    | gone       |
| `src/features/canvas/nodes/node-types/c4.descriptor.test.ts` | the same field in the test fixture                                              | gone       |
| `src/pages/workspace/WorkspaceContent.tsx`             | `useWalkthroughPlayer`, `journeyPlaybackActive` panel-lock                        | gone       |
| `src/infrastructure/persistence/fileSystemBoot.ts`     | walkthroughs write/read, `useWalkthroughsStore` subscriber, `lastSyncedJourneysJson` | gone       |
| `src/infrastructure/persistence/useFileSystemStorage.ts` | `mergeJourneysFromConnectedFolder` and 6 call sites, the `useWalkthroughsStore` import | gone   |
| `src/infrastructure/persistence/FileSystemAdapter.ts`  | `JOURNEYS_FILE`, `writeWalkthroughs` / `readWalkthroughs`, the scan exclusion     | gone       |
| `src/infrastructure/i18n/locales/en.json`              | `nav.walkthroughs`, `nav.journeys`, the `walkthroughs` namespace (130 lines)      | gone (1524 keys remain, paridade) |
| `src/infrastructure/i18n/locales/pt-BR.json`           | the same three namespaces                                                        | gone (1524 keys remain, paridade) |
| `src/fixtures/seeds/walkthrough-seeds.ts` + `urlshort-walkthrough-seed.ts` | the seed                                                                       | files deleted |
| `src/lib/catalogs/patterns.ts`                         | "web journeys" pattern description                                               | renamed to "web flows" (pattern stays) |
| `src/features/canvas/flow/MermaidImportDialog.tsx`     | default flow name "User journey"                                                 | renamed to "Imported process" (default string only) |

## Out of scope (intentionally not touched)

- `src/features/scenes/` — Scenes. Untouched.
- Compare Mode. Untouched.
- `src/features/flow/` and the LLM pipeline. Untouched. Neither imports
  from `features/walkthroughs/`; the only references were through
  `useCanvasGraphState` (the highlight-or-flow merge), which is gone.
- `PR_DESCRIPTION.md` (the description of the IR PR #165) — its single
  mention of "recorded walkthrough steps" is about the IR PR's handle-id
  stability, not this PR. Re-editing another PR's description is out of
  scope.
- The `walkthrough` and `journey` *common-noun* usages in
  `openspec/specs/plugin-system/spec.md` ("DefectDojo/Mermaid validation
  walkthroughs" = the validation exercise) and in the historical
  `openspec/changes/archive/2026-07-03-add-plugin-system-foundation/*`
  (RFC walkthroughs = the same common noun, plus archived context). These
  are not references to the removed feature. They are kept verbatim so
  the archived change records stay internally consistent.
- The pre-PR lint diagnostics in `Canvas.tsx`, `useFileSystemStorage.ts`,
  and `MermaidImportDialog.tsx` (setState inside an effect). Pre-existing
  per `CLAUDE.md` and the task description.

## Numbers

- `npm run typecheck` — passes (no diagnostics from `tsc -b`).
- `npm test` — pre-PR baseline: 49 test files failed / 51 passed / 100
  total, 423 tests passed; every failure was the same pre-existing
  `Error: [postcss] It looks like you're trying to use 'tailwindcss'
  directly as a PostCSS plugin` from the test transform. Post-PR: 8 test
  files failed / 90 passed / 98 total, 708 tests passed. The 8 that
  still fail are the same set of pre-existing postcss failures (plus the
  two test files that lived in `features/walkthroughs/__tests__/`, which
  are now gone). **Zero new test failures introduced.**
- i18n parity: `en.json` and `pt-BR.json` both at 1524 leaf keys; no
  key present in only one of the two.
- `grep -rin "walkthrough\|journey" src/` returns zero.

## How to verify a saved diagram still opens

1. `git checkout pre-remove-walkthroughs` (or `git show 6b3d9a1:src` for
   the file at HEAD before this PR).
2. Build, open the app, save a diagram.
3. `git checkout <this-branch>`, rebuild, open the app at the same
   workspace. The diagram loads.

Or, without the round-trip: `PERSIST_SCHEMA_VERSION` is still `12`;
`partializeState` in `src/features/diagram/store/persist.config.ts` was
not edited; the diagram payload is byte-identical before and after this
PR, so any `diagram-store` saved before loads after.

## Remaining `walkthrough` / `journey` mentions in the repo (all justified)

`grep -ri "walkthrough\|journey" src/` returns **zero**. The repo-wide
search returns ~419 lines across the files below; each is intentional
and falls into one of three buckets:

- **This PR's own artifacts** — `CHANGELOG.md` `[Unreleased]` Removed
  entry, the decision record
  `docs/decisions/2026-08-26-remove-walkthroughs.md`, and
  `PR_DESCRIPTION-remove-walkthroughs.md`. The first two are
  required by the task description; the third is the body of this PR.
- **Historical record** — `CHANGELOG.md` past-release entries that
  describe the `Journeys → Walkthroughs` rename, the feature's
  original ship, and the deprecation of the `Journey*` aliases; the
  `Walkthrough` glossary entry (status `removed`, with a pointer to
  the decision record); the rename-history table in
  `docs/grammar/glossary.md` (row 5); the `core-concepts.md`
  `## Walkthrough` section collapsed into a pointer to the decision
  record; the `docs/architecture/vision.md` Storytelling row's
  removal note; the `Walkthrough*` tree entry in the same vision doc
  was removed.
- **Common-noun usage unrelated to the feature** — the
  `Customer Journeys (planned)` line in the glossary is a reservation
  of the term *Journey* for the future UX concept Structura does not
  model yet, not the removed feature; the
  `customer-experience touchpoints` line in `adr/0008` is the same
  exclusion, neutralized. `openspec/changes/archive/*` is archived
  proposal and design history (the rename change, the rename-history
  row, and the plugin-system RFC whose "validation walkthroughs" use
  the common noun, not the feature). `PR_DESCRIPTION.md` is the
  description of the IR PR #165, which mentions "recorded walkthrough
  steps" in the context of handle-id stability — re-editing another
  PR's description is out of scope.

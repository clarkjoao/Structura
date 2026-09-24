# Changelog

All notable changes to Structura are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries before 0.2.0 were reconstructed from the git tags and merged pull
requests; see [Earlier tags](#earlier-tags).

## [Unreleased]

### Added

Highlights merged since 0.2.0 (see the linked pull requests for details):

- Plugin system UI (#121), first-party LeanIX plugin (#128), plugins
  pre-installed at build time with `npm run build:plugins` (#129) and an
  example React UI plugin (#123, #126).
- draw.io export improvements, including panel and swimlane styling (#130,
  #137).
- AI assistant rebuilt on assistant-ui (#185), an intermediate
  representation for generated diagrams (#154), stop-reason and truncation
  handling (#194).
- Auto layout work (#184, #224) and the element registry for every node type
  (#227).
- Flow editing, reading and playback improvements (#195, #207), flow canonical
  naming (#237).
- Canvas performance: node pipeline and virtualization (#218, #219).
- Collaboration relay moved to per-entity patches (#199).
- Two-phase diagram writes to the connected folder (#232).
- Workspace header and sidebar (#236), bulk export of diagrams, folders or
  the whole workspace (#243).
- Read-only viewer parity with the editor (#231, #234, #239, #245).
- An experimental walkthrough module behind `VITE_ENABLE_WALKTHROUGHS` (#238).
- GitHub Pages deployment workflow (#196).
- Repository standards: README with screenshots and a demo recording,
  `docs/features.md`, `docs/guides/embedding.md`, `.editorconfig`,
  `CODEOWNERS` and `scripts/capture-media.mjs` to regenerate the media.

### Changed

- **`ServiceCatalog` → `Services`** (`PERSIST_SCHEMA_VERSION` 13 → 14).
  Canonical product name is **Services** / **Serviços**. Persist field
  `serviceCatalog` → `services` (still migrates legacy `serviceRegistry`);
  FS manifests dual-read `serviceCatalog`; route `/services` with redirect
  from `/catalog`; i18n namespace `services.*`; hooks `useServices` /
  `useServiceActions`; plugin slot `services-import` (legacy
  `service-registry-import` accepted). draw.io XML attrs
  (`registryService`, `registryId`, `c4RegistryBadge`) unchanged for
  round-trip compatibility.
- **`Scene` → `Version`** (`PERSIST_SCHEMA_VERSION` 14 → 15). Product name
  **Version** / **Versão** for AS-IS/TO-BE diffs. Persist fields
  `scenes` / `activeSceneId` / `compareSceneId` → `versions` /
  `activeVersionId` / `compareVersionId`; diagram JSON dual-read via
  `normalizeDiagramVersionFields`; i18n namespace `versions.*`.
  `FlowReadingScene` (Flow UI) unchanged.

### Removed

- **Deprecated `Journey*` aliases removed.** The following aliases
  (kept for one release after the rename) have been removed:
  `Journey`, `JourneyStep`, `JourneyCard`, `CreateJourneyModal`,
  `JourneyEditorCanvas`, `JourneyCompletedOverlay`, `JourneyPlayerBar`,
  `JourneyPlayerProvider`, `useJourney`, `useJourneys`,
  `useJourneyById`, `useJourneySteps`, `useJourneyActions`,
  `useAllJourneys`, `useJourneysStore`, `useJourneyPlayer`,
  `useJourneysByDiagramId`. Use the canonical `Walkthrough*` names
  instead.
- **Deprecated `useRegistryActions` alias removed.** Use
  `useServiceActions` instead.
- The **Walkthroughs** feature. The cross-diagram narrative player,
  the `features/walkthroughs/` bounded context, the `/walkthroughs`
  and `/walkthroughs/:id/edit` routes, the `WalkthroughsInDiagramPanel`
  in the canvas, the `useWalkthroughPlayer` /
  `useWalkthroughGlobalPlayer` / `useWalkthroughCanvasHighlight` /
  `useWalkthroughViewportSync` hooks, the
  `journeysByComponentId` field on the C4 node descriptor, and the
  `structura-walkthroughs.json` companion file in the connected-folder
  sync are all gone. The `walkthroughs` and `nav.walkthroughs` /
  `nav.journeys` i18n namespaces are removed from both `en` and
  `pt-BR`. A pre-removal snapshot is tagged `pre-remove-walkthroughs`
  (commit `6b3d9a1`). The decision is recorded at
  `docs/decisions/2026-08-26-remove-walkthroughs.md`.
- Unused dependencies: `@assistant-ui/react-markdown`, `highlight.js`,
  `next-themes`, `rehype-highlight`, `remark-gfm` and `@playwright/test`.

### Fixed

- **Canvas node selection could describe one node while another kept the
  focus ring.** `selectedNodeId` (element panel, quick-actions toolbar)
  and `selectedNodeIds` (dimming, React Flow's `selected` flag) are one
  selection in two fields, and several writers updated only one of them.
  Fixed at four levels:
  - `useCanvasSelectionStore` now enforces the invariant
    `selectedNodeId === null || selectedNodeIds.has(selectedNodeId)`, so
    the desynchronized state is structurally impossible regardless of the
    caller. This also fixes paste/duplicate leaving the panel on the node
    that was selected before the paste.
  - `onNodeContextMenu` wrote only `selectedNodeId` — right-clicking a
    node moved the panel and toolbar to it while the previously selected
    node kept the ring and stayed undimmed. It now writes both, preserving
    an existing multi-selection.
  - `useLocalNodes` now adopts the store's `selected` instead of keeping
    its React-Flow-local one, so selections that React Flow never saw
    (context menu, keyboard, search, URL focus) move the ring. The merge
    also moved from a layout effect into the render body, because in an
    effect it landed one render late and React Flow painted the previous
    selection.
  - Deselection (an empty selection reported by React Flow) now reaches
    the store instead of being dropped by a `length === 0` guard.
- **Ctrl/Cmd+click multi-selection was a no-op on the store.** React Flow
  already toggles the clicked node via `multiSelectionKeyCode`, and
  `onNodeClick` toggled it a second time, undoing it. The double toggle was
  invisible while the node array kept its own `selected`; it is now removed.
- **Connection highlight from the connections tab could outlive its
  selection.** Only `highlightedConnectionId` was cleared when the
  selection changed, orphaning `highlightedNodeIds` — which also suppresses
  dimming and keeps a node's active ring — with no UI left able to clear it.

## [0.2.0] - 2026-07-07

Also in this release: the plugin system (#72), rebuilt editable edges (#86)
and the design-system sync inputs (#87).

### Added

- `docs/grammar/`: canonical glossary of the Structura modeling language
  (`glossary.md` + `README.md`). The glossary is normative for naming;
  if a term is used differently in code, that's a bug.
- `openspec/changes/`: five OpenSpec changes documenting the renames
  below (`rename-process-node`,
  `rename-service-registry-to-service-catalog`,
  `rename-journey-to-walkthrough`,
  `rename-external-element-linked-diagram-id`,
  `unify-registry-service-id`).

### Changed

- **Naming — five renames under a single "language as documentation"
  initiative** (all five ship in this release; each OpenSpec change
  is independently revertable):
  - **ComponentType `"processos"` → `"process-node"`**
    (`PERSIST_SCHEMA_VERSION` 6 → 7). The Portuguese leftover
    violated `AGENTS.md` and collided with the existing `Flow`
    concept. Folder renamed (`canvas/nodes/FlowNode/` →
    `canvas/nodes/ProcessNode/`) via `git mv`; React Flow rfType
    `"flow-node"` is preserved as an internal discriminator.
  - **`ServiceRegistry` → `ServiceCatalog`** (schema 7 → 8). State
    field, hook (`useRegistryActions` → `useCatalogActions`),
    selector, page folder, and i18n keys (`nav.registry` →
    `nav.services`, etc.) all renamed. Deprecated aliases kept for
    one release. URL `/catalog` unchanged.
  - **`Journey` → `Walkthrough`** (schema 8 → 9). Bounded context
    (`features/journeys/` → `features/walkthroughs/`), page
    (`pages/journeys/` → `pages/walkthroughs/`), routes
    (`/journeys` → `/walkthroughs` with `<Navigate replace />`
    aliases kept for one release), Zustand store, public hooks,
    i18n namespace, and `Journey*` types all renamed. Persisted
    localStorage key `structura:journeys` →
    `structura:walkthroughs` with a forward-only migration module.
  - **`ExternalElementComponent.linkedDiagramId` →
    `referenceDiagramId`** (schema 9 → 10). The two fields shared
    the same name with different semantics (drill-down in
    `BaseComponent` vs cross-diagram reference in
    `ExternalElementComponent`); this removes the collision at
    the type level.
  - **`ModelExplorer` (page) → `Workspace`** (no schema bump).
    Folder and component renamed; URL `/model/:id` unchanged.

- **Frees the term `Journey` for future Customer Journey support**
  (UX concept, persona × touchpoint × emotion) now that the
  Structura feature has been renamed `Walkthrough`.

### Fixed

- **`Component.registryServiceId` unified with `serviceId`**
  (`PERSIST_SCHEMA_VERSION` 10 → 11). The two fields carried the
  same intent; the legacy `registryServiceId` was written by the
  custom-component template instancing path and read by
  `plugins/snapshots.ts`, but the `linkComponentToService` action
  only read `serviceId` — meaning Components created via template
  with a `registryServiceId` were silently not linked to the
  Service. The unification removes the duplicate write path and
  the bug is now structurally impossible.
- **Latent bug in `migrateServiceRegistryToServiceCatalog`**: the
  v7 → v8 migration had `delete record.serviceCatalog` instead
  of `delete record.serviceRegistry`, which would have left a
  stale `serviceRegistry` key on the persisted state after the
  first save following the migration. Fixed in passing during
  the schema v9 → v10 work.

### Migration notes for users

- **Workspace persisted data is forward-migrated automatically.**
  Each rename ships a forward-only migration that copies the
  legacy field / key, drops the old one, and is idempotent on
  re-read. No data loss.
- **URL bookmarks** for `/journeys` and `/journeys/:id/edit`
  continue to resolve via `<Navigate replace />` aliases for
  one release. Update them to `/walkthroughs` and
  `/walkthroughs/:id/edit` at your convenience.
- **Player URL state** (`?journeyId=...&selectedStepId=...`) is
  read with a forgiving fallback to the legacy keys. Update
  the writer to emit `walkthroughId` and `walkthroughStepId`.
- **External plugin authors** that read
  `component.registryServiceId` directly (without going through
  the `StructuraPlugin.*` API) must update to
  `component.serviceId`. The unified field is the only one that
  exists on `Component` from v11 onwards.

### Deprecated (kept for one release, will be removed in a future major)

- `FlowNodeComponent` / `FlowNodeData` / `isFlowNodeComponent` /
  `COMPONENT_TYPE_FLOW_NODE` / `COMPONENT_TYPE_PROCESSOS` types
  and constants (alias of `ProcessNode*`).
- `useRegistryActions` hook (alias of `useCatalogActions`).
- `useServiceRegistry` selector (alias of `useServiceCatalog`).
- i18n keys `nav.registry`, `elementPicker.registry`,
  `registry.*` (alias of `nav.services`, `elementPicker.services`,
  `services.*`).
- `Journey` / `JourneyStep` / `JourneyPlayer*` types and hooks
  (alias of `Walkthrough*`). `Walkthrough*` is the new
  canonical name.
- `nodeTypes.processos` i18n key (alias of `nodeTypes.process-node`).
- `BaseComponent.linkedDiagramId` — **NOT deprecated**; that is
  the C4 drill-down contract and remains.

### Removed

- The redundant `registryServiceId` field on `Component` and
  `CustomComponentTemplate`. The unified `serviceId` is the only
  field that points to a Service in the catalog.

## 0.1.0 - 2026-05

Initial public version: C4 diagrams with drill-down, AWS/GCP/Azure catalogs,
flows (recording + playback), journeys, undo/redo, local-first persistence
(localStorage / File System Access API), import/export (JSON, draw.io, Mermaid),
LLM-assisted diagramming, experimental real-time collaboration, and the plugin
system foundation.

This version was never tagged; the `version` field in `package.json` still
reads `0.1.0`.

## Earlier tags

Before 0.2.0 the project was tagged `v1` … `v2.1` without release notes.
Those tags predate the current versioning and are listed for reference only.

| Tag      | Date       | Main changes (pull requests)                                                         |
| -------- | ---------- | ------------------------------------------------------------------------------------ |
| `v2.1`   | 2026-07-03 | Structurizr (#52), storage warning (#53), File System permission recovery (#56), Docker for the server (#60), GCP icons (#66), contribution docs (#59), architecture docs (#71) |
| `v2.0`   | 2026-04-06 | Journeys (#44), LLM chat (#46)                                                        |
| `v1.9.1` | 2026-03-30 | Collaboration rewrite (#34), unknown element types (#36), external links (#37), DB table and JSON viewer nodes |
| `v1.9`   | 2026-03-24 | Scenes (#26), flow forks (#27), custom icons (#28), embed canvas (#29, #30), multiplayer (#31), editable edges (#32) |
| `v1.8`   | 2026-03-22 | Swimlanes (#25), store and export-service refactors                                  |
| `v1.5`   | 2026-03-20 | Nested panels (#18), local folder sync (#19), endpoints (#20, #21), GitHub imports (#23), i18n (#24), canvas search |
| `v1.3`   | 2026-03-14 | Refactors (#15)                                                                      |
| `v1.2`   | 2026-03-13 | Renamed from ArchFlow to Structura; registry detail panel; flow playback             |
| `v1.1`   | 2026-03-11 | Folders (#7), shortcuts (#8), store refactor (#9), element search (#13) |
| `v1`     | 2026-03-07 | Development environment setup (#5)                                                   |

[Unreleased]: https://github.com/clarkjoao/Structura/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/clarkjoao/Structura/compare/v2.1...v0.2.0

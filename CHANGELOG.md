# Changelog

All notable changes to Structura are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  `useCatalogActions` instead.

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

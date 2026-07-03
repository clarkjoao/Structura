# Proposal: Canvas Plugin MVP (plugin-system Phase 2)

## Why

The `plugin-system` spec (`openspec/specs/plugin-system/spec.md`) and the archived RFC
(`openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md`) fixed the plugin
contract on paper: manifest, lifecycle, and the versioned `StructuraPlugin.*` API. None of it
exists in code — extensibility is still in-tree only. This change implements Phase 2: the Canvas
Plugin MVP end-to-end, so the API can be exercised by a real plugin and declared `1.0.0`.

## What Changes

- New `src/features/plugins/` domain: public surface types, plugin registry (install records,
  lifecycle state machine, contribution ownership tracking), scoped `StructuraPluginApi` facade,
  and a Zustand `plugins` store slice.
- `window.StructuraPlugin.define(...)` loader: install from an explicitly user-picked local JS
  file, manifest validation (semver, apiVersion range, known capabilities, unique id), file
  snapshot persisted through `IStoragePort`, re-activation on startup for `enabled` records.
- Plugin manager page (`src/pages/settings/PluginsPage.tsx`, new `/plugins` route): install,
  enable/disable, uninstall, capability display, errored state — fully i18n'd (en + pt-BR).
- Canvas node-type registry gains `unregisterDescriptor()` and a reactive `nodeTypes` map
  (today it is computed once at module load); catch-all-last invariant preserved.
- Importer/exporter registries: `lib/export-service`'s hardcoded `DiagramExportFormat` union and
  the import UI learn to offer registered plugin contributions; import results are normalized and
  committed through store slices with `pushHistory`.
- Panel slots `element-inspector` and `service-registry-import` host error-boundaried plugin
  panels with a `PluginPanelContext` (read-only snapshots + sanctioned `updateComponent` /
  `updateService` mutations).
- `onDiagramChange` subscription on committed store changes; plugin-scoped `api.storage`
  namespaced per plugin id and backed by `IStoragePort`.
- One real example plugin validating the API end-to-end: the Mermaid flowchart importer as a
  local-file plugin (`examples/plugins/structura-plugin-mermaid-import.js`); the built-in Mermaid
  path stays (built-ins migrate onto shared registries later, per the RFC dogfooding note).

## Capabilities

### New Capabilities

_None — the contract was created by `add-plugin-system-foundation`._

### Modified Capabilities

- `plugin-system`: two additive requirements the RFC fixes but the spec does not yet state —
  the API surface is versioned and exposed as `api.apiVersion` starting at `1.0.0`, and plugin
  load failures (no/duplicate `define`, top-level throw, failed `activate`) must be contained
  with full rollback of tracked contributions. All existing requirements are implemented, not
  changed.

## Impact

- **New code**: `src/features/plugins/*` (no React/JSX outside panel-hosting components),
  `src/pages/settings/PluginsPage.tsx`, example plugin file, tests.
- **Modified code**: `features/canvas/nodes/node-types/registry.ts` (unregister + reactive map),
  `lib/export-service` (format registry), `pages/ImportModal.tsx` + canvas import surfaces
  (plugin importers), `pages/modelExplorer` export flow (plugin exporters), ElementPanel and
  Service Registry page (panel slots), `App.tsx` (route), i18n catalogs (en, pt-BR),
  persistence keys (`plugin:*` namespace via `IStoragePort`; no persisted diagram schema change,
  so no `PERSIST_SCHEMA_VERSION` bump).
- **Dependencies**: needs a semver range check — implement a minimal local helper (no new
  runtime dependency) unless one already exists.
- **Non-breaking**: no existing behavior is removed; built-in node types, importers and exporters
  keep working unchanged.

## Non-Goals

- Platform Plugins (routes/pages, Service Registry field schemas, background sync) — Phase 3.
- Sandbox, capability enforcement, CSP, signatures, npm/marketplace distribution — Phase 4.
- Migrating built-in integrations (DefectDojo, GitHub) onto the plugin API.
- Plugin settings UI framework, inter-plugin dependencies, lazy activation events.
- Opening the domain `ComponentType` union beyond namespaced plugin types degrading to
  `unknown` (the full domain-descriptor design remains `component-type-extensibility`).

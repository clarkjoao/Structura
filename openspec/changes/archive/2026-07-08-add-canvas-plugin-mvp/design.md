# Design: Canvas Plugin MVP implementation

## Context

The contract is already decided. The archived RFC
(`openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md`, D1–D8) and the
`plugin-system` spec are **normative** for this change: manifest schema (D2), lifecycle (D3),
`StructuraPluginApi` surface and contribution types (D4), trust model (D6), distribution (D7),
folder layout (D8). Nothing there is re-decided here. This document records only the
implementation-level choices the RFC left open.

## Decisions

### I1 — Opening the `ComponentType` union (minimal, per RFC D4.1)

`ComponentType` gains one member: `` PluginComponentType = `${string}/${string}` `` (namespaced
plugin types always contain `/`; no built-in type does). A guard `isPluginComponentType(type)`
joins the existing guards. Degradation path: `getDescriptor()` currently falls back to
`c4Descriptor`; for plugin-namespaced types with no live descriptor it falls back to
`unknownDescriptor` instead, and `unknownDescriptor.buildData` learns to surface the component's
name for plugin-typed components (persisted data untouched). The full domain-descriptor design
remains out of scope (`component-type-extensibility`).

### I2 — Reactive node-type registry

`registry.ts` keeps its array + `registerDescriptor()` contract and gains:

- `unregisterDescriptor(rfType)` — removes a descriptor; catch-all (`c4Descriptor`) stays last
  because it is never unregistered and inserts keep splicing before it.
- A listener set with `subscribeNodeTypes(listener)` and `getNodeTypesSnapshot()` returning a
  cached `NodeTypes` map rebuilt on registry change (fixes the compute-once-at-module-load bug).
- `useNodeTypes()` (`useSyncExternalStore`) consumed by `Canvas.tsx`; the legacy `nodeTypes`
  export remains as the initial snapshot for non-canvas consumers until they migrate.

Plugin attribution stays outside `NodeTypeDescriptor`: the plugin registry tracks
plugin-id → rfType list itself (RFC D3 point 4).

### I3 — Importer/exporter registries

New framework-free module `src/features/plugins/io-registry.ts` holds `ImporterContribution` /
`ExporterContribution` maps (throw on duplicate id, subscribe for UI). Built-in formats keep the
`DiagramExportFormat` union untouched; plugin exporters are offered _alongside_ built-ins in the
export modal (`pages/modelExplorer`), producing an `ExportArtifact` from a read-only
`DiagramSnapshot` and delivered through the existing `downloadFile`/zip flow. Plugin importers
appear as additional tabs in `pages/ImportModal.tsx`; their `ImportResult` is normalized
(host-assigned ids), committed through store slice actions with `pushHistory` first, and
warnings are surfaced via the existing toast mechanism. Migrating the built-in union onto the
registry is deliberately deferred (dogfooding step, RFC Phase 2 note).

### I4 — Snapshots and patches

`PluginComponentSnapshot`, `PluginConnectionSnapshot`, `PluginServiceSnapshot`, `DiagramSnapshot`
and the patch types are pure mappers in `src/features/plugins/snapshots.ts` (no React). Patches
whitelist fields (`name`, `description`, `tags`, `metadata`-like fields) and are applied through
existing slice actions `updateComponent` / `updateService`, which already handle `pushHistory`.

### I5 — Loader and execution

Install reads the picked file (`showOpenFilePicker` with `<input type="file">` fallback) and
executes it via `new Function(code)()` after installing a capture hook at
`window.StructuraPlugin.define`. Exactly one `define()` call is required; zero, two, or a
top-level throw → rejected, nothing persisted (spec: containment requirement). Activation runs
`activate(scopedApi)`; a throw/reject rolls back all tracked contributions and marks the record
errored.

### I6 — Persistence layout (all via `IStoragePort`, no schema-version bump)

- Install records: single key `plugins:installed` → array of
  `{ manifest, code, enabled, errored }` (code = file snapshot, RFC D3).
- Plugin storage: `plugin:<pluginId>:<key>`, with a per-plugin key index at
  `plugin:<pluginId>:__keys` so uninstall can delete the namespace (the port has no key listing).
- Nothing enters the Zustand persisted diagram schema → no `PERSIST_SCHEMA_VERSION` bump.

### I7 — `onDiagramChange`

The plugin registry subscribes once to the diagram store, watches the diagrams map by reference,
diffs which diagram ids changed, and notifies plugin callbacks on a trailing debounce (committed
states only — same rationale as the persistence sync debounce). All subscriptions for a plugin
are dropped on deactivate regardless of unsubscribe.

### I8 — Semver check

A minimal local helper (`semver.ts`) supporting exact versions and `^`/`~` ranges — enough for
`manifest.version` validation and `apiVersion` range checks. No new runtime dependency.

### I9 — UI

- `PluginsPage` at new route `/plugins` (lazy-loaded like every page): install button,
  per-plugin card (name, version, author, description, capability badges, enable switch,
  uninstall, errored state). All host strings through `t()` (en + pt-BR).
- `PluginPanelSlot` host component (error boundary + `PluginPanelContext` provider) mounted in
  the ElementPanel sections list (`element-inspector`) and the Service Registry import area
  (`service-registry-import`). `LocalizedText` resolved by `resolveLocalizedText(text, locale)`
  with plain-string fallback.

### I10 — Example plugin

`examples/plugins/structura-plugin-mermaid-import.js`: a self-contained plain-JS plugin
registering an `mmd`/`mermaid` importer with a minimal flowchart parser (subset: nodes + edges),
demonstrating manifest, `define()`, `ImportContext` dedupe and warnings. The built-in Mermaid
flow-import path is untouched.

## Risks / Trade-offs

- [`new Function` breaks under a strict CSP] → acceptable: the app ships no CSP today; the RFC
  already flags CSP co-evolution as Phase 4 work.
- [Template-literal `ComponentType` member loosens exhaustiveness checks] → confined: guards
  keep narrowing built-ins; switch statements over built-in types keep their `default` paths.
- [Key-index bookkeeping for plugin storage can drift] → writes are awaited and index updates are
  co-located in the storage facade; worst case an orphan key survives uninstall (harmless).

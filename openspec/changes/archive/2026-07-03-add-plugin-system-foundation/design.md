# Design: Plugin System Foundation (Canvas Plugin RFC)

## Context

Structura is a client-side SPA (no backend, no database). Extensibility today is in-tree only:

- `registerDescriptor()` in `src/features/canvas/nodes/node-types/registry.ts` is a working proto-API for canvas node types, with a clean `NodeTypeDescriptor` contract (plain object: declarative fields + pure builder functions receiving a `NodeBuildContext`).
- `src/integrations/defectdojo/` and `src/integrations/github/` are hand-written integrations wired into the Service Registry pages.
- Import/export formats are a hardcoded list in `src/lib/export-service/`.
- `docs/extension-points/README.md` inventories every current and needed extension point; `docs/architecture/plugin-system-preparation.md` fixes the philosophy (contribution points, capability-scoped context, built-ins as first plugins).

TODO.md **F-02** defines the baseline this design elaborates: two plugin kinds (Canvas, Platform), a five-method public API, local-file distribution for the MVP, and the warning that the public API is an expensive-to-change contract requiring RFC-first design validated against real use cases.

**Maintainer decisions already made** (encoded here, not re-opened):

1. **Trust model (MVP): no sandbox**, matching draw.io. A plugin is a local JS file the user explicitly loads; that act is informed consent. Plugin code runs in the app's JS context but MUST NOT touch the Zustand store, `IStoragePort`, or React Flow internals directly — only the versioned `StructuraPlugin.*` API. The manifest still declares capabilities so a future sandboxed model needs no manifest format break.
2. This **supersedes** the "static compilation only, no runtime loading in v1" stance of `docs/architecture/plugin-system-preparation.md` for the distribution model. Everything else in that document (contribution points over runtime, capability-scoped context, serializable-first contributions, built-ins dogfooding the same contracts) is carried forward.
3. **This change is spec-only.** Nothing under `src/` changes. Implementation is a later OpenSpec change scoped from this document.

## Goals / Non-Goals

**Goals:**

- Define the plugin manifest schema, lifecycle, and versioned `StructuraPlugin.*` public API precisely enough that the implementation change can be scoped without re-deciding anything.
- Design the **Canvas Plugin** kind in full detail (Phase 2 target).
- Validate the API on paper against two real use cases (DefectDojo-style, Mermaid-import-style) and fix any gap the walkthroughs expose.
- Document (not implement) the trust/security risks and the mitigations a later phase should evaluate.

**Non-Goals:**

- Platform Plugin design beyond the "future shape" paragraph in §Taxonomy.
- Sandbox implementation, npm scaffolding, marketplace, inter-plugin dependencies, plugin settings UI framework.
- Any code.

## Decisions

### D1 — Plugin definition and entry contract

For the MVP a plugin is a **single local JS file**. The file's only sanctioned side effect is one call to the global definition hook:

```ts
window.StructuraPlugin.define({
  manifest: PluginManifest,
  activate: (api: StructuraPluginApi) => void | Promise<void>,
  deactivate?: () => void | Promise<void>,
});
```

- `activate` receives the plugin's **own scoped instance** of `StructuraPluginApi` (the `StructuraPlugin.*` surface from TODO.md). Scoping the facade per plugin is what lets the host attribute and later bulk-unregister everything the plugin contributed — the plugin never has to hand back tokens.
- `deactivate` is optional cleanup for resources the host cannot track (timers, `fetch` aborts, external connections). Host-tracked registrations are rolled back by the host regardless (see D3).
- A file that never calls `define`, calls it twice, or throws at top level is rejected with a visible error; the app keeps running.

*Alternative considered:* draw.io's `Draw.loadPlugin(fn)` callback-only style (no manifest). Rejected: the maintainer decision requires declared capabilities and versioning up front, and a manifest is the anchor for the future marketplace/sandbox model.

### D2 — Manifest schema

```ts
interface PluginManifest {
  /** Unique id, npm-style or reverse-DNS (e.g. "structura-plugin-defectdojo"). */
  id: string;
  /** Display name (shown in the plugin manager UI). */
  name: string;
  /** Plugin's own version. MUST be valid semver. */
  version: string;
  author: string;
  description: string;
  /**
   * Semver range of the StructuraPlugin API the plugin supports
   * (e.g. "^1.0"). Checked at registration; incompatible → not activated.
   */
  apiVersion: string;
  /**
   * Declared capabilities. NOT enforced in the MVP (no sandbox) — declared
   * anyway so the plugin manager can display them and a future sandbox can
   * enforce them without a manifest format break.
   */
  capabilities: PluginCapability[];
  /**
   * Entry point, relative to the package root. Ignored for single-file MVP
   * plugins (the file is the entry point); required for the future
   * `structura-plugin-*` npm distribution.
   */
  entry?: string;
}

type PluginCapability =
  | "canvas:node-types" // registerNodeType
  | "io:importers"      // registerImporter
  | "io:exporters"      // registerExporter
  | "ui:panels"         // registerPanel
  | "events:diagram"    // onDiagramChange
  | "storage"           // plugin-scoped storage
  | "network";          // plugin intends to call external services via fetch
```

Validation at registration (fail loudly, never execute an invalid plugin): `id` unique among installed plugins; `version` and `apiVersion` parse as semver / semver range; `capabilities` contains only known values; required fields present and non-empty. A plugin that calls an API method not covered by its declared capabilities logs a console warning in the MVP (observability now, enforcement later).

### D3 — Lifecycle

```
            install (register)          activate                      deactivate                 uninstall
user picks file ──► manifest valid ──► code runs, activate(api) ──► contributions removed ──► record + storage deleted
                    record persisted     contributions tracked         subscriptions dropped
```

| Transition | Trigger | Effect |
| --- | --- | --- |
| **register (install)** | User explicitly picks a JS file in the plugin manager (File System Access API `showOpenFilePicker`, falling back to `<input type="file">`). | File contents read; `define()` evaluated **only far enough to obtain the manifest** is not possible without executing JS — so install IS consent to execute (see D6). Manifest validated per D2. On success, an install record (manifest + file snapshot + `enabled: true`) is persisted **through `IStoragePort`**. On failure, nothing is persisted and a visible error explains why. |
| **activate** | Immediately after successful install; and on app startup for every installed record with `enabled: true`. | Plugin code is executed, `activate(api)` is called with the plugin-scoped API. Every registration made through the api is tracked against the plugin id. If `activate` throws/rejects: all tracked registrations are rolled back, the plugin is marked *errored* in the manager UI, the app keeps running. |
| **deactivate (disable)** | User toggles the plugin off in the manager UI; also the first half of uninstall. | Host calls the plugin's `deactivate?()` (best-effort, errors logged not fatal), then force-unregisters **all** tracked contributions: node types leave the registry and the React Flow `nodeTypes` map, importers/exporters leave the format registry, panels unmount, `onDiagramChange` subscriptions drop. Components in saved diagrams that used a removed node type degrade to the existing `unknown` descriptor (the model's escape hatch) — data is never corrupted. |
| **uninstall** | User removes the plugin in the manager UI. | Deactivate (if active), then delete the install record and the plugin's scoped storage namespace. |

**What `registerDescriptor()` is missing today** (to be fixed by the implementation change, listed so it can be scoped):

1. No `unregisterDescriptor()` — the registry only grows.
2. The exported `nodeTypes` map is computed **once at module load** (`Object.fromEntries(...)` at top level of `registry.ts`); late registrations never reach React Flow. It must become reactive (rebuilt or subscribable on registry change).
3. `registerDescriptor` splices new descriptors before the last element to keep the catch-all (`c4Descriptor`) last — that invariant must survive unregistration too.
4. Descriptors carry no owner attribution; the plugin registry must track plugin-id → contributions externally (keeping `NodeTypeDescriptor` itself unchanged for built-ins).

**Startup and consent durability:** consent is given once, explicitly, at install. Plugins with `enabled: true` re-activate automatically on later startups (draw.io behaves the same); disabled or errored plugins never execute. The MVP persists a **snapshot of the file contents** at install time rather than a live file handle — File System Access handles require permission re-grants per session, which would either nag the user or silently fail on startup. Updating a plugin = re-installing the file. Trade-off accepted: a stale snapshot is predictable; a permission prompt storm is not.

### D4 — Public API contract (`StructuraPlugin.*`)

The API is **versioned independently from the app** with semver, starting at `1.0.0` when Phase 2 ships. `api.apiVersion` exposes it; `manifest.apiVersion` declares the compatible range, checked at registration. Breaking changes bump the major version and require a changelog entry and a deprecation note in the plugin docs. Internal refactors that don't touch this surface are free.

```ts
interface StructuraPluginApi {
  /** Semver of this API surface, e.g. "1.0.0". */
  readonly apiVersion: string;

  registerNodeType(descriptor: PluginNodeTypeDescriptor): void;
  registerExporter(handler: ExporterContribution): void;
  registerImporter(handler: ImporterContribution): void;
  registerPanel(section: PanelContribution): void;

  /** Fires after any committed change to a diagram. Returns unsubscribe. */
  onDiagramChange(callback: (diagramId: string) => void): () => void;

  /** Plugin-scoped persistent key-value storage (see D4.6). */
  readonly storage: PluginStorage;
}
```

The five methods are TODO.md F-02's surface unchanged; `storage` is the one addition, forced by the DefectDojo walkthrough (§Validation). All `register*` methods return `void` — ownership tracking is the host's job via the scoped facade, so plugins have nothing to hold on to. All `register*` methods **throw on duplicate id** within their registry, mirroring `registerDescriptor()`'s existing throw-on-duplicate-`rfType` behavior — failing loudly at registration is rule 2 of `docs/extension-points/README.md`.

#### D4.1 `registerNodeType(descriptor: PluginNodeTypeDescriptor)`

A thin, safe wrapper around the existing `registerDescriptor()` mechanism — not a parallel system.

```ts
interface PluginNodeTypeDescriptor {
  /**
   * React Flow type id. MUST be namespaced "<pluginId>/<name>"
   * (host validates the prefix) so plugin types can never collide
   * with built-ins or other plugins.
   */
  rfType: string;
  /** React component rendered for the node (same contract as NodeTypes[string]). */
  component: NodeTypes[string];
  /**
   * Domain component type this descriptor matches, namespaced the same
   * way. The host derives NodeTypeDescriptor.matches from it; persisted
   * components carry this string so a workspace opened without the plugin
   * degrades to the `unknown` descriptor instead of corrupting.
   */
  componentType: string;
  zIndex?: number;
  connectable?: boolean;
  canHaveParent?: boolean;
  canBeParent?: boolean;
  buildData: (comp: PluginComponentSnapshot) => Record<string, unknown>;
  defaultSize?: { width: number; height: number };
  defaultData?: Record<string, unknown>;
  draggable?: boolean;
  selectable?: boolean;
}
```

Differences from the internal `NodeTypeDescriptor`, and why:

- `matches` is replaced by a declarative `componentType` (host derives the predicate) — plugins must not pattern-match arbitrary internal types.
- `buildData` receives a `PluginComponentSnapshot` (a stable, read-only projection: id, type, label, description, position, size, metadata) instead of the full `NodeBuildContext`. `NodeBuildContext` exposes selection sets, drag state, flow-recording state and store callbacks — all internals that would instantly become a frozen de-facto API. Snapshot fields are added deliberately, by API minor version, as plugins demonstrate need.
- `buildStyle`, `dragHandle`, `focusable` and function-valued `zIndex` are omitted from v1 (smallest committed surface; additive later).
- Prerequisite noted for the implementation change: the domain `ComponentType` union is closed today (`docs/extension-points/README.md` marks "Node types (domain)" 🔴). Namespaced plugin component types with `unknown`-degradation are the minimal opening this API needs; the full domain-descriptor design remains the separate `component-type-extensibility` effort.

#### D4.2 `registerExporter(handler: ExporterContribution)`

```ts
interface ExporterContribution {
  /** Unique within the exporter registry (throw on duplicate). */
  id: string;
  /** Display label for the export UI. */
  label: string | LocalizedText;
  /** File extension without dot, e.g. "puml". */
  extension: string;
  mime: string;
  /** Pure: receives a read-only diagram snapshot, returns file content. */
  export(diagram: DiagramSnapshot): string | Promise<string>;
}
```

The host wraps the result into the existing `ExportArtifact` flow (`src/lib/export-service/build-export-files.ts`) — naming, download, zip. Prerequisite for implementation: `lib/export-service`'s hardcoded `DiagramExportFormat` union becomes a registry (already inventoried as 🔴 "Importers / Exporters" in extension-points).

#### D4.3 `registerImporter(handler: ImporterContribution)`

```ts
interface ImporterContribution {
  id: string;
  label: string | LocalizedText;
  /** Extensions without dot, e.g. ["mmd", "mermaid"]. */
  extensions: string[];
  /** Optional content sniffing when the extension is ambiguous. */
  canImport?(fileName: string, contents: string): boolean;
  import(contents: string, ctx: ImportContext): ImportResult | Promise<ImportResult>;
}

interface ImportContext {
  /** Read-only snapshots of the target diagram, for merge/dedupe decisions. */
  existingComponents: Readonly<Record<string, PluginComponentSnapshot>>;
  existingConnections: Readonly<Record<string, PluginConnectionSnapshot>>;
  /** Canvas position where imported content should be anchored. */
  anchor: { x: number; y: number };
}

interface ImportResult {
  components: PluginComponentInput[];   // plain data, host assigns/validates ids
  connections: PluginConnectionInput[];
  warnings: string[];
}
```

The plugin returns **plain data**; the host normalizes it (`normalize-imported-diagram.ts`), applies it through store slices with `pushHistory` first, and reports warnings. The plugin never touches the store, and undo/redo works for free. `ImportContext` exists because the Mermaid walkthrough exposed it (§Validation): today's `parseMermaidFlowchart(text, existingComponents, existingConnections, anchor)` needs exactly this to merge into an existing diagram.

#### D4.4 `registerPanel(section: PanelContribution)`

```ts
type PanelSlot = "element-inspector" | "service-registry-import";

interface PanelContribution {
  id: string;
  slot: PanelSlot;
  title: string | LocalizedText;
  /** React component; rendered inside the host slot, error-boundaried. */
  component: React.ComponentType<PluginPanelProps>;
}

interface PluginPanelProps {
  context: PluginPanelContext;
}

interface PluginPanelContext {
  /** Read-only snapshot of the current selection (element-inspector slot). */
  selection: readonly PluginComponentSnapshot[];
  /** Read-only snapshot of the service being viewed (service-registry slot). */
  service: PluginServiceSnapshot | null;
  /** Sanctioned mutations — routed through store actions, pushHistory included. */
  updateComponent(id: string, patch: PluginComponentPatch): void;
  updateService(id: string, patch: PluginServicePatch): void;
  /** Current locale ("en" | "pt-BR"), so plugins can localize their own text. */
  locale: string;
}
```

Two slots only in v1, both existing seams: the element inspector (`canvas/panels/ElementPanel` sections) and the Service Registry import area (where `DefectDojoPanel` mounts today via `pages/serviceRegistry`). This follows extension-point rule 3: every contribution pairs a contract with a context object; contributions read from context, never import internals. Panels are wrapped in an error boundary — a crashing plugin panel must not take down the page.

`LocalizedText` (used by `label`/`title` above) is `string | Partial<Record<"en" | "pt-BR", string>>`: third-party plugins cannot add keys to the app's i18n catalogs, so they carry their own translations; the host resolves against the active locale with plain-string fallback. All **host-owned** plugin-management UI text goes through `t()` per the repo hard rule — restated as a spec requirement.

#### D4.5 `onDiagramChange(callback): () => void`

Exactly as drafted in TODO.md: callback receives the `diagramId` of a diagram whose committed state changed; returns an unsubscribe function. Fired after store commits (not during drags — same debounce the persistence sync uses), so plugins observe consistent states. All subscriptions are dropped on deactivate regardless of whether the plugin unsubscribed.

#### D4.6 `storage: PluginStorage`

```ts
interface PluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Namespaced per plugin (`plugin:<pluginId>:<key>`) and backed by `IStoragePort` — plugins get persistence without touching `localStorage` (which the hard rules forbid outside `infrastructure/persistence/`). Deleted on uninstall. Added because the DefectDojo walkthrough requires it (config: base URL + API token).

### D5 — Taxonomy: Canvas Plugin vs Platform Plugin

- **Canvas Plugin** (this design, Phase 2 target): extends the diagramming surface — node types, importers/exporters, inspector/registry panels, diagram-change observation. Fully covered by D4.
- **Platform Plugin** (future shape only, per this change's Non-Goals): extends the application shell — new routes/pages, external integrations (Confluence, Jira), Service Registry field schemas, background sync. Expected shape: the same manifest and lifecycle, with additional capabilities (e.g. `ui:routes`, `registry:fields`) and API namespaces added by API minor/major versions; the GitHub integration (`src/integrations/github/`, with its import plan/merge-conflict machinery) is the benchmark use case. Nothing here constrains that future design except the manifest format and lifecycle, which it must reuse.

### D6 — Trust & security model (MVP)

**Model:** no sandbox. Loading a local JS file after an explicit file-picker action is the user's informed consent, exactly as in draw.io. The plugin manager UI shows the manifest's declared capabilities before finishing install, so consent is informed by *something* — but nothing technically enforces the declarations in the MVP.

**The "no direct access" rule is a contract, not a boundary.** Plugin code runs in the same JS context and *could* reach the Zustand store, `localStorage`, or React Flow internals. The rule that it must not is enforced socially and by review (for `structura-plugin-*` official packages), and stated in the spec so violations are unambiguous bugs. Honest documentation of this gap is part of the model.

**Documented risks (mitigations to evaluate in Phase 4, not now):**

| Risk | Later mitigation to evaluate |
| --- | --- |
| Arbitrary JS execution — a plugin can do anything the app can, including reading every workspace and exfiltrating it | iframe/worker sandbox with a postMessage bridge implementing `StructuraPluginApi`; capability enforcement at the bridge |
| XSS surface — plugin-rendered panels/nodes inject into the app DOM | Sandboxed rendering slots; CSP (`script-src` without `unsafe-eval`/`unsafe-inline` breaks naive plugin eval — CSP design must co-evolve with the loader) |
| Supply-chain — a user loads a file a third party gave them; a popular plugin file is trojaned | Signature verification + curated marketplace review for `structura-plugin-*`; checksums shown at install |
| Silent capability creep — plugin uses APIs beyond declared capabilities | MVP: console warning on undeclared use (D2). Later: hard enforcement at the API facade or sandbox bridge |
| Persistence poisoning — plugin writes garbage through its storage or patch surface | Patches validated before commit (`PluginComponentPatch` whitelists fields); storage namespaced and quota-limited |

### D7 — Distribution model

- **MVP:** local JS files, loaded explicitly via the File System Access API (`showOpenFilePicker`) with `<input type="file">` fallback. Fits the no-backend architecture — there is nothing to host or fetch. File contents snapshotted at install (D3).
- **Later:** official/community plugins as npm packages named `structura-plugin-*`, with `manifest.entry` pointing at the bundled entry file. Distribution mechanics (how an npm package reaches a no-backend SPA — pre-bundled "official set", URL import, or marketplace) are decided in Phase 4, not here; the manifest already carries what that decision needs.

### D8 — Folder layout (future implementation change)

Consistent with TODO.md F-02's file list and the `features/<domain>` architecture in AGENTS.md:

```
src/features/plugins/
├── plugin.types.ts        # PluginManifest, StructuraPluginApi, contribution types (public surface types)
├── plugin-registry.ts     # install records, lifecycle state machine, contribution ownership tracking
├── plugin-api.ts          # the scoped StructuraPluginApi facade handed to activate()
└── store/
    └── plugins.store.ts   # Zustand slice: installed plugins, enabled/errored state
src/pages/settings/
└── PluginsPage.tsx        # plugin manager UI (install, enable/disable, uninstall, capability display)
```

Plus surgical changes to existing files (inventoried in D3/D4): `features/canvas/nodes/node-types/registry.ts` (unregister + reactive `nodeTypes`), `lib/export-service/index.ts` (importer/exporter registry), the import modal (plugin importers). `features/plugins` follows the domain-layer rule: no React/JSX outside the page and panel-hosting components.

## Validation against real use cases

### Use case 1 — DefectDojo plugin (today: `src/integrations/defectdojo/`)

Today's integration: a config form + search panel mounted in the Service Registry page, an HTTP client for the DefectDojo REST API, config persisted via `defaultStorage` under `defectdojo:config`, and service enrichment through `syncServiceFromSources`.

As a plugin against this API:

1. **Manifest**: `capabilities: ["ui:panels", "storage", "network"]`, `apiVersion: "^1.0"`.
2. **`activate(api)`** calls `api.registerPanel({ id: "defectdojo-import", slot: "service-registry-import", title: { en: "DefectDojo", "pt-BR": "DefectDojo" }, component: DefectDojoPanel })`.
3. The panel reads/writes its config (base URL, API token) via `api.storage` — replacing today's direct `defaultStorage`/`localStorage` access, which a third-party plugin must not have.
4. Search calls the DefectDojo REST API with plain `fetch` (declared `network` capability; no sandbox, so no bridge needed).
5. Applying a result to a service uses `context.updateService(id, patch)` from `PluginPanelContext` — replacing today's in-tree merge writes. The merge heuristics (`merge-utils.ts`) stay plugin-side; only the final patch crosses the API.
6. `onDiagramChange` is not needed; `deactivate` aborts in-flight fetches.

**Gaps this walkthrough exposed → fixed in the API**: (a) plugin-scoped persistent storage — added as `api.storage` (D4.6); (b) a sanctioned write path to service fields — added as `PluginPanelContext.updateService` (D4.4); (c) a Service Registry panel slot — `"service-registry-import"` added to `PanelSlot` (D4.4). **Verdict: expressible.** Residual honesty: today's panel is one of the built-in import tabs; as a plugin it renders in the generic plugin slot of that page — same function, slightly different placement.

### Use case 2 — Mermaid import plugin (today: `src/features/diagram/utils/import-mermaid-flowchart.ts`)

Today's path: `parseMermaidFlowchart(text, existingComponents, existingConnections, anchor)` parses flowchart text into a plan (new components/connections, dedup against existing ones, error list) that the caller applies to the store.

As a plugin:

1. **Manifest**: `capabilities: ["io:importers"]`.
2. **`activate(api)`** calls `api.registerImporter({ id: "mermaid-flowchart", label: {...}, extensions: ["mmd", "mermaid"], canImport: (name, text) => /^\s*(flowchart|graph)\b/m.test(text), import: parse })`.
3. `import(contents, ctx)` runs the same parsing logic, using `ctx.existingComponents`/`ctx.existingConnections` for dedupe and `ctx.anchor` for placement — then returns `{ components, connections, warnings }` as plain data.
4. The host normalizes, calls `pushHistory`, commits through store slices, shows warnings. Undo works without the plugin knowing history exists.

**Gap this walkthrough exposed → fixed in the API**: an importer signature of just `(contents) => diagram` (the naive reading of TODO.md's `registerImporter(handler)`) cannot express merge-into-existing-diagram — today's Mermaid path fundamentally needs the existing components, connections, and an anchor. `ImportContext` (D4.3) was added for exactly this. **Verdict: expressible, with better separation than today** (the current code applies store mutations at the call site; the plugin version can't).

## Risks / Trade-offs

- [No sandbox means the API ban is unenforceable] → Documented honestly (D6); manifest capabilities + scoped facade keep the future enforcement path open; Phase 4 revisits.
- [File-snapshot installs go stale] → Predictable behavior chosen over permission-prompt storms; re-install = update; revisit if File System Access permission persistence improves (D3).
- [`PluginComponentSnapshot`/patch types are new stable surfaces] → Kept minimal by design; grow additively by API minor version. The snapshot is the price of not freezing `NodeBuildContext` (D4.1).
- [Namespaced plugin component types pre-empt part of the domain component-descriptor design] → Coordinated: only the namespace convention and `unknown`-degradation are fixed here; the full domain design (`component-type-extensibility`) keeps its freedom (D4.1).
- [Two panel slots may be too few] → Deliberate: slots are cheap to add (minor version), impossible to remove. Wait for demand (extension-points rule: "wait for real demand before designing").
- [API v1 surface could still be wrong despite two walkthroughs] → Phase 2 builds one real example plugin end-to-end before the API is declared `1.0.0`; built-ins migrating onto the same registries (dogfooding) is the ongoing falsification test.

## Future phases roadmap (context only — nothing below is part of this change)

- **Phase 1 (this change):** RFC reviewed and archived; API surface signed off.
- **Phase 2:** Canvas Plugin MVP end-to-end — loader, lifecycle, plugin manager page, the D4 API at `1.0.0`, one real example plugin (candidate: extracting the Mermaid flowchart importer).
- **Phase 3:** Platform Plugin — routes/pages, external integrations, Service Registry field schemas; GitHub integration as the benchmark.
- **Phase 4:** Revisit trust model if community uptake justifies a marketplace — sandbox (iframe/worker bridge), capability enforcement, CSP, signature verification, npm distribution mechanics.

## Open Questions

None blocking. Two items intentionally deferred with their trigger conditions: npm-to-SPA distribution mechanics (Phase 4, needs marketplace decision) and lazy activation events (VS Code-style `onCommand:`; the manifest's async `activate` already permits it — optimize only if startup cost appears).

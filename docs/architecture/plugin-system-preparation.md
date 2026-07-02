# Plugin System — Architectural Preparation

**Status:** Preparation only. Nothing here is implemented; the design happens
in `specs/0005-plugin-contribution-points` (and its prerequisites). This
document fixes the philosophy so that all work between now and then converges
instead of diverging.

## Philosophy: contribution points, not a plugin runtime

The VS Code lesson Structura adopts is not the marketplace — it is
**contribution points**: a plugin is mostly *declarations* against published
contracts, plus small amounts of code invoked through those contracts.
Concretely:

1. **A plugin is a manifest plus contributions.** Sketch (illustrative, to be
   specified):

   ```ts
   interface StructuraPlugin {
     id: string;                    // reverse-DNS-ish, unique
     version: string;               // semver
     engine: string;                // compatible Structura API range
     contributes: {
       nodeTypes?: DomainComponentDescriptor[];   // paired with canvas descriptors
       canvasNodes?: NodeTypeDescriptor[];
       commands?: CommandContribution[];
       importers?: ImporterContribution[];
       exporters?: ExporterContribution[];
       validators?: ValidatorContribution[];
       panels?: InspectorSectionContribution[];
       palette?: PaletteContribution[];
       aiProviders?: AIProviderContribution[];
       // grows with the extension-point inventory
     };
     activate?(ctx: PluginContext): void | Promise<void>;
     deactivate?(): void | Promise<void>;
   }
   ```

2. **Capability-scoped API, not store access.** `PluginContext` exposes
   narrow capabilities (read model via selectors, mutate via commands/patches,
   register UI in sanctioned slots). Plugins never receive the Zustand store,
   React Flow instance, or another feature's internals. The AI patch contract
   ([ai-integration](../concepts/ai-integration.md)) is the precedent:
   powerful actors get a reviewed vocabulary, not root.

3. **Built-ins are plugins first.** The existing node descriptors, cloud
   catalogs, exporters, and LLM providers become the first "plugins"
   (statically imported, same contracts). This is the forcing function that
   keeps the API honest — if C4 can't be expressed as contributions, the
   contract is wrong.

4. **Static first.** Plugins are compiled in (a `plugins/` source directory,
   registered at startup). No runtime loading, no marketplace, no sandbox in
   v1 — see Security below for why this is a feature, not a shortcut.

## What must become an extension point

The full inventory with status lives in
[extension-points/README.md](../extension-points/README.md). The dependency
spine, in order:

1. **Domain component descriptors** — open the `ComponentType` bottleneck
   (spec 0002). Without this, "plugin" means "canvas skin".
2. **Command system** (spec 0003) — toolbar actions, context menus, keyboard
   shortcuts, palette, and MCP are all *placements of commands*; one registry
   serves five surfaces.
3. **Contribution points v1** (spec 0005) — the manifest, `PluginContext`,
   registration order, and the pairing rules (a node type contribution may
   bundle its inspector section, palette entry, and export cell builder).
4. Importers/exporters, validators, layout providers, AI providers — each
   becomes a `contributes` key as its registry lands.

Diagram **profiles** (VSM, Step Functions, Saga) are the intended first
consumers: a profile = one plugin bundling node/edge types + palette +
validators + defaults.

## Lifecycle

Deliberately minimal in v1:

- **Register** (startup): manifests validated (unique ids, engine range,
  contribution invariants — e.g. catch-all ordering), contributions added to
  registries. A failing plugin is skipped with a visible warning; it must
  never take the app down.
- **Activate**: eager at startup in v1. Lazy activation events
  (VS Code-style `onCommand:`, `onDiagramType:`) are a later optimization —
  designed for in the manifest (`activate` is async) but not built.
- **Deactivate**: exists for symmetry and tests; in v1 "disable" means
  "restart without it".

## Dependency management & versioning

- **v1: no inter-plugin dependencies.** Plugins depend on the Structura API
  only (`engine` semver range checked at registration). Inter-plugin deps
  (a Saga plugin extending the Step Functions palette) are a real future
  need — the manifest reserves the field, the resolver is not built until
  two real plugins need it.
- **The API is versioned as one surface.** Whatever `PluginContext` and the
  contribution types export is *the* public API; changes to it follow semver
  and get changelog entries. Internal refactors that don't touch it are free.
  This is the concrete meaning of "stable extension points over internal
  access".
- Persisted data created by plugin node types must carry the plugin id +
  contribution id, so a workspace opened without the plugin degrades to the
  existing `unknown` component (already the model's escape hatch) instead of
  corrupting.

## Security

Static compilation is the v1 security model, and it is honest: **code that
ships in the bundle is code the maintainers reviewed.** There is no boundary
to pretend about. The dangerous step is *runtime* third-party loading, which
would require sandboxing (iframe/worker isolation), a permissions model, and
supply-chain review — a product in itself. Decision: do not cross that line
until there is a compelling, spec'd reason. What we do now to keep the
option open:

- Capability-scoped `PluginContext` (least authority from day one).
- No contribution ever receives DOM outside its sanctioned slot.
- Serializable-first contributions (declarations over code) so a future
  sandbox has less code to isolate.

## Discoverability

- v1: plugins are visible in the repo (`plugins/` directory) and in an
  in-app "capabilities" listing derived from registered manifests (cheap,
  since manifests are data).
- A community story (recipes, copy-in plugins, eventually a curated gallery)
  is explicitly deferred — an ecosystem before API stability produces
  breakage and resentment.

## Anti-goals (v1)

Runtime plugin loader · marketplace · sandboxed third-party code ·
inter-plugin dependency resolution · plugin settings UI framework. Each is
deferred, not rejected — and each requires its own spec to un-defer.

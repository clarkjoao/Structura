# Extension Points

The inventory of everywhere Structura is — or must become — extensible. This
is the master list the plugin system will formalize; the philosophy and
sequencing live in
[architecture/plugin-system-preparation.md](../architecture/plugin-system-preparation.md).

**Status legend:**
🟢 registry exists today · 🟡 seam exists, no registry · 🔴 hardcoded, needs design

| Extension point | Status | Where today | Notes |
| --- | --- | --- | --- |
| Node types (canvas) | 🟢 | `canvas/nodes/node-types/registry.ts` (`registerDescriptor`) | Plugin render descriptors only. Built-ins resolve through the element registry ([ADR-0010](../adr/0010-element-registry.md)). |
| Node types (domain) | 🟢 | `features/elements` (`ElementDescriptor` / `elementRegistry`, `CloudFamilyDefinition`) | **Resolved.** Single owner for structural, C4, and cloud families. See [element-registry.md](element-registry.md). `NODE_TYPE_REGISTRY` is plugins-only; unknown types → `unknown`. |
| Edge types | 🔴 | single `EditableEdge` renderer | Blocked on edge redesign; design `EdgeTypeDescriptor` there. |
| Cloud providers / catalogs | 🟢 | `features/elements/packs/<id>/pack.json` → `registerElementPack` → `registerCloudFamily` | AWS/GCP/Azure/Kubernetes/OSS are element packs (data in JSON, a small TS adapter for icons/export). A new family, category, service or shape is a JSON edit; see [element-registry.md#element-packs](element-registry.md#element-packs). |
| Plugin UI kit | 🟢 | `features/plugins/ui-kit` → `api.ui.*` and the `__STRUCTURA_UI__` global (`@structura/ui`) | API 1.18: host components behind stable props (Button, Field, Select, Tabs, Card, …), so plugin UI matches the design system without relying on host Tailwind classes. |
| Element packs (plugins) | 🟢 | Plugin capability `canvas:elements` | `registerElementPack` / `registerShape` (API 1.17): same format as the built-in packs; types `<pluginId>/<id>`, offered in the palette, catalog, search and assistant, removed on deactivate. |
| Storage backends | 🟢 | `IStoragePort` adapters | Add adapters, never bypass the port. |
| AI providers | 🟡 | `features/llm/providers/*` | Common call shape exists; needs a formal provider registry + capability flags. |
| Importers / Exporters | 🟢 | Plugin capability `io:importers`, `io:exporters` | Registry via `registerImporter`/`registerExporter`. Since API 1.14, `registerWorkspaceImporter` adds an entry to the workspace home's Import that sets a whole source up (it may `createFolder`, `createDiagram` in a folder, and move a picked folder to a new binding id with `files.move`); the host opens the diagram it names and, if asked, the plugin's own document pane. |
| Export cell builders | 🔴 | `lib/export-core` (neutral IR + `cell-builders.ts` `kind` switch), shared with the LeanIX plugin via **versioned sync, not direct import** | Single source of truth for draw.io generation across app + plugins ([ADR-0009](../adr/0009-export-core-sharing.md)). The plugin cannot import the host (no path mapping, no workspaces, IIFE bundle isolates it), so `plugins/.../scripts/sync-shared.mjs` copies `export-core/**` into `plugins/.../src/generated/export-core/` and `npm run plugins:sync-check` guards drift in CI. Still a `kind` switch; should become per-node-type contributions paired with element descriptors. |
| opscr projection | 🟡 | `lib/opscr-mapping` (opscr workspace → technical view + layout graph) | Pure, shared by design with the planned `structura-plugin-opscr` and VSCode preview through the same versioned sync as `export-core`; no consumer yet. Takes the workspace structurally, so the app never depends on the `opscr` package. Provider → catalog service is a table pinned to the catalogs by a test. See [src/lib/opscr-mapping/README.md](../../src/lib/opscr-mapping/README.md). |
| Commands | 🔴 | ad-hoc store action calls from UI | Prerequisite for toolbar/menu/shortcut/palette/MCP extensibility. Needs its own spec. |
| Toolbar actions | 🟢 | Plugin `canvas-toolbar` slot | Plugins register buttons via `ui:panels` capability with `slot: "canvas-toolbar"`. |
| Context menus | 🔴 | hardcoded menus | Same: command contributions with context predicates. |
| Inspector panels / property editors | 🟢 | Plugin `element-inspector` slot | Plugins add sections to element inspector via `ui:panels` capability. |
| Toast notifications | 🟢 | Plugin `ui:overlays` capability | Plugins call `api.overlay.showToast()` to display toasts. |
| Modal dialogs | 🟢 | Plugin `ui:overlays` capability | Plugins call `api.overlay.openModal()` to open modals. |
| Versions (branches) | 🟢 | Plugin `api.versions` (API 1.14, `diagram:read` / `diagram:write`) | A plugin upserts Versions by `key` (whole content against the base, owned by the plugin), lists them with their conflicts, activates one, and receives the user's merge / rename / delete / status / create through `onAction` (`features/plugins/version-actions.ts`). `getDiagram` returns the active Version applied, `{ base: true }` the base. |
| Element picker / palette entries | 🟡 | `features/elements` palette + family tabs | Largely derived from the element / cloud-family registries; remaining hardcoded chrome can become contributions. |
| Validators | 🟡 | `validate-diagram.ts` (interchange); per kind: `DiagramKindDescriptor.conforms` / `checks` | Kind-level conformance and quiet checks exist ([ADR-0014](../adr/0014-diagram-kinds.md)); diagram-wide validators outside a kind do not. |
| Templates / patterns | 🟡 | `ElementPreset` store, `lib/catalogs/patterns/` | User presets are runtime data; built-in patterns should become contributions. |
| Diagram types (kinds) | 🟡 | `features/diagram-kinds` (`DiagramKindDescriptor`, `registerDiagramKind`, `resolveKindPolicy`) | A kind = metadata over an ordinary diagram: palette, conformance, creation template, derivation, arrangement, checks, commands, interaction policy. Built-in `guided` registers through it; plugin exposure is a follow-up. See [ADR-0014](../adr/0014-diagram-kinds.md). |
| Layout providers | 🔴 | `layout/layoutEngine.ts` (`layout()`) + `layout/applyLayoutResult.ts` | One engine and one applicator, shared by all four consumers: `hooks/useAutoLayout` (toolbar button), `hooks/usePanelChildLayout` ("Organize children"), `llm/apply-diagram-patch.ts` and `layout/layoutScopedNodes.ts` (mermaid/draw.io import, via `FlowPanel`). The contract is single; what is still missing is a *registry* — `layout()` hardcodes ELK, so an alternative algorithm per selection or diagram profile has nowhere to register. A kind may bring its own arrangement (`DiagramKindDescriptor.arrange`, run by the kind watcher on the shared ELK ordering). |
| Themes | 🔴 | Tailwind + CSS vars | Low priority; CSS-variable theming is nearly sufficient. |
| Sidebar views | 🔴 | page-level composition | Wait for real demand before designing. |
| MCP providers | 🔴 | none | Must be built on the command system + patch contract, never raw store access. |
| Keyboard shortcuts | 🟡 | `canvas/hooks/keyboard`, `lib/keyboard-*` | Centralized handling exists; binding table should key off command ids. |

## Rules for extension-point design

1. **Contribution = data + functions, no classes.** Follow
   `NodeTypeDescriptor`: a plain object with declarative fields and pure
   builder functions.
2. **Registries validate at registration** (duplicate ids, invariants like
   the catch-all ordering) and fail loudly.
3. **Every extension point pairs a contract with a context object** (like
   `NodeBuildContext`): contributions read from context, never import
   internals.
4. **Core behavior must not degrade when zero contributions are registered.**
   Built-ins register through the same mechanism as future plugins
   (dogfooding is the test that the contract is sufficient).
5. **New extension points require a spec** — they are five-year commitments;
   propose one via [OpenSpec](../../openspec/) (`/opsx:propose`).

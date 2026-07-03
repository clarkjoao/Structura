# Extension Points

The inventory of everywhere Structura is — or must become — extensible. This
is the master list the plugin system will formalize; the philosophy and
sequencing live in
[architecture/plugin-system-preparation.md](../architecture/plugin-system-preparation.md).

**Status legend:**
🟢 registry exists today · 🟡 seam exists, no registry · 🔴 hardcoded, needs design

| Extension point | Status | Where today | Notes |
| --- | --- | --- | --- |
| Node types (canvas) | 🟢 | `canvas/nodes/node-types/registry.ts` (`registerDescriptor`) | The template registry. Ordered matching, catch-all last. |
| Node types (domain) | 🔴 | `ComponentType` union in `diagram/model` | **Top priority.** Blocks every new diagram vocabulary. Needs domain component descriptors. |
| Edge types | 🔴 | single `CustomEdge` renderer | Blocked on edge redesign; design `EdgeTypeDescriptor` there. |
| Cloud providers / catalogs | 🟢 | `features/cloud/registry` | AWS/GCP/Azure today; catalog shape is reusable for other icon/service packs. |
| Storage backends | 🟢 | `IStoragePort` adapters | Add adapters, never bypass the port. |
| AI providers | 🟡 | `features/llm/providers/*` | Common call shape exists; needs a formal provider registry + capability flags. |
| Importers / Exporters | 🔴 | `lib/export-service` hardcoded format list | Registry of `{id, extensions, capabilities, import?, export?}`. |
| Export cell builders | 🔴 | `cell-builders.ts` switches on type | Should become per-node-type contributions paired with node descriptors. |
| Commands | 🔴 | ad-hoc store action calls from UI | Prerequisite for toolbar/menu/shortcut/palette/MCP extensibility. Needs its own spec. |
| Toolbar actions | 🔴 | `canvas/toolbar` composition | Becomes command contributions + placement metadata. |
| Context menus | 🔴 | hardcoded menus | Same: command contributions with context predicates. |
| Inspector panels / property editors | 🔴 | `canvas/panels/ElementPanel` sections | Per-type sections should resolve from a registry keyed by component type. |
| Element picker / palette entries | 🔴 | `canvas/toolbar/element-picker` + `lib/catalogs` | Catalog data is close to contribution-shaped already. |
| Validators | 🔴 | `validate-diagram.ts` (interchange only) | Model-level validation rules (per diagram profile) don't exist yet. |
| Templates / patterns | 🟡 | `UserTemplate` store, `lib/catalogs/patterns.ts` | User templates are runtime data; built-in patterns should become contributions. |
| Diagram types (profiles) | 🔴 | `Diagram.level` is a free string | A profile = bundle of node/edge types, palette, validators, defaults. Late-stage. |
| Layout providers | 🔴 | `useAutoLayout` | Registry of layout algorithms per selection/diagram profile. |
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
   see [specs/README.md](../../specs/README.md).

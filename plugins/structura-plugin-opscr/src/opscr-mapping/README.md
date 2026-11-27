# opscr-mapping

Projects an opscr workspace — architecture described as YAML
manifests — into a Structura **technical view**: the elements to draw, how they nest, and the edges
between them, plus a layout graph for the app's layout engine.

It is the one place that answers "what does this workspace look like in Structura", so the importer
plugin, the VSCode preview and, later, the bidirectional editor cannot draw the same YAML differently.
Spec: `openspec/changes/opscr-technical-view/`.

## Rules

- **The plugin's, not the app's.** It lives in `structura-plugin-opscr`; the app does not import
  it. The VSCode extension copies this folder with its `sync-shared` script.
- **Framework-agnostic.** Relative imports only: no `@/features`, no plugin API, no `opscr`, so the
  copy works in the extension. A test (`test/opscr-mapping/elements.test.ts`) enforces it.
- **Structural input.** `OpscrWorkspaceInput` is only what the projection reads. An `opscr/core`
  `Workspace` satisfies it, so callers pass it straight through.
- **Never throws.** Anything `opscr compile` would reject degrades and is reported in `omitted` /
  `dropped`.

## Use

```ts
import { compileSources } from "opscr/core"; // in the adapter, not here
import { buildTechnicalView, placeView, placeViewWith, toImporterGraph } from "./opscr-mapping";

const { workspace } = await compileSources({ files });
const view = buildTechnicalView(workspace);
const placed = await placeViewWith(api.layout, view, previous); // Structura places it
const graph = toImporterGraph(placeView(view, placed)); // plugin importer result / embed input
```

This library decides _what_ is drawn; Structura decides _where and how big_. `placeViewWith`
hands the view to the host's placement — the plugin's `api.layout.place` (API 1.21), the VSCode
extension's webview (`STRUCTURA_PLACE`, answered by the same implementation) — so every channel
sizes and places a workspace the way the canvas does: with nothing drawn, the canvas's Arrange;
afterwards, what is drawn stays exactly where it is (`previous`, by element key, relative to its
parent) and each new element goes beside what it is connected to, along the reading, where it
overlaps nothing.

## The technical view

| opscr                                 | Drawn as                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Product`, `Domain`, `BoundedContext` | panel; `belongsTo` nests into it                                                                     |
| `Subdomain`                           | not drawn — a bounded context that belongs to one lands in its Domain                                |
| Technical Kinds                       | the catalog service of `spec.provider` (`PROVIDER_SERVICES`), else a C4 container naming the product |
| `ExternalSystem` / `Channel`          | C4 system / C4 container                                                                             |
| Business and organization Kinds       | not drawn, listed in `omitted`                                                                       |
| Any edge but `belongsTo`              | an edge, `from` → `to`, when both ends are drawn; otherwise listed in `dropped`                      |

Ids are `Kind/name`: in opscr the name is the identity.

## Updating

- **A provider gains a Structura icon:** add it to `PROVIDER_SERVICES`; the catalog-pin test checks
  the id exists.
- **The opscr sample changes:** run `node scripts/opscr-fixture.mjs` (needs a built opscr checkout at
  `../asc`, or `OPSCR_DIR`) and commit `__fixtures__/sample.workspace.json`.

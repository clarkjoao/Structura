# opscr-mapping

Projects an opscr workspace — architecture described as YAML
manifests — into a Structura **technical view**: the elements to draw, how they nest, and the edges
between them, plus a layout graph for the app's layout engine.

It is the one place that answers "what does this workspace look like in Structura", so the importer
plugin, the VSCode preview and, later, the bidirectional editor cannot draw the same YAML differently.
Spec: `openspec/changes/opscr-technical-view/`.

## Rules

- **Framework-agnostic.** Relative imports only: no `@/features`, no plugin API, no `opscr`. A test
  enforces it. Plugins copy this folder with a `sync-shared` script, as they do `export-core`
  ([ADR-0009](../../../docs/adr/0009-export-core-sharing.md)).
- **Structural input.** `OpscrWorkspaceInput` is only what the projection reads. An `opscr/core`
  `Workspace` satisfies it, so callers pass it straight through and the app's CI never needs opscr.
- **Never throws.** Anything `opscr compile` would reject degrades and is reported in `omitted` /
  `dropped`.

## Use

```ts
import { compileSources } from "opscr/core"; // in the adapter, not here
import { buildTechnicalView, placeView, toLayoutGraph } from "./opscr-mapping";

const { workspace } = await compileSources({ files });
const view = buildTechnicalView(workspace);
const placed = placeView(view, await layout(toLayoutGraph(view))); // app's ELK engine
const graph = toImporterGraph(placed); // plugin importer result / embed preview input
```

Hosts that cannot import the app's layout engine use `src/lib/opscr-layout` (`layoutView`, same
ELK options). To keep a picture still across edits, seed it with the previous boxes and pass the
result through `stabilizeLayout(view, fresh, previous)`: surviving elements keep their place.

## The technical view

| opscr                                            | Drawn as                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `Domain`, `ApplicationService` (bounded context) | panel; `belongsTo` nests into it                                                                     |
| `Subdomain`                                      | not drawn — a bounded context that belongs to one lands in its Domain                                |
| Technical Kinds                                  | the catalog service of `spec.provider` (`PROVIDER_SERVICES`), else a C4 container naming the product |
| `ExternalSystem` / `Channel`                     | C4 system / C4 container                                                                             |
| Business and organization Kinds                  | not drawn, listed in `omitted`                                                                       |
| Any edge but `belongsTo`                         | an edge, `from` → `to`, when both ends are drawn; otherwise listed in `dropped`                      |

Ids are `Kind/name`: in opscr the name is the identity.

## Updating

- **A provider gains a Structura icon:** add it to `PROVIDER_SERVICES`; the catalog-pin test checks
  the id exists.
- **The opscr sample changes:** run `node scripts/opscr-fixture.mjs` (needs a built opscr checkout at
  `../asc`, or `OPSCR_DIR`) and commit `__fixtures__/sample.workspace.json`.

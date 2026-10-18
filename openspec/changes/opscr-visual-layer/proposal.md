# Proposal

## Why

opscr's draw.io import writes what the YAML can say honestly into manifests and everything else
into `opscr.visual.json`: infrastructure boundaries (AWS Cloud, Account, Region, VPC, AZ,
subnets, clusters), services with no opscr Kind (CloudFront, Route 53, WAF, Cognito, CloudWatch,
X-Ray…), titles and notes, and the edges through them. Structura reads only the manifests and
`opscr.layout.json`, so an imported diagram loses its groups, its monitoring and tracing, and
every arrow that went through a CDN — the picture the architect recognises is gone. Importing
also needs a terminal today; the opscr pane cannot start one.

## What Changes

- `opscr-mapping` reads `opscr.visual.json` and adds a **visual layer** to the technical view:
  - boundaries as panels (VPC, subnets, AZ, Auto Scaling group, EKS / ECS cluster with their
    panel kinds; Cloud, Account, Region and other groups as plain panels) holding the elements
    drawn inside them, manifest panels included;
  - sidecar services as catalog components when their hint maps to a Structura catalog service
    (`aws:cloudfront` → CloudFront), otherwise as unknown components carrying their label;
  - titles, notes and legends as text elements;
  - the drawn edges that are not in the manifests; a manifest edge that `finalize` collapsed from a
    chain is drawn as the chain, and listed in the pane as drawn through it.
- The opscr plugin binds, syncs and saves the visual layer: moving or deleting a visual element
  writes `opscr.visual.json`; nothing about it ever reaches the YAML or `opscr.layout.json`.
- **Plugin API 1.12:** importers and batched changes may create `text` components and give a
  panel its `panelKind`.
- The opscr pane gets **Import .drawio…**: it runs the opscr import in the browser (no LLM), writes
  the workspace into the bound folder, syncs, and shows the import summary as a clickable list.
- The VSCode preview draws the visual layer too.

## Capabilities

### New Capabilities

- `opscr-visual-layer`: how `opscr.visual.json` is drawn, nested with the technical view, synced
  and saved.
- `opscr-drawio-import`: the pane's import of a draw.io file into the bound folder.

### Modified Capabilities

- `plugin-system`: importers keep `text` components and honour `panelKind`.

## Non-Goals

- Rendering BPMN or value streams (opscr change `process-and-value-stream`; until then BPMN
  shapes are unknown components with their label).
- Drawing a sidecar element from its raw draw.io style (stencil SVG, pasted image): unknown
  component for now.
- Editing the visual layer beyond moving, resizing and deleting (rename, restyle, new visual
  elements stay in draw.io terms and are not written back).
- Running the agent refinement from Structura: the LLM step stays in Claude Code / Devin.

## Impact

- `src/lib/opscr-mapping` (new `visual-layer.ts`, hint table pinned to the catalogs), synced into
  `plugins/structura-plugin-opscr` and `extensions/vscode-opscr` by `sync-shared`.
- `src/features/plugins` (`plugin.types.ts`, `import-graph.ts`, version bump to 1.12.0).
- `plugins/structura-plugin-opscr` (engine sync/reconcile, pane, build: bundles
  `opscr/import-drawio` from the linked opscr).
- `extensions/vscode-opscr` (reads the sidecar, posts the layer).
- i18n: new pane strings in `en` and `pt-BR`.

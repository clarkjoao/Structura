# Design

## Context

See proposal.md — Why. The opscr side is done (`~/www/opscr`, change `drawio-import`): its import
writes `opscr.visual.json` v1 —

```jsonc
{
  "version": 1,
  "source": { "file": "d.drawio", "page": "Page-1" },
  "elements": {
    "drawio:<cell>": { "role": "service" | "boundary" | "decoration", "label": "…", "hint": "aws:cloudfront",
                       "style": "<draw.io style>", "box": { x, y, width, height }, "parent": "Kind/name" | "drawio:<cell>" | null,
                       "members": ["Kind/name", "drawio:<cell>"] }   // boundaries only
  },
  "edges": [ { "id": "drawio:<edge>", "from": key | null, "to": key | null, "label": "…", "style": "…",
               "collapsedInto": "Kind/a -calls-> Kind/b" } ]
}
```

Visual boxes are relative to their `parent`; `opscr.layout.json` boxes are relative to the
element's manifest parent (Domain / BoundedContext) — both in the same page coordinates
(transposed when the import transposed the page). Checked headless already: the import's layout
covers every view node, so the plugin keeps the drawing's positions.

Constraints from Structura:

- The plugin speaks only plugin API (`PluginComponentInput`): today a component keeps its type
  only for C4, `panel`, catalog categories and plugin types — `text` degrades to `unknown`, and
  there is no `panelKind`. `GeneratedNodeInput` already carries `panelKind`; `PanelKind` has
  `vpc`, `public-subnet`, `private-subnet`, `availability-zone`, `auto-scaling-group`,
  `eks-cluster`, `ecs-cluster`.
- `opscr-mapping` is framework-agnostic and copied into the plugin and the VSCode extension by
  `sync-shared`.
- The plugin engine binds every graph component key to a canvas id (`BindingState`), writes the
  layout sidecar from bound elements (`sidecarText`) and reconciles canvas edits into YAML patches.
- Text elements show only while the diagram's text layer is on.

## Goals / Non-Goals

**Goals:** the canvas after an import looks like the draw.io page (groups, monitoring, chains,
titles), with no new persistence path in the host; one module decides how the layer is drawn, for
the plugin and the preview alike.

**Non-Goals:** see proposal. Also: no host-side knowledge of opscr (the host only learns `text`
and `panelKind` as plugin API features, useful to any importer).

## Decisions

### 1. Plugin API 1.12: `text` and `panelKind`

`importedType` keeps `text`; `validComponents` passes `panelKind` when it is a `PanelKind` value
(guard `isPanelKind`), and `toGeneratedGraph` forwards it. `PluginComponentInput` and the batched
changes' `add` gain `panelKind?: string`; `STRUCTURA_PLUGIN_API_VERSION` → `1.12.0`; the plugin
declares `^1.12`. Alternative: a plugin node type for boundaries — rejected, Structura already
draws AWS boundary panels natively and users would get a second, different VPC.

### 2. `opscr-mapping/visual-layer.ts`

```ts
parseVisualFile(text): VisualFile | null
withVisualLayer(graph: ImporterGraph, visual: VisualFile, opts?): { graph: ImporterGraph; drawnThrough: Array<{ edge: string; via: string[] }> }
```

It works on the importer graph (already placed), so the plugin, the preview and the one-file
importer share it:

1. **Absolute boxes**: manifest components from the graph (parent-relative → absolute by walking
   `parentKey`), visual elements from their `parent` chain.
2. **Components**: boundary → `panel` with `panelKind` from `BOUNDARY_PANELS` (hint, plus the
   label for subnet public/private and cluster EKS/ECS); service → catalog component from
   `VISUAL_SERVICES` (`aws:cloudfront` → `aws-networking` / `cloudfront`, `aws:cloudwatch`,
   `aws:xray`, `aws:route53`, `aws:waf`, `aws:cognito`, `aws:iam`, `aws:secrets-manager`,
   `aws:kms`, `aws:nat-gateway`, `aws:internet-gateway`, `aws:iot`, `aws:elastic-ip`…; a test pins
   every id to the catalog like `PROVIDER_SERVICES`), else `unknown` with the label; decoration with
   a label of 2+ characters → `text`, the rest dropped. Keys are the sidecar keys (`drawio:<cell>`).
3. **Nesting**: every component's parent is the innermost container among manifest panels and
   boundary panels: boundaries take their `members`; a manifest component listed as a boundary's
   member gets that boundary as `parentKey`, otherwise keeps its own. Positions are re-made
   relative to the new parent from the absolute boxes. Panels are sized to the drawing's boxes.
4. **Connections**: sidecar edges with both ends drawn, labelled with their label. Edges with
   `collapsedInto` are drawn as the chain, and the manifest connection they name is removed from
   the graph and reported in `drawnThrough` (the pane lists it next to the edges it does not draw).

The technical view itself does not change: the visual layer is a second pass, absent when there is
no sidecar (spec: no sidecar → same output).

### 3. Plugin engine

- `project()` stays; `syncNow` reads `opscr.visual.json` and runs `withVisualLayer` on
  `projection.graph` before `planSync`. Visual keys are bound like any other.
- `sidecarText` writes only manifest keys (keys without the `drawio:` prefix) to
  `opscr.layout.json`; a new `visualText(binding, diagram, visual)` writes moved / resized boxes back
  into `opscr.visual.json` (relative to each element's parent key) and drops deleted elements and
  their edges. Both are written by `writeSidecar`, unsaved until Save, like the layout today.
- `reconcile` ignores components and connections bound to `drawio:` keys (no YAML patch, never
  "not in the YAML"); a visual element deleted on the canvas is removed from the visual file instead
  of being restored.
- External changes to `opscr.visual.json` (git pull) move the canvas like `sidecarMoves` does.

### 4. Pane: Import .drawio…

`opscr/import-drawio` is bundled from the linked opscr like `opscr/core` (`vite` alias / dependency
`opscr`). The pane picks a file (`<input type="file">`, no new permission), runs `importDrawio`,
writes the files through the folder access it already has — only into a folder with no opscr
workspace (the folder API writes top-level files, so there are no sub-folders: a several-page drawing
brings its first page and names the others for the CLI) — then reloads and syncs. The summary's lists come
from `analysis.json` + the manifests' annotations (assumed, evidence, cell), not by parsing the
Markdown; selecting one uses the existing "light + open at line" path.

### 5. VSCode preview

`pipeline.ts` reads `opscr.visual.json` next to the manifests and applies `withVisualLayer` before
posting the graph; the embed already inserts through `toGeneratedGraph`, so it gets `text` and
`panelKind` from decision 1.

### 6. Text layer

Text elements honour the diagram's text-layer toggle. After an import whose visual layer has text,
the pane says "turn on the text layer to see titles and notes" when the layer is off — the plugin
API has no setter for it, and adding one is out of scope.

## Risks / Trade-offs

- [Two sidecars to keep consistent] → one function composes positions both ways; a round-trip test
  (import → draw → move → save → draw) pins it.
- [Removing collapsed manifest edges from the canvas hides a YAML edge] → it is listed in the pane
  with the chain it is drawn through; deleting a chain edge does not delete the manifest edge.
- [Catalog ids drift] → `VISUAL_SERVICES` pinned by test, like `PROVIDER_SERVICES`.
- [Bundling the import grows the plugin] → the import is ~100 KB of TS plus the catalog; loaded on
  demand by the import action (dynamic import).

## Migration Plan

Additive. A workspace without `opscr.visual.json` draws as before; plugin API 1.12 is a minor bump.
Rollback: revert; existing visual files are ignored by older versions.

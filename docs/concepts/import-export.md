# Import / Export (Interchange)

The Interchange context converts between Structura's model and external
formats. It lives in `src/lib/export-service/` (plus two Mermaid importers in
`features/diagram/utils/`). Its governing rule: **format knowledge never
leaks inward** — the model has no idea draw.io exists.

## Supported formats

| Format | Direction | Entry points | Notes |
| --- | --- | --- | --- |
| JSON (native) | export / import | `export-json.ts`, `shared-import.ts` | Lossless; the sharing/backup format. Validated on import (`validateWorkspaceFile`, `validate-diagram`). |
| draw.io (mxGraph XML) | export / import | `export-drawio.ts`, `import-drawio.ts` | The richest external target. Cell builders per component shape, geometry mapping, AWS icon style cache. |
| Mermaid | export / import | `export-mermaid.ts`; `import-mermaid-flowchart.ts`, `import-mermaid-sequence.ts` | Export flattens; import parses flowchart + sequence into components/flows. |
| Structurizr DSL | export / import | `export-structurizr.ts`, `import-structurizr.ts` | C4 semantic mapping; layout is not preserved (Structurizr auto-layouts). |

## Export pipeline (draw.io as the model case)

```
Diagram(s) → build-export-files → per-diagram conversion
  components → cell-builders.ts   (shape/style per component type)
  connections → edge-builder.ts   (waypoints, markers, labels)
  geometry   → geometry.ts        (absolute coords, parent offsets)
  styles     → styles.ts + aws-cache.ts (icon styles)
→ xml-utils → downloadable file(s)
```

Design points:

- **Builders are pure functions** from model + layout to format primitives —
  fully unit-tested (`export-drawio.test.ts`, `edge-builder.test.ts`,
  `geometry.test.ts`) with no DOM.
- **Imports normalize before entering the store**
  (`normalize-imported-diagram.ts`): id regeneration, parent resolution,
  layout reconstruction, icon resolution (`resolve-used-icons.ts`). Nothing
  raw from a foreign file touches the model.
- **Validation is a gate, not a hope:** malformed input degrades to
  `unknown` components (the escape-hatch type) rather than failing the whole
  import.

## Fidelity policy

Interchange is *lossy by design* in defined ways, and the losses should be
explicit:

- Semantic connection fields (`intent`, `transportPreset`) do not survive any
  external format today.
- Scenes, flows, and walkthroughs export only via native JSON.
- Structurizr drops layout; Mermaid drops nearly all styling.

When improving a format (e.g. the roadmap's "better draw.io import/export"),
extend the mapping tables in the spec first, so what round-trips and what
doesn't is a decision, not an accident.

## Extension outlook

The format list is hardcoded (a `switch` in the export modal / import flow).
The target shape is an **importer/exporter registry**: each format registers
`{ id, label, extensions, capabilities (which model facets it preserves),
importFn?, exportFn? }`. Cell builders similarly want to become per-node-type
contributions so a plugin adding a node type can also teach draw.io export
about it — that pairing is a requirement for the plugin contribution-points
spec. See [extension-points.md](../architecture/extension-points.md).

# Proposal

## Why

Canvas → YAML covers edits of elements the YAML declares, but an element drawn from the palette on
a bound diagram stays canvas-only ("not in the YAML"), so building the architecture on the canvas
still needs hand-written manifests.

## What Changes

- **Plugin API 1.10.0** (additive): component snapshots carry `cloudServiceId` and `technology`.
- **opscr-mapping:** `kindFor` — the inverse of `elementFor`: the Kind and provider whose manifest
  would draw an element (panel → Domain, or ApplicationService inside a Domain; system →
  ExternalSystem; container → Application; catalog service → the Kind listing it).
- **opscr plugin:** the pane lists canvas elements not in the YAML with a suggested Kind and
  provider (editable). _Add to YAML_ (or _Add all_) writes a manifest named after the label in
  kebab-case, a `belongsTo` to the panel it sits in (adding that panel too when it is outside the
  YAML), turns its canvas connections into edges, and binds the element in place — redrawn when the
  chosen Kind draws another shape.

## Non-Goals

- A Kind picker inside the host palette, or adding every palette element automatically (notes and
  free shapes stay canvas-only by choice).

## Capabilities

### Modified Capabilities

- `plugin-system`: snapshots expose catalog service and technology.
- `opscr-text-editing`: palette elements can be added to the YAML.

## Impact

- Host: snapshots, plugin types; `src/lib/opscr-mapping/elements.ts` (synced to plugin and
  extension). Plugin: `adopt.ts`, `reconcile` outside list, pane section, `addEdge` fallback, i18n.

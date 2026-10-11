# Proposal

## Why

opscr describes an architecture as YAML manifests that an LLM and people write and validate
(`opscr compile`). Structura should draw them, and later edit them, without becoming a second source of
truth (see `.grill/opscr-yaml-diagram-integration.md`). Three consumers need the same answer to "what
does this workspace look like as a Structura diagram": an importer plugin, a VSCode live preview and,
later, a bidirectional editor. Written three times, it drifts the way the draw.io export did before
ADR-0009. This change writes it once.

## What Changes

- **Add** a framework-agnostic library that turns an opscr workspace into a _technical view_: the
  Structura elements to draw, how they nest, and the edges between them.
- `belongsTo` becomes nesting: a Domain and a bounded context (ApplicationService) are drawn as panels,
  Applications inside their bounded context, bounded contexts inside their Domain.
- Technical Kinds become Structura elements chosen from their `spec.provider`: the matching AWS, GCP,
  Azure or open-source catalog service when Structura has one, a C4 container naming the product
  otherwise.
- Business and organization Kinds (and Subdomain) are left out of this view and reported, never
  silently dropped.
- **Add** a layout graph for the existing layout contract, and a way to place the view from a layout
  result, so every consumer gets the same autolayout.
- The library takes the workspace as plain data and does not depend on the `opscr` package at runtime,
  so the app's CI does not need opscr installed.

## Non-Goals

- No UI, no importer, no plugin: wiring this into the app (plugin `structura-plugin-opscr`) and into
  VSCode are separate changes.
- No diagram → YAML direction, no layout sidecar file, no rename support.
- No views other than the technical one (no domain-only, business or organization views).
- No change to the plugin API, the element registry or the persisted diagram schema.
- No new provider icons: products without a Structura catalog entry fall back to a C4 container.

## Capabilities

### New Capabilities

- `opscr-technical-view`: projecting an opscr workspace into the elements, nesting and edges of a
  Structura technical diagram, with an autolayout-ready graph.

### Modified Capabilities

None.

## Impact

- New code under `src/lib/opscr-mapping/` (pure TypeScript, no `@/features/*` imports), with unit
  tests and a checked-in fixture of `examples/sample` from the opscr repo.
- No new runtime dependency. Reuses the layout contract shape and the ELK layout engine in tests only.
- Later consumers copy the library with a `sync-shared` script, as the LeanIX plugin does with
  `src/lib/export-core`.

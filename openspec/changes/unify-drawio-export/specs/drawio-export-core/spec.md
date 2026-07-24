# draw.io Export Core

## Purpose

A single, framework-agnostic module that turns a normalized export model
(`ExportModel`) into mxGraph XML, consumed by both the app export
(`src/lib/export-service`) and the LeanIX plugin export through thin per-side
adapters. Eliminates the hand-maintained duplicate exporters and the drift
between them.

## ADDED Requirements

### Requirement: Core has no app or plugin coupling

The `export-core` module SHALL NOT import from `@/features/*` nor from the
plugin's `plugin.types`. Its only inputs are the `ExportModel` IR and its own
constants. Strict-mode rules apply: no `any`, no `as unknown as`; kind-specific
node data is expressed as a discriminated union on `ExportNode.kind`.

#### Scenario: Core builds without the app barrel

- **GIVEN** the `export-core` source
- **WHEN** its imports are inspected (lint/test guard)
- **THEN** none resolve into `@/features/*` or `../../types/plugin.types`

#### Scenario: Core is copy-portable

- **GIVEN** `export-core` copied into the plugin (or packaged) with only relative
  imports rewritten by the delivery mechanism
- **WHEN** the plugin `typecheck` and `build` run
- **THEN** both succeed with no missing-module or alias errors

### Requirement: Single public entry with wrapper selection

The core SHALL expose `buildMxGraphXml(model: ExportModel, opts: { wrapper:
"mxfile" | "mxgraphModel" })` as the one entry point. `"mxfile"` emits the full
`<?xml…><mxfile><diagram>…</mxfile>` (app); `"mxgraphModel"` emits a bare
`<mxGraphModel>…</mxGraphModel>` (LeanIX).

#### Scenario: App wrapper

- **GIVEN** a model and `wrapper: "mxfile"`
- **WHEN** `buildMxGraphXml` runs
- **THEN** the output starts with `<?xml` and contains `<mxfile>` and `<diagram`

#### Scenario: LeanIX wrapper

- **GIVEN** a model and `wrapper: "mxgraphModel"`
- **WHEN** `buildMxGraphXml` runs
- **THEN** the output starts with `<mxGraphModel` and contains no `<mxfile>`

### Requirement: Positions map 1:1; container children stay relative

The core SHALL position root nodes by shifting them into positive space by the
bounding-box origin plus a fixed margin, with **no scale factor**, and SHALL keep
nodes whose `parentId` is a container at their parent-relative coordinates. The
gap-to-node ratio of the source model is preserved.

#### Scenario: Two roots keep their canvas gap

- **GIVEN** two root nodes whose left edges are 300 units apart in the model
- **WHEN** the XML is built
- **THEN** their exported x-coordinates are also 300 units apart (not scaled)

#### Scenario: Boundary child is parent-relative

- **GIVEN** a node with `parentId` set to a panel container at model x=20,y=20
- **WHEN** the XML is built
- **THEN** its `<mxGeometry>` is `x="20" y="20"` and its `parent` is the panel id

### Requirement: Per-type geometry defaults come from one table

C4 nodes with unknown size (`width`/`height` = 0) SHALL be exported at the shared
`C4_META` footprint (uniform box matching the Structura renderer), identically for
the app and the plugin.

#### Scenario: C4 node without explicit size

- **GIVEN** an `ExportNode` of kind `c4` with `width: 0, height: 0`
- **WHEN** the XML is built
- **THEN** its geometry uses the `C4_META` default box for its `subtype`

### Requirement: Both exporters produce equivalent geometry for equal input

The app adapter and the plugin adapter SHALL produce the same node kinds,
positions, and sizes for a diagram expressible in both input models. Styling and
labels MAY differ only where the plugin snapshot lacks the data.

#### Scenario: Same diagram, same geometry

- **GIVEN** a diagram mapped to an `ExportModel` via the app adapter and the same
  diagram's snapshot mapped via the plugin adapter
- **WHEN** both are built
- **THEN** each shared node has identical `x`, `y`, `width`, `height`, and `parent`

### Requirement: App export output is unchanged by the refactor

Migrating the app export onto the core SHALL NOT change its generated XML for
existing diagrams (guarded by a golden-XML baseline captured before the refactor).

#### Scenario: Golden XML stable

- **GIVEN** the golden-XML baseline of the two proportion-fix example diagrams
- **WHEN** the app export runs through the core-based implementation
- **THEN** the produced XML is byte-identical to the baseline

### Requirement: No hand-maintained duplicate of the export algorithm

After migration there SHALL be exactly one implementation of geometry, styles,
cell-building, and edge-building. The plugin's previously vendored copies are
removed, and a CI check fails the build if the shared core copy (delivery Option
A) or workspace boundary (Option B) drifts from the source of truth.

#### Scenario: Drift is caught

- **GIVEN** the shared core is edited but the plugin's synced copy is not
  regenerated (Option A)
- **WHEN** `sync-shared --check` runs in CI
- **THEN** it exits non-zero and fails the build

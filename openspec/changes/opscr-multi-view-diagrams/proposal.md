# Proposal

## Why

opscr is adding a `View` Kind (change `architecture-views` in the opscr repo): one workspace in
many files holds several named diagrams — system context, containers, components, deployment —
that drill into each other. Structura's opscr plugin binds a workspace to **one** diagram and draws
the whole model in it. To honour views, Structura must lay out and draw one diagram per View, keep
them in sync with the YAML, and turn `drillDown` into the drill-down navigation it already has
(`linkedDiagramId`). The YAML never carries layout, so every position decision is Structura's.

## What Changes

- The opscr plugin projects each `View` (via `resolveView` from `opscr/core`) into its own diagram:
  the first sync creates one diagram per View, later syncs update them in place, a removed View
  leaves its diagram untouched and flags it.
- `drillDown` entries become `linkedDiagramId` on the matching component, pointing at the diagram
  bound to the target View.
- Layout is per diagram: `opscr.layout.json` gains a version 2 keyed by `View name → Kind/name`;
  version 1 files keep loading and are used for the workspace's default (view-less) diagram.
- Plugin API (1.13): an importer/binding may return several diagrams, each with its components,
  connections and the id of its sibling it links to.
- Deployment views draw `DeploymentNode`s as panels with the AWS group styling and icons; `Person`
  and `Component` get their C4 shapes.
- A workspace with no `View` behaves exactly as today.

## Capabilities

### New Capabilities

- `opscr-multi-view`: one diagram per opscr View, drill-down links between them, per-view layout.

### Modified Capabilities

<!-- None in openspec/specs; plugin API additions are recorded in the design. -->

## Impact

- `src/lib/opscr-mapping` (view-based projection replaces `buildTechnicalView` when Views exist),
  `layout-file.ts` (v2), `plugins/structura-plugin-opscr` (engine, sync, reconcile, pane),
  the plugin API types and host (multi-diagram binding), VSCode extension (view picker).
- Depends on opscr change `architecture-views` (`resolveView`, new Kinds).

## Non-Goals

- Editing View definitions from the canvas (canvas → YAML covers elements only for now).
- Auto-creating Views from a hand-drawn diagram.
- Rendering `Process`, `ValueStream` or journey maps.

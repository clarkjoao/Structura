# Proposal

## Why

A plugin importer can only create flat C4 shapes: anything else degrades to `unknown`, and there is no
way to nest one element inside another. That rules out importing any architecture that has boundaries
or cloud services — the opscr importer (`opscr-technical-view` already projects Domains and bounded
contexts as panels and technical Kinds as AWS/GCP/Azure/OSS services) would land as a pile of loose
boxes. The host already has a single-undo, scene-aware path for exactly this shape of data: the one
the LLM diagram generator uses. This change lets plugin importers use it.

## What Changes

- Importer results may nest a component in a panel: `parentKey` names another new component of the
  same import, or an existing component of the diagram.
- Importer results may create panels and cloud catalog components (AWS, GCP, Azure and the other
  registered catalog families), with the catalog service (`cloudServiceId`) that picks their icon, and
  a `technology` for C4 and cloud components. Other built-in types keep degrading to `unknown`.
- The host normalizes what it cannot honour instead of failing: a parent that cannot hold the child,
  a missing parent or a parent cycle puts the component at the top level.
- Plugin imports are committed through the same store path as generated diagrams, so they respect an
  active diagram version (scene) as well.
- Plugin API version goes to `1.3.0`; the change is additive, every 1.2 importer keeps working.

## Non-Goals

- No new built-in types beyond panels and catalog families (no api-group, endpoint, note, db-table…).
- No panel kinds, colours or sizes chosen by the importer beyond `width`/`height`.
- No editing or removing existing components from an importer, and no other v1.3 items (document
  pane, host Monaco, `llm:context`, folder access) — they get their own changes.
- No opscr plugin: that is the next change, built on this one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-system`: the `registerImporter` contract accepts nested components, panels and catalog
  components.

## Impact

- `src/features/plugins/plugin.types.ts` (`PluginComponentInput`, `STRUCTURA_PLUGIN_API_VERSION`),
  `run-plugin-import.ts`, synced type copies in `plugins/*/src/types/`.
- `src/features/diagram/store/slices/generated-graph.slice.ts` (`insertGeneratedGraph` learns to link to
  existing components and to carry a description).
- `plugins/README.md`, `CHANGELOG.md`.

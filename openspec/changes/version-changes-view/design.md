# Design

## The diff

`versionChanges(diagram, versionId)` — pure, in `version.utils.ts`, memoised per diagram like the
canvas snapshot:

```ts
interface VersionChanges {
  added: { components: Set<string>; connections: Set<string> };
  changed: Map<string, FieldChange[]>; // component or connection id → fields that differ
  removed: { components: string[]; connections: string[] }; // base ids, still in the base
}
interface FieldChange {
  field: string;
  base: unknown;
  version: unknown;
}
```

- `added`: the Version's `addedComponents` / `addedConnections`.
- `changed`: every `modifiedComponents` / `modifiedConnections` entry compared field by field with
  the base element (the same fields the content hash covers); an entry equal to its base is not a
  change. Layout overrides are never changes.
- `removed`: `removedComponentIds` / `removedConnectionIds` that the base still has.

## Ghosts

Drawn at the projection layer (`useCanvasNodes` / the edge projection), after the normal nodes:

- a ghost node is the base component at its base layout, `data.ghost = true`, class
  `node-version-removed` (opacity ~0.45, dashed red outline, struck-through title), every
  interaction flag off, `pointer-events: none`, z-index under live nodes;
- its parent: the live parent if the Version still has it, else its ghost parent, else none
  (absolute base position);
- a ghost edge connects two drawn nodes (live or ghost) only; dashed red, no handles, no labels
  editing.

Because ghosts never enter the resolved snapshot, everything that reads it — selection, Cmd+A,
delete, auto-layout, plugins (`getDiagram`), collaboration, exports, `onDiagramChange` — is
unaffected by construction.

## Outlines

Reuse the compare-mode classes (`node-diff-added`, `node-diff-modified`) through a new
`changesOverlay` in `nodeOverlays.ts`, applied when the changes view is on, a Version is active and
compare mode is off. The existing "~" / "⚠" badges stay; the conflict marker keeps priority over the
amber outline.

## Switch and legend

UI store flag `showVersionChanges` (default `true`, persisted with the other canvas preferences).
Switch: in the Version panel header and as a toggle on the Version chip's menu. Legend: a small
bar at the top of the canvas — `+ added · ~ changed · − removed` — with counts, only when the
active Version has at least one change.

## What changed (element panel)

For a selected changed element, a "Changed in <Version>" section lists each `FieldChange` as
`field: base → version` (long texts truncated with a tooltip). The existing conflict notice ("Keep
version" / "Use base") stays above it.

## Open questions

- Exports: ghosts are left out (an export shows the Version as it would be). A "changes" export can
  come later if asked for.

# Design

Decisions approved on 2026-10-24: the whole element is the unit of `modified`; conflicts get a badge,
a blocked merge and keep / take-base actions now; Versions stay per diagram and a linked diagram
activates the Version with the same `key`.

## Model

```ts
interface VersionDiff {
  // existing: id, name, color, createdAt, addedComponents, addedConnections,
  //           removedComponentIds, removedConnectionIds, viewport, nodeLayouts
  modifiedComponents?: Record<string, Component>; // replaces the base component with that id
  modifiedConnections?: Record<string, Connection>;
  baseHashes?: Record<string, string>; // element id → hash of the base element when copied
  status?: VersionStatus; // "proposed" | "approved" | "in-progress" | "done"
  key?: string; // stable id from outside (an initiative name)
  ownerPluginId?: string; // set by api.versions.upsert
}
```

The new fields are optional, read through helpers (`modifiedComponentsOf(v)` …), so stored
diagrams need no migration and an untouched diagram hashes as before (the same convention as
`textsVisible` / `showLegend`). `nodeLayouts` keeps holding the layouts of added nodes and, now,
overrides for base nodes moved inside the Version.

Resolution (`resolveVersionSnapshot`): base components minus removed, overridden by modified, plus
added; same for connections; layouts are base overlaid with the Version's.

## Content hash

`hashElement(value)` = cyrb53 of the canonical JSON (sorted keys) of the component or connection.
Layout is not part of a component, so moving a node never changes its hash.

## Copy-on-write (store)

With a Version active and an element that the Version did not add:

| Action                                                                                          | Writes                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `updateComponent`, `updateComponents`, other content patches routed through `writableComponent` | copies the base component into `modifiedComponents` (once), records `baseHashes[id]`, patches the copy |
| `updateConnection` (label, technology, …)                                                       | same with `modifiedConnections`                                                                        |
| `updateNodeLayout` (drag, inspector X/Y)                                                        | copies the base layout into `version.nodeLayouts[id]` and moves it                                     |
| `batchUpdateNodeLayouts` (measurement)                                                          | writes the override when there is one, else the base — never creates one                               |
| remove                                                                                          | unchanged (`removed…Ids`); also drops a `modified` copy of it                                          |

`pushHistory` runs before each structural write, as for base edits. Copying an element that is
already modified patches the copy and keeps its first base hash.

`canMoveNodeInSceneMode` returns true outside compare mode; `lockedByVersion` is dropped.

## Conflicts

`versionConflicts(diagram, versionId)` → ids in `modified*` whose base element exists and hashes
differently from `baseHashes[id]`, plus ids whose base element is gone ("base removed"). Actions:

- `keepVersionCopy(versionId, id)` — rebases: `baseHashes[id] = hash(base now)`.
- `takeBaseVersion(versionId, id)` — drops the copy (the element shows the base again).

`mergeVersionIntoBase` refuses (returns `false`) while conflicts remain; the merge dialog lists them
with both actions. A merge writes added, modified and layout overrides into the base and removes
removed ids; other Versions whose `baseHashes` point at a merged element will then report a
conflict, which is the intended signal.

## UI

- Version panel: groups by status (no status = "Draft" group); each Version shows its status, a
  conflict count badge and, for plugin-owned ones, the plugin's name; status is editable for local
  Versions. Merge is disabled with a tooltip while conflicts remain.
- Canvas: a modified node gets a "~" marker (same overlay family as compare badges); a conflicted
  node a warning marker. Compare mode counts modified elements as "in A/B".
- Element panel: on a conflicted element, a notice with "Keep version" / "Use base".
- All strings through i18n (`en`, `pt-BR`).

## Plugin API 1.14.0 (capability `diagram:write` for writes, `diagram:read` for reads)

```ts
type PluginVersionStatus = "proposed" | "approved" | "in-progress" | "done";
interface PluginVersionSnapshot {
  id: string;
  key: string | null;
  name: string;
  status: PluginVersionStatus | null;
  ownerPluginId: string | null;
  added: { componentIds: string[]; connectionIds: string[] };
  modified: { componentIds: string[]; connectionIds: string[] };
  removed: { componentIds: string[]; connectionIds: string[] };
  conflicts: string[];
}
interface PluginVersionInput {
  key: string;
  name: string;
  status?: PluginVersionStatus;
  /** The whole content, replacing what the Version held. */
  diff: {
    add?: PluginComponentInput[];
    connect?: PluginConnectionInput[];
    modify?: Array<{
      id: string;
      name?: string;
      description?: string;
      technology?: string;
      cloudServiceId?: string;
      linkedDiagramId?: string;
    }>;
    remove?: string[];
    disconnect?: string[];
    move?: Array<{ id: string; x: number; y: number; width?: number; height?: number }>;
  };
}
type PluginVersionAction =
  | { type: "merge" | "rename" | "delete"; diagramId: string; key: string }
  | { type: "create"; diagramId: string };
interface PluginVersions {
  list(diagramId?: string): PluginVersionSnapshot[];
  upsert(input: PluginVersionInput, options?: PluginApplyOptions): string; // version id
  remove(key: string, options?: PluginApplyOptions): void;
  setActive(key: string | null, options?: PluginApplyOptions): void;
  /** Actions the user took on this plugin's Versions; the plugin carries them out. Returns unsubscribe. */
  onAction(handler: (action: PluginVersionAction) => void): () => void;
}
```

- `upsert` finds the Version by `key` (creating it), sets `ownerPluginId`, name and status, and
  rebuilds its content from `diff` against the current base: `modify` copies the base element and
  applies the patch, recording the base hash; ids not in the base are ignored. One history step.
- Plugin-owned Versions: the panel's merge, rename and delete call `onAction`; "New version"
  calls `onAction({ type: "create" })` when the active diagram has a plugin-owned Version and that
  plugin listens. Canvas edits in a plugin-owned Version still go to the store (copy-on-write); the
  plugin reads them through `getDiagram` and writes its files.
- `DiagramSnapshot.activeVersion: { id, key, status } | null`; components and connections are the
  resolved ones of that Version (as the canvas shows them).
- `PluginFolder.list({ recursive: true })` returns POSIX paths under the folder; `read` / `write` /
  `stats` accept such paths; `..`, absolute paths and empty segments are rejected; `write` creates
  missing sub-folders.

## Linked diagrams

When the user opens a component's `linkedDiagramId` (drill-down) while a Version with a `key` is
active, the target diagram activates its Version with the same `key`, or its base when it has none.

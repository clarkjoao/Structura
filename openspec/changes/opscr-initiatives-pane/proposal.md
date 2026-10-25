# Proposal

## Why

opscr product workspaces hold planned work as `initiatives/<name>/` overlays on the AS-IS root
(opscr changes `product-workspace`, `rule-based-views`), and Structura's Versions are now logical
branches a plugin can own (change `versions-as-branches`, API 1.14). The opscr pane still reads only
the folder's top level and draws only the root. This change makes each initiative a Version in every
diagram bound to the folder, writes canvas edits made in that Version back to the initiative's files
(copy-on-write, `retired` stubs, the initiative's own edges, the lock), and carries the Version
actions — new, rename, delete, merge (promote) — into the folder. Slice 5 of
`docs/concepts/opscr-product-workspace.md`.

## What Changes

- opscr core (in `~/www/opscr`): `initiativeSources(product, name)` (the root with an initiative
  applied, as text) and `initiativeDelta(product, name, merged)` (the initiative folder an edited
  copy of that text means: copies, stubs, added manifests, the initiative's own Relationship, copies
  of root Relationships that drop a live edge, and the lock).
- Plugin API 1.14 (still unreleased) gains what the pane needs: `applyChanges` into a Version by key
  or into the base while a Version is shown, `getDiagram(id, { version })`, `PluginFolder.remove`,
  and the new name in a `rename` action.
- The pane, for a folder with `opscr.workspace.yaml`:
  - loads `initiatives/*/` (manifests, `initiative.lock`, `opscr.layout.json`) as tabs and watches
    them; the root engine ignores them and writes the base even while a Version is shown;
  - keeps one Version per initiative (key = folder name, name = `displayName`, status) in the
    bound diagram and in each View diagram, drawn by an engine per diagram and initiative over the
    merged text;
  - writes canvas edits made in an initiative's Version to that initiative (through
    `initiativeDelta`), positions to the initiative's layout sidecar;
  - lists the initiatives (status, lock conflicts, accept, show, promote) and answers the Version
    panel's actions: new (a folder with an `Initiative`), rename (`displayName`), delete (the
    folder), merge (`planPromote` applied to the buffers).
- Everything stays unsaved until **Save**, which now also deletes the files and folders the
  buffers dropped.

## Capabilities

### New Capabilities

- `opscr-initiatives-pane/versions`: initiatives as Versions in every bound diagram.
- `opscr-initiatives-pane/editing`: canvas edits in an initiative's Version written to its files.
- `opscr-initiatives-pane/actions`: the initiatives list and the Version actions.

### Modified Capabilities

- None with a main spec.

## Non-Goals

- A git check before promote in the browser (the CLI keeps it); the pane says to commit after.
- Editing structure on View diagrams (they stay projections; only positions flow back).
- Resolving initiative overlaps automatically.
- Root files in sub-folders of the bound folder (the pane reads the top level plus `initiatives/`).

## Impact

- opscr: `src/kernel/workspace/{promote,delta,text}.ts`, tests.
- Structura host: `plugin.types.ts`, `plugin-api.ts`, `snapshots.ts`, `pluginFolders.ts`,
  `generated-graph.slice.ts`, `VersionPanel.tsx`.
- Plugin opscr: new `src/engine/initiatives.ts`, `src/pane/useInitiatives.ts`; `OpscrPane.tsx`,
  `useViewDiagrams.ts`, `view-diagrams.ts`, i18n.

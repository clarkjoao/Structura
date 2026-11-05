# Proposal

## Why

opscr now models planned work as initiatives: overlays on the AS-IS root, with an element replacing
its root version whole, a base hash to catch root changes made after the copy, a lifecycle status
and a promote (opscr changes `product-workspace` and `rule-based-views`; brief in
`docs/concepts/opscr-product-workspace.md` §5). Structura's Versions are the natural UI for them,
but today a Version only adds and hides elements: editing a base element while a Version is active
writes into the base, base nodes cannot be moved in a Version, nothing detects a base change, there
is no status, and plugins cannot see or drive Versions. The feature has no users, so it can be
reshaped as **logical git branches**, generic for every diagram and drivable by the opscr plugin.

## What Changes

- `VersionDiff` gains `modifiedComponents` / `modifiedConnections` (a whole element replacing the
  base one), `baseHashes` (the base element's hash when it was copied), `status`
  (`proposed | approved | in-progress | done`), `key` (a stable id from outside) and
  `ownerPluginId`. All optional: a diagram that never uses them stores and hashes as before.
- Copy-on-write: with a Version active, editing a base element copies it into `modified` (recording
  its base hash) and patches the copy; the base is never touched. Moving a base node writes a layout
  override in the Version (not a content change).
- Conflicts: a modified element whose base hash changed is a conflict, badged on the canvas and in
  the Version panel; merge is blocked until the user keeps the Version's copy or takes the base.
- Merge applies `modified` too. The Version panel groups Versions by status.
- Plugin API 1.14.0: `api.versions` (`list`, `upsert`, `remove`, `setActive`, `onAction`),
  `DiagramSnapshot.activeVersion`, plugin-owned Versions whose merge / create / rename / delete are
  routed to the plugin, and `PluginFolder` reading sub-folders.
- Navigating to a linked diagram activates the Version with the same `key` there, so one initiative
  stays selected from C1 to C2 to Deployment.

## Capabilities

### New Capabilities

- `versions-as-branches/model`: the diff model, copy-on-write, conflicts, merge.
- `versions-as-branches/ui`: status groups, conflict badges and resolution, moving base nodes.
- `versions-as-branches/plugin-api`: `api.versions`, plugin-owned Versions, active version in
  snapshots, sub-folders, key carried across linked diagrams.

### Modified Capabilities

- None with a main spec today.

## Non-Goals

- The opscr pane mapping initiatives to Versions, writing copy-on-write to files and promoting
  from the UI — slice 5, in the plugin only.
- Workspace-level Versions (one Version across diagrams); Versions stay per diagram, linked by `key`.
- Automatic resolution of conflicts between two Versions.
- Field-level patches in `modified`; the whole element is the unit.

## Impact

- `src/features/diagram`: `diagram.types.ts`, `version.utils.ts`, `version-mutations.ts`,
  `version-helpers.ts`, `versions.slice.ts`, `components.slice.ts`, `connections.slice.ts`,
  `layout.slice.ts`.
- `src/features/canvas`: Version panel, merge dialog, node overlays, drag guards, element panel.
- `src/features/plugins`: `plugin.types.ts` (1.14.0), `plugin-api.ts`, `snapshots.ts`, folder access.
- i18n `en` / `pt-BR`.

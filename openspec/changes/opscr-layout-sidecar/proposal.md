# Proposal

## Why

The grill decided that YAML stays free of coordinates and the layout lives in a sidecar file keyed
by `Kind/name` (`.grill/opscr-yaml-diagram-integration.md`). Today positions live only in the
Structura diagram: a second diagram bound to the same folder, a teammate cloning the repo, or the
VSCode preview all start from a fresh autolayout, and the arrangement the user made is not in git.

## What Changes

- **Shared format** in `opscr-mapping`: `opscr.layout.json` next to the manifests, one entry per
  drawn element (`"Kind/name": { x, y, width, height }`, parent-relative like the layout result),
  serialized with sorted keys, whole numbers and one element per line so git diffs stay small.
  Parsing tolerates junk (bad entries are skipped; an unreadable file counts as absent).
- **opscr plugin:** the pane reads the sidecar with the folder. Elements the canvas does not have
  yet are placed at their sidecar box (so binding a fresh diagram restores the arrangement); what
  the canvas shows always wins. After every sync and canvas change the sidecar text is rewritten
  from the canvas — renames re-key it, deletions drop entries — and saved with the manifests.
- **VSCode preview:** reads the sidecar of the folder and seeds the stable layout with it; it
  re-reads it when the file changes on disk (e.g. Structura saved it). _Relayout_ ignores the
  sidecar until it changes again.

## Non-Goals

- Edge routes and viewport in the sidecar.
- Writing the sidecar from VSCode (the preview stays read-only).
- Multiple sidecars per folder or per solution.

## Capabilities

### Modified Capabilities

- `opscr-text-editing`: the bound diagram's arrangement is stored in and restored from the sidecar.
- `opscr-preview`: the VSCode preview draws the sidecar's arrangement.

## Impact

- `src/lib/opscr-mapping/layout-file.ts` (+ tests), synced into the plugin and the extension.
- `plugins/structura-plugin-opscr` pane and e2e; `extensions/vscode-opscr` pipeline and watcher.

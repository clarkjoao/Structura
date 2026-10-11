# Proposal

## Why

The grill's workflow is a git repo of YAML with Structura, VSCode and Claude Code as windows onto
it. Today the opscr pane reads the folder only when it binds or on Reload, which discards unsaved
edits: an edit in VSCode or a `git pull` stays invisible in Structura.

## What Changes

- **Plugin API 1.9.0** (additive): `PluginFolder.stats()` lists top-level files with last-modified
  time and size, so a plugin can notice outside changes without reading every file.
- **opscr plugin:** while a folder is open the pane checks it every 2 s (and when the window gets
  focus): a clean file that changed reloads and the canvas syncs; new files appear, removed clean
  files go; a file with unsaved edits is never overwritten — it shows a conflict with "Use the
  folder's version" / "Keep mine". The layout sidecar is written by the app, so its disk text always
  wins and moves the canvas to it.
- **Fix:** keys typed in a plugin code editor are no longer canvas shortcuts for React Flow (Space
  was swallowed under Monaco's native edit context).

## Capabilities

### Modified Capabilities

- `plugin-system`: folder stats.
- `opscr-text-editing`: the pane follows outside changes.

## Impact

- Host: `pluginFolders.stats`, plugin types, `PluginCodeEditor` wrapper class.
- Plugin: `watch.ts`, `sidecarMoves`, pane polling and conflict banner, i18n, e2e.

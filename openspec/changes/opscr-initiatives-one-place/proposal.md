# Proposal

## Why

Initiatives are managed in two places: the Versions panel (show, new, rename, delete, merge) and the
opscr pane's list (status, show, promote, new, show root). And promoting — moving an initiative
onto the root — happens at once, from either place, without saying what it will write.

## What Changes

- **The Versions panel is the place** to show, create, rename, delete and set the status of an
  initiative. Setting the status of a plugin-owned Version is routed to its plugin, like rename
  (plugin API 1.14, still unreleased: `PluginVersionAction` gains `{ type: "status" }`).
- **The pane keeps what is opscr's own**: each initiative's lock issues with "Accept root", and
  promote. The status select, Show, New initiative and Show root leave the pane's list; the status
  shows as a label.
- **Promote always previews first**, whether started from the pane or from Merge in the Versions
  panel: the elements it adds, changes and retires, the edges it adds and removes, and the files it
  writes and deletes. Confirm applies it to the buffers (unsaved until Save, as before); Cancel
  leaves everything. When promote is refused the preview says why, and offers "Mark as done" when
  the status is the only reason.

## Impact

- Host: `PluginVersionAction`, `VersionPanel` (status select for owned Versions, routed),
  `docs/extension-points.md`; types synced to the plugins.
- opscr plugin: `useInitiatives` (status action, preview state), `OpscrPane` (list trimmed, preview
  card), i18n; `e2e/initiatives.mjs`.

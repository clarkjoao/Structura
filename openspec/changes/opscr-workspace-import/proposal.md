# Proposal

## Why

Setting an opscr product up takes several steps: create a diagram, open the opscr pane, bind the
folder, switch on "a diagram for each view", and file everything in a workspace folder. The
workspace home has an Import, but plugin importers only read one file into the active diagram.

## What Changes

- **Plugin API 1.14 (unreleased) gains workspace importers.** `registerWorkspaceImporter` (capability
  `io:importers`) adds an entry to the home's Import under "Set up from". The host runs it from the
  click with the locale and the folder the user is in; the result names the diagram to open and,
  optionally, one of the plugin's own `document-pane` panels to open beside it. A thrown error's
  message is shown in a toast.
- **Host additions the importer needs:** `createFolder({ name, parentId })`; `createDiagram` takes a
  `folderId`; `DiagramSnapshot.folderId`; `files.move(from, to)` remembers a picked folder under the
  id of the diagram made after the pick; `files.isSame(a, b)` tells whether two binding ids remember
  the same folder. The home's Import button gets an accessible name.
- **opscr plugin: "opscr folder (product)".** One pick: a workspace folder named after the Product
  (`displayName`, else its name, else the folder name), the main diagram in it bound to the folder,
  "a diagram for each view" switched on when the root has Views, and the pane opened beside it,
  where the folder opens without asking again (handed over in the same session) and draws the root,
  the View diagrams (in the same workspace folder) and the initiatives' Versions. A folder imported
  before opens its diagram again; a folder without top-level manifests is refused.

## Impact

- Host: `plugin.types.ts`, `plugin-api.ts`, `io-registry.ts`, `use-plugin-contributions.ts`,
  `snapshots.ts`, `pluginFolders.ts`, `ImportModal.tsx`, dashboard Import button, i18n; types synced
  to the plugins.
- opscr plugin: new `workspace-import.ts` and `pane/handoff.ts`; the pane opens a handed-over
  folder; View diagrams go in the bound diagram's workspace folder; new e2e `workspace-import.mjs`.

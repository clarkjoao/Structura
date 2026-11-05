# Proposal

## Why

The opscr pane stacks everything in one column: folder header, View picker, View diagrams,
initiatives, what is not carried, review items, a horizontal strip of file tabs and the editor, which
keeps half the height at most. With a product workspace it is too much in one place.

## What Changes

- The pane gets tabs, drawn like the element panel's: **Overview** (counts of elements, views,
  initiatives and files, the problem summary, the View picker and View diagrams), **Initiatives**
  (only for a product workspace: lock issues, Accept root, Promote and its preview), **Files** (the
  folder as a tree — sub-folders such as `initiatives/<name>/` fold — over the editor, which takes
  the rest of the height) and **Problems** (opscr diagnostics by file, what the diagram does not
  draw, what does not carry, the import review), with a count when something needs a look.
- The folder header, conflict banners and the status line stay outside the tabs.
- The pane keeps its tab while it is closed and opened; an empty folder opens on Files; an entry of
  Problems opens its file at its line in Files. Selecting an element on the canvas still opens its
  manifest, without switching tab.

## Impact

- opscr plugin only: `OpscrPane`, new `PaneTabs` and `FileTree`, i18n; the three e2e scripts open
  the tab they need.

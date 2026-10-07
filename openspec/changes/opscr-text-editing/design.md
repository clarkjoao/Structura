# Design

## Context

- Plugin API 1.3: importers create nested panels and catalog components through
  `toGeneratedGraph` + `insertGeneratedGraph`; plugins may otherwise only patch names/descriptions
  and move components.
- `opscr-mapping` + `opscr-layout` already produce a stable placed graph from YAML (`stabilizeLayout`
  keeps survivors' boxes).
- The app's own folder connection (`FileSystemAdapter`) keeps one directory handle in IndexedDB and
  re-requests permission on boot — the pattern to reuse for plugin folders.
- Monaco is lazy-loaded through `lib/monaco/LazyMonacoEditor`.

## Goals / Non-Goals

**Goals:**

- Generic host APIs (document pane, code editor, folder access, batched changes) — nothing
  opscr-specific in the host.
- The opscr plugin computes _what_ to change; the host decides _how_ it is stored.

**Non-Goals:**

- A host-side notion of "bound diagram": the binding lives in plugin storage.

## Decisions

**`applyChanges` reuses the generated-graph path.** `add` goes through `toGeneratedGraph` and
`insertGeneratedGraph(…, { linkExisting: true })`; update/move/remove/connection removal are applied
in the same `set()` after one `pushHistory`. To make it one step, `insertGeneratedGraph` gains an
internal variant that runs inside an open transaction (no second history push). Updates accept a
whitelist: name, description, technology, catalog service (`cloudServiceId` written through
`cloudServiceIdClearingPatch`). Removal goes through the store's own removal
(`removeElementsInDraft`), which takes a component's descendants and connections with it — so the
plugin keeps an element only when all its ancestors stay.

**The plugin keeps the key → id map.** Per bound diagram, plugin storage holds `{ folder binding,
ids by element key, ids by connection key }`. A sync diffs the new graph against that map and the
current diagram snapshot: keys whose id is gone from the diagram (the user deleted it) count as new.
No persisted schema change. Alternative: a persisted `externalKey` on components — a migration for
data only one plugin reads.

**Positions belong to the canvas.** The previous layout fed to `stabilizeLayout` is read from the
diagram snapshot (current positions and sizes of mapped ids), so the user's drags are survivors like
any other. Panels the user resized keep their size unless a child no longer fits.

**Folder access in `infrastructure/persistence/pluginFolders.ts`.** One IndexedDB store keyed
`<pluginId>:<bindingId>` → directory handle; `open` verifies permission (prompting on a user
gesture), `list` returns top-level file names, `read`/`write` take a single file name (no `/`, no
`..`). Writes go through `createWritable`. Exposed to plugins as `api.files.pick(bindingId)`,
`api.files.open(bindingId)`, `.list()`, `.read(name)`, `.write(name, text)`, `.forget(bindingId)`.

**Document pane UI.** `DocumentPaneSlot` renders right of the canvas in `WorkspaceContent`,
resizable, one pane open at a time; the toolbar shows a toggle per registered `document-pane`
panel (titles are plugin `LocalizedText`; host strings are i18n keys in en and pt-BR).

**`api.ui.CodeEditor`** wraps `LazyMonacoEditor` and maps markers with `setModelMarkers` on mount and
on change. Version bumps to **1.4.0**.

**Sync loop in the plugin.** Debounced 300 ms after an edit: compile all buffers → if any parse
error, markers only → else view → seeded `layoutView` → `stabilizeLayout` against the canvas →
diff → `applyChanges`. A sync never runs while another is in flight; the latest buffer wins.

## Risks / Trade-offs

- [The canvas and the YAML can disagree when the user edits a synced element on the canvas] → the
  next sync restores what the YAML says (positions excepted); canvas → YAML is the next change.
- [Only Chromium has the File System Access API] → the bind action is hidden where it is missing;
  the importer still works everywhere.
- [Undo of a sync is overwritten by the next edit's sync] → expected: the YAML is the truth.

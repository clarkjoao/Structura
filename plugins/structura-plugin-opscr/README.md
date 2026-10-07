# structura-plugin-opscr

Two ways to bring opscr into Structura:

- **Edit a folder (document pane, plugin API 1.4).** Open a diagram, click **opscr** in the canvas
  toolbar, and **Bind to opscr folder…**. The pane lists the folder's manifests and edits them in
  Structura's editor, with opscr problems marked on their lines; the diagram follows ~300 ms after
  you stop typing. Elements already on the canvas — including ones you dragged — stay where they
  are; new ones are placed next to their neighbours; removed ones disappear. Each sync is one undo
  step. **Save** (or Ctrl/Cmd+S in the editor) writes the files back; **Reload** re-reads the folder
  and discards unsaved edits. After a page reload, **Reconnect folder** asks the browser for
  permission again. Needs a Chromium-based browser (File System Access API).

  The other way works too, while the folder is open: canvas edits of what the YAML declares are
  patched into the text (unsaved until you save), touching only the lines they change — comments
  and formatting elsewhere stay as they are.

  | On the canvas                          | In the YAML                                                         |
  | -------------------------------------- | ------------------------------------------------------------------- |
  | Rename an element                      | `metadata.name` and every edge end naming it (refused if taken)     |
  | Edit its description                   | `spec.description`                                                  |
  | Delete elements                        | their manifests and the edges naming them                           |
  | Draw a connection between two elements | a new edge (`type` = the label if it is an edge type, else `calls`) |
  | Relabel a connection with an edge type | the edge's `type`                                                   |
  | Delete a connection                    | its edge                                                            |
  | Undo / redo (of either side)           | the text change it reverts                                          |

  **The chat** (bottom-right) on a bound diagram, while the folder is open in the pane, is an
  opscr editing assistant: its context is the opscr-architect skill (bundled at build time from
  the linked `opscr`, `npm run build-skill`) and the current manifests. The model writes whole
  manifest documents; they are applied as text patches (unsaved), validated by opscr, and errors
  they introduce are sent back to the model to fix, up to three attempts.

  **F2** on a manifest's `metadata.name`, or on an edge end's `id`, renames that element in every
  file; the canvas element keeps its place.

  Catalog services, technology and elements added from the palette stay canvas-only; the pane
  counts the elements that are not in the YAML.

  Positions go to the **layout sidecar** `opscr.layout.json` beside the manifests (one
  `"Kind/name": { x, y, width, height }` per line, parent-relative), saved with them. Binding a
  fresh diagram — or opening the VSCode preview — restores that arrangement; elements the sidecar
  does not list are placed by the stable layout.

- **Import one file**, described below.

## Importer

Imports opscr architecture-as-code manifests (`*.opscr.yaml`) into the active
diagram as a laid-out **technical view**: Domains and bounded contexts (ApplicationService) as nested
panels, technical Kinds as their AWS / GCP / Azure / OSS catalog components, flow edges as
connections labelled with their type. Kinds left out of the view, edges not drawn and opscr
validation errors come back as import warnings.

How the workspace is drawn is decided by the host's `src/lib/opscr-mapping` (copied in by
`sync-shared`); this plugin only parses, lays out with ELK and hands the result to the importer API
(plugin API `^1.3`).

## Build

opscr is not on npm yet, so it comes from a local checkout through `npm link`:

```bash
# once, in the opscr checkout
cd ../asc && npm install && npm run build && npm link

# here
npm install
npm link opscr          # again after every npm install: install drops the link
npm test
npm run build           # → dist/plugin.js
node e2e/pane.mjs       # document pane end to end (after `npm run build:plugins -- --no-build structura-plugin-opscr` at the root)
```

Install `dist/plugin.js` from the Plugins page, or build the app with it pre-installed:
`npm run build:plugins -- structura-plugin-opscr` from the repo root.

## Importing a workspace

The import dialog hands an importer one file. An opscr workspace usually spans several files, and a
file without the `Relationship` manifests has no edges, so join them into one multi-document file
first:

```bash
for f in examples/sample/*.opscr.yaml; do cat "$f"; echo "---"; done > all.opscr.yaml
```

Then **Import → opscr manifests** and pick `all.opscr.yaml`. Importing a folder belongs to the
folder-binding work, not to this plugin.

## Keeping it in sync

- `npm run sync-types` — the host plugin API types (`src/types/plugin.types.ts`).
- `npm run sync-shared` — the host projection (`src/generated/opscr-mapping`).
- `npm run sync-shared` also copies the host ELK runner (`src/generated/opscr-layout`).

Neither runs in CI: this plugin depends on an unpublished package.

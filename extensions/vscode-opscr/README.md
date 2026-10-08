# opscr Preview & Diagram Editor for VSCode

A live Structura diagram of an [opscr](../../plugins/structura-plugin-opscr/README.md) workspace,
next to the YAML you are editing: a read-only **preview**, and an editable **diagram editor**.

## Diagram editor

With a `*.opscr.yaml` active, run **opscr: Open Diagram Editor** (or its icon in the editor title).
Structura's own canvas opens beside the YAML, bound to the folder by the same engine as the
Structura plugin's document pane:

- **YAML → diagram:** typing in any manifest of the folder (unsaved text included) redraws the
  diagram ~300 ms after you stop. Changes on disk (git, other tools) too.
- **Diagram → YAML:** renames (every edge end follows), descriptions, deletions, connections,
  moves between panels, cloud service / technology, and palette elements added from the pane-less
  canvas become edits of the documents — unsaved, so you review and save them. Comments and
  formatting elsewhere are kept byte for byte. Undo a diagram edit in the diagram (Cmd/Ctrl+Z
  there reverts every file it touched); VSCode's undo in an editor reverts that file only, and the
  diagram follows the text.
- **Layout:** positions are written to `opscr.layout.json` next to the manifests, straight to disk.
- **Problems:** opscr diagnostics appear in the Problems panel.

Each editor starts from the YAML and the layout sidecar; nothing else is remembered between
sessions. The chat and the Structura plugin pane are not part of the editor — in VSCode, Claude
Code is the assistant.

## Preview

- **Open:** with a `*.opscr.yaml` active, run **opscr: Open Preview to the Side** (or the preview
  icon in the editor title).
- **Workspace:** every `*.opscr.yaml` / `*.opscr.yml` in that file's folder, plus its
  `opscr.config.yaml`. Unsaved text in open editors is used as it is.
- **Live:** the preview follows edits ~300 ms after you stop typing. While the YAML does not parse,
  it keeps the last picture.
- **Still:** elements already drawn keep their place when you add, remove or edit others; new ones
  are placed next to their neighbours. **opscr: Re-layout Preview** arranges everything from
  scratch.
- **Layout sidecar:** when the folder has an `opscr.layout.json` (Structura writes it when you save a
  bound folder), elements are drawn where it puts them; the preview redraws when the file changes.
  Re-layout ignores it until it changes again.
- **Problems:** opscr errors and warnings appear in the Problems panel, on their file and line.
- **Theme:** dark or light, following VSCode.

What is drawn is Structura's technical view of opscr (`src/lib/opscr-mapping`): Domains and bounded
contexts as panels, technical Kinds as their AWS / GCP / Azure / OSS components, flow edges as
connections. The preview never writes a file.

## Build and install

opscr is not on npm yet; it comes from a local checkout through `npm link`.

```bash
# once, in the opscr checkout
cd ../asc && npm install && npm run build && npm link

# at the Structura root: the preview page the webview loads
npm run build:embed

# here
npm install
npm link opscr        # again after every npm install: install drops the link
npm test
npm run package       # → vscode-opscr-<version>.vsix
code --install-extension vscode-opscr-0.1.0.vsix
```

## How it works

```
*.opscr.yaml ──(extension host, Node)──────────────────────────────────────┐
  opscr/core: parse + validate ──► Problems panel                           │
  opscr-mapping: technical view                                             │
  opscr-layout: ELK, seeded with the previous picture                       │
  stabilizeLayout: survivors keep their boxes ──► importer-shaped graph ────┤
                                                                            ▼
webview: Structura's embed preview (dist-embed) ◄── postMessage STRUCTURA_LOAD_GRAPH / THEME
```

- `src/pipeline.ts` — YAML → graph, no VSCode API (unit-tested).
- `src/extension.ts` — commands, debounce, diagnostics, webview.
- `src/generated/` — the host libraries, copied by `npm run sync-shared`; do not edit.
- `media/embed/` — the host's `npm run build:embed` output, copied by `npm run copy-embed`.

## Tests

- `npm test` — the pipeline: multi-file workspace, stability across an edit, parse failures,
  diagnostics.
- `npm run e2e` — a real VSCode (isolated profile, your settings untouched) opens the opscr sample,
  checks the webview drew every element, follows an unsaved edit and reports a problem. Set
  `VSCODE_PATH` when VSCode is not in `/Applications`.

Neither runs in CI: the extension depends on unpublished opscr.

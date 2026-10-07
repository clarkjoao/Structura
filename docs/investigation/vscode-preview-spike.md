# Spike: a read-only Structura preview for a VSCode webview

Date: 2026-10-06 · Branch: `spike/vscode-viewer` (throwaway code under `spike/vscode-viewer/`)

**Question.** How much of the viewer has to be extracted for a VSCode extension to render an opscr
file live, read-only, with autolayout?

**Answer.** Almost nothing has to be extracted. The existing viewer renders from a separate,
router-less entry built with relative paths, fed by `postMessage`; the opscr → diagram pipeline
already exists (`opscr/core` → `opscr-mapping` → ELK → importer-shaped graph). The real work is
**layout stability on edit** and the **webview packaging**, not the renderer.

## What was built

- `spike/vscode-viewer/embed-main.tsx` + `embed.html`: an entry that mounts `ViewerCanvas` alone. It
  listens for `STRUCTURA_LOAD_GRAPH { components, connections }` — the plugin importer result shape
  (API 1.3) — builds the diagram in an **in-memory store** (`createDiagramStore(new InMemoryAdapter())`
  + `insertGeneratedGraph`) and renders it. Every message rebuilds: that is the live-update path.
- `vite.spike.config.ts`: the app's Vite config with that entry only and `base: "./"`.
- `make-graph.ts`: what the extension host would run on save — reuses the opscr plugin's
  `importOpscr` (opscr/core + mapping + ELK) under Node.
- `drive.mjs`: headless Chromium loads the preview from a **non-root path** inside an iframe, posts
  the sample, then posts the sample plus one Cache and one edge.

## Measurements (opscr sample, 22 elements, 17 edges)

| | |
|---|---|
| YAML → graph in Node (parse, validate, project, ELK) | ~170 ms |
| Preview ready (`STRUCTURA_READY`) | ~0.3 s |
| First render after the message | ~1.9 s from page load |
| Rebuild on update (store + diagram) | ~1.5 ms; new node on screen in ~30 ms |
| Script + CSS fetched at runtime (minified) | ~3.5 MB, 15 files, Monaco not loaded |
| Build output on disk | 24 MB — Monaco and its language chunks are emitted though never loaded |
| Console errors | none |

Screenshots: `spike/vscode-viewer/shot-1.png` (sample), `shot-2.png` (after the edit).

## Findings

1. **The viewer needs a router context.** `CardNode/Badges.tsx` calls `useNavigate`, so the bare
   entry crashed until wrapped in `MemoryRouter`. A real entry must do the same (or Badges should not
   need a router when there is nowhere to navigate).
2. **Relative base works.** Built with `base: "./"` and served from a sub-path, every chunk, CSS and
   lazy import resolved. A webview will additionally need a `<base href>` pointing at
   `asWebviewUri(dist)` and a CSP allowing `webview.cspSource` for scripts, styles, fonts and images.
3. **No viewer extraction needed.** `ViewerCanvas` + the element/cloud bootstraps + an in-memory
   store are enough. Nothing from the editor (Canvas, LLM, collab) was reached.
4. **Layout is not stable across edits.** Adding one Cache re-runs ELK from scratch and swaps
   whole panels (`orders` and `catalog` traded places). For a live preview this is the main UX
   problem: the picture must not jump on every keystroke.
5. **Payload trimming is a packaging task.** The 24 MB on disk is mostly Monaco chunks a preview never
   loads; a preview build should keep them out of the graph (or delete them when packaging the
   `.vsix`).
6. **Cosmetic:** a panel's description overlaps its first child in nested panels.

## Not verified here

- An actual VSCode webview (`vscode-webview://` origin, CSP, `localStorage` availability for i18n
  and theme). Chromium in an iframe at a sub-path is the closest stand-in; the first task of the
  extension milestone should be a hello-world webview loading this build.
- Theme: the preview renders light; VSCode dark themes need the `dark` class toggled from the
  webview's theme kind.

## Recommendation for the VSCode milestone

- A real `embed` entry in the app (not under `spike/`), with `MemoryRouter`, the in-memory store, and
  a small message protocol: `STRUCTURA_LOAD_GRAPH` (replace), `STRUCTURA_THEME`, and
  `STRUCTURA_LOADED` back. Built as its own Vite target with `base: "./"`, Monaco excluded.
- The extension host runs `opscr/core` + `opscr-mapping` + ELK (as the plugin does) on document
  change (debounced) and posts the graph; invalid YAML posts nothing and surfaces diagnostics in the
  Problems panel instead, so the last valid picture stays.
- **Stable layout before anything else:** keep the previous position of every element whose id
  (`Kind/name`) survives an edit and only place new ones — either ELK's interactive/semi-interactive
  layered options seeded with the previous coordinates, or the layout sidecar decided in the grill
  log. This is the decision to make first; it is the one the user feels.

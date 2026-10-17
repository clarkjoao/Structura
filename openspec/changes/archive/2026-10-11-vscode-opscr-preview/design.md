# Design

## Context

- Spike findings: `docs/investigation/vscode-preview-spike.md`. The viewer renders from a
  router-less entry (with a `MemoryRouter`, since card badges call `useNavigate`) and an in-memory
  store fed by `insertGeneratedGraph`. Seeded ELK in interactive mode keeps the order of panels but
  still moves existing nodes ~160 px on average after adding one element — not stable enough alone.
- The opscr plugin already turns a file into an importer result (`importOpscr`); its ELK runner is a
  plugin-local copy.

## Goals / Non-Goals

**Goals:**

- Zero movement for surviving elements; deterministic placement for new ones.
- One ELK runner and one importer-result → store-graph normalization, shared by the plugin, the
  embed entry and the extension.

**Non-Goals:**

- Persisting positions (the layout sidecar belongs to the bidirectional milestone).
- Edge routes in the preview: the canvas routes connections itself, as for plugin imports.

## Decisions

**Stable layout = previous boxes + fresh layout for what is new, as a pure function.**
`stabilizeLayout(view, fresh, previous)` in `opscr-mapping` (no ELK): surviving leaves keep their
previous box; a new node takes its position in `fresh` translated by the offset of its nearest
surviving sibling between `fresh` and `previous` (so it lands where ELK put it relative to its
neighbours), then moves down until it overlaps no sibling; boundaries keep their previous position
and grow to their children's bounds plus padding, bottom-up. Without `previous` it returns `fresh`.
The fresh layout is seeded with the previous positions (interactive ELK) so "where ELK would put it"
is already close to the existing picture. Alternative: interactive ELK alone — measured, it moves
existing nodes.

**Shared ELK runner `src/lib/opscr-layout/`** (imports `elkjs` and `../opscr-mapping` only; guarded
like the mapping), synced into the plugin and the extension. Same options as the host engine;
interactive strategies switch on when a seed is given.

**`toGeneratedGraph(result)`** — the type policy, parent-cycle cutting and mapping to
`GeneratedNodeInput` move out of `runPluginImport` into a pure function in `features/plugins`, used by
the runner and the embed entry. Behaviour of plugin imports is unchanged (its tests stay as they are).

**Embed entry.** `embed.html` + `src/embed/main.tsx`, built by `vite.embed.config.ts` into
`dist-embed/` with `base: "./"`. Protocol (all `postMessage`):

| direction    | message                                            | meaning                 |
| ------------ | -------------------------------------------------- | ----------------------- |
| embed → host | `STRUCTURA_READY`                                  | listening               |
| host → embed | `STRUCTURA_LOAD_GRAPH { components, connections }` | replace the picture     |
| host → embed | `STRUCTURA_THEME { theme: "light" \| "dark" }`     | toggle the `dark` class |

Each graph is rebuilt in a fresh in-memory store (no persistence, no `localStorage` writes); the
canvas keeps its viewport between graphs (same diagram id), so an update does not re-zoom.

**Extension (`extensions/vscode-opscr`).** Extension host (Node, bundled with esbuild):

1. On open/edit (debounced 300 ms) of a `*.opscr.yaml`, collect every manifest file in its folder,
   taking unsaved text from open documents, plus `opscr.config.yaml`.
2. `compileSources` (opscr/core) → diagnostics to a `DiagnosticCollection`; if the YAML of any file
   fails to parse, stop here (the preview keeps its last picture).
3. `buildTechnicalView` → seeded `layoutView` → `stabilizeLayout` against the previous placed result
   → importer-shaped graph → `postMessage`.

The webview loads `dist-embed/embed.html` with a `<base href>` set to its `asWebviewUri` and a CSP
limited to `webview.cspSource` (+ `'unsafe-inline'` styles, which the canvas uses). `dist-embed` is
copied into the extension at build time; the Monaco chunks the preview never loads are not copied.
Theme follows `window.activeColorTheme` and its change event.

## Risks / Trade-offs

- [A panel that grows can come to overlap a sibling, since survivors never move] → accepted:
  moving a survivor is the jump this change removes; _Re-layout Preview_ tidies.

- [New nodes stacked below siblings may produce tall panels] → _Re-layout Preview_ resets; the
  placement only matters until the user asks for a tidy layout.
- [Webview CSP or `localStorage` surprises] → the first extension task is a webview that loads the
  embed build; i18n falls back to its default when storage is unavailable.
- [The extension depends on unpublished opscr] → built locally like the plugin, not in CI.

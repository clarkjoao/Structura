# Proposal

## Why

The moonshot of the opscr integration (`.grill/opscr-yaml-diagram-integration.md`): edit a
`.opscr.yaml` in VSCode and watch the diagram follow. The spike
(`docs/investigation/vscode-preview-spike.md`) showed the renderer is ready — the existing viewer
renders a graph from a router-less entry — and that the missing piece is a picture that does not
jump: re-running ELK on every edit swaps whole panels.

## What Changes

- **Add** a stable relayout for the technical view: elements that survive an edit keep their
  position; new elements are placed next to where the layout engine would put them, without
  overlapping; panels grow to hold them. A full relayout stays available on demand.
- **Add** a shared ELK runner for the technical view (`src/lib/opscr-layout`), taking previous
  positions as a seed. The opscr plugin switches to it instead of its own copy.
- **Add** an embeddable read-only preview entry of the app (`embed.html`), built separately with
  relative paths, that renders a graph posted to it (`STRUCTURA_LOAD_GRAPH`) and follows a theme
  message — the same graph shape plugin importers return.
- **Add** the VSCode extension `extensions/vscode-opscr`: _opscr: Open Preview to the Side_ renders the
  workspace of the active `*.opscr.yaml` (every manifest file in its folder, the open editors' unsaved
  text included), updates as you type, reports opscr diagnostics in the Problems panel, and offers
  _opscr: Re-layout Preview_.

## Non-Goals

- No editing in the preview, no diagram → YAML, no layout sidecar file (positions live only for the
  preview's lifetime).
- No marketplace publishing; the extension is built and installed locally (`.vsix`) while opscr is
  unpublished.
- No change to the editor app's routes, the `/viewer` page or its `postMessage` protocol.
- Views other than the technical view.

## Capabilities

### New Capabilities

- `opscr-preview`: a live, read-only, layout-stable preview of an opscr workspace, rendered by
  Structura inside VSCode.

### Modified Capabilities

None.

## Impact

- New: `src/lib/opscr-layout/`, `src/embed/`, `embed.html`, `vite.embed.config.ts`, an
  `npm run build:embed` script, `extensions/vscode-opscr/`.
- Changed: `src/lib/opscr-mapping` (stable layout), `src/features/plugins/run-plugin-import.ts`
  (graph normalization extracted for reuse), `plugins/structura-plugin-opscr` (uses the shared runner).
- Removed: `spike/vscode-viewer/` once the real entry exists.

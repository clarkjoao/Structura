# Proposal

## Why

The web canvas arranges a diagram with one pipeline (`planDiagramAutoLayout`). It follows the
reading direction, starts each container at its sources, applies the density and gaps, and ends
far back-connections on references (`arrange-rule-refs`). The viewer, shared links and plugin
imports draw what that pipeline or the author saved.

The VSCode extension does not. It lays the opscr workspace out in the extension host with a
mirrored ELK copy (`src/lib/opscr-layout`), so the same workspace reads differently there:

- no references;
- no density or reading rules;
- a different source order.

Arranging there cannot use the canvas rules either.

## What Changes

- The embed preview can arrange a posted graph itself, with the canvas pipeline. It uses the same
  settings type (`DiagramLayoutSettings`), defaults and normalisation as a diagram's Arrange menu.
- Protocol:
  - `STRUCTURA_LOAD_GRAPH` gains an optional `arrange: { mode, settings }`;
  - a new `STRUCTURA_ARRANGE { arrange }` re-arranges the picture on screen.
  - `mode: "automatic"` arranges every picture in the embed.
  - `mode: "manual"` draws the host's positions, as today, and is the default for a host that says
    nothing.
- In automatic mode, an update that changes no structure (only text) keeps the picture exactly
  where it was, the way the canvas only re-arranges after structural edits.
- A click on an automatic reference reveals its original.
- The VSCode extension:
  - gets _opscr: Arrange Preview…_, a menu with:
    - Mode: Automatic or Manual;
    - Spacing: compact, normal or spacious;
    - References: Rules, Trial or Off, with the neighbour distance, the connections kept on the
      original, and long forward lines;
  - saves the choice per workspace folder;
  - shows it in a status bar item.
  - Automatic is the default; the reference defaults are the canvas defaults.
  - _Re-layout Preview_ re-arranges in either mode.
- Read-only surfaces (viewer, shared link, embed, extension) zoom out as far as the canvas does
  (`CANVAS_MIN_ZOOM`). This is what makes a large arranged diagram fit.

## Non-Goals

- No Rearrange control in the viewer or a shared link. They keep drawing exactly what the author
  saved, references included, so every surface shows the author's picture.
- No change to plugin imports. They place what the plugin returns, and the author arranges in the
  canvas.
- The extension's own ELK layout (`opscr-layout`) and the layout sidecar stay, for manual mode. In
  automatic mode the sidecar is not read.
- No persisted schema change. The extension's settings live in VSCode `workspaceState`, not in the
  workspace files.

## Impact

- `src/embed/` (protocol, preview and a new `arrange.ts`).
- `applyLayoutResultEdges` and `applyDiagramAutoLayout` accept a store, so the embed arranges in
  its throwaway store, never in the app store.
- `reactFlowBaseConfig.ts` (read-mode `minZoom`).
- `extensions/vscode-opscr` (`arrange.ts`, `extension.ts`, `package.json`, README).
- The default picture in the extension changes for every folder with no saved choice.

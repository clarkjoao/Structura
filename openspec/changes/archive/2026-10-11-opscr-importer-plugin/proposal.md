# Proposal

## Why

`opscr-technical-view` decides how an opscr workspace looks in Structura, and plugin API 1.3 lets an
importer create nested panels and catalog components. Nothing yet connects them: there is no way to
open an opscr file and see the diagram. This change is that first visible step — and it proves the
projection and the autolayout on real files before the VSCode preview reuses them.

## What Changes

- **Add** `plugins/structura-plugin-opscr`: an importer for `*.opscr.yaml` / `*.opscr.yml` files.
- The importer validates the file with opscr's own engine (`opscr/core`), projects it with
  `src/lib/opscr-mapping` (copied in by a `sync-shared` script, as the LeanIX plugin does with
  `export-core`), lays it out with ELK, and returns panels, catalog components and connections at the
  canvas anchor.
- opscr diagnostics, Kinds left out of the view and edges not drawn come back as import warnings.

## Non-Goals

- One file per import. A workspace split across files is imported by concatenating them into one
  multi-document YAML; importing a folder belongs to the folder-binding milestone.
- No diagram → YAML, no layout sidecar, no re-import/merge into an already imported diagram.
- No edge routing or handle order from the importer: the API has no field for them; the canvas
  routes connections itself.
- Not built into the app by default and not run in CI: it depends on `opscr`, which is not on npm yet.

## Capabilities

### New Capabilities

- `opscr-import`: importing an opscr manifest file into the active diagram as a laid-out technical view.

### Modified Capabilities

None.

## Impact

- New folder `plugins/structura-plugin-opscr/` with its own `package.json` (`opscr` through
  `npm link`, `elkjs`), `sync-types` and `sync-shared` scripts, and tests.
- `plugins/README.md` lists the plugin.

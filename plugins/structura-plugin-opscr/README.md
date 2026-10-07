# structura-plugin-opscr

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
- `src/elk-layout.ts` mirrors the host's ELK options by hand; keep them in step.

Neither runs in CI: this plugin depends on an unpublished package.

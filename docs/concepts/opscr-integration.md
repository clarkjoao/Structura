# opscr ⇄ Structura — one page

Context to start a new chat about opscr work. Read this first, then the file the request is about.

## The idea

**opscr** describes a software architecture as YAML manifests (`*.opscr.yaml`) and validates them
against OpenAPI schemas and policies. **Structura** draws them. The YAML is the source of truth.
Structura edits the YAML only as text patches. Positions live in a sidecar file, never in the YAML.

```
           write / validate                      draw / edit
 Claude Code ──► *.opscr.yaml ◄──── text patches ──── Structura (opscr plugin pane)
 (skill, MCP)        │   ▲                                   │
                     │   └── opscr.layout.json (positions) ◄─┘
                     ▼
               VSCode preview (read-only picture of the folder)
```

## Repositories

| Where | What |
| --- | --- |
| `~/www/opscr` | The opscr engine. `schemas/opscr.dev/v1/*.schema.yaml` (source of truth for Kinds), `src/kernel` (= `opscr/core`, browser-safe), CLI `opscr compile <dir>`, `opscr import drawio`, `opscr mcp`, the `opscr-architect` skill. Examples: `examples/sample`, `examples/web-app-aws`. Linked into Structura with `npm link opscr`, not from npm. |
| `src/lib/opscr-mapping` | Pure projection YAML → Structura graph (technical view, view diagrams, layout file, visual layer, `withoutBroken`). No `@/` imports and no `opscr` import. Copied into the plugin and the extension by `sync-shared`. |
| `src/lib/opscr-layout` | Shared ELK layout runner. Also copied. |
| `plugins/structura-plugin-opscr` | The Structura plugin: importer, the **opscr document pane**, the bidirectional engine, the chat context. It bundles `opscr/core` and ELK. |
| `extensions/vscode-opscr` | The VSCode preview: a read-only picture beside the YAML, plus problems in the Problems panel. It loads `dist-embed` (`npm run build:embed`). |

## opscr in 30 seconds

- **Manifest:** `apiVersion: opscr.dev/v1`, `kind`, `metadata.name` (the name *is* the identity:
  `Kind/name`), `spec` (fields per Kind schema, `additionalProperties: false`).
- **Kinds:**
  - Technical: `Application`, `APIGateway`, `LoadBalancer`, `Database`, `Cache`, `Storage`, `Queue`, `Topic`, `Channel`, `Notification`, `ExternalSystem`, `Person`, `Component`, `DeploymentNode`, `Interface`.
  - DDD: `Domain`, `Subdomain`, `BoundedContext`.
  - Business: `BusinessCapability`, `BusinessRule`.
  - Organization: `Squad`, `Community`.
  - Graph: `Relationship`.
  - Diagrams: `View`.
- **`spec.provider`** is the product (SNS, Lambda, AuroraPostgres). Each provider belongs to one
  platform. The schema lists them in `x-opscr-platforms`.
- **`Relationship`** holds `edges: [{ from: {kind, id}, to: {kind, id}, type }]`. The types are
  `calls`, `consumes`, `produces`, `reads`, `writes`, `subscribes`, `publishes`, `triggers`,
  `appliesTo`, `belongsTo` (nesting), `relatedTo` and `deployedOn`.
- **`View`** (`SystemContext`, `Container`, `Component`, `Deployment`) selects what one diagram
  shows. `drillDown` links a box to another view.
- `opscr compile <folder>` validates the folder as one workspace. It reports errors (schema, missing
  references) and warnings (orphans, for example).

## Sidecars, beside the manifests

- `opscr.layout.json`: positions per `Kind/name`. Version 2 keeps the whole workspace in `elements`
  and one entry per View in `views`. Structura writes it, and the VSCode preview reads it.
- `opscr.visual.json`: the draw.io visual layer (boundaries, text, services with no Kind), written by
  `opscr import drawio`.
- `analysis.json`: what a draw.io import assumed, listed in the pane for review.

## The Structura side

**Panel rail → opscr icon → "Bind to opscr folder…"** binds the active diagram to a folder through
the File System Access API (Chromium only).

- **YAML → canvas.** About 300 ms after an edit (in the pane, VSCode or git; the folder is polled
  every 2 s), the engine projects the YAML and redraws. Elements keep their place, and new ones go
  next to their neighbours.
- **Canvas → YAML** (`engine/reconcile.ts`, `patches.ts`, `yaml-text.ts`): renames, descriptions,
  deletes, connections, edge types, providers and reparenting (`belongsTo`) become **text patches**.
  The rest of the file keeps its formatting. The patches stay unsaved until **Save**.
- **New canvas elements** are listed under "not in the YAML". You pick a Kind and click **Add to
  YAML** (`engine/adopt.ts`). The written manifest carries every field the Kind requires
  (`engine/required.ts`). A value guessed from the schema is marked
  `# set by Structura from the schema — review`.
- **Views.** The pane's Diagram picker shows the whole workspace or one View. A view is a
  **projection**: structure is not edited there. Elements drawn on it are listed, with a button to
  switch to the whole workspace. "A Structura diagram for each view" creates linked diagrams
  (`engine/view-diagrams.ts`).
- **Chat.** On a bound diagram, the assistant edits the YAML using the bundled skill
  (`chat-context.ts`). Errors are sent back to it for up to 3 attempts.
- **Errors.** The Structura pane draws what it can and shows problems as editor markers. The
  **VSCode preview** leaves out only the element an error is in (`withoutBroken`). Only YAML that
  does not parse freezes the picture.

Main files in the plugin:

- `src/pane/OpscrPane.tsx`: the UI, styled with the host classes listed in `pane/styles.ts`.
- `src/engine/engine.ts`: the orchestrator.
- `src/project.ts`: YAML → graph.
- `src/session.ts`: folder access.
- `src/pane/i18n.ts`: the pane's own en and pt-BR strings. Plugins cannot add keys to the host
  catalogs.

## Commands

```bash
# opscr (in ~/www/opscr)
npm run build && npm link            # after changing schemas or core
node dist/cli/index.js compile examples/web-app-aws

# plugin (plugins/structura-plugin-opscr)
npm link opscr                       # again after every npm install
npm run sync-shared                  # after touching src/lib/opscr-mapping or opscr-layout
npm run typecheck && npm test
# then at the root: build the app with the plugin, run the e2e
npm run build:plugins -- --no-build structura-plugin-opscr
node e2e/pane.mjs && node e2e/views.mjs

# app with the plugin built in (port 8080)
npm run dev:plugins -- opscr

# VSCode extension (extensions/vscode-opscr)
npm run sync-shared && npm test
npm run package                      # .vsix (needs `npm run build:embed` at the root first)
```

## Rules that bite

- `opscr-mapping` stays framework-agnostic: relative imports only, never throws. Edit it in
  `src/lib`, then run `sync-shared` in **both** the plugin and the extension.
- The plugin API types are copied too (`npm run sync-types`). A new host capability means bumping
  the plugin API version (`src/features/plugins/plugin.types.ts`) and the plugin manifest's
  `apiVersion`.
- The plugin's Tailwind classes work because `tailwind.config.ts` scans `plugins/*/src`.
- The opscr vocabulary is OSS: no internal business terms. The Kind for a solution is
  `BoundedContext`.
- LLM evals call the API endpoint, never plain `claude -p`.
- Tests read the opscr examples from **git HEAD** of the opscr checkout, so they do not depend on
  your working-tree edits.
- Structura's own workspace-folder sync (`src/infrastructure/persistence`) is a different thing from
  the opscr pane's folder. A deleted workspace folder now disconnects with a toast.

## Known gaps / ideas

- Adding a canvas element to the YAML while a View is shown needs the whole-workspace diagram.
- The pane opens a folder's top-level files only. The VSCode preview reads subfolders.
- No chat in VSCode, by decision: Claude Code edits the files there.

## How to ask in a new chat

Name the side, the case and the expected result. For example: "In the opscr pane (Structura),
renaming an element on a View should …", or "opscr schema: add field X to Topic, and keep the
Structura Add-to-YAML valid". Point to the example folder used for checking
(`~/www/opscr/examples/web-app-aws`).

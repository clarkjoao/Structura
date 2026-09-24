# Feature map

A user-facing inventory of what Structura does today, checked against the code. When a feature
changes, update this page in the same PR. For how each subsystem works internally, see
[concepts/](concepts/).

## Keyboard shortcuts

`Cmd` on macOS, `Ctrl` elsewhere. The in-app list lives under **More options → Shortcuts**
(`src/components/ShortcutsModal.tsx`), which is the source of truth for this table.

| Shortcut                          | Action                                     |
| --------------------------------- | ------------------------------------------ |
| `Cmd/Ctrl + F` or `Cmd/Ctrl + /`  | Search the canvas                          |
| `Cmd/Ctrl + K`                    | Command palette                            |
| `Cmd/Ctrl + B`                    | Toggle the sidebar                         |
| `Cmd/Ctrl + S`                    | Save to the connected folder               |
| `Cmd/Ctrl + Shift + L`            | Auto layout                                |
| `Space` + drag                    | Pan                                        |
| `Shift + E`                       | Quick insert                               |
| `Cmd/Ctrl + 1` / `2` / `3` / `4`  | Add a Person / System / Container / Component |
| `Esc`                             | Clear the selection                        |
| `Cmd/Ctrl + A`                    | Select all                                 |
| `Del` / `Backspace`               | Delete the selection                       |
| `Cmd/Ctrl + C` / `V` / `D`        | Copy / paste / duplicate                   |
| `Cmd/Ctrl + G` / `Cmd/Ctrl + Shift + G` | Group / ungroup                      |
| `Cmd/Ctrl + Shift + W`            | Reset edge waypoints                       |
| `Cmd/Ctrl + Shift + K`            | Lock / unlock                              |
| `Cmd/Ctrl + Z`                    | Undo                                       |
| `Cmd/Ctrl + Shift + Z` / `Ctrl + Y` | Redo                                     |
| Scroll / `Shift` + scroll         | Pan vertically / horizontally              |
| `Cmd/Ctrl` + scroll               | Zoom at the cursor                         |

During flow playback: `←` / `→` previous / next step (on a condition step, choose a branch),
`F10` step over, `Shift + F11` step out, `Esc` exit.

## Canvas

- Pan, zoom, fit to screen and a minimap that can be hidden (the preference is persisted).
- Click, `Cmd/Ctrl`+click and marquee selection; select all.
- Diagrams read left to right: left handles are inputs, right handles are outputs, and moving a
  node never rewires existing connections.
- Drag elements into and out of panels and swimlanes to re-parent them.
- Undo / redo with a bounded history per diagram.
- Focus mode, tag filters and search.

## Elements

### C4

| Type        | Use for                                  |
| ----------- | ---------------------------------------- |
| `person`    | People and actors                        |
| `system`    | Software systems (yours or external)     |
| `container` | Applications, services and data stores   |
| `component` | Building blocks inside a container       |

Each element can link to another diagram (drill-down, shown as "Explore inside"), to a service in
the Services catalog, and to external URLs.

### Structural elements

| Type               | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `panel`            | Grouping container (generic, VPC, subnets, AZ, EKS/ECS cluster, ASG) |
| swimlane           | A panel kind laid out as a lane                                      |
| `note`             | Markdown note                                                        |
| `api-group`        | A group of API endpoints                                             |
| `endpoint`         | A single endpoint (method + path)                                    |
| `db-table`         | Database table with columns                                          |
| `json-viewer`      | JSON payload viewer                                                  |
| `process-node`     | Flowchart-style process step                                         |
| `svg`              | Imported SVG or raster image                                         |
| `external-element` | Reference to an element in another diagram                           |

### Catalog families

AWS (~140 services), Azure (~55), Google Cloud (~40), Kubernetes resources and a small OSS family
(Redis, Kafka). Families register through the element registry — see
[architecture/element-registry.md](architecture/element-registry.md) and
[ADR-0010](adr/0010-element-registry.md).

Frequently used element configurations can be saved as **element presets** and reused from the
element picker. Custom icons can be added through the icon picker.

## Connections

- **Routing:** bezier, smoothstep, step, straight, and two editable styles — free-form with
  control points, and orthogonal (draw.io-style) with draggable segments and grid snapping.
- **Line:** solid, dashed, dotted; markers: none, arrow, closed arrow; custom colors.
- **Intent:** `dependency`, `call`, `event`, `data-flow`, `async-message` (each with default
  styling).
- **Direction:** unidirectional, bidirectional, reverse.
- Labels that can be dragged along the path.

## Flows

- Record a flow by clicking through the diagram, or edit its steps as a script.
- Step-by-step playback with highlighting, condition steps with branches, and coverage.
- Mermaid: import flowcharts and sequence diagrams, export flows as sequence diagrams.

## Versions

Named variants of a diagram (for example AS-IS / TO-BE) stored as differences from the base
snapshot, with a compare mode.

## Layout

- Auto layout (layered, left to right) powered by ELK.
- Fit panels to their children; grid snapping.

## Import, export and sharing

| Format                    | Import | Export | Notes                                          |
| ------------------------- | :----: | :----: | ---------------------------------------------- |
| JSON                      |   ✓    |   ✓    | Lossless; carries the services it references   |
| draw.io / diagrams.net    |   ✓    |   ✓    | Import by pasting draw.io XML onto the canvas  |
| Mermaid                   |   ✓    |   ✓    | Flowchart/sequence import; sequence export     |
| Workspace zip             |        |   ✓    | Selected diagrams, a folder or everything      |

- **Share links** encode the diagram in the URL (`/viewer#data=…`) and open a read-only viewer.
- **Embedding** — see [guides/embedding.md](guides/embedding.md).
- Plugins can add more importers and exporters.

## Persistence

| Storage                | Where                    | Notes                                         |
| ---------------------- | ------------------------ | --------------------------------------------- |
| Browser (localStorage) | This browser             | Default; automatic                            |
| Connected folder       | A folder on your disk    | File System Access API (Chromium browsers); two-way sync, conflict prompts |

A storage warning appears when the browser quota is close to full. See
[concepts/persistence.md](concepts/persistence.md).

## Live sessions (experimental)

Real-time editing through a self-hosted WebSocket relay (`server/`): shared cursors, presence,
editing warnings, and room limits. The wire protocol is documented in
[collab-websocket-protocol.md](collab-websocket-protocol.md).

## Services catalog

A registry of services (name, description, repository, stack, owner, tags) that elements can
link to. Sources: manual entry, GitHub and DefectDojo importers (enabled with
`VITE_ENABLE_GITHUB_IMPORT` / `VITE_ENABLE_DEFECTDOJO`). Exported diagrams carry the services
they reference and can relink them on import.

## AI assistant

A chat panel grounded in the open diagram. It can explain and analyze the diagram, generate
diagrams, and propose changes that are previewed on the canvas and applied only after
confirmation. Providers: OpenAI, Anthropic or a custom endpoint, called directly from the browser
or through the proxy in `server/`. API keys stay in the browser. Conversations are stored in
IndexedDB. See [concepts/ai-integration.md](concepts/ai-integration.md).

## Plugins

Install plugins from a local JavaScript file on the **Plugins** page, or build the app with
plugins pre-installed. See [../plugins/README.md](../plugins/README.md) and
[architecture/extension-points.md](architecture/extension-points.md).

## Walkthroughs (experimental)

Guided, multi-diagram walkthroughs. Disabled unless the build sets
`VITE_ENABLE_WALKTHROUGHS=true`.

## Interface

- Light and dark themes.
- English and Brazilian Portuguese (`pt-BR`) UI.

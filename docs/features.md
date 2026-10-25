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
snapshot, with a compare mode. A Version works like a branch:

- Editing an element of the base inside a Version edits the Version's own copy; the base does not
  change. Moving a base node inside a Version keeps the new position in the Version.
- Each Version can carry a status (Proposed, Approved, In progress, Done); the panel groups by it.
- When the base changes after a Version copied an element, the element is marked as a conflict.
  Choose **Keep version** or **Use base** in the element panel; merging waits until none is left.
- Merging writes what the Version added, changed and moved into the base, and removes what it
  removed.
- Plugins can own Versions (the opscr plugin, one per initiative): their merge, rename and delete
  go to the plugin. Drilling down to a linked diagram keeps the Version with the same key
  selected.

## Layout

- Auto layout (layered, left to right) powered by ELK, from the **Arrange** button in the bottom
  toolbar, `Cmd/Ctrl + Shift + L`, the context menus or the assistant.
- Per-diagram arrange settings, saved with the diagram:
  - **Spacing**: Compact, Normal or Spacious. It scales every tuned layout gap (×0.75 / ×1 / ×1.35),
    so the measured proportions hold. Normal is the default layout.
  - **Advanced**: the gap between layers and the gap between elements in a layer (40–308px), each
    overriding the spacing for that gap only.
  - Changing a setting re-arranges at once; one undo restores both the setting and the positions.
  - **Mode**: Manual (default) moves nothing on its own. Automatic places what you add next to
    what it connects to (a column to the right of its source, sliding down past anything in the
    way) and leaves every other element where it is. Moves, renames, deletions and connections
    between placed elements move nothing. The placement joins the edit's undo step, keeps your
    zoom, and the **Arrange** button still reorganizes the whole diagram. In a live session only
    the person who made the edit places it, and the mode itself syncs to everyone.
  - **Direction**: Horizontal (left to right, the default) or Vertical (top to bottom,
    [ADR-0013](adr/0013-diagram-reading-direction.md)). Switching re-arranges the whole diagram on
    the new axis and redraws its connections as one undo step; inputs move to the top and outputs
    to the bottom of every element. During a live session the switch is off; a vertical diagram
    still reads vertical for everyone, as the direction and arrange settings sync. The draw.io export
    attaches connections on the diagram's axis, a Mermaid `flowchart TD` imported into an empty
    diagram makes it vertical (into one with content it follows that diagram's direction), and
    the assistant can generate a vertical diagram.
  - **Restore defaults** goes back to Manual, Normal spacing, no overrides.
  - **Live sessions**: on a diagram with more than 50 elements, arranging the whole diagram (button,
    shortcut, menus, spacing changes, the assistant) is off, since it would rewrite every position
    for every participant at once. The automatic mode's placement of what was just added stays on.
- Arranging animates: elements glide to their new place and connections fade back in on their
  final route (instant with reduced motion).
- A collapsed panel is arranged at its collapsed size; its hidden children keep their place.
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

Real-time editing through a self-hosted relay (`server/`): up to 50 people per room, shared
cursors, presence, soft locks while someone drags or retypes an element, and automatic reconnect.
It runs single-instance out of the box, or as many relays sharing one Redis (`REDIS_URL`; the
Kubernetes and kind deployment lives in the separate `structura-wbsocket-server` project). See [concepts/collaboration.md](concepts/collaboration.md)
and the wire protocol, [collab-protocol-v3.md](collab-protocol-v3.md).

## Services catalog

A registry of services (name, description, repository, stack, owner, tags) that elements can
link to. Sources: manual entry, GitHub and DefectDojo importers (enabled with
`VITE_ENABLE_GITHUB_IMPORT` / `VITE_ENABLE_DEFECTDOJO`). Exported diagrams carry the services
they reference and can relink them on import.

## AI assistant

A chat panel grounded in the open diagram. It can explain and analyze the diagram, generate
diagrams, and propose changes that are previewed on the canvas and applied only after
confirmation. Providers: OpenAI, Anthropic or a custom endpoint, called directly from the browser
or through an HTTP proxy you run (`VITE_LLM_PROXY_URL`). API keys stay in the browser. Conversations are stored in
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

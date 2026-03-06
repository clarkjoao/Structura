# CONTEXT.md — Architecture Diagram Platform

## Vision

A collaborative architecture diagramming platform focused on **C4 Model**, designed to be the living documentation of a software system. The goal is to go beyond static diagrams — connecting architecture to real code, repositories, and workflows, so teams always know what exists, how it connects, and what breaks when something changes.

Reference products: IcePanel.io, draw.io, C4 Model spec.

---

## What's built

### Diagram system
- Multiple independent diagrams per workspace, each with its own isolated `ModelDraft`
- Each diagram has a `level` (context / container / component), `domain`, and `updatedAt`
- Dashboard lists all diagrams with name, domain, C4 level, and last edit
- Diagrams are opened individually and navigated via `/model/:id`

### Canvas
- Built on **React Flow** (`@xyflow/react`)
- Node types: `person`, `system`, `container`, `component`, `panel`, and all AWS category types
- Straight edges (`getStraightPath`), horizontal handles (left = target, right = source)
- Nodes linked to another diagram show a drill-down button → navigates to linked diagram
- **Panel nodes** — resizable group containers for visual organization (domain boundaries, responsibility zones), using React Flow's native parent-child system
- Z-order controls: bring to front / send to back
- Keyboard shortcuts: `Cmd+A` (select all), `Delete` (remove selected), `Cmd+D` (duplicate), `Cmd+Z/Shift+Z` (undo/redo), `Escape` (deselect)

### State management
- **Zustand** + **immer** — single store, no Context providers
- All selectors that return arrays/objects use `useShallow` to prevent infinite re-render loops
- Per-diagram isolated snapshots — editing one diagram never affects another

### AWS nodes
- Full AWS service catalog with categories and icons (`aws-react-icons`)
- Icons lazy-loaded via `import("aws-react-icons")` — pre-bundled by Vite as ESM
- Nodes display AWS category color, service icon, and name

### Service Registry
- Global catalog of microservices, independent of any diagram
- Each `ServiceDefinition` has: name, description, `repositoryUrl`, `technology[]`, `owner`, `tags`
- Canvas nodes can be linked to a registry entry via `serviceId`
- GitHub import: paste a repo URL → auto-detects tech stack from `package.json`, `pom.xml`, `go.mod`, `Cargo.toml`
- Registry answers: *"if this service changes, what systems and flows are impacted?"*

### Element Panel
- Properties tab: edit name, description, type, technology, AWS service, linked diagram, linked service
- Connections tab: lists all incoming and outgoing connections for the selected node, searchable

### Embedded diagrams (read-only)
- A node with `linkedDiagramId` can embed the linked diagram's contents inline on the canvas
- Embedded nodes are virtual (not in `draft.components`) — derived from the linked diagram's snapshot
- Rendered inside an `EmbeddedPanelNode` with `opacity: 0.75`, not editable, not draggable
- Detach button removes the embed

---

## What's in progress / planned next

### Flows (next priority)
Flows are named sequences that highlight a subset of nodes and connections to tell a story — e.g. "authentication flow", "checkout process".

**Creation:**
- User enters recording mode → clicks nodes and edges on the canvas in sequence
- Each click appends a `FlowStep` (`componentId` or `connectionId` + `order`)
- Side panel shows live step list + real-time Mermaid preview (generated from steps)
- Mermaid is the human-readable source of truth, saved alongside structured steps
- Validation warns if referenced elements no longer exist on canvas

**Playback:**
- User-driven, step by step — no auto-advance, no video controls
- Each step highlights the active node/edge; previous steps show subtle checkmark; others dim to `opacity: 0.25`
- Navigation: `← →` keyboard arrows or buttons in a fixed bottom bar
- Canvas is view-only during playback

**Data model:**
```ts
FlowStep { order, componentId?, connectionId?, note? }
Flow { id, name, mermaid, steps: FlowStep[], diagramId }
```
`flows: Record<string, Flow>` lives inside `ModelDraft`.

---

### Versioning and history
- Each diagram will support snapshots (commits) with author, timestamp, and message
- Version list shown in a side panel — similar to current `BluePrintVersion` concept
- **Diff view**: visual comparison between two versions — highlight added/removed/changed nodes and connections
- Restore a previous version as current draft

---

### GitHub sync (planned)
Deep integration between canvas elements and real repositories:

- **Auto-update tech stack**: when a service's repo is linked, periodically re-fetch `package.json` / `pom.xml` and update `technology[]` automatically
- **Drift detection**: detect when a service's actual dependencies diverge from what's documented in the diagram — surface a warning badge on the node
- **GitHub token support**: stored per-workspace for private repo access
- **Webhook support** (future): receive push events from GitHub → trigger re-scan of affected services

---

### Export
- **PNG/SVG**: canvas snapshot via `html-to-image`
- **JSON**: full `ModelDraft` export for backup and external tooling
- **draw.io XML**: serialize diagrams to `.drawio` format
  - `panel` → draw.io swimlane container
  - `component/container/system` → draw.io shapes with C4 styles
  - `connection` → draw.io edges with labels
  - `parentId` maps directly to draw.io's `parent` attribute
  - Flow step numbers → draw.io edge annotations

---

### Multi-user collaboration (future)
- Real-time presence: cursors, node locks
- Requires backend (WebSocket + persistent storage)
- Current architecture (Zustand in-memory) would be replaced by a CRDT or operational transform layer

---

### Tags and filtering (planned)
- Filter the canvas by tag (`payments`, `auth`, `infra`) — hide non-relevant nodes
- Tags already exist on `Component` and `ServiceDefinition`

---

### Comments and annotations (planned)
- Sticky notes on the canvas for additional context
- Not linked to any node — purely spatial

---

## Key architectural decisions

| Decision | Rationale |
|---|---|
| Zustand over Context | Canvas updates frequently (drag, resize) — Context would cause full re-renders |
| `useShallow` on all array selectors | `Object.values().filter()` always creates new references — causes infinite loops without shallow comparison |
| Per-diagram isolated snapshots | Editing one diagram must never affect another — each `Diagram` owns its own `ModelDraft` |
| Mermaid as text, not rendered | No `mermaid` npm package — flows store Mermaid as a string, steps as structured data. Steps drive playback, Mermaid is human-readable export |
| Straight edges | Cleaner for architecture diagrams — matches draw.io and IcePanel style |
| Panel nodes via React Flow parent-child | Native system, no extra libs, directly compatible with draw.io's XML parent attribute |
| AWS icons via single import | `import("aws-react-icons")` pre-bundled by Vite — avoids CJS `require` errors from glob imports |
| `onMoveEnd` not `onMove` for viewport | `onMove` fires every pixel and triggers store updates → re-render loop |

---

## Non-goals
- Not a UML tool — C4 Model only
- Not a real-time collaboration tool (yet)
- Not a code generator — documents architecture, does not generate it
- Mermaid is never rendered as a visual diagram — only parsed/generated as text

# CONTEXT.md — Structura

Single source of truth for architecture, data model, feature inventory, and roadmap.
For commands and agent setup, see `.ai/AGENTS.md`.
For coding rules, see `.ai/skills/`.

---

## Vision

A collaborative architecture diagramming platform focused on **C4 Model**, designed to be the living documentation of a software system. The goal is to go beyond static diagrams — connecting architecture to real code, repositories, and workflows, so teams always know what exists, how it connects, and what breaks when something changes.

Reference products: IcePanel.io, draw.io, C4 Model spec.

Open source first. Self-hostable. Cloud-ready for enterprise.

---

## Tech stack

| Concern | Library |
|---------|---------|
| UI framework | React 18 + TypeScript (strict) |
| Build | Vite + `@vitejs/plugin-react-swc` |
| Canvas | React Flow (`@xyflow/react`) |
| State | Zustand + Immer (feature slices) |
| Styling | Tailwind CSS — no CSS modules, no inline styles |
| UI primitives | shadcn/ui — do not edit directly, regenerate via shadcn CLI |
| Icons | lucide-react only |
| Animations | framer-motion (transitions and panel animations) |
| Routing | react-router-dom |
| i18n | react-i18next · pt-BR default · en secondary |
| Testing | Vitest |
| `@` alias | resolves to `./src` (configured in `vite.config.ts`) |

**Not actively used:** `@tanstack/react-query` is installed but not used for API calls.

---

## Architecture — Feature-Sliced Design (FSD)

Adopted FSD adapted for scalable frontend. Clean Architecture was explicitly rejected — overhead for a UI-first product. Ports & Adapters is applied surgically in the infrastructure layer only.

### Folder structure (current, implemented)

```
src/
├── features/
│   ├── diagram/                       # domain layer — no React, no JSX, no React Flow
│   │   ├── model/
│   │   │   ├── diagram.types.ts       # all domain types
│   │   │   ├── diagram.service.ts     # pure business logic (no Zustand)
│   │   │   └── diagram.utils.ts       # generateId
│   │   ├── store/
│   │   │   ├── diagram.store.ts       # Zustand + immer + persist; seed; selectors
│   │   │   ├── store.types.ts         # AppState, StoreActions
│   │   │   ├── actions.types.ts
│   │   │   ├── persist.config.ts      # localStorage config + schema migrations
│   │   │   ├── selectors/             # one file per domain
│   │   │   │   ├── component.selectors.ts
│   │   │   │   ├── connection.selectors.ts
│   │   │   │   ├── diagram.selectors.ts
│   │   │   │   ├── flows.selectors.ts
│   │   │   │   ├── folder.selectors.ts
│   │   │   │   ├── layout.selectors.ts
│   │   │   │   ├── registry.selectors.ts
│   │   │   │   └── index.ts
│   │   │   └── slices/                # one file per domain
│   │   │       ├── diagram.slice.ts
│   │   │       ├── components.slice.ts
│   │   │       ├── connections.slice.ts
│   │   │       ├── flows.slice.ts
│   │   │       ├── layout.slice.ts
│   │   │       ├── services.slice.ts
│   │   │       ├── clipboard.slice.ts
│   │   │       ├── history.slice.ts
│   │   │       ├── folders.slice.ts
│   │   │       ├── patterns.slice.ts
│   │   │       └── index.ts
│   │   └── index.ts                   # public API — only import from here
│   │
│   ├── canvas/                        # UI layer — bridges diagram domain to React Flow
│   │   ├── Canvas.tsx                 # React Flow shell; logic in useCanvasController
│   │   ├── constants.ts               # layout constants (PANEL_DEFAULT_W/H, etc.)
│   │   ├── viewport-utils.ts
│   │   ├── hooks/
│   │   │   ├── useCanvasController.ts # composes all canvas hooks
│   │   │   ├── useCanvasStore.ts      # centralised store access
│   │   │   ├── useCanvasVisualState.ts
│   │   │   ├── useCanvasEventHandlers.ts
│   │   │   ├── useCanvasEffects.ts    # viewport/layout side-effects
│   │   │   ├── useCanvasDrillHandlers.ts
│   │   │   ├── useCanvasKeyboard.ts   # orchestrates keyboard sub-hooks
│   │   │   ├── useNodeDragParenting.ts
│   │   │   └── keyboard/              # sub-hooks per shortcut group
│   │   ├── nodes/
│   │   │   ├── CustomNode/            # C4 + AWS nodes
│   │   │   ├── PanelNode.tsx
│   │   │   ├── NoteNode.tsx
│   │   │   ├── AwsIcon.tsx            # lazy-loads aws-react-icons
│   │   │   ├── useCanvasNodes.ts
│   │   │   └── node-types/            # NodeTypeDescriptor registry
│   │   │       ├── types.ts
│   │   │       ├── registry.ts        # NODE_TYPE_REGISTRY — c4Descriptor must be last
│   │   │       ├── c4Descriptor.ts    # catch-all fallback
│   │   │       ├── panelDescriptor.ts
│   │   │       ├── noteDescriptor.ts
│   │   │       └── README.md
│   │   ├── edges/
│   │   │   ├── CustomEdge.tsx
│   │   │   ├── edgeBuilding.ts
│   │   │   ├── connectionDerivations.ts
│   │   │   └── useCanvasEdges.ts
│   │   ├── panels/
│   │   │   ├── ElementPanel/          # properties sidebar (tabs: props + connections)
│   │   │   ├── MultiSelectPanel.tsx
│   │   │   └── NodeContextMenu.tsx
│   │   ├── flow/
│   │   │   ├── FlowPanel.tsx
│   │   │   ├── FlowRecorderPanel.tsx
│   │   │   ├── FlowStepNavigator.tsx
│   │   │   ├── useFlowState.ts
│   │   │   └── RecordingModeContext.tsx
│   │   ├── toolbar/
│   │   │   ├── CanvasToolbar.tsx
│   │   │   ├── ElementPickerModal.tsx
│   │   │   ├── PatternPicker.tsx
│   │   │   └── QuickInsertPopover.tsx
│   │   ├── contexts/
│   │   │   └── HandleHighlightContext.tsx
│   │   └── index.ts
│   │
│   ├── registry/
│   │   ├── model/registry.types.ts    # ServiceDefinition
│   │   ├── store/registry.store.ts    # re-exports + useRegistryActions
│   │   └── index.ts
│   │
│   └── flows/
│       └── index.ts                   # placeholder; types live in diagram
│
├── components/                        # shared UI outside features
│   ├── ui/                            # shadcn/ui — do not modify directly
│   ├── Navbar.tsx
│   ├── NavLink.tsx
│   └── LandingPage.tsx
│
├── infrastructure/
│   └── persistence/
│       ├── IStoragePort.ts            # interface: save/load/delete + raw get/set/remove
│       ├── LocalStorageAdapter.ts     # production; prefix structura_; defaultStorage singleton
│       ├── InMemoryAdapter.ts         # for tests and SSR
│       └── index.ts                   # export only defaultStorage and InMemoryAdapter
│
├── lib/
│   ├── aws-catalog.ts                 # AWS_CATEGORIES, AwsCategoryId, isAwsType, AWS_SERVICE_MAP
│   ├── github-import.ts               # importFromGitHub (tech stack detection)
│   ├── export-service/                # exportJSON, exportDrawio, exportMermaid, downloadFile
│   ├── utils.ts                       # cn() (tailwind-merge)
│   ├── model-types.ts                 # ⚠ compatibility only — do not add new imports
│   └── model-store.ts                 # ⚠ compatibility only — do not add new imports
│
├── fixtures/
│   └── seed.ts                        # demo data — used only when localStorage is empty
│
├── pages/
│   ├── Index.tsx                      # landing
│   ├── Dashboard.tsx → dashboard/     # diagram list + folder tree
│   ├── ModelExplorer.tsx → modelExplorer/  # canvas + flows + export
│   ├── ServiceRegistry.tsx            # global service catalog
│   └── NotFound.tsx
│
├── hooks/
│   ├── useTheme.ts
│   ├── use-toast.ts
│   └── use-mobile.tsx
│
├── App.tsx
└── main.tsx
```

### Boundary rules

- **Never** import from another feature's internals — only from its `index.ts`
- `features/diagram/` is the domain layer — **no React, no JSX, no React Flow imports**
- `features/canvas/` is the UI layer — may import from `diagram/` but not vice-versa
- **Never** import `LocalStorageAdapter` directly outside `infrastructure/persistence/`

---

## Pages and routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Index` / `LandingPage` | Landing |
| `/dashboard` | `Dashboard` | List/create/delete diagrams |
| `/model/:id` | `ModelExplorer` | Canvas editor for a diagram |
| `/registry` | `ServiceRegistry` | Manage service definitions |

`ModelExplorer` wraps `Canvas` in a `ReactFlowProvider` and manages flow playback/recording state locally, passing callbacks down to `Canvas`.

---

## Data model

```ts
ComponentType =
  | "person" | "system" | "container" | "component"
  | "panel" | "note"
  | AwsCategoryId
  | InfraType

Component {
  id, name, type: ComponentType, description
  technology?: string
  parentId: string | null
  tags?: string[]
  awsService?: string
  serviceId?: string
  linkedDiagramId?: string
  width?: number
  height?: number
  panelColor?: string       // panels and notes
  panelOpacity?: number     // 0–100, panels only
}

// Component is a discriminated union — always use type guards:
// isPanelComponent, isNoteComponent, isC4Component, isAwsComponent
// imported from @/features/diagram

Connection {
  id, sourceId, targetId, label
  technology?: string
  description?: string
  communicationType?: CommunicationType
  style?: ConnectionStyle   // edgeStyle, strokeStyle, strokeWidth, markerEnd, markerStart, animated
}

CommunicationType = "sync" | "async" | "tcp" | "udp" | "event" | "protocol"

ServiceDefinition {
  id, name, description, repositoryUrl
  technology: string[]
  owner?: string
  tags?: string[]
}

ViewNodeLayout { elementId, x, y, zIndex? }

Diagram {
  id, name, level: Level, domain?
  updatedAt: number              // Unix timestamp — NOT a string
  folderId?: string
  snapshot: ModelDraft
  nodeLayouts: ViewNodeLayout[]
  viewport: { x, y, zoom }
  versions: DiagramVersion[]
}

ModelDraft { components, connections, serviceRegistry, flows }

Flow {
  id, name, diagramId
  description?: string
  tags?: string[]
  mermaid: string
  steps: FlowStep[]
}

FlowStep {
  order
  componentId?: string
  connectionId?: string
  note?: string
  duration?: string       // e.g. "~200ms", "async"
}

DiagramVersion {
  id, diagramId
  snapshot: ModelDraft
  nodeLayouts: ViewNodeLayout[]
  author?: string
  message: string
  createdAt: number
}

Folder {
  id, name
  parentId: string | null
  domain?: string
}

PatternTemplate {
  id, name, description
  category: "messaging" | "data" | "integration" | "resilience" | "security"
  components: Omit<Component, "id">[]
  connections: Array<Omit<Connection, "id" | "sourceId" | "targetId"> & {
    sourceIndex: number
    targetIndex: number
  }>
}

InfraType =
  | "load-balancer" | "auto-scaling" | "firewall" | "cdn"
  | "dns" | "api-gateway-infra" | "reverse-proxy" | "service-mesh"
```

### Store root shape

```ts
{
  diagrams: Record<string, Diagram>;
  folders: Record<string, Folder>;   // at root, outside ModelDraft
  activeDiagramId: string | null;
}
```

---

## Store — slice index

| Slice | Actions |
|-------|---------|
| `diagram.slice.ts` | `addDiagram`, `openDiagram`, `updateDiagram`, `removeDiagram`, `setActiveDiagramId`, `commitVersion`, `restoreVersion` |
| `components.slice.ts` | `addComponent`, `updateComponent`, `removeComponent`, `setParent`, `groupNodes`, `ungroupNodes` |
| `connections.slice.ts` | `addConnection`, `updateConnection`, `removeConnection` |
| `flows.slice.ts` | `addFlow`, `updateFlow`, `removeFlow` |
| `layout.slice.ts` | `updateNodeLayout`, `updateViewport`, `bringToFront`, `sendToBack` |
| `services.slice.ts` | `addService`, `updateService`, `removeService`, `linkComponentToService`, `linkComponentToDiagram` |
| `clipboard.slice.ts` | `copyToClipboard`, `pasteFromClipboard`, `clearClipboard` |
| `history.slice.ts` | `undo`, `redo` + internal `pushHistory()` |
| `folders.slice.ts` | `addFolder`, `updateFolder`, `removeFolder`, `moveFolder` |
| `patterns.slice.ts` | `insertPattern` |

**Critical store rules** — see `.ai/skills/store-patterns.md` for full detail:
- Selectors that return arrays/objects **must** use `useShallow`
- `pushHistory` must be called **before** every undoable mutation
- Layout/viewport updates are **not** undoable — no `pushHistory`
- Service changes are **not** undoable by design
- No I/O, no React, no side effects inside slices
- `resolveCanvasSnapshot` must go through `getCachedCanvasSnapshot` in selectors

**Testing**: Use `createDiagramStore(new InMemoryAdapter())` — never test against `localStorage`.

---

## Canvas hooks

| Hook | Responsibility |
|------|---------------|
| `useCanvasController` | Composes all canvas hooks; bridges store to React Flow |
| `useCanvasStore` | Centralised store access via `useShallow` selectors |
| `useCanvasVisualState` | Local visual state: selection, context menu, highlights |
| `useCanvasEventHandlers` | React Flow event handlers: connect, click, context menu |
| `useCanvasEffects` | Side-effects: viewport persistence, layout sync |
| `useCanvasDrillHandlers` | Drill-down to linked diagrams |
| `useCanvasKeyboard` | Orchestrates keyboard shortcut sub-hooks |
| `useNodeDragParenting` | Drag-to-panel parenting and unparenting |
| `useCanvasNodes` | Derives `Node[]` from visible components via descriptor system |
| `useCanvasEdges` | Derives `Edge[]` from visible connections |
| `useFlowState` | Playback highlights, recording badges, coverage overlays |

Keyboard shortcuts: `Cmd+A` select all · `Delete` remove · `Cmd+D` duplicate · `Cmd+G` group · `Cmd+Z` / `Shift+Z` undo/redo · `Escape` deselect.

---

## Node type system

`src/features/canvas/nodes/node-types/` implements a descriptor registry.

- Each node type is a `NodeTypeDescriptor` — see `node-types/README.md` and `.ai/skills/new-node-type.md`
- **`c4Descriptor` must always be last** in `NODE_TYPE_REGISTRY` — it is the catch-all fallback
- Never add node type conditionals directly in `useCanvasNodes` or `Canvas.tsx`

Layout constants (`PANEL_DEFAULT_W/H`, `MIN/MAX_HANDLES`, `NODE_DRAG_PADDING`, `DEFAULT_NODE_W/H`) are in `src/features/canvas/constants.ts`.

---

## Ports & Adapters

Infrastructure is always accessed through interfaces. Application code never imports adapters directly.

```ts
// infrastructure/persistence/IStoragePort.ts
interface IStoragePort {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}

// infrastructure/git/IGitPort.ts  (planned)
interface IGitPort {
  getRepository(url: string, token: string): Promise<RepoMetadata>;
  getFileTree(repoId: string): Promise<FileNode[]>;
  watchChanges(repoId: string, callback: (change: GitChange) => void): void;
}
```

This allows: `LocalStorageAdapter` (self-hosted), `PostgresAdapter` (enterprise/cloud), `SupabaseAdapter` (SaaS).

---

## Deprecated — do not import from these

| File | Use instead |
|------|------------|
| `src/lib/model-types.ts` | `@/features/diagram` |
| `src/lib/model-store.ts` | `@/features/diagram` |

---

## What's built

### Diagram system
Multiple independent diagrams, each with isolated `ModelDraft`. Dashboard lists diagrams with name, domain, C4 level, last edit. Navigate via `/model/:id`.

### Canvas
React Flow with node types: `person`, `system`, `container`, `component`, `panel` + all AWS categories. Straight edges (`getStraightPath`), horizontal handles (left = target, right = source). Nodes with `linkedDiagramId` show drill-down button. Panel nodes are resizable group containers via React Flow parent-child. Z-order: bring to front / send to back.

### AWS nodes
Full AWS service catalog with categories and icons (`aws-react-icons`). Icons lazy-loaded via `import("aws-react-icons")` — pre-bundled by Vite.

### Service Registry
Global catalog of `ServiceDefinition`, independent of any diagram. Nodes linked via `serviceId`. GitHub import: auto-detect tech stack from `package.json`, `pom.xml`, `go.mod`, `Cargo.toml`. Impact analysis: "if this service changes, what systems and flows are affected?"

### Element Panel
Properties tab: name, description, type, technology, AWS service, linked diagram, linked service. Connections tab: incoming/outgoing connections, searchable.

### Flows
Named sequences highlighting nodes/connections to tell a story. Recording mode: click nodes/edges in sequence → builds `FlowStep[]`. Real-time Mermaid preview during recording. Playback: step-by-step with keyboard `← →`, active node/edge highlighted, others dimmed to 0.25 opacity. Canvas view-only during playback.

`playing` and `recording` are mutually exclusive, enforced by discriminated union. Any action requiring idle state guards with `flowMode.isIdle`.

### Versioning / Scenes
ASIS/TOBE scenes, visual side-by-side compare mode, merge with preview and conflict resolution, scene duplication.

---

## Features planned / in progress

### Feature #3 — Create diagram from component
Button "Criar diagrama vinculado" in `ElementPanel` when `linkedDiagramId` is empty and type is `system` or `container`. Auto-fill name, suggest level, inherit `domain`. Auto-call `linkComponentToDiagram` after creation.

### Feature #4 — Architecture Patterns
`PatternTemplate` in types. Pattern catalog in `src/lib/patterns-catalog.ts`: FIFO Queue (AWS/Kafka), Transactional Outbox, API Gateway + BFF, Circuit Breaker, Sidecar Proxy, CQRS, Saga, Cache Aside, Event Sourcing. `PatternPicker` modal from `CanvasToolbar`, grouped by category, with preview.

### Feature #6 — Panel improvements + Note component
`panelColor` and `panelOpacity` on `Component`. Panel redesign with color picker (8 swatches + opacity slider). New `note` ComponentType: `NoteNode` — colored card, no handles, resizable, no connections allowed.

### Feature #8 — Flow enhancements
`description` and `tags` on `Flow`. `duration` on `FlowStep`. "Copiar Mermaid" button. Flow coverage indicators: colored dots on covered nodes, soft overlay on covered edges.

### Feature #9 — Export + Import
`exportJSON`, `exportDrawio`, `exportMermaid` in `ExportService`. `importFromJSON`, `importFromDrawio` in `ImportService`. "Exportar" → up to 3 simultaneous downloads. "Importar" always creates new diagram, never overwrites.

### Feature #10 — GitHub sync
Auto re-fetch tech stack on Service Registry open. Drift detection badge (`⚠ Desatualizado`). Personal GitHub token in localStorage — never in store/snapshot.

### Feature #11 — Versioning + Diff
`DiagramVersion` and `versions: DiagramVersion[]` on `Diagram`. `commitVersion` and `restoreVersion` actions. Version side panel in `ModelExplorer`. Diff view: added (green), removed (red), modified (yellow).

### Feature #12 — i18n
`i18next` + `react-i18next` + `i18next-browser-languagedetector` + `date-fns`. Auto-detect browser language, fallback pt-BR. `updatedAt` on `Diagram` is `number` (Unix timestamp) everywhere. All `updatedAt` displays use `formatDistanceToNow` from `date-fns` with dynamic locale. From this feature forward: every new UI string goes directly to both locale files.

### Feature #13 — Communication type on Connection
`communicationType?: CommunicationType` on `Connection`. Visual diff per type: `sync` = solid arrow, `async` = dashed, `event` = arrow + lightning icon. Included in draw.io export and Mermaid output.

### Feature #14 — Folders in Dashboard
`Folder` type, `folders: Record<string, Folder>` at store root, `folderId?` on `Diagram`. Unlimited depth tree. Drag & drop diagrams between folders. Diagrams without `folderId` at root.

### Feature #15 — Infra elements
`InfraType` union. "Infra" category in `CanvasToolbar` — cloud-agnostic. Distinct icons via lucide. Dashed border or neutral color to distinguish infra from application. Separate `infra-catalog.ts` from `aws-catalog.ts`.

---

## Roadmap — backend and infrastructure

### Phase 1 — Foundation (current, client-side)
FSD folder restructure · `IStoragePort` + `LocalStorageAdapter` · Seed data only when localStorage is empty.

### Phase 2 — Backend (Next.js migration)
Migrate Vite → Next.js when auth is needed. NextAuth (GitHub + GitLab). API Routes as HTTP adapters. `IGitPort` with `GitHubAdapter` and `GitLabAdapter`.

### Phase 3 — Database
Drizzle ORM (not Prisma — same schema for SQLite and PostgreSQL). Self-hosted: SQLite. Cloud/Enterprise: PostgreSQL. SaaS option: Supabase.

### Phase 4 — Collaboration
Real-time presence: cursors, node locks. WebSocket or Liveblocks. Zustand replaced by CRDT or operational transform layer.

---

## Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| FSD over Clean Architecture | UI is the product — CA layers add overhead without benefit for a canvas-heavy app |
| Ports & Adapters only in infrastructure | Isolates persistence and git without over-engineering the domain |
| Drizzle over Prisma | Same schema for SQLite (self-hosted) and PostgreSQL (cloud) — critical for open source |
| Next.js migration deferred | No SSR/API benefit until auth and backend are needed |
| Zustand over Context | Canvas updates frequently — Context causes full re-renders |
| `useShallow` on all array selectors | `Object.values().filter()` always creates new references → infinite loops |
| Per-diagram isolated snapshots | Editing one diagram must never affect another |
| Mermaid as text, not rendered | No `mermaid` npm package — steps drive playback, Mermaid is human-readable export |
| Straight edges | Cleaner for architecture diagrams — matches draw.io and IcePanel style |
| Panel nodes via React Flow parent-child | Native system, compatible with draw.io XML `parent` attribute |
| AWS icons via single import | `import("aws-react-icons")` pre-bundled by Vite — avoids CJS `require` errors |
| `onMoveEnd` not `onMove` for viewport | `onMove` fires every pixel → store updates → re-render loop |
| `updatedAt` as Unix timestamp | Enables i18n-aware relative formatting via `date-fns` |

---

## Non-goals

- Not a UML tool — C4 Model only
- Not a real-time collaboration tool (yet)
- Not a code generator — documents architecture, does not generate it
- Mermaid is never rendered as a visual diagram — only parsed/generated as text
- No vendor lock-in — every cloud integration goes through a Port interface

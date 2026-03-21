# CONTEXT.md — Structura

## Vision

A collaborative architecture diagramming platform focused on **C4 Model**, designed to be the living documentation of a software system. The goal is to go beyond static diagrams — connecting architecture to real code, repositories, and workflows, so teams always know what exists, how it connects, and what breaks when something changes.

Reference products: IcePanel.io, draw.io, C4 Model spec.

Open source first. Self-hostable. Cloud-ready for enterprise.

---

## Tech stack

- **React 18** + **TypeScript** (strict)
- **Vite** + `@vitejs/plugin-react-swc`
- **React Flow** (`@xyflow/react`) — canvas, nodes, edges
- **Zustand** + **immer** — all global state, split into feature slices
- **Tailwind CSS** — styling only, no CSS modules or inline styles
- **shadcn/ui** — UI primitives
- **lucide-react** — icons only
- **framer-motion** — transitions and panel animations
- **react-router-dom** — routing
- UI language: **Brazilian Portuguese (pt-BR)**

---

## Architecture — Feature-Sliced Design (FSD)

Adopted **Feature-Sliced Design** adapted for scalable frontend. Clean Architecture (classic 4-layer) was explicitly rejected — overhead for a UI-first product. The relevant principle from Hexagonal Architecture is applied surgically: **Ports & Adapters in the infrastructure layer only**.

### Folder structure

```
src/
├── features/
│   ├── diagram/
│   │   ├── model/
│   │   │   ├── diagram.types.ts       # tipos de Diagram, ModelDraft, ViewNodeLayout
│   │   │   ├── diagram.service.ts     # lógica de negócio pura, sem Zustand
│   │   │   └── diagram.utils.ts
│   │   ├── store/                     # Zustand slice de diagrams
│   │   └── index.ts                   # public API da feature
│   ├── canvas/
│   │   ├── nodes/                     # C4Node, PanelNode, NoteNode, AwsNode, InfraNode
│   │   ├── edges/                     # C4Edge
│   │   ├── toolbar/
│   │   └── index.ts
│   ├── registry/
│   │   ├── model/
│   │   │   └── registry.types.ts      # ServiceDefinition
│   │   ├── store/
│   │   └── index.ts
│   └── flows/
│       ├── model/
│       │   └── flow.types.ts          # Flow, FlowStep
│       ├── store/
│       └── index.ts
│
├── shared/
│   ├── ui/                            # shadcn + primitivos reutilizáveis
│   ├── lib/                           # utils genéricos (generateId, etc.)
│   └── types/                         # tipos globais compartilhados
│
├── infrastructure/
│   ├── persistence/
│   │   ├── IStoragePort.ts            # interface genérica
│   │   ├── LocalStorageAdapter.ts     # browser, usa Zustand persist
│   │   ├── IndexedDBAdapter.ts        # para dados maiores (futuro)
│   │   └── HttpAdapter.ts             # quando tiver backend (futuro)
│   ├── git/
│   │   ├── IGitPort.ts                # interface genérica
│   │   ├── GitHubAdapter.ts           # OAuth + GitHub API (futuro)
│   │   └── GitLabAdapter.ts           # GitLab API (futuro)
│   └── auth/
│       ├── IAuthPort.ts               # interface genérica (futuro)
│       └── ...
│
└── pages/
    ├── Dashboard.tsx
    ├── ModelExplorer.tsx
    └── Index.tsx
```

### Estrutura atual (implementada)

Estrutura real do projeto após a refatoração FSD + persistência:

```
src/
├── features/
│   ├── diagram/
│   │   ├── model/
│   │   │   ├── diagram.types.ts       # Tipos: Component, Connection, Diagram, ModelDraft, Flow, FlowStep, ViewNodeLayout, Level, ComponentType
│   │   │   ├── diagram.service.ts     # Lógica pura: computeServiceImpact, parseMermaidToSteps
│   │   │   └── diagram.utils.ts       # generateId
│   │   ├── store/
│   │   │   ├── diagram.store.ts       # Zustand + immer + persist; seed; ações e selectors
│   │   │   ├── store.types.ts         # AppState, StoreActions
│   │   │   ├── actions.types.ts       # Tipos das actions
│   │   │   ├── persist.config.ts      # Configuração de persistência
│   │   │   ├── selectors/             # Seletores por domínio
│   │   │   │   ├── component.selectors.ts
│   │   │   │   ├── connection.selectors.ts
│   │   │   │   ├── diagram.selectors.ts
│   │   │   │   ├── flows.selectors.ts
│   │   │   │   ├── folder.selectors.ts
│   │   │   │   ├── layout.selectors.ts
│   │   │   │   ├── registry.selectors.ts
│   │   │   │   └── index.ts
│   │   │   └── slices/                # Slices por domínio
│   │   │       ├── diagram.slice.ts   # addDiagram, openDiagram, removeDiagram, commitVersion, restoreVersion
│   │   │       ├── components.slice.ts
│   │   │       ├── connections.slice.ts
│   │   │       ├── flows.slice.ts
│   │   │       ├── layout.slice.ts
│   │   │       ├── services.slice.ts
│   │   │       ├── clipboard.slice.ts
│   │   │       ├── history.slice.ts
│   │   │       ├── folders.slice.ts   # addFolder, updateFolder, removeFolder, moveFolder
│   │   │       ├── patterns.slice.ts  # insertPattern
│   │   │       └── index.ts
│   │   └── index.ts                   # Reexporta tipos, utils, service, store
│   ├── canvas/
│   │   ├── Canvas.tsx                 # Shell React Flow (JSX); lógica em hooks/useCanvasController.ts
│   │   ├── canvas.constants.ts / canvas.types.ts / reactFlowConfig.tsx
│   │   ├── constants.ts               # Constantes de layout
│   │   ├── viewport-utils.ts          # Utilitários de viewport
│   │   ├── hooks/
│   │   │   ├── useCanvasStore.ts      # Acesso centralizado ao store
│   │   │   ├── useCanvasVisualState.ts # Estado visual local
│   │   │   ├── useCanvasEventHandlers.ts
│   │   │   ├── useCanvasEffects.ts    # Side-effects: viewport, layout
│   │   │   ├── useCanvasDrillHandlers.ts
│   │   │   ├── useCanvasKeyboard.ts   # Orquestra atalhos de teclado
│   │   │   ├── useNodeDragParenting.ts
│   │   │   └── keyboard/              # Sub-hooks de teclado por grupo
│   │   ├── nodes/
│   │   │   ├── CustomNode/            # Nó C4 + AWS (componentes internos)
│   │   │   ├── PanelNode.tsx
│   │   │   ├── NoteNode.tsx
│   │   │   ├── AwsIcon.tsx
│   │   │   ├── nodeVisibility.ts
│   │   │   ├── useCanvasNodes.ts
│   │   │   └── node-types/            # Sistema de descritores (c4, panel, note)
│   │   ├── edges/
│   │   │   ├── CustomEdge.tsx
│   │   │   ├── edgeBuilding.ts
│   │   │   ├── connectionDerivations.ts
│   │   │   ├── useCanvasEdges.ts
│   │   │   ├── useCanvasConnectionDerivations.ts
│   │   │   └── useCanvasHandleReorder.ts
│   │   ├── panels/
│   │   │   ├── ElementPanel/          # Painel lateral de propriedades
│   │   │   ├── MultiSelectPanel.tsx
│   │   │   └── NodeContextMenu.tsx
│   │   ├── flow/
│   │   │   ├── FlowPanel.tsx
│   │   │   ├── FlowRecorderPanel.tsx
│   │   │   ├── FlowStepNavigator.tsx
│   │   │   ├── flowState.ts
│   │   │   ├── useFlowState.ts
│   │   │   └── RecordingModeContext.tsx
│   │   ├── toolbar/
│   │   │   ├── CanvasToolbar.tsx
│   │   │   ├── ElementPickerModal.tsx
│   │   │   ├── PatternPicker.tsx
│   │   │   └── QuickInsertPopover.tsx
│   │   ├── models/
│   │   │   └── panelParenting.ts
│   │   ├── contexts/
│   │   │   └── HandleHighlightContext.tsx
│   │   └── index.ts
│   ├── registry/
│   │   ├── model/
│   │   │   └── registry.types.ts      # ServiceDefinition
│   │   ├── store/
│   │   │   └── registry.store.ts      # Reexporta selectors do diagram + useRegistryActions
│   │   └── index.ts
│   └── flows/
│       └── index.ts                   # Placeholder (tipos Flow/FlowStep estão em diagram)
│
├── components/                        # UI compartilhada (fora de features)
│   ├── ui/                            # shadcn/ui
│   ├── Navbar.tsx                     # Inclui ThemeToggle
│   ├── NavLink.tsx
│   └── LandingPage.tsx
│
├── lib/                               # Utilitários e catálogos globais
│   ├── model-types.ts                 # Reexporta @/features/diagram e @/features/registry (compat)
│   ├── model-store.ts                 # Reexporta @/features/diagram (compat)
│   ├── aws-catalog.ts                 # AWS_CATEGORIES, AwsCategoryId, isAwsType, AWS_SERVICE_MAP
│   ├── github-import.ts               # importFromGitHub (tech stack a partir de repo)
│   ├── export-service/                # exportJSON, exportDrawio, exportMermaid, downloadFile (+ submódulos)
│   └── utils.ts                       # cn() (tailwind-merge)
│
├── infrastructure/
│   └── persistence/
│       ├── IStoragePort.ts            # Interface: save, load, delete, getItem, setItem, removeItem
│       ├── LocalStorageAdapter.ts     # Implementação browser; prefixo structura_; defaultStorage
│       └── index.ts
│
├── fixtures/
│   └── seed.ts                        # Dados de seed para desenvolvimento
│
├── pages/
│   ├── Index.tsx                      # Landing
│   ├── Dashboard.tsx                  # Reexport → dashboard/DashboardPage.tsx
│   ├── dashboard/                     # Lista de diagramas + pastas; subviews e diálogo “novo diagrama”
│   ├── ModelExplorer.tsx              # Reexport → modelExplorer/ModelExplorerPage.tsx
│   ├── modelExplorer/                 # Canvas + flows + export; conteúdo e estado de playback
│   ├── ServiceRegistry.tsx            # Catálogo de serviços, impacto, import GitHub
│   └── NotFound.tsx
│
├── hooks/
│   ├── useTheme.ts                    # Toggle dark/light theme
│   ├── use-toast.ts
│   └── use-mobile.tsx
│
├── App.tsx
└── main.tsx
```

### Responsabilidades dos arquivos

| Camada / Pasta | Arquivo | Responsabilidade |
|----------------|---------|------------------|
| **features/diagram/model** | `diagram.types.ts` | Tipos do domínio: `Component`, `Connection`, `Diagram`, `ModelDraft`, `Flow`, `FlowStep`, `ViewNodeLayout`, `Level`, `ComponentType`. Importa `AwsCategoryId` de `aws-catalog` e `ServiceDefinition` do registry. |
| | `diagram.service.ts` | Lógica de negócio pura: `computeServiceImpact(serviceId, components, connections)` (análise de impacto); `parseMermaidToSteps(mermaid, components, connections)` (Mermaid → steps para Flow). Sem Zustand. |
| | `diagram.utils.ts` | `generateId(prefix)` para IDs únicos (elementos, diagramas, conexões, serviços, flows). |
| **features/diagram/store** | `diagram.store.ts` | Store Zustand com immer + persist (LocalStorage via `defaultStorage`). Seed em `src/fixtures/seed.ts` usado só quando não há dados persistidos. Ações: diagram CRUD, components, connections, layout, viewport, z-order, service registry, flows, undo/redo, folders, patterns. Selectors com `useShallow` onde retornam array/objeto. |
| | `slices/diagram.slice.ts` | Diagram CRUD: `addDiagram`, `openDiagram`, `updateDiagram`, `removeDiagram`, `setActiveDiagramId`, `commitVersion`, `restoreVersion`. |
| | `slices/folders.slice.ts` | Hierarquia de pastas: `addFolder`, `updateFolder`, `removeFolder`, `moveFolder`. |
| | `slices/patterns.slice.ts` | `insertPattern(template, position)` — instancia componentes/conexões do padrão no canvas ativo. |
| **features/diagram** | `index.ts` | API pública: tipos, generateId, computeServiceImpact, parseMermaidToSteps, useDiagramStore, selectors, useDiagramActions. |
| **features/registry/model** | `registry.types.ts` | Tipo `ServiceDefinition` (id, name, description, repositoryUrl, technology[], owner?, tags?). |
| **features/registry/store** | `registry.store.ts` | Reexporta useDiagramStore, useServiceRegistry, useAllServices, useAllComponents, useAllConnections; define `useRegistryActions()` (addService, updateService, removeService, linkComponentToService) com useShallow. |
| **features/registry** | `index.ts` | Reexporta ServiceDefinition e hooks do store. |
| **features/canvas** | `Canvas.tsx` + `useCanvasController` | Container React Flow: nodeTypes, edgeTypes; orquestra store, visual state, eventos, efeitos e teclado. |
| **features/canvas/hooks** | `useCanvasStore.ts` | Acesso centralizado ao store via seletores `useShallow`. |
| | `useCanvasVisualState.ts` | Estado visual local: seleção, context menu, highlights. |
| | `useCanvasEventHandlers.ts` | Handlers de eventos ReactFlow: connect, click, context menu. |
| | `useCanvasEffects.ts` | Side-effects: persistência de viewport e layout. |
| | `useCanvasDrillHandlers.ts` | Drill-down para diagramas vinculados. |
| | `useCanvasKeyboard.ts` + `keyboard/` | Atalhos de teclado decompostos em sub-hooks por grupo. |
| | `useNodeDragParenting.ts` | Drag-to-panel parenting / unparenting. |
| **features/canvas/panels** | `ElementPanel/` | Painel lateral: abas propriedades (nome, tipo, tecnologia, serviço, diagrama vinculado) e conexões; color picker para painéis/notas. |
| | `NodeContextMenu.tsx` | Menu de contexto: trazer para frente / enviar para trás. |
| | `MultiSelectPanel.tsx` | Painel de ações em multi-seleção. |
| **features/canvas/flow** | `FlowPanel.tsx` | Lista de flows do diagrama ativo; play, editar, remover, copiar Mermaid. |
| | `FlowRecorderPanel.tsx` | Modo gravação: steps, preview Mermaid, `stepsToMermaid()`; finalizar/cancelar. |
| | `FlowStepNavigator.tsx` | Barra de playback: anterior/próximo, nome do flow, nota do step atual. |
| | `useFlowState.ts` | Computa highlights de playback, badges de recording e coverage. |
| **features/canvas/nodes** | `CustomNode/` | Nó C4 (person, system, container, component) + nós AWS; handles; badges de serviço e diagrama vinculado; botão “Explorar interior”. |
| | `PanelNode.tsx` | Nó tipo painel: NodeResizer, cor/opacidade, destaque ao arrastar. |
| | `NoteNode.tsx` | Nó tipo nota: NodeResizer, cor, texto. |
| | `AwsIcon.tsx` | Lazy load de ícones `aws-react-icons` por nome. |
| | `node-types/` | Sistema de descritores: `c4Descriptor`, `panelDescriptor`, `noteDescriptor` + registry. |
| **features/canvas/edges** | `CustomEdge.tsx` | Aresta reta (getStraightPath), label, tecnologia, badges de gravação/playback. |
| **features/canvas/toolbar** | `CanvasToolbar.tsx` | Nome do diagrama, nível; botão “Adicionar elemento” (C4, painel, nota, AWS); PatternPicker; QuickInsert. |
| **features/flows** | `index.ts` | Placeholder; tipos de flow estão em diagram.types. |
| **infrastructure/persistence** | `IStoragePort.ts` | Port: save(key, data), load\<T\>(key), delete(key); getItem/setItem/removeItem (raw) para Zustand persist. |
| | `LocalStorageAdapter.ts` | Implementação: localStorage, prefixo `structura_` com fallback para chaves legadas; serialização em save/load; `defaultStorage` singleton. |
| **lib** | `model-types.ts` | Reexporta tipos de diagram e registry + generateId (compatibilidade). |
| | `model-store.ts` | Reexporta store e selectors do diagram (compatibilidade). |
| | `aws-catalog.ts` | Catálogo AWS: categorias, serviços, ícones; AwsCategoryId, isAwsType, mapas. |
| | `github-import.ts` | `importFromGitHub(repoUrl, token?)`: detecta tech stack (package.json, pom.xml, etc.). |
| | `export-service/` | `exportJSON`, `exportDrawio`, `exportMermaid`, `downloadFile` (tipos do diagram; draw.io em submódulos). |
| **pages** | `Dashboard.tsx` + `dashboard/` | Lista diagramas (useAllDiagrams), pastas, busca global; abre diagrama (openDiagram → /model/:id). |
| | `ModelExplorer.tsx` + `modelExplorer/` | Canvas + flows + export; playback, gravação, export draw.io/JSON. |
| | `ServiceRegistry.tsx` | Lista serviços (useAllServices), impacto (computeServiceImpact), import GitHub; useRegistryActions. |
| | `Index.tsx` | Landing; `NotFound.tsx` para 404. |

### Ports & Adapters principle

Infrastructure is always accessed through interfaces. The application code never imports adapters directly — only ports. This allows:

- Self-hosted users: `LocalStorageAdapter` or `FileSystemAdapter`
- Enterprise/cloud: `PostgresAdapter` behind an API
- SaaS: `SupabaseAdapter`

```ts
// infrastructure/persistence/IStoragePort.ts
export interface IStoragePort {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}

// infrastructure/git/IGitPort.ts
export interface IGitPort {
  getRepository(url: string, token: string): Promise<RepoMetadata>;
  getFileTree(repoId: string): Promise<FileNode[]>;
  watchChanges(repoId: string, callback: (change: GitChange) => void): void;
}
```

---

## Data model

### Core types

```ts
ComponentType = "person" | "system" | "container" | "component" | "panel" | "note" | AwsCategoryId | InfraType

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
  panelColor?: string           // panels and notes
  panelOpacity?: number         // 0–100, panels only
}

Connection {
  id, sourceId, targetId, label
  technology?: string
  description?: string
  communicationType?: CommunicationType   // sync | async | tcp | udp | event | protocol
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
  updatedAt: number              // Unix timestamp (não string)
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
  duration?: string             // ex: "~200ms", "async"
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
  folders: Record<string, Folder>; // fora do ModelDraft
  activeDiagramId: string | null;
}
```

---

## State management rules (CRITICAL)

1. **All state lives in feature slices** — no local state for data, only for UI (modals, panels open/closed)
2. **All mutations use immer** — mutate `state` directly inside `set()`
3. **Selectors that return arrays/objects MUST use `useShallow`**
4. **`useDiagramActions()`** must always use `useShallow`
5. **No `Object.values()` without `useShallow`** — always creates new references

---

## What's built

### Diagram system

- Multiple independent diagrams, each with isolated `ModelDraft`
- Dashboard lists diagrams with name, domain, C4 level, last edit
- Navigate via `/model/:id`

### Canvas

- React Flow, node types: `person`, `system`, `container`, `component`, `panel` + all AWS categories
- Straight edges (`getStraightPath`), horizontal handles (left = target, right = source)
- Nodes with `linkedDiagramId` show drill-down button
- Panel nodes — resizable group containers via React Flow parent-child
- Z-order: bring to front / send to back
- Keyboard shortcuts: `Cmd+A`, `Delete`, `Cmd+D`, `Cmd+Z/Shift+Z`, `Escape`

### AWS nodes

- Full AWS service catalog with categories and icons (`aws-react-icons`)
- Icons lazy-loaded via `import("aws-react-icons")` — pre-bundled by Vite

### Service Registry

- Global catalog of `ServiceDefinition`, independent of any diagram
- Nodes linked via `serviceId`
- GitHub import: auto-detect tech stack from `package.json`, `pom.xml`, `go.mod`, `Cargo.toml`
- Impact analysis: "if this service changes, what systems and flows are affected?"

### Element Panel

- Properties tab: name, description, type, technology, AWS service, linked diagram, linked service
- Connections tab: incoming/outgoing connections, searchable

### Flows

- Named sequences highlighting nodes/connections to tell a story
- Recording mode: click nodes/edges in sequence → builds `FlowStep[]`
- Real-time Mermaid preview during recording
- Playback: step-by-step, keyboard `← →`, active node/edge highlighted, others dimmed to 0.25 opacity
- Canvas view-only during playback

---

## Features planned / in progress

### Feature #3 — Create diagram from component

- Button "Criar diagrama vinculado" in `ElementPanel` when `linkedDiagramId` is empty and type is `system` or `container`
- Auto-fill name from component name, suggest level (`system` → `container`, `container` → `component`), inherit `domain`
- Auto-call `linkComponentToDiagram(componentId, newDiagram.id)` after creation
- Show inline confirmation `✓ Diagrama criado e vinculado`, reset after 3s

### Feature #4 — Architecture Patterns

- `PatternTemplate` interface in types
- `src/lib/patterns-catalog.ts` with: FIFO Queue (AWS), FIFO Queue (Kafka), Transactional Outbox, API Gateway + BFF, Circuit Breaker, Sidecar Proxy, CQRS, Saga (Choreography), Cache Aside, Event Sourcing
- `PatternPicker` modal from `CanvasToolbar`, grouped by category, with preview
- Instantiate all components/connections at relative grid positions using `generateId`

### Feature #6 — Panel improvements + Note component

- `panelColor?: string` and `panelOpacity?: number` on `Component`
- Panel redesign: backdrop blur, colored border, color picker (8 swatches + opacity slider) in `ElementPanel`
- Drag highlight: pulsing border on panel target during `onNodeDrag`
- `description` visible in panel header
- New `note` ComponentType: `NoteNode` — colored card, no handles, `min-w-[160px] max-w-[280px]`, resizable, no connections allowed

### Feature #8 — Flow enhancements

- **A** — `description?: string` on `Flow`, shown as subtitle in playback bar
- **B** — Auto-derived participants summary (no store) displayed at top of flow detail
- **D** — `tags?: string[]` on `Flow`, pill input, filter bar above flow list
- **E** — `duration?: string` on `FlowStep`, shown in edge label during playback, in generated Mermaid as `Note right of`
- **F** — "Copiar Mermaid" button → `navigator.clipboard.writeText`, `✓ Copiado!` for 2s
- **G** — Flow coverage indicators: colored dot on covered nodes, soft overlay on covered edges, tooltip listing flow names on hover — hidden during playback

### Feature #9 — Export + Import

- `src/lib/ExportService.ts`: `exportJSON(diagram)`, `exportDrawio(diagram)`, `exportMermaid(flows, components, connections)`
- `src/lib/ImportService.ts`: `importFromJSON(json)`, `importFromDrawio(xml)` — pure functions, no side effects
- Single "Exportar" button → up to 3 simultaneous downloads: `.json`, `.drawio`, `.md` (only if flows exist)
- "Importar" button → `<input type="file" accept=".json,.drawio">` → always creates new diagram, never overwrites

### Feature #10 — GitHub sync

- Auto re-fetch tech stack on Service Registry open or service view
- Drift detection: `⚠ Desatualizado` badge on node and registry listing when stored `technology[]` diverges from latest fetch
- Personal GitHub token for private repos — stored in localStorage, never in store/snapshot
- Visual indicator of last sync time on node

### Feature #11 — Versioning + Diff

- `DiagramVersion` interface (see Data model above)
- `versions: DiagramVersion[]` on `Diagram`
- `commitVersion(diagramId, message)` action
- Version side panel in `ModelExplorer` — chronological list with message, author, relative timestamp
- Diff view: added (green), removed (red), modified (yellow) nodes; connections highlighted
- `restoreVersion(diagramId, versionId)` with confirmation

### Feature #12 — i18n

- `i18next` + `react-i18next` + `i18next-browser-languagedetector` + `date-fns`
- Setup in `src/lib/i18n.ts`, auto-detect browser language, fallback pt-BR
- `src/locales/pt-BR.json` and `src/locales/en.json` — max 2 levels of key depth
- Replace all hardcoded strings with `t()`
- Language selector in header (PT / EN)
- `updatedAt` on `Diagram` changes from `string` to `number` (Unix timestamp) everywhere including seed data
- All `updatedAt` displays use `formatDistanceToNow` from `date-fns` with dynamic locale
- From this feature forward: every new UI string goes directly to both locale files, never hardcoded

### Feature #13 — Communication type on Connection

- `communicationType?: CommunicationType` on `Connection`
- Dropdown in `ElementPanel` → Connections tab when editing a connection
- Visual diff per type: `sync` = solid arrow, `async` = dashed arrow, `event` = arrow + lightning icon, `tcp`/`udp` = arrow + protocol label
- Included in draw.io export as edge XML attribute
- Included in Mermaid as label suffix: `API Gateway->>Order Service: Roteia [async]`

### Feature #14 — Folders in Dashboard

- `Folder` interface (see Data model above)
- `folders: Record<string, Folder>` at store root (outside `ModelDraft`)
- `folderId?: string` on `Diagram`
- Hierarchy: `Domain > Folder > Folder > Diagram` (unlimited depth)
- Tree view sidebar + main area showing active folder content
- Breadcrumb: `E-commerce / Payments / Checkout`
- Create folder inline, rename on double-click, delete with confirmation (blocked if has children)
- Drag & drop diagrams between folders
- Diagrams without `folderId` live at root

### Feature #15 — Infra elements

- `InfraType` (see Data model above)
- Separate "Infra" category in `CanvasToolbar` — cloud-agnostic, not tied to AWS
- Distinct icons via lucide where possible
- Visual: dashed border or neutral color to distinguish infra from application
- `InfraNode` or `C4Node` with extended type config
- draw.io export with corresponding shapes (e.g. `shape=mxgraph.network.load_balancer`)
- `infra-catalog.ts` separate from `aws-catalog.ts`

---

## Roadmap — backend and infrastructure

### Phase 1 — Foundation (current, client-side)

- FSD folder restructure ✅ (in progress)
- Extract business logic from components to `model/diagram.service.ts`
- `IStoragePort` + `LocalStorageAdapter` → data persists across page reloads
- Seed data only used when nothing is persisted

### Phase 2 — Backend (Next.js migration)

- Migrate Vite → Next.js when: auth is needed, API Routes replace separate server, SEO for landing page matters
- NextAuth for OAuth (GitHub + GitLab)
- API Routes as HTTP adapters for the persistence port
- `IGitPort` with `GitHubAdapter` and `GitLabAdapter`

### Phase 3 — Database

- **Drizzle ORM** (not Prisma — works with SQLite and PostgreSQL with same schema, just swap driver)
- **Self-hosted**: SQLite (`better-sqlite3`), single file, zero config, mountable Docker volume
- **Cloud / Enterprise**: PostgreSQL — standard, any cloud supports it
- **SaaS option**: Supabase (PostgreSQL + Auth + Realtime, open source, self-hostable)

### Phase 4 — Collaboration

- Real-time presence: cursors, node locks
- Requires WebSocket or Liveblocks
- Current Zustand in-memory store replaced by CRDT or operational transform layer

---

## Key architectural decisions

| Decision                                | Rationale                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FSD over Clean Architecture             | UI is the product — CA layers add overhead without benefit for canvas-heavy app                                                            |
| Ports & Adapters only in infrastructure | Isolates persistence and git integrations without over-engineering the domain                                                              |
| Drizzle over Prisma                     | Same schema works for SQLite (self-hosted) and PostgreSQL (cloud) — critical for open source                                               |
| Next.js migration deferred              | No SSR/API benefit until auth and backend are needed                                                                                       |
| Zustand over Context                    | Canvas updates frequently (drag, resize) — Context causes full re-renders                                                                  |
| `useShallow` on all array selectors     | `Object.values().filter()` always creates new references → infinite loops without shallow comparison                                       |
| Per-diagram isolated snapshots          | Editing one diagram must never affect another                                                                                              |
| Mermaid as text, not rendered           | No `mermaid` npm package — flows store Mermaid as string, steps as structured data. Steps drive playback, Mermaid is human-readable export |
| Straight edges                          | Cleaner for architecture diagrams — matches draw.io and IcePanel style                                                                     |
| Panel nodes via React Flow parent-child | Native system, no extra libs, directly compatible with draw.io XML `parent` attribute                                                      |
| AWS icons via single import             | `import("aws-react-icons")` pre-bundled by Vite — avoids CJS `require` errors                                                              |
| `onMoveEnd` not `onMove` for viewport   | `onMove` fires every pixel → store updates → re-render loop                                                                                |
| `updatedAt` as Unix timestamp           | Enables i18n-aware relative formatting via `date-fns`                                                                                      |

---

## Non-goals

- Not a UML tool — C4 Model only
- Not a real-time collaboration tool (yet)
- Not a code generator — documents architecture, does not generate it
- Mermaid is never rendered as a visual diagram — only parsed/generated as text
- No vendor lock-in — every cloud integration goes through a Port interface

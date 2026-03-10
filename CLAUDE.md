# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:8080
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

The `@` alias resolves to `./src` (configured in `vite.config.ts`).

## Architecture Overview

**Archflow** is a C4-model architecture diagramming tool. Users create diagrams at three abstraction levels (context → container → component), define flows (sequences of interactions), and export to JSON/draw.io/Mermaid.

### Feature Structure

The codebase follows a feature-based layout under `src/features/`:

- **`features/diagram`** — The core data layer. Exports all types (`Diagram`, `Component`, `Connection`, `Flow`, `FlowStep`, etc.) and the Zustand store (`useDiagramStore`). The store is the single source of truth for all diagram state and is persisted to `localStorage` via `LocalStorageAdapter` with the key `archflow_diagram-store`.

- **`features/canvas`** — The interactive canvas built on `@xyflow/react`. `Canvas.tsx` is the main component that bridges the diagram store to ReactFlow nodes/edges. Keyboard shortcuts (Cmd+Z/Shift+Z undo/redo, Delete remove, Cmd+D duplicate, Cmd+G group) are handled in `hooks/useCanvasKeyboard.ts`. Drag-to-panel parenting logic lives in `hooks/useNodeDragParenting.ts`.

- **`features/registry`** — `ServiceDefinition` type and `registry.store.ts`. Services live inside each diagram's `snapshot.serviceRegistry` and can be linked to components via `serviceId`.

- **`features/flows`** — Re-exports from the flows sub-system.

### Data Model

Each `Diagram` contains a `snapshot` (`ModelDraft`) with:
- `components`: Record of `Component` objects — a **discriminated union** of `C4Component | PanelComponent | NoteComponent | AwsComponent`. Use the guards `isPanelComponent`, `isNoteComponent`, `isC4Component`, `isAwsComponent` from `@/features/diagram` instead of checking `type === "panel"` directly.
- `connections`: Record of `Connection` objects between components. Visual style is nested under `connection.style?: ConnectionStyle` (6 fields: edgeStyle, strokeStyle, strokeWidth, markerEnd, markerStart, animated).
- `flows`: Record of `Flow` objects (each with Mermaid text + parsed `FlowStep[]`)

`serviceRegistry` (`Record<string, ServiceDefinition>`) lives inside each diagram's snapshot. Deleting a service cleans up `serviceId` across all components.

Node positions and dimensions are stored separately in `nodeLayouts: NodeLayout[]` (each entry has `elementId`, `x`, `y`, and optional `width`, `height`, `zIndex`). Viewport state (pan/zoom) is also persisted per diagram.

### Store Pattern

`useDiagramStore` (in `features/diagram/store/diagram.store.ts`) uses Zustand with `immer` middleware for mutations and `persist` middleware for localStorage (key `diagram-store`, prefixed to `archflow_diagram-store`).

**Factory**: `createDiagramStore(storage?)` accepts an optional `IStoragePort` (defaults to `defaultStorage`). Use this in tests with `InMemoryAdapter` from `@/infrastructure/persistence`.

**Slices** (`features/diagram/store/slices/`):
| Slice | Actions |
|-------|---------|
| `components.slice.ts` | `addComponent`, `updateComponent`, `removeComponent`, `setParent`, `groupNodes`, `ungroupNodes` |
| `connections.slice.ts` | `addConnection`, `updateConnection`, `removeConnection` |
| `flows.slice.ts` | `addFlow`, `updateFlow`, `removeFlow` |
| `layout.slice.ts` | `updateNodeLayout`, `updateViewport`, `bringToFront`, `sendToBack` |
| `services.slice.ts` | `addService`, `updateService`, `removeService`, `linkComponentToService`, `linkComponentToDiagram` |
| `clipboard.slice.ts` | `copyToClipboard`, `pasteFromClipboard`, `clearClipboard` |
| `history.slice.ts` | `undo`, `redo` + internal `pushHistory()` |

**Selectors** live only in `diagram.store.ts`, never in slices. Use `useShallow` when selecting derived arrays/objects.

**Schema versioning**: the `persist.merge` function doubles as a migration runner — add future migrations there as `schemaVersion < N` guards.

Undo/redo is implemented via `past`/`future` stacks of `DiagramSnapshot` objects (diagram-scoped only — service changes are not undoable by design). `pushHistory()` is called inside mutations that should be undoable.

### Canvas Hooks

`src/features/canvas/hooks/`:
- **`useCanvasKeyboard`** — Registers a global `keydown` listener for all canvas shortcuts. Skips when focus is in input/textarea. Delegates to store actions.
- **`useNodeDragParenting`** — Tracks which panel a dragged node is hovering over (`dragTargetPanelId`) and whether a parented node is outside its panel bounds (`unparentCandidatePanelId`). Returns `onNodesChange` and `onNodeDragStop` handlers for ReactFlow.
- **`useCanvasNodes`** — Derives the ReactFlow `Node[]` array from visible components via the descriptor system.
- **`useCanvasEdges`** — Derives the ReactFlow `Edge[]` array from visible connections.
- **`useFlowState`** — Computes playback highlights, recording badges, and coverage overlays.

### Node Type Descriptors

`src/features/canvas/node-types/` implements a descriptor registry. Each node type is a `NodeTypeDescriptor` (see `types.ts`). See `node-types/README.md` for how to add a new type. **`c4Descriptor` must always be last** — it is the catch-all fallback.

Layout constants (`PANEL_DEFAULT_W/H`, `MIN/MAX_HANDLES`, `NODE_DRAG_PADDING`, `DEFAULT_NODE_W/H`) are centralised in `src/features/canvas/constants.ts`.

### Pages / Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Index` / `LandingPage` | Landing |
| `/dashboard` | `Dashboard` | List/create/delete diagrams |
| `/model/:id` | `ModelExplorer` | Canvas editor for a diagram |
| `/registry` | `ServiceRegistry` | Manage service definitions |

`ModelExplorer` wraps `Canvas` in a `ReactFlowProvider` and manages flow playback/recording state locally, passing callbacks down to `Canvas`.

### Infrastructure

`src/infrastructure/persistence/` contains:
- `IStoragePort` — interface (getItem/setItem/removeItem + save/load/delete)
- `LocalStorageAdapter` — production implementation
- `InMemoryAdapter` — Map-backed implementation for tests and SSR
- `defaultStorage` — singleton `LocalStorageAdapter` exported from the index

Import only `defaultStorage` or `InMemoryAdapter` from `@/infrastructure/persistence`. Never import `LocalStorageAdapter` directly outside this directory.

### UI Components

`src/components/ui/` is a standard shadcn/ui component library — do not modify these files directly; regenerate via shadcn CLI if updates are needed.

`src/lib/aws-catalog.ts` defines AWS service categories used as `ComponentType` values. `src/lib/github-import.ts` handles importing architecture definitions from GitHub.

### Deprecated Compatibility Files

`src/lib/model-types.ts` and `src/lib/model-store.ts` exist only for backward compatibility. Do not add new imports from them — import from `@/features/diagram` or `@/features/registry` instead.

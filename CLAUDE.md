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

- **`features/canvas`** — The interactive canvas built on `@xyflow/react`. `Canvas.tsx` is the main component that bridges the diagram store to ReactFlow nodes/edges. It handles: node drag-to-panel parenting, flow playback highlighting, flow recording mode, keyboard shortcuts (Cmd+Z/Shift+Z for undo/redo, Delete to remove, Cmd+D to duplicate).

- **`features/registry`** — `ServiceDefinition` type and `registry.store.ts`. Services live inside each diagram's `snapshot.serviceRegistry` and can be linked to components via `serviceId`.

- **`features/flows`** — Re-exports from the flows sub-system.

### Data Model

Each `Diagram` contains a `snapshot` (`ModelDraft`) with:
- `components`: Record of `Component` objects (person, system, container, component, panel, note, or AWS service types)
- `connections`: Record of `Connection` objects between components
- `flows`: Record of `Flow` objects (each with Mermaid text + parsed `FlowStep[]`)

`serviceRegistry` (`Record<string, ServiceDefinition>`) lives at the **top level of the store**, not inside any diagram. Components reference services via `serviceId`. Deleting a service cleans up `serviceId` across all diagrams automatically.

Node positions are stored separately in `nodeLayouts: ViewNodeLayout[]` so layout can change without mutating business data. Viewport state (pan/zoom) is also persisted per diagram.

### Store Pattern

`useDiagramStore` (in `features/diagram/store/diagram.store.ts`) uses Zustand with `immer` middleware for mutations and `persist` middleware for localStorage (key `archflow_diagram-store`). It has granular selector hooks (`useActiveDiagram`, `useVisibleComponents`, `useServiceRegistry`, `useFlows`, etc.) and a single `useDiagramActions` hook that returns all mutation functions. Always use `useShallow` when selecting derived arrays/objects to avoid unnecessary re-renders.

**Schema versioning**: the store tracks `schemaVersion: number` (currently `1`). The `persist.merge` function doubles as a migration runner — add future migrations there as `schemaVersion < N` guards. Migration v0→v1 extracted `serviceRegistry` from each diagram's snapshot into top-level state.

Undo/redo is implemented manually via `past`/`future` stacks of `DiagramSnapshot` objects (diagram-scoped only — service changes are not undoable by design). `pushHistory()` is called inside mutations that should be undoable.

### Pages / Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Index` / `LandingPage` | Landing |
| `/dashboard` | `Dashboard` | List/create/delete diagrams |
| `/model/:id` | `ModelExplorer` | Canvas editor for a diagram |
| `/registry` | `ServiceRegistry` | Manage service definitions |

`ModelExplorer` wraps `Canvas` in a `ReactFlowProvider` and manages flow playback/recording state locally, passing callbacks down to `Canvas`.

### Infrastructure

`src/infrastructure/persistence/` contains `IStoragePort` interface and `LocalStorageAdapter` implementing it. The `defaultStorage` singleton is passed to Zustand's `createJSONStorage()`.

### UI Components

`src/components/ui/` is a standard shadcn/ui component library — do not modify these files directly; regenerate via shadcn CLI if updates are needed.

`src/lib/aws-catalog.ts` defines AWS service categories used as `ComponentType` values. `src/lib/github-import.ts` handles importing architecture definitions from GitHub.

# Structura — Project Context for LLMs

## What it is
Structura is an open source C4 architecture diagramming SPA.
No backend, no database, no external services. All state is client-side.

## Tech Stack
- React 18 + TypeScript (strict)
- Vite as bundler (dev port 8080)
- Zustand + Immer for global state
- React Flow (@xyflow/react) for canvas rendering
- Tailwind + shadcn/ui for UI
- react-i18next — pt-BR default, en secondary
- NO backend — persistence via localStorage + pluggable adapter (IStoragePort)

## Key folder structure
src/
├── features/
│   ├── diagram/       # Pure domain — types, Zustand store, slices, selectors
│   │                  # NO React, NO UI here
│   ├── canvas/        # UI layer — React Flow, nodes, edges, toolbar, panels, hooks
│   └── registry/      # ServiceDefinition + registry store
├── infrastructure/
│   └── persistence/   # IStoragePort, LocalStorageAdapter, InMemoryAdapter
├── pages/             # Dashboard, ModelExplorer, ServiceRegistry, Index
├── components/        # Shared UI (shadcn/ui + Navbar)
└── lib/               # aws-catalog, export-service, github-import, utils

---

## Absolute Code Rules

### Type guards — NEVER use raw strings
# WRONG
if (component.type === "panel") { ... }
# RIGHT
import { isPanelComponent, isPanelType } from "@/features/diagram"
if (isPanelComponent(component)) { ... }

### Imports — deprecated modules are forbidden
# NEVER import from:
src/lib/model-types.ts   → use @/features/diagram
src/lib/model-store.ts   → use @/features/diagram

### User-visible strings — NEVER hardcode
# WRONG
<button>Save</button>
# RIGHT
const { t } = useTranslation()
<button>{t("common.save")}</button>

### Path alias
@ → resolves to ./src

---

## Store Architecture (Zustand + Immer)

### Slices
diagramsSlice, componentsSlice, connectionsSlice, flowsSlice,
layoutSlice, servicesSlice, clipboardSlice, historySlice,
foldersSlice, patternsSlice, scenesSlice, iconsSlice, userTemplatesSlice

### Undo/Redo — critical rule
# pushHistory() MUST be called at the START of any undoable mutation,
# inside the set() Immer callback, BEFORE any data modification.
set((state) => {
  pushHistory(state)   // ← first
  state.diagrams[id].snapshot.components[compId] = ...  // ← then
})

### What is/is not persisted
Persisted to localStorage:
  diagrams, folders, userTemplates, serviceRegistry,
  activeDiagramId, past, future, _lastUndoRedoAt

NOT persisted (intentional):
  clipboard  ← cleared on every reload

### Current schema version: 4
Idempotent migrations covering:
  v1 → iconLibrary
  v2 → icon source structure
  v3 → edgeLayouts, diagram description
  v4 → userTemplates

---

## Canvas Render Pipeline

### Derivation flow
Zustand store
  → useVisibleComponents / useVisibleConnections
    (filters: only components that have a nodeLayout)
  → useCanvasNodes
    (resolves NodeTypeDescriptor → buildData → buildStyle → computeNodeVisibility)
  → useLocalNodes
    (local position buffer for lag-free drag without store roundtrip)
  → React Flow renders nodes/edges

### Node position — critical drag pattern
useLocalNodes does smart merging:
  - During drag: preserves local position (no lag)
  - After undo/redo: discards local, accepts everything from store
  - After reparenting: accepts remote position
  - Collaboration (Yjs): accepts if id is in remoteLayoutUpdates

# NEVER call setParent + updateNodeLayout separately during drag
# This causes double-history and a race condition
# RIGHT: use commitNodeDrag() — atomic: pushHistory + parentId + position in one transaction

---

## NodeTypeDescriptor System

Each node type is a descriptor registered in:
  src/features/canvas/nodes/node-types/registry.ts

Interface:
  rfType: string           # key in the React Flow nodeTypes map
  matches(type): boolean
  buildData(comp, ctx): Record<string, unknown>
  buildStyle(comp, ctx): CSSProperties | undefined
  zIndex, connectable, canHaveParent, canBeParent

### Registry order — critical rule
c4Descriptor MUST always be LAST (it is the catch-all, matches() returns true for everything)
New descriptors are inserted BEFORE c4Descriptor.

Current descriptors (in order):
  panelDescriptor → swimlaneDescriptor → noteDescriptor
  → apiGroupDescriptor → endpointDescriptor → c4Descriptor

---

## Scene System (Diagram Versioning)

SceneDiff: declarative diff over the immutable base snapshot
  addedComponents: Record<string, Component>
  addedConnections: Record<string, Connection>
  removedComponentIds: string[]
  removedConnectionIds: string[]
  nodeLayouts: Record<string, NodeLayout>

Key functions:
  resolveSceneSnapshot(diagram, sceneId)   → merged snapshot for one scene
  resolveCanvasSnapshot(diagram)           → handles compare mode (2 scenes overlay)
  canMoveNodeInSceneMode(diagram, compId)  → blocks moving base nodes when scene is active

---

## Flow Playback / Recording

States: idle | playing | recording (via FlowModeProvider)

Recording mode:
  - Blocks drag, undo/redo, copy/paste
  - Only active shortcut: Delete/Backspace → onRecordUndo (removes last step)
  - Nodes/edges outside the flow get reduced opacity overlay

Playing mode:
  - Blocks everything on canvas
  - Opacity overlay: active=1, participant=0.5, rest=dim

---

## Collaboration (WebRTC + Yjs — optional)

Bidirectional bridge Zustand ↔ Yjs:
  - Anti-loop guard: isApplyingRemoteRef (synchronous useRef, NOT useState)
  - remoteLayoutUpdates: global Set<string> — signals to useLocalNodes
    which node ids should accept positions coming from Yjs

---

## i18n Conventions

Key format: "feature.subFeature.description"
Files: src/infrastructure/i18n/locales/{pt-BR,en}.json
Rule: NEVER hardcode user-visible strings

---

## Commands
npm run dev      # port 8080
npm run lint     # 3 pre-existing errors in shadcn/ui and tailwind.config.ts — DO NOT fix
npm run test
npx vitest run src/test/example.test.ts   # single file
npm run build

---

## Project skill files (read before coding)

See **AGENTS.md** at the repo root for the canonical list. Highlights:

- `.ai/skills/feature-slice-standard.md` — canonical folder structure for every feature
- `.ai/skills/new-feature.md` — creating a new feature (FSD)
- `.ai/skills/new-node-type.md` — adding a new node type to the canvas
- `.ai/skills/store-patterns.md` — Zustand slices, selectors, history
- `.ai/skills/code-standards.md` — naming, TypeScript, anti-patterns
- `.ai/skills/i18n.md` — adding strings and translations
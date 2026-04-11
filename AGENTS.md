# Structura — Agent / contributor guide

## What it is

Structura is an open source C4 architecture diagramming SPA. No backend or database; all state is client-side with optional localStorage / file-system persistence.

## Tech stack

- React 18 + TypeScript (strict)
- Vite (dev port 8080)
- Zustand + Immer
- React Flow (`@xyflow/react`)
- Tailwind + shadcn/ui
- react-i18next — pt-BR default, en secondary

## Key folder structure

```
src/
├── features/
│   ├── diagram/       # Pure domain — types, Zustand store, slices, selectors
│   │                  # NO React, NO UI here
│   ├── canvas/        # UI layer — React Flow, nodes, edges, toolbar, panels, hooks
│   ├── collaboration/ # Real-time collab (WebRTC + Yjs)
│   ├── journeys/      # Cross-diagram journey sequences
│   ├── custom-components/ # User-defined component templates
│   ├── viewer/        # Read-only shared diagram viewer
│   ├── icons/         # Icon library store
│   └── llm/           # LLM Assistant domain (NO React)
├── components/
│   ├── ui/            # shadcn/ui
│   └── chat/          # LLM chat UI (stateless components)
├── infrastructure/
│   └── persistence/   # IStoragePort, LocalStorageAdapter, InMemoryAdapter
├── pages/             # Dashboard, ModelExplorer, ServiceRegistry, Index
└── lib/               # aws-catalog, export-service, github-import, utils
```

## Feature structure standard

Every feature follows the canonical structure defined in:

`.ai/skills/feature-slice-standard.md`

Key rules:

- index.ts exports ONLY the public API
- utils/ = pure functions, zero React, zero Zustand
- store/ only if the feature has persisted state
- __tests__/ colocated inside each feature
- File naming: kebab-case, no redundant prefixes

## Absolute code rules

### Type guards — never raw string checks on component types

Use `isPanelComponent`, `isPanelType`, etc. from `@/features/diagram`.

### Forbidden imports

Do not import:

- `src/lib/model-types.ts` — use `@/features/diagram`
- `src/lib/model-store.ts` — use `@/features/diagram`

### User-visible strings

Use `t("feature.key")` from react-i18next; never hardcode UI copy.

### Path alias

`@` → `./src`

## Store architecture (Zustand + Immer)

Slices include: diagrams, components, connections, flows, layout, services, clipboard, history, folders, patterns, scenes, icons, userTemplates (see `src/features/diagram/store/README.md`).

### Undo/redo — critical rule

`pushHistory` MUST be the first call inside the `set()` Immer callback, before any data mutation.

### Mutation types for pushHistory

Structural mutations (always create a new checkpoint, never coalesce within `HISTORY_COALESCE_MS`):

- addComponent, removeComponent, setParent, groupNodes, ungroupNodes
- addConnection, removeConnection
- insertPattern, pasteFromClipboard
- commitNodeDrag (atomic parent + position)
- mergeSceneIntoBase
- LLM `ensureHistoryBoundary` (structural batch)

Soft mutations (may coalesce within `HISTORY_COALESCE_MS`):

- updateComponent (text / color / non-dimension fields)
- updateConnection (label / style)

Call pattern:

```ts
pushHistory(state, "structural"); // structural mutations
pushHistory(state);               // default = "soft"
```

### Persisted vs ephemeral

Persisted: diagrams, folders, userTemplates, serviceRegistry, activeDiagramId, past, future, `_lastUndoRedoAt`.

Not persisted: clipboard (cleared on reload).

Current persist schema version: **4** (see `persist.config.ts`).

## Canvas pipeline (short)

Store → visible components/connections → `useCanvasNodes` / `useCanvasEdges` → React Flow. Prefer `getCachedCanvasSnapshot` over raw `resolveCanvasSnapshot` in hot paths.

### Journey playback highlight

When a Journey is playing (`JourneyPlayerMode.kind === "playing"`):

- `useJourneyCanvasHighlight()` derives a `FlowHighlight` from the current step.
- If the step has a `flowId`, it delegates to `buildFlowHighlight()` (aligned with Flow playback when the same flow is active).
- The canvas viewport auto-pans to the active node via `useJourneyViewportSync()` when a highlighted node exists on the diagram.
- Journey-derived highlight takes priority over Flow playback highlight while the journey player is active.

## NodeTypeDescriptor

Registry: `src/features/canvas/nodes/node-types/registry.ts`. The C4 catch-all descriptor must stay last.

## Project skill files (read before coding)

```
.ai/skills/feature-slice-standard.md  # canonical folder structure for every feature
.ai/skills/new-feature.md             # creating a new feature (FSD)
.ai/skills/new-node-type.md           # adding a new node type to the canvas
.ai/skills/store-patterns.md          # Zustand slices, selectors, history
.ai/skills/code-standards.md          # naming, TypeScript, anti-patterns
.ai/skills/i18n.md                    # adding strings and translations
```

## Commands

```bash
npm run dev      # port 8080
npm run lint     # pre-existing errors in shadcn/ui + tailwind.config.ts — do not “fix” opportunistically
npm run test
npm run build
```

## Documentation

- Full codebase analysis and phased roadmap context: `docs/architecture/analysis.md`
- Store composition: `src/features/diagram/store/README.md`

## Cursor Cloud specific instructions

- **Single service**: Only the Vite dev server needs to run (`npm run dev`, port 8080). No backend, database, or Docker required.
- **Lint baseline**: `npm run lint` exits with code 1 due to pre-existing errors in `src/components/ui/` (shadcn/ui) and `tailwind.config.ts`. These are expected — do not attempt to fix them.
- **Default language**: The UI renders in pt-BR by default. Button labels, toasts, and sidebar items are in Portuguese.
- **Optional server**: `server/` provides a collaboration WebSocket server and API proxy. It is not needed for normal development and can be ignored unless working on collaboration features (`npm run proxy` to start it).
- **No secrets required**: The app is fully client-side with localStorage persistence. No API keys or environment variables are needed for standard development.

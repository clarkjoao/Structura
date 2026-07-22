# Overall Architecture

How Structura is put together today. The target state and rationale live in
[vision.md](vision.md); this document describes what a contributor will find
in the code.

## System shape

Structura is a client-only SPA. There is no backend and no database: all state
is client-side (localStorage, or a local folder via the File System Access
API). A small optional Node server (`server/`) provides only a collaboration
relay and an LLM proxy — it never stores data.

```
┌─────────────────────────────────────────────────────────────┐
│ Pages (route-level, lazy-loaded)                            │
│   dashboard · canvas (Index) · Workspace ·              │
│   ServiceCatalog · walkthroughs · viewer                       │
├──────────────┬──────────────────────────────────────────────┤
│ Feature contexts                                            │
│   canvas   collaboration   llm   journeys   viewer          │
│   cloud    custom-components    icons                       │
├──────────────┴──────────────────────────────────────────────┤
│ Model  (features/diagram — types, guards, store; no React)  │
├─────────────────────────────────────────────────────────────┤
│ Infrastructure                                              │
│   persistence (IStoragePort + adapters, sync, migrations)   │
│   i18n (react-i18next, en / pt-BR)                          │
└─────────────────────────────────────────────────────────────┘
        lib/: export-service (interchange), catalogs,
              diagram-preview, monaco, utilities
```

## Layering rules

1. `features/diagram` (the Model) contains no React and imports nothing from
   other features. It is unit-testable in isolation.
2. Only `features/canvas` imports `@xyflow/react`. React Flow types do not
   appear in the Model or in any other feature.
3. Persistence goes through `IStoragePort`
   (`infrastructure/persistence/`); nothing else touches `localStorage`.
4. Features communicate through the store's actions/selectors and through
   registries — never by importing each other's internals.
5. Cross-cutting UI (shadcn/ui) lives in `components/ui/` and is regenerated
   by CLI, not hand-edited.

## Data flow in one paragraph

User interaction on the canvas → canvas hooks translate React Flow events
into **store actions** (`features/diagram/store/slices/*`) → Immer produces
the next immutable state, structural mutations push a history snapshot →
subscribed selectors recompute → `useCanvasNodes` rebuilds React Flow nodes
via the **node-type descriptor registry** → React Flow re-renders. A
persistence subscription serializes the store through the active
`IStoragePort` adapter (with schema version + migrations). Collaboration,
when active, replicates store changes through Yjs via the relay server.

Details per stage: [rendering-pipeline](../concepts/rendering-pipeline.md),
[state-management](../concepts/state-management.md),
[persistence](../concepts/persistence.md),
[collaboration](../concepts/collaboration.md).

## Bundle architecture

All pages are lazy-loaded from `App.tsx`. The `@/features/diagram` and
`@/features/canvas` barrels couple the bundle graph: route chunks stay small
only if always-mounted code (app shell, journey player) imports leaf modules
directly instead of the barrels. Keep this in mind when adding imports to
anything that mounts at startup.

## Quality gates

- TypeScript strict mode, project references (`tsc -b`) — keep it green.
- ESLint + Prettier (printWidth 100), enforced in CI.
- Vitest for unit tests (model utilities, slices, export builders).
- Cypress `stress-*` e2e specs for canvas performance regressions.

## Known load-bearing fragilities

- `useLocalNodes` keeps a local copy of nodes during drags and merges store
  updates back; deliberate (drag performance) and fragile — has tests, don't
  refactor casually.
- Undo/redo stores full `ModelDraft` snapshots with coalescing, bounded by
  `MAX_HISTORY_STEPS`.
- The node-type registry's catch-all (`c4Descriptor`) must stay last;
  `registerDescriptor()` preserves this invariant.

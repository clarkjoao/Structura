# diagram/store — Store composition

The Zustand store is assembled in `diagram.store.ts` by spreading 7 slice functions.
Selectors and the `useDiagramActions` hook live **only** in `diagram.store.ts`.

## Slice composition

```
createDiagramStore()
│
├── diagramsSlice(set, get)    addDiagram · openDiagram · updateDiagram · removeDiagram
│                              setActiveDiagramId · commitVersion · restoreVersion
│
├── componentsSlice(set)       addComponent · updateComponent · removeComponent
│                              setParent · groupNodes · ungroupNodes
│
├── connectionsSlice(set)      addConnection · updateConnection · removeConnection
│
├── flowsSlice(set, get)       addFlow · updateFlow · removeFlow
│
├── layoutSlice(set)           updateNodeLayout · updateViewport
│                              bringToFront · sendToBack
│
├── servicesSlice(set)         addService · updateService · removeService
│                              linkComponentToService · linkComponentToDiagram
│
├── clipboardSlice(set)        copyToClipboard · pasteFromClipboard · clearClipboard
│
├── historySlice(set)          undo · redo
│                              (internal: pushHistory, deepClone)
│
├── foldersSlice(set, get)     addFolder · updateFolder · removeFolder · moveFolder
│
└── patternsSlice(set, get)    insertPattern
```

## Slice → Actions

| Slice file | Actions |
|-----------|---------|
| `diagram.slice.ts` | `addDiagram`, `openDiagram`, `updateDiagram`, `removeDiagram`, `setActiveDiagramId`, `commitVersion`, `restoreVersion` |
| `components.slice.ts` | `addComponent`, `updateComponent`, `removeComponent`, `setParent`, `groupNodes`, `ungroupNodes` |
| `connections.slice.ts` | `addConnection`, `updateConnection`, `removeConnection` |
| `flows.slice.ts` | `addFlow`, `updateFlow`, `removeFlow` |
| `layout.slice.ts` | `updateNodeLayout`, `updateViewport`, `bringToFront`, `sendToBack` |
| `services.slice.ts` | `addService`, `updateService`, `removeService`, `linkComponentToService`, `linkComponentToDiagram` |
| `clipboard.slice.ts` | `copyToClipboard`, `pasteFromClipboard`, `clearClipboard` |
| `history.slice.ts` | `undo`, `redo` |
| `folders.slice.ts` | `addFolder`, `updateFolder`, `removeFolder`, `moveFolder` |
| `patterns.slice.ts` | `insertPattern` |

## Selectors

All selector hooks (`useActiveDiagram`, `useVisibleComponents`, `useServiceRegistry`, etc.)
live in `diagram.store.ts` **only**. Never put selectors inside slice files.

Use `useShallow` whenever the selector returns a derived array or object (not a primitive).

## pushHistory — when to call

Call `pushHistory(state)` at the **start** of any mutation that should be undoable.

**Should call:** `addComponent`, `removeComponent`, `updateComponent` (non-dimension-only),
`addConnection`, `removeConnection`, `updateConnection`, `groupNodes`, `ungroupNodes`,
`setParent`, `addFlow`, `updateFlow`, `removeFlow`, `insertPattern`, `pasteFromClipboard`.

**Should NOT call:** `updateNodeLayout`, `updateViewport`, `bringToFront`, `sendToBack`,
`addService`, `updateService`, `removeService`, `linkComponentToService`, `linkComponentToDiagram`,
`copyToClipboard`, `clearClipboard`.

Service actions are intentionally **not** undoable (they affect all diagrams globally).

## Factory

```ts
import { createDiagramStore } from '@/features/diagram';
import { InMemoryAdapter } from '@/infrastructure/persistence';

const store = createDiagramStore(new InMemoryAdapter());
```

Use `createDiagramStore` in tests to get a fresh, isolated store backed by an in-memory adapter.

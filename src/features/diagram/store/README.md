# diagram/store — Store composition

The Zustand store is assembled in `diagram.store.ts` by composing specialized
slice functions.

Action hooks such as `useDiagramActions`, `useIconActions`, and
`useRegistryActions` live in `diagram.store.ts`.
Selector hooks now live in `store/selectors/`.

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
├── patternsSlice(set, get)    insertPattern
├── scenesSlice(set, get)      addScene · duplicateScene · removeScene
│                              setActiveScene · setCompareScene · mergeSceneIntoBase
├── iconsSlice(set, get)       removeIconReferences
└── userTemplatesSlice(set)    saveUserTemplate · updateUserTemplate · deleteUserTemplate
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
| `scenes.slice.ts` | `addScene`, `duplicateScene`, `removeScene`, `mergeSceneIntoBase`, `setActiveScene`, `setCompareScene`, `renameScene`, `addComponentToScene`, `removeComponentFromScene`, `addConnectionToScene`, `removeConnectionFromScene`, `updateSceneNodeLayout` |
| `icons.slice.ts` | `removeIconReferences` |
| `userTemplates.slice.ts` | `saveUserTemplate`, `updateUserTemplate`, `deleteUserTemplate` |

## Selectors

Selector hooks are grouped under `store/selectors/` and re-exported through the
feature entry point. Keep selectors out of slice files so mutation logic stays
separate from state access logic.

Important distinction:

- Many selectors (`useComponent*`, `useConnection*`, `useVisible*`,
  `useResolved*`) read from `getCachedCanvasSnapshot`, so they return the
  scene-resolved canvas view.
- Layout selectors (`useNodeLayout`, `useNodeLayouts`, `useEdgeWaypoints`,
  `useEdgeLabelOffset`) read persisted layout state from the active diagram.

Use `useShallow` whenever the selector returns a derived array or object (not a primitive).

## pushHistory — when to call

Call `pushHistory` at the **start** of any mutation that should be undoable.

- **Structural** (`pushHistory(state, "structural")`): never coalesced — one checkpoint per structural action. Used for `addComponent`, `removeComponent`, `setParent`, `groupNodes`, `ungroupNodes`, `addConnection`, `removeConnection`, `insertPattern`, `pasteFromClipboard`, `commitNodeDrag`, `mergeSceneIntoBase`, and the LLM history boundary.
- **Soft** (`pushHistory(state)` or `pushHistory(state, "soft")`): may coalesce within `HISTORY_COALESCE_MS` for rapid typing-style edits — e.g. `updateComponent` (non-dimension-only), `updateConnection`.

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

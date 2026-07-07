# Diagram Feature

`src/features/diagram` is the source-of-truth domain layer for Structura. It
defines the data model, owns the Zustand store, resolves scene-aware snapshots,
and exposes the selectors and actions consumed by the canvas and other feature
layers.

## Mental model

There are two important views of diagram state:

| View                  | Meaning                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw persisted state   | The data stored in the diagram itself: snapshot, node layouts, edge layouts, scenes, folders, flows, and registry links.                                                                |
| Resolved canvas state | The scene-aware view produced by helpers such as `getCachedCanvasSnapshot`, where active-scene additions and removals have already been applied for rendering and selector consumption. |

If you are documenting or using selector hooks, this distinction matters:

- `useComponent*`, `useConnection*`, `useVisible*`, and resolved-layout selectors
  generally read from the cached resolved canvas snapshot.
- Layout selectors such as `useNodeLayout`, `useNodeLayouts`,
  `useEdgeControlPoints`, and `useEdgeLabelOffset` read persisted layout data
  from the active diagram.

## Main entry points

| Surface                   | Goal                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                | Public API for models, guards, utilities, store hooks, selectors, and snapshot helpers.                                                                     |
| `store/diagram.store.ts`  | Composes the Zustand store and exposes `useDiagramStore`, `useDiagramActions`, `useIconActions`, and `useRegistryActions`.                                  |
| `store/selectors/`        | Read-only hooks for diagrams, components, connections, layouts, icons, folders, flows, services, and user templates.                                        |
| `utils/snapshot-cache.ts` | Builds and caches the resolved canvas snapshot used by scene-aware selectors.                                                                               |
| `store/slices/`           | Mutation logic grouped by concern: diagrams, components, parenting, connections, flows, layout, scenes, folders, clipboard, patterns, icons, and templates. |

## State access surfaces

### Action hooks

| Hook                 | Goal                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDiagramActions`  | Main mutation API for the feature. It groups diagram, component, connection, layout, scene, flow, folder, clipboard, and template actions behind one hook. |
| `useIconActions`     | Small action surface for the shared icon library that sits alongside the diagram store.                                                                    |
| `useRegistryActions` | Focused action surface for global service registry mutations and component-to-service linking.                                                             |

### Diagram selectors

| Hook                 | Goal                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `useActiveDiagramId` | Returns the ID of the diagram the app is currently operating on.          |
| `useActiveDiagram`   | Returns the current active diagram object or `null` if nothing is open.   |
| `useDiagramIds`      | Returns the list of all diagram IDs in the store.                         |
| `useDiagram`         | Reads a specific diagram by ID.                                           |
| `useDiagrams`        | Returns the diagram dictionary keyed by diagram ID.                       |
| `useAllDiagrams`     | Returns all diagrams as an array, typically for navigation or lookup UIs. |

### Component and connection selectors

| Hook                         | Goal                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `useComponentIds`            | Returns component IDs from the resolved active-diagram snapshot.                                                 |
| `useComponent`               | Reads one resolved component from the active diagram.                                                            |
| `useComponents`              | Returns the resolved component map for the active diagram.                                                       |
| `useAllComponents`           | Returns all resolved components for the active diagram as an array.                                              |
| `useConnectionIds`           | Returns connection IDs from the resolved active-diagram snapshot.                                                |
| `useConnection`              | Reads one resolved connection from the active diagram.                                                           |
| `useConnections`             | Returns the resolved connection map for the active diagram.                                                      |
| `useVisibleComponents`       | Returns only components that are visible in the current scene-aware canvas snapshot.                             |
| `useVisibleConnections`      | Returns only connections whose endpoints are visible in the current scene-aware canvas snapshot.                 |
| `useResolvedComponents`      | Returns the resolved component map used by canvas derivation hooks.                                              |
| `useResolvedNodeLayouts`     | Returns the resolved node-layout map aligned with the current scene-aware snapshot.                              |
| `useActiveDiagramSceneState` | Returns the active diagram ID together with active-scene metadata so consumers can quickly branch on scene mode. |

### Layout selectors

| Hook                   | Goal                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `useNodeLayouts`       | Returns persisted node layouts for the active diagram.            |
| `useNodeLayout`        | Returns one persisted node layout by component ID.                |
| `useEdgeControlPoints` | Returns the stored control points for an editable edge's path.    |
| `useEdgeLabelOffset`   | Returns the stored label offset for an edge label along its path. |

### Flows, folders, icons, registry, and templates

| Hook                                                                  | Goal                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `useFlowIds`                                                          | Returns flow IDs for the active diagram.                                          |
| `useFlow`                                                             | Returns a single flow from the active diagram snapshot.                           |
| `useFlows`                                                            | Returns all flows for the active diagram.                                         |
| `useFolderIds`, `useFolder`, `useFolders`, `useAllFolders`            | Read folder structure and folder lists from the store.                            |
| `useIconLibrary`, `useIconById`, `useComponentIcon`                   | Read from the shared icon library and resolve a component's selected custom icon. |
| `useServiceIds`, `useService`, `useAllServices`, `useServiceRegistry` | Read the global service registry that diagrams can link components to.            |
| `useAllUserTemplates`                                                 | Returns saved user templates sorted by creation time.                             |

## Preference helpers

`hooks/useLastEdgeStyle.ts` is not a React hook despite the filename. It stores
and restores the user's most recently chosen `EdgeStyle` in local storage under
`structura:lastEdgeStyle`, validates the stored value, and falls back to
`Smoothstep` when storage is missing or unavailable.

## Important implementation notes

- Scene-aware selectors rely on `getCachedCanvasSnapshot`, so they usually
  expose the resolved canvas view instead of raw `snapshot` data.
- `component-parenting.slice.ts` owns reparenting, grouping, and ungrouping
  semantics, which is why canvas drag hooks delegate structural changes back to
  this feature.
- `connections.slice.ts` and `scenes.slice.ts` decide whether writes land in the
  base snapshot or in scene-local additions and removals.
- Removing or changing some structural graph data can trigger flow repair logic,
  so diagram mutations should go through the provided actions instead of editing
  snapshot data directly.

## Related docs

- [`store/README.md`](./store/README.md) explains store composition and undo
  boundaries.

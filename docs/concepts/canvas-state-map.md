# Canvas state map

Where every piece of state the editing canvas reads lives, who owns it, who
reads and writes it, and where the same fact is held twice. Measured on
`019a1641`. It is a map and a short plan, not a redesign: the hot-path rules in
[canvas-hot-path.md](./canvas-hot-path.md) decide what may move, and
[state-management.md](./state-management.md) the rules for new state.

## How the canvas is put together

```
Canvas.tsx                         (the write host: chrome, overlays, panels)
└─ useCanvasController             (composition root of the canvas state)
   ├─ useCanvasStore               diagram store facade: diagram, diagrams, visible
   │                               components/connections, services, flows, actions
   ├─ useCanvasVisualState         selection + highlight + menus + tag filter + inline editors
   ├─ useCanvasCompareState        compare mode
   ├─ useCanvasFlowState           flow mode (context) + flow highlight/coverage/badges
   ├─ useAutoLayout                Arrange
   ├─ useCanvasInteraction         navigation, drill, drag parenting, RF handlers, keyboard, effects
   ├─ useCanvasGraphState          the React Flow nodes/edges projection
   └─ useInteractionMode           what the current mode allows
└─ DiagramSurface                  (shared with the viewer: providers + <ReactFlow>)
```

## Hook calls per file

Counted as `use[A-Z]…(` call sites outside imports and comments
(`useState<…>(` counts once). Custom hooks count as one call each, whatever they
call inside.

| File | Lines | Hook calls |
| --- | --- | --- |
| `features/canvas/Canvas.tsx` | 791 | 52 |
| `features/canvas/hooks/useCanvasController.ts` | 221 | 30 |
| `features/canvas/hooks/useCanvasInteraction.ts` | 370 | 23 |

## Zustand stores

Thirteen `create()` stores in `src/`, eleven of them on the canvas path. A
"store" below is a module-level Zustand store; per-instance stores built by hand
are listed separately.

| Store | Owner (file) | Read on the canvas path by | Written by | Persisted |
| --- | --- | --- | --- | --- |
| `useDiagramStore` | `diagram/store/diagram.store.ts` | everything, through selectors (`useCanvasStore`, `useResolved*`, `useActiveDiagramVersionState`, `useDiagramTags`, `Canvas` for the initial viewport) | slices only (`useDiagramActions`) | yes, `IStoragePort` via `persist.config.ts` |
| `useIconStore` | `diagram/store/icon-store.ts` | icon selectors (node renderers through `data`) | icon actions | yes (`structura:icon-library`) |
| `useSaveStatusStore` | `diagram/store/saveStatus.store.ts` | `SaveStatusIndicator`, `StorageWarningBanner` | `persist.config.ts`, `storage-monitor.ts` | no |
| `useLLMStore` | `llm/store.ts` | `Canvas` (message count for the unread dot), `useLLMChat`, `useCanvasNodes`, `useCanvasEdges` (pending previews) | the chat | the active thread, by hand |
| `useCollabStore` | `collaboration/store/collab.store.ts` (`createCollabStore`, one instance) | presence hooks (`useCollabHighlight`, `usePeerOnNode`, `useIsCollabGuest`), `CollabRoom` | `CollabSession` / `StoreBridge` | no |
| `useCatalogUiStore` | `canvas/catalog/catalogUi.store.ts` | `CanvasBottomToolbar`, `QuickInsertPopover`, `useCatalogDrop` | `useCanvasInteraction` (keyboard opens it), toolbar | no |
| `useSharedRevealStore` | `canvas/shared/useSharedRevealStore.ts` | `useCanvasGraphState`, `useReadDiagramFlow` | `SharedLayer` | no |
| `useElementPresetStore` | `element-presets/store/element-presets.store.ts` | `useCatalogDrop`, `useCanvasCatalogIndex`, `Canvas` (save preset) | `Canvas`, presets UI, file-system boot | yes |
| `useCanvasPreferencesStore` | `canvas/preferences/canvas-preferences.store.ts` | `Canvas` (`showMiniMap`), event handlers and effects (scroll mode), catalog, panels, view options | view options, catalog | yes (browser preference) |
| `useCanvasSelectionStore` | `canvas/hooks/useCanvasSelectionStore.ts` | `useCanvasSelection` (→ `useCanvasVisualState`), `pointerFunnel`, `useCanvasEventHandlers`, panels, flow panels, `llm/ir/apply-ir.ts` | the same | no |
| `useTextToolStore` | `canvas/text/textLayer.store.ts` | `useTextLayer` (Canvas), `useCanvasStore`, `useCanvasGraphState`, `useCatalogInsert` | `useTextLayer`, `useCatalogInsert` | no |
| `useFlowViewStore` | `canvas/flow/useFlowViewStore.ts` | `useFlowState`, `FlowPanel`, `FlowScriptPanel`, `useFlowRecording` | the flow panels | no |
| `useWalkthroughStore` | `walkthrough/store/walkthrough.store.ts` | not on the canvas path (walkthrough pages) | walkthrough pages | yes |

Per-instance stores built by hand (not Zustand), all read by subscription so a
change re-renders only the members whose answer changed:

| Store | Owner | Scope | Read by | Written by |
| --- | --- | --- | --- | --- |
| `SelectionControls` | `canvas/selection/selectionControls.ts` | one per React Flow instance (keyed on RF's `getState`) | card controls (`useSelectionDisablesControls`) | `useCanvasGraphState` (`useSyncSelectionControls`, layout effect) |
| `IdSetStore` × 3 | `canvas/contexts/idSetStore.ts` | one per provider | nodes/edges (`useIsNodeHandleHighlighted`, `useIsConnectionHandleHighlighted`, `useIsEdgeLabelRevealed`) | `HandleHighlightProvider`, `EdgeLabelRevealProvider` |
| `LineHopsRegistry` | `canvas/edges/lineHopsRegistry.ts` | one per surface | edges (`useLineHops`) | edges |
| `autoArrangeWatcher` | `canvas/hooks/autoArrangeWatcher.ts` | a `subscribe` on the diagram store, not a store | `useAutoArrange` | — |

## React Contexts

Sixteen `createContext` calls in `src/` (none under `components/ui`).

| Context | Owner | Provided by | Value changes | Read by |
| --- | --- | --- | --- | --- |
| `ElementsSelectableContext` | `contexts/ElementsSelectableContext.tsx` | `DiagramSurface` | with the policy (mode change) | every edge |
| `LineHopsContext` | `contexts/LineHopsContext.tsx` | `DiagramSurface` | never (created once) | every edge |
| `CanvasLodContext` | `contexts/canvasLod.ts` | `DiagramSurface` (`CanvasLodProvider`) | once per zoom threshold crossing | edges, nodes |
| `SetCanvasLodContext` | `contexts/canvasLod.ts` | `DiagramSurface` (`CanvasLodProvider`) | never | `CanvasLodSync` |
| `ReadingDirectionContext` | `contexts/ReadingDirectionContext.tsx` | `DiagramSurface` | with `diagram.direction` | every node (`useHandleSides`), edges |
| `EdgeLabelPortalContext` | `edges/EdgeLabelPortal.tsx` | `DiagramSurface` | never | every edge overlay |
| `ComponentIconLookupContext` | `components/icons/componentIconLookupContext.ts` | `DiagramSurface`, only when given a lookup (viewer, embed) | with the lookup | node icons |
| `HandleHighlightContext` | `contexts/HandleHighlightContext.tsx` | `Canvas` | with each highlight | panels outside the canvas (`useHandleHighlight`) |
| `HighlightMembershipContext` | `contexts/highlightMembership.ts` | `Canvas` (inside `HandleHighlightProvider`) | never (two stable `IdSetStore`s) | nodes, edges |
| `EdgeLabelRevealContext` | `contexts/edgeLabelReveal.ts` | `Canvas` (`EdgeLabelRevealProvider`) | never (a stable `IdSetStore`) | edges |
| `FlowModeReactContext` | `flow/FlowModeContext.tsx` | the workspace page | with the flow mode | `useCanvasFlowState`, `useInteractionMode`, `useCanvasInteraction`, flow UI |
| `CollabContext` | `collaboration/components/collab-context.ts` | `CollabProvider` | with the session (cursors left out) | `Canvas`, `useCanvasController`, `useInteractionMode`, collab UI |
| `PanelFrameContext` | `panels/ElementPanel/shell/panelFrame.context.ts` | `PanelFrame` | per panel | panel sections |
| `ShareContext` | `viewer/components/ShareContext.tsx` | viewer | — | viewer only |
| `useReactFlow` / RF store | `@xyflow/react` | `ReactFlowProvider` (workspace) | every RF write | not ours; listed because selection lives there too |

The audit's figure of 22 contexts does not match a `createContext` count of
this tree; the app defines sixteen, fourteen of them on the canvas path.

## Local state that outlives a gesture

Not stores, but state the canvas holds in React and passes down:

| State | Owner | Notes |
| --- | --- | --- |
| `showVersions`, `focusTitleTrigger`, `reactFlowWrapperRef` | `useCanvasController` | handed to `useCanvasInteraction` and back to `Canvas` |
| `showSearch`, `showDiagramSidebar`, `showCommandPalette` | `useCanvasDiagramNavigation` | sidebar can be controlled from props |
| highlight, context menus, quick insert, tag filter, inline editor ids | `useCanvasVisualState` | one object, rebuilt when any of them changes |
| `isChatOpen`, `hasUnread`, `templateNodeId` | `Canvas` | chat chrome, save-as-preset modal |
| `localNodesRef` | `useCanvasInteraction` | the drag copy; see `useLocalNodes` (sharp edge) |

## Overlaps: the same fact in two places

| Fact | Where | Status |
| --- | --- | --- |
| Which nodes are selected | `useCanvasSelectionStore.selectedNodeIds` and React Flow's `node.selected` (projected from the store by `useCanvasNodes`, reported back by `onSelectionChange`; the pointer funnel's write wins for a press, `dragSelectionRef.selectionWrittenByFunnel`) | **known, product decision; not touched here** |
| Which nodes are selected, for card controls | `SelectionControls` mirrors the store (layout effect) | deliberate, a read-only mirror for the hot path (§9.5 of the audit) |
| Highlight / revealed labels | `useCanvasVisualState` holds the sets; `IdSetStore`s mirror them per element | deliberate, a read-only mirror |
| Collaboration session | `useCollabStore.session` and `CollabContext.session` (the context is built from the store, minus cursors) | deliberate: the context's identity ignores cursor packets |
| Compare mode | `useCanvasCompareState.isCompareMode` and `useInteractionMode().isCompareMode`, both derived from the same diagram fields | derived twice, no drift possible |
| Flow playing / recording | `FlowModeContext`, re-read by `useCanvasFlowState` and `useInteractionMode`; `flowState.isPlayingEffective` differs from `interactionMode.isPlaying` in compare mode | derived twice; the two `isPlaying` are not the same fact |
| Text layer visible | `useTextToolStore.layerVisible` (the editor's session view) and `diagram.textsVisible` (what a viewer/export shows) | **not** an overlap: two facts, documented in `textLayer.store.ts` |
| The selected component | resolved in `useCanvasController` (element panel gate) and again in `Canvas` (quick actions, text toolbar) from the same `useResolvedComponents` | derived twice in two files |
| "Select the node just inserted" | one callback in `Canvas` (catalog drop, bottom toolbar) and one in `useCanvasInteraction` (keyboard inserts) | duplicated code |
| `useReactFlow()`, `useCollab()`, `useResolvedComponents()` | called in both `Canvas` and `useCanvasController` | same subscription twice; same value |

The UI-flag stores (`catalogUi`, `sharedReveal`, `textLayer`, `flowView`) have
disjoint readers and writers: no two of them are read together by the same
component, and none of them duplicates another store's fact. Merging any two
would widen each subscriber's store without removing a source of truth.

## Consolidation steps, by risk

Lowest risk first. **This pass** = done on branch `audit/arch-state`; the
others are left as follow-ups with the reason.

1. **This pass.** Split `Canvas.tsx` by responsibility into components and hooks
   with the same render output: the chat chrome, the right rail, the overlays
   (context menu, quick insert, command palette, save-as-preset), the compare
   banner, the selection toolbars, the drop target, the flow-mode effects and
   the Arrange toolbar config. The MiniMap block stays where it is.
2. **This pass.** One callback for "select the node just inserted", used by both
   `Canvas` and `useCanvasInteraction`.
3. **This pass.** `useCanvasInteraction`: move cohesive groups into named hooks
   (mode exits, folder save, keyboard inserts, focus-title trigger); same
   return shape.
4. **This pass.** `useCanvasController`: move Arrange and the element-panel gate
   into named hooks; same return shape.
5. **This pass.** `DiagramSurface`: one `DiagramSurfaceProviders` component for the
   five providers it nests. The contexts stay split (one value each) so no
   consumer re-renders more.
6. Follow-up. Resolve the selected component once (in the controller) and hand
   it to the selection toolbars, instead of resolving it in two files. Low risk,
   but it changes which component subscribes to `useResolvedComponents`; worth
   a render count before and after.
7. Follow-up. Read `isCompareMode` / `isPlaying` from `useInteractionMode` only,
   with `isPlayingEffective` named for what it is. Touches every consumer of
   `flowState` and `compareState`.
8. Follow-up. Split `useCanvasVisualState` so menus, tag filter and inline
   editors stop rebuilding the object the selection consumers read. This is
   the "Canvas re-renders on selection" item (A4.3 of the audit): a performance
   project, measure first.
9. Not proposed. Merging the UI-flag stores (`catalogUi`, `sharedReveal`,
   `textLayer`, `flowView`): no overlap to remove (see above).
10. Product decision, not a refactor. One source of truth for selection
    (`useCanvasSelectionStore` vs React Flow's `selected`).

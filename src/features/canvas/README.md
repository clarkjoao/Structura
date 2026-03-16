# Canvas Feature

The canvas feature wraps `@xyflow/react` (React Flow) and bridges the diagram Zustand store to an interactive canvas. `Canvas.tsx` is the top-level component.

## Estrutura

```
src/features/canvas/
├── Canvas.tsx                  # Componente principal — monta o ReactFlow e integra todos os hooks
├── constants.ts                # Constantes de layout (DEFAULT_NODE_W/H, PANEL_DEFAULT_W/H, etc.)
├── viewport-utils.ts           # Utilitários de viewport (cálculo de centro, etc.)
├── index.ts                    # Public API da feature
│
├── hooks/
│   ├── useCanvasStore.ts               # Acesso centralizado ao store Zustand
│   ├── useCanvasVisualState.ts         # Estado visual: seleção, highlights, context menu
│   ├── useCanvasEventHandlers.ts       # Handlers de click, connect, seleção
│   ├── useCanvasEffects.ts             # Side-effects: sincronização de viewport e layout
│   ├── useCanvasDrillHandlers.ts       # Handlers de drill-down entre diagramas
│   ├── useCanvasKeyboard.ts            # Orquestra todos os atalhos de teclado
│   ├── useNodeDragParenting.ts         # Drag-to-panel parenting / unparenting
│   ├── README.md
│   └── keyboard/                       # Sub-hooks especializados de teclado
│       ├── useCopyPasteShortcuts.ts
│       ├── useGroupShortcuts.ts
│       ├── useQuickAddShortcuts.ts
│       ├── useRecordingShortcuts.ts
│       ├── useSelectionShortcuts.ts
│       ├── useUndoRedoShortcuts.ts
│       └── helpers.ts
│
├── nodes/
│   ├── CustomNode/                     # Nó C4 (person/system/container/component) + AWS
│   │   ├── index.tsx
│   │   ├── Badges.tsx
│   │   ├── DrillDownButton.tsx
│   │   ├── EmbedButton.tsx
│   │   ├── Handles.tsx
│   │   ├── RecordingBadge.tsx
│   │   ├── ReorderControls.tsx
│   │   ├── TypeConfig.ts
│   │   └── types.ts
│   ├── PanelNode.tsx                   # Painel agrupador, redimensionável
│   ├── NoteNode.tsx                    # Nota adesiva, sem handles
│   ├── AwsIcon.tsx                     # Ícone AWS lazy-loaded
│   ├── nodeVisibility.ts               # Lógica de visibilidade de nodes
│   ├── useCanvasNodes.ts               # Deriva Node[] do store
│   └── node-types/                     # Sistema de descritores
│       ├── README.md
│       ├── registry.ts
│       ├── types.ts
│       ├── c4.descriptor.ts
│       ├── panel.descriptor.ts
│       ├── note.descriptor.ts
│       └── index.ts
│
├── edges/
│   ├── CustomEdge.tsx                  # Aresta reta com label e badges
│   ├── edgeBuilding.ts                 # Lógica de construção de edges
│   ├── connectionDerivations.ts        # Derivados de conexões
│   ├── useCanvasEdges.ts               # Deriva Edge[] do store
│   ├── useCanvasConnectionDerivations.ts
│   ├── useCanvasHandleReorder.ts       # Reordenação de handles
│   └── index.ts
│
├── panels/
│   ├── ElementPanel/                   # Painel lateral de propriedades
│   ├── MultiSelectPanel.tsx            # Painel de multi-seleção
│   └── NodeContextMenu.tsx             # Menu de contexto do node
│
├── flow/
│   ├── FlowPanel.tsx                   # Lista de flows, play, editar
│   ├── FlowRecorderPanel.tsx           # Gravação de flow (steps + Mermaid)
│   ├── FlowStepNavigator.tsx           # Barra de playback
│   ├── flowState.ts                    # Lógica de estado do flow
│   ├── useFlowState.ts                 # Hook de estado de playback/recording
│   ├── RecordingModeContext.tsx
│   └── index.ts
│
├── toolbar/
│   ├── CanvasToolbar.tsx               # Barra: diagrama ativo, adicionar elemento, padrões
│   ├── ElementPickerModal.tsx
│   ├── PatternPicker.tsx
│   ├── QuickInsertPopover.tsx
│   └── element-usage-tracker.ts
│
├── models/
│   └── panelParenting.ts               # Lógica de parenting de painéis
│
└── contexts/
    └── HandleHighlightContext.tsx      # Contexto de highlight de handles
```

## Hooks

### useCanvasStore
Centraliza acesso ao store Zustand com seletores otimizados via `useShallow`.

```typescript
const { nodes, edges, viewport, actions } = useCanvasStore();
```

### useCanvasVisualState
Gerencia todo o estado visual local: node/edge selecionados, context menu, highlights de recording/playback.

### useCanvasEventHandlers
Handlers para eventos do ReactFlow: `onConnect`, `onNodeClick`, `onEdgeClick`, `onPaneClick`, `onNodeContextMenu`.

### useCanvasEffects
Side-effects declarativos: persiste viewport no store em `onMoveEnd`, sincroniza layout em `onNodeDragStop`.

### useCanvasDrillHandlers
Lida com navegação drill-down: abre diagrama vinculado ao clicar no botão de explorar interior de um nó.

### useCanvasKeyboard
Orquestra todos os atalhos de teclado delegando para sub-hooks especializados:

| Sub-hook | Atalhos |
|----------|---------|
| `useUndoRedoShortcuts` | `Cmd+Z`, `Shift+Cmd+Z` |
| `useSelectionShortcuts` | `Cmd+A`, `Escape`, `Delete/Backspace` |
| `useCopyPasteShortcuts` | `Cmd+C`, `Cmd+V`, `Cmd+D` |
| `useGroupShortcuts` | `Cmd+G`, `Shift+Cmd+G` |
| `useRecordingShortcuts` | `Delete/Backspace` no modo gravação |
| `useQuickAddShortcuts` | Teclas de adição rápida de elementos |

### useNodeDragParenting
Gerencia drop de nodes em painéis durante drag. Rastreia `dragTargetPanelId` em tempo real e comita o `setParent` no `onNodeDragStop`.

### useFlowState
Dado `activeFlow` e `currentStep`, computa highlights de playback, badges de recording e indicadores de coverage.

## Node Type Descriptors

Cada tipo de node é um `NodeTypeDescriptor` registrado em `nodes/node-types/registry.ts`. Para adicionar um novo tipo, veja [`nodes/node-types/README.md`](nodes/node-types/README.md).

Regra: **`c4Descriptor` deve sempre ser o último** — é o fallback catch-all.

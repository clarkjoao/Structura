# Structura — Performance Audit

**Scope**: Zustand → React Flow render pipeline, canvas interactions, state derivation  
**Auditor role**: Staff Frontend Performance Engineer  
**Date**: 2026-04-11

---

## 1. Executive Summary

| # | Severidade | Tipo | Achado |
|---|-----------|------|--------|
| 1 | **Crítico** | Bug | `useCanvasNodes` recomputa **todos** os nós (sort + map com `data`/`style` inline) quando qualquer seleção, highlight ou drag-target muda — O(N) por clique/frame de drag em 500 nós |
| 2 | **Crítico** | Gargalo | `HandleHighlightProvider` recria o objeto `value` em cada render do `Canvas`, forçando re-render de **todos** os nós/edges que consomem `useHandleHighlight` |
| 3 | **Alto** | Bug | `onSelectionChange` + `onNodeClick` com Meta/Ctrl produzem **race condition de seleção**: ambos chamam `setSelectedNodeIds` → o callback de `onNodeClick` pode ser sobrescrito pelo callback assíncrono de `onSelectionChange`, causando a falha no stress test de multi-select |
| 4 | **Alto** | Gargalo | `useVisibleComponents` / `useVisibleConnections` criam novos arrays (`Object.values().filter()`) dentro do selector; `useShallow` compara **elemento a elemento** — O(N) por notificação de store mesmo sem mudança |
| 5 | **Alto** | Gargalo | `CollabProvider` context value é recriado em cada render (sem `useMemo`), forçando re-render de todo `useCollab()` / `useCollabHighlight()` subscriber (todos os nós) |
| 6 | **Alto** | Gargalo | `buildData` em c4.descriptor.ts cria um novo closure `onReorderHandle` e novo objeto `data` por nó, por recompute — React Flow considera `data` changed → rerender do componente memo |
| 7 | **Médio** | Risco | `deepClone` via `JSON.parse(JSON.stringify)` em `pushHistory` e `undo/redo` é O(tamanho do diagrama); com 500+ nós e 50 checkpoints, o custo de serialização pode bloquear o thread |
| 8 | **Médio** | Gargalo | `useEdgeWaypoints` faz `.find()` linear em `edgeLayouts[]` por edge — O(E²) total onde E = nº de edges |
| 9 | **Médio** | Risco | `useCanvasEffects` wheel handler re-registra em `[reactFlowInstance, diagram]`, mas `diagram` muda em cada mutation → remove/add listener a cada store update |
| 10 | **Baixo** | Oportunidade | `useIconLibrary` ordena `Object.values(icons)` a cada invocação do selector; `useShallow` não ajuda contra arrays reordenados (identidade de array sempre nova) |

---

## 2. Render Pipeline Map

```
┌──────────────────────────────────────────────────────────────┐
│                     Zustand Store (Immer)                     │
│  diagrams{} → snapshot, nodeLayouts, edgeLayouts, scenes     │
│  activeDiagramId, past[], future[]                           │
└───────────────┬──────────────────────────────────────────────┘
                │ subscribe via selectors
                ▼
┌─────────────────────────────────────────────────────┐
│ Selectors (useShallow wrappers)                      │
│ useActiveDiagram      → Diagram ref (Immer replaced) │
│ useVisibleComponents  → Component[]   ⚠ ALLOC EACH   │
│ useVisibleConnections → Connection[]  ⚠ ALLOC EACH   │
│ useFlows, useDiagrams, useServiceRegistry            │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ useCanvasController (orchestrator)                            │
│  ├─ useCanvasStore()    → pulls all selectors                │
│  ├─ useCanvasVisualState() → selection, highlight (useState) │
│  ├─ useCanvasCompareState()→ scene compare visuals (useMemo) │
│  ├─ useCanvasFlowState()   → playback/recording (useMemo)   │
│  ├─ useCanvasInteraction() → handlers, keyboard, drag        │
│  │     ├─ useNodeDragParenting()→ drag state (useState/ref)  │
│  │     ├─ useCanvasEventHandlers() → callbacks               │
│  │     ├─ useCanvasKeyboard() → keydown handler              │
│  │     └─ useCanvasEffects() → viewport fitView, wheel       │
│  └─ useCanvasGraphState()  → derives nodes[] + edges[]       │
│        ├─ useCanvasConnectionDerivations() → panelIds, etc.  │
│        ├─ useCanvasNodes() ⚠ FULL REBUILD EACH CHANGE        │
│        │    (sort + map → new Node[] with inline data/style) │
│        ├─ useLocalNodes()  → drag buffer (useState + merge)  │
│        └─ useCanvasEdges() → Edge[] (useMemo, full rebuild)  │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Canvas.tsx                                            │
│  HandleHighlightProvider ⚠ INLINE VALUE OBJECT        │
│  ReactFlow                                            │
│    nodes={localNodes}  edges={edges}                  │
│    nodeTypes={nodeTypes}  edgeTypes={canvasEdgeTypes}  │
│    ▲ both are module-level constants ✅                │
│                                                       │
│  Cada node → CardNode (memo), PanelNode (memo), etc.  │
│    ├─ useHandleHighlight() ← context re-render        │
│    ├─ useCollabHighlight() ← context re-render        │
│    └─ useComponentIcon()  ← 2 store subscriptions     │
└──────────────────────────────────────────────────────┘
```

### Principais pontos de fan-out de rerender

1. **`useCanvasNodes` output** → qualquer mudança de seleção/highlight/drag invalida useMemo → rebuild ALL Node[]. Cada Node recebe novo `data` e `style` → React Flow diffing detecta mudança em todos.

2. **`HandleHighlightProvider`** → inline `value={{...}}` no render body de Canvas.tsx → **new ref every Canvas render** → every `useHandleHighlight()` consumer (CardNode, PanelNode, NoteNode) rerenders.

3. **`CollabProvider`** → inline `value={{...}}` sem `useMemo` → every `useCollab()` consumer (CardNode via `useCollabHighlight`, PanelNode, etc.) rerenders.

4. **`FlowModeContext`** → `value` é `useMemo`'d ✅, mas `mode` muda frequentemente durante playback → sub-tree inteiro re-renders (todos os hooks que chamam `useFlowMode`).

---

## 3. Findings Detalhados

### F1. `useCanvasNodes` é O(N) sort+map em cada mudança de seleção/highlight

- **Severidade**: Crítico
- **Tipo**: Gargalo
- **Arquivo**: `src/features/canvas/nodes/useCanvasNodes.ts`
- **Função**: `useCanvasNodes` (useMemo interno, linhas ~200-320)
- **Evidência**: O `useMemo` depende de `nodeCtxBase` que inclui `selectedNodeId`, `selectedNodeIds`, `highlightedNodeIds`, `dragTargetPanelId`, `unparentCandidatePanelId`. Qualquer mudança recria o `nodeCtxBase` memo → invalida o memo final → **sort + map de TODOS visibleComponents** → gera Node[] inteiramente novo com novos objetos `data` e `style` para cada nó.
- **Mecanismo**: Ao clicar um nó (seleção muda), ALL nodes são recalculados. Para 500 nós, isso inclui: 1) sort O(N log N), 2) map com N chamadas a `resolveNodeDescriptor`, `computeNodeVisibility`, `buildData`, `buildStyle`, cada uma alocando novos objetos.
- **Impacto prático**: Stress test mostra 177ms para node selection com 500 elementos. O custo escala linearmente com N. Em drag, `dragTargetPanelId` muda a cada posição → full rebuild a cada frame.
- **Correção recomendada**: Separar o `useMemo` em duas camadas:
  1. **Structural memo** (depende de `diagram`, `visibleComponents`, `resolvedNodeLayouts`, `panelIds`) — reconstrói a lista base (sort + map) somente quando componentes/layout mudam.
  2. **Visual overlay memo** (depende de `selectedNodeId`, `selectedNodeIds`, `highlightedNodeIds`, `dragTargetPanelId`, flow highlight) — atualiza somente `selected`, `style.opacity`, `className`, `data.isSelected` dos nós afetados, via patch incremental.
- **Risco da mudança**: Médio — requer split do `buildData` em parts estáveis vs visuais; pode introduzir inconsistência se algum campo "visual" afeta layout.
- **Esforço**: Alto (refactor significativo do pipeline de nodes)

---

### F2. `HandleHighlightProvider` value inline — mass re-render

- **Severidade**: Crítico
- **Tipo**: Gargalo
- **Arquivo**: `src/features/canvas/Canvas.tsx` (linhas 150-157)
- **Evidência**:
  ```tsx
  <HandleHighlightProvider
    value={{
      highlightedConnectionId: visualState.highlightedConnectionId,
      highlightedNodeIds: visualState.highlightedNodeIds,
      setHighlight: visualState.setHighlight,
      clearHighlight: visualState.clearHighlight,
    }}
  >
  ```
  Este objeto é criado no corpo do render de Canvas — nova referência em cada render.
- **Mecanismo**: Todo `useContext(HandleHighlightContext)` consumer (chamado em CardNode, PanelNode, NoteNode, SwimlaneNode) é notificado → re-render de TODOS os nós em cada Canvas render.
- **Impacto prático**: Qualquer setState no Canvas (chat open, template modal, etc.) força re-render de todos os nós custom via context.
- **Correção recomendada**: Extrair o valor em `useMemo`:
  ```tsx
  const highlightValue = useMemo(() => ({
    highlightedConnectionId: visualState.highlightedConnectionId,
    highlightedNodeIds: visualState.highlightedNodeIds,
    setHighlight: visualState.setHighlight,
    clearHighlight: visualState.clearHighlight,
  }), [
    visualState.highlightedConnectionId,
    visualState.highlightedNodeIds,
    visualState.setHighlight,
    visualState.clearHighlight,
  ]);
  ```
- **Risco da mudança**: Baixo — memoização simples de objeto.
- **Esforço**: Baixo (< 30min)

---

### F3. Race condition multi-select: `onNodeClick` vs `onSelectionChange`

- **Severidade**: Alto
- **Tipo**: Bug
- **Arquivo**: `src/features/canvas/hooks/useCanvasEventHandlers.ts` (linhas ~130-160, 220-240)
- **Evidência**: No teste Cypress `multi-select with Meta/Ctrl adds nodes to selection`, o resultado é 1 nó selecionado quando deveria ser ≥2.
- **Mecanismo**:
  1. `onNodeClick` com `e.metaKey`/`e.ctrlKey` chama `setSelectedNodeIds((prev) => { next = new Set(prev); next.add(node.id); return next; })`.
  2. React Flow dispara `onSelectionChange` assincronamente com os nós que React Flow internamente considera selecionados.
  3. `onSelectionChange` chama `setSelectedNodeIds(new Set(selectedIds))` — pode sobrescrever a atualização de `onNodeClick` se o timing conflitar.
  4. `prevSelectionRef` mitigação tem race: `onNodeClick` atualiza `prevSelectionRef`, mas `onSelectionChange` compara contra o mesmo ref e pode pular o update, ou inversamente, aplicar um update parcial.
  
  Com 500 nós, o render delay amplifica a janela de race.
- **Impacto prático**: Multi-select falha intermitentemente em canvases grandes — confirmado pelo teste Cypress.
- **Correção recomendada**: Unificar seleção: em `onNodeClick` com Ctrl/Meta, **não** atualizar selection diretamente — apenas marcar via React Flow's built-in selection mechanism. Ou: em `onSelectionChange`, respeitar Meta/Ctrl context e não overwrite selection quando é um click incremental. Uma abordagem pragmática: após `onNodeClick` com Meta, setar um flag de debounce que `onSelectionChange` respeita por ~50ms.
- **Risco da mudança**: Médio — selection logic é sensível; mudanças podem afetar rubber-band selection.
- **Esforço**: Médio

---

### F4. `useVisibleComponents` / `useVisibleConnections` — O(N) allocation in selector

- **Severidade**: Alto
- **Tipo**: Gargalo
- **Arquivo**: `src/features/diagram/store/selectors/connection.selectors.ts` (linhas 32-52)
- **Evidência**:
  ```ts
  export const useVisibleComponents = () =>
    useDiagramStore(
      useShallow((s) => {
        const r = getCachedCanvasSnapshot(d);
        const visibleIds = new Set(Object.keys(r.nodeLayouts));
        return Object.values(r.components).filter((c) => visibleIds.has(c.id));
      }),
    );
  ```
- **Mecanismo**: `useShallow` compara arrays elemento a elemento. Cada invocação do selector cria:
  1. `new Set(Object.keys(...))` — O(N) allocation
  2. `Object.values(...).filter(...)` — O(N) allocation + iteration
  
  Se o snapshot cache hit (Diagram ref unchanged), `getCachedCanvasSnapshot` retorna o mesmo objeto, mas os arrays criados são sempre novos. `useShallow` então faz shallow compare de cada elemento — se Component refs são estáveis (Immer structural sharing), a comparação passa. **Porém**: qualquer mutation em qualquer componente do diagrama gera nova Diagram ref → cache miss → novo snapshot → novos component objects → `useShallow` detecta diferença → re-render.
- **Impacto prático**: Qualquer store mutation (layout update, viewport, edge style) invalida o Diagram ref → todos os selectors que usam `getCachedCanvasSnapshot` recompuram.
- **Correção recomendada**: Considerar selectors que retornam o **Record** (referência estável do snapshot) em vez de arrays derivados, e fazer a filtragem no hook consumidor com `useMemo`. Alternativamente, um selector customizado que mantém referência estável se os IDs não mudaram.
- **Risco da mudança**: Médio — mudança de API de selectors afeta múltiplos consumidores.
- **Esforço**: Médio

---

### F5. `CollabProvider` context value sem `useMemo`

- **Severidade**: Alto
- **Tipo**: Gargalo
- **Arquivo**: `src/features/collaboration/components/CollabProvider.tsx` (linhas 246-268)
- **Evidência**:
  ```tsx
  <CollabContext.Provider
    value={{
      session, isReady, status,
      isGuest: ...,
      sessionClosedByHost, hostDisconnected,
      closeSession: handleCloseSession,
      ...
    }}
  >
  ```
  Objeto inline sem `useMemo`.
- **Mecanismo**: Qualquer render de `CollabProvider` (que é perto do root) cria novo objeto `value` → todo `useContext(CollabContext)` consumer re-renders. Consumers incluem: `useCollab()` em `useCanvasController`, `useCollabHighlight()` em CADA CardNode, PanelNode, NoteNode, CustomEdge.
- **Impacto prático**: Com collab desabilitada, `session=null` + estado estável → baixo impacto. Mas mesmo sem collab, qualquer re-render do provider ancestor causa cascade. Com collab ativa, cursor updates → session changes → mass re-render.
- **Correção recomendada**: Wrap `value` em `useMemo` com deps explícitas. Split context se necessário (session vs actions vs editingComponents).
- **Risco da mudança**: Baixo
- **Esforço**: Baixo (< 30min)

---

### F6. `buildData` closures — nova referência de `data` por nó

- **Severidade**: Alto
- **Tipo**: Gargalo
- **Arquivo**: `src/features/canvas/nodes/node-types/c4.descriptor.ts` (linhas 48-126)
- **Evidência**: `onReorderHandle` cria closure por nó:
  ```ts
  onReorderHandle: ctx.onReorderHandle
    ? (side, connId, direction) => ctx.onReorderHandle!(comp.id, side, connId, direction)
    : undefined,
  ```
  `onDrillDown`, `onEmbed`, etc. são refs a ctx functions mas o objeto `data` inteiro é novo. React Flow compara `node.data` por referência → todos os nós são "changed" → memo bypass em CardNode.
- **Mecanismo**: `memo()` em `CardNode` nunca pode bailar porque `data` é sempre um objeto fresco. React Flow's internal memo comparison on Node also fails.
- **Impacto prático**: Todos os 500+ CardNodes re-render a cada `useCanvasNodes` recompute, mesmo se apenas seleção mudou.
- **Correção recomendada**: Duas opções:
  1. Separar `data` em `data` (referência estável) + `visualData` (campos que mudam com seleção/flow). Require custom node que sabe como pegar visual state de outra fonte (e.g. context ou separate Map).
  2. More pragmático: memoize `data` objects per-node via Map<nodeId, data> com structural comparison, retornando ref estável quando dados não mudaram.
- **Risco da mudança**: Alto (requer mudança na arquitetura de descriptors)
- **Esforço**: Alto

---

### F7. `deepClone` via `JSON.parse(JSON.stringify)` no history

- **Severidade**: Médio
- **Tipo**: Risco
- **Arquivo**: `src/features/diagram/store/slices/history.slice.ts` (linhas 13-15)
- **Evidência**: `deepClone` é chamado em `pushHistory` (2 clones: snapshot + nodeLayouts) e em `undo`/`redo` (2 clones cada).
- **Mecanismo**: Para 500 componentes com metadata completa, `JSON.stringify` + `JSON.parse` pode custar 5-20ms por chamada no main thread. Em drag com structural mutations (commitNodeDrag), isso é 2 × deepClone no pushHistory + persist serialization.
- **Impacto prático**: **Hipótese de profiling** — precisa medir com diagrama de 500+ nós. O coalesce de 1s em soft mutations mitiga frequência.
- **Correção recomendada**: Substituir por `structuredClone()` (nativo, ~30% mais rápido) ou usar snapshot imutável do Immer (o frozen draft) diretamente como checkpoint se o Immer estiver configurado com freeze.
- **Risco da mudança**: Baixo — `structuredClone` é drop-in.
- **Esforço**: Baixo (< 15min)

---

### F8. `useEdgeWaypoints` — busca linear em `edgeLayouts[]`

- **Severidade**: Médio
- **Tipo**: Gargalo
- **Arquivo**: `src/features/diagram/store/selectors/layout.selectors.ts` (linhas 8-17)
- **Evidência**:
  ```ts
  export const useEdgeWaypoints = (connectionId: string): Point[] =>
    useDiagramStore(
      useShallow((state) => {
        const diagram = state.diagrams[state.activeDiagramId ?? ""];
        const waypoints = diagram?.edgeLayouts.find(
          (layout) => layout.connectionId === connectionId
        )?.waypoints;
        return waypoints ?? EMPTY_WAYPOINTS;
      }),
    );
  ```
  `.find()` é O(E) onde E = nº de edge layouts. Chamado por cada CustomEdge → O(E²) total.
- **Mecanismo**: Cada edge renderiza e subscribe com `useEdgeWaypoints(connId)`, executando `.find` linear no selector. Com 500 edges, são 500 × 500 = 250K comparações por update cycle.
- **Correção recomendada**: Converter `edgeLayouts` para `Record<connectionId, EdgeLayout>` no modelo (migration + slice update), eliminando `.find()`.
- **Risco da mudança**: Médio (schema migration necessária)
- **Esforço**: Médio

---

### F9. `useCanvasEffects` wheel handler re-registra em cada mutation

- **Severidade**: Médio
- **Tipo**: Risco
- **Arquivo**: `src/features/canvas/hooks/useCanvasEffects.ts` (linhas 67-93)
- **Evidência**: `useEffect` com deps `[reactFlowInstance, diagram]`. `diagram` é nova ref em cada store mutation → remove/add event listener a cada update.
- **Mecanismo**: O `handleWheel` closure captura `reactFlowInstance` que é estável, mas `diagram` está na dep array desnecessariamente — o handler não usa `diagram` diretamente (só guarda o `if (!diagram) return`).
- **Correção recomendada**: Remover `diagram` da dep array; usar early return baseado em ref ou condição externa. Ou mover para `!!diagram` boolean na dep.
- **Risco da mudança**: Baixo
- **Esforço**: Baixo (< 10min)

---

### F10. `useIconLibrary` sort em cada selector call

- **Severidade**: Baixo
- **Tipo**: Oportunidade
- **Arquivo**: `src/features/diagram/store/selectors/icon.selectors.ts` (linhas 17-20)
- **Evidência**: `useShallow((state) => sortIconDefinitions(Object.values(state.icons)))` — cria novo array sorted em cada invocação. `useShallow` compara shallow, mas como o sort pode reordenar, identidade de elementos muda → re-render.
- **Correção recomendada**: Memoizar o sort result usando um selector customizado, ou aceitar (icon library é painel secundário, não no hot path).
- **Risco**: Baixo
- **Esforço**: Baixo

---

### Findings Adicionais

### F11. `onPaneContextMenu` lê `visualState` props diretamente — stale closure risk

- **Severidade**: Baixo
- **Tipo**: Risco
- **Arquivo**: `src/features/canvas/hooks/useCanvasEventHandlers.ts` (linhas 277-295)
- **Evidência**: `visualState.selectedNodeId`, `visualState.selectedEdgeId`, `visualState.selectedNodeIds.size` são lidos no corpo da callback, mas esses valores vêm de `useState` — dentro de `useCallback`, eles são referências ao render corrente porque estão na dep array. ✅ Correto — sem stale closure.

### F12. `useLocalNodes` — merge logic durante drag é correto

- **Severidade**: N/A (bem resolvido)
- **Arquivo**: `src/features/canvas/hooks/useLocalNodes.ts`
- **Análise**: A lógica de merge entre store nodes e local nodes é sólida:
  - `draggingNodeIdsRef` tracked por `change.dragging` flag
  - `isUndoRedoTransition` detecta undo/redo e descarta posição local ✅
  - `useRemotePosition` usa store position quando parentId muda ou node não está em drag ✅
  - `filterNodeChangesForSceneMoveLock` previne drag de nós base em scene mode ✅
- **Risco encontrado**: Nenhum — lógica bem implementada.

### F13. `Canvas.tsx` `accept` callback force-rerenders todos os nodes

- **Severidade**: Baixo
- **Tipo**: Oportunidade
- **Arquivo**: `src/features/canvas/Canvas.tsx` (linhas 127-137)
- **Evidência**:
  ```ts
  const accept = useCallback(
    (suggestionId: string) => {
      acceptSuggestion(suggestionId);
      setTimeout(() => {
        reactFlowInstance.setNodes((previousNodes) =>
          previousNodes.map((node) => ({ ...node })),
        );
      }, 50);
    },
    [acceptSuggestion, reactFlowInstance],
  );
  ```
  Força re-render de TODOS os nodes por spread `{...node}` após aceitar sugestão LLM. É intencional (forçar React Flow a recalcular), mas alternativa seria `updateNodeInternals`.

### F14. `allDiagramTags` recomputa em cada diagrama change

- **Severidade**: Baixo
- **Tipo**: Oportunidade
- **Arquivo**: `src/features/canvas/hooks/useCanvasController.ts` (linhas 29-34)
- **Evidência**: `useMemo` depende de `resolved?.components` que muda quando diagrama muda. Itera todos os componentes para extrair tags. Apenas usado no toolbar — não no hot path.

---

## 4. Patch Plan por Arquivo

### `src/features/canvas/Canvas.tsx`

**Problema**: `HandleHighlightProvider` value inline.

**Mudança exata**:
```tsx
// ANTES (dentro do render body)
<HandleHighlightProvider value={{
  highlightedConnectionId: visualState.highlightedConnectionId,
  ...
}}>

// DEPOIS
const highlightContextValue = useMemo(() => ({
  highlightedConnectionId: visualState.highlightedConnectionId,
  highlightedNodeIds: visualState.highlightedNodeIds,
  setHighlight: visualState.setHighlight,
  clearHighlight: visualState.clearHighlight,
}), [
  visualState.highlightedConnectionId,
  visualState.highlightedNodeIds,
  visualState.setHighlight,
  visualState.clearHighlight,
]);
// ...
<HandleHighlightProvider value={highlightContextValue}>
```

**Por que reduz rerender**: Context consumers só re-renderizam quando o value muda por referência. Com memoização, a ref é estável quando highlight não muda.

**Cuidados**: `setHighlight` e `clearHighlight` devem ser referências estáveis (já são — vêm de `useCallback` em `useCanvasVisualState`).

---

### `src/features/collaboration/components/CollabProvider.tsx`

**Problema**: Context value inline sem `useMemo`.

**Mudança exata**:
```tsx
const contextValue = useMemo(() => ({
  session,
  isReady,
  status,
  isGuest: isHost ? false : session !== null && !session.isHost,
  sessionClosedByHost,
  hostDisconnected,
  closeSession: handleCloseSession,
  provider: null,
  ydoc: null,
  collabUrl,
  updateCursor,
  updateSelectedNode,
  updateViewport,
  updateEditingComponent,
  editingComponents,
  peerLimitReached,
}), [
  session, isReady, status, isHost,
  sessionClosedByHost, hostDisconnected,
  handleCloseSession, collabUrl,
  updateCursor, updateSelectedNode, updateViewport,
  updateEditingComponent, editingComponents, peerLimitReached,
]);

return (
  <CollabContext.Provider value={contextValue}>
    {children}
  </CollabContext.Provider>
);
```

**Por que**: Elimina re-render cascading para ~N nós que consomem `useCollab()`/`useCollabHighlight()`.

**Cuidados**: Verificar que `editingComponents` (Map) tem referência estável (já é: vem de `useMemo` line 233). Callbacks já são `useCallback`'d.

---

### `src/features/canvas/hooks/useCanvasEventHandlers.ts`

**Problema**: Race condition entre `onNodeClick` (Meta) e `onSelectionChange`.

**Mudança exata**:
```tsx
// Adicionar ref para tracking de click-driven selection
const metaClickSelectionRef = useRef(false);

const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
  // ... existing code ...
  if (e.metaKey || e.ctrlKey) {
    metaClickSelectionRef.current = true;
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      prevSelectionRef.current = [...next].sort().join(",");
      setSelectedNodeId(
        next.size === 0 ? null : next.has(node.id) ? node.id : (next.values().next().value ?? null),
      );
      return next;
    });
    // Clear flag after a tick to let onSelectionChange respect it
    requestAnimationFrame(() => { metaClickSelectionRef.current = false; });
  }
  // ...
}, [/* deps */]);

const onSelectionChange = useCallback(
  ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    // Skip when a meta-click just set selection to prevent overwrite
    if (metaClickSelectionRef.current) return;
    // ... rest unchanged ...
  },
  [/* deps */],
);
```

**Por que**: Previne `onSelectionChange` de sobrescrever a seleção incremental feita por `onNodeClick` com Meta/Ctrl.

**Cuidados**: O flag precisa ser resetado de forma confiável. `requestAnimationFrame` garante reset após o cycle de eventos.

---

### `src/features/canvas/hooks/useCanvasEffects.ts`

**Problema**: Wheel handler re-registra por mudança de `diagram`.

**Mudança exata**:
```tsx
// ANTES
}, [reactFlowInstance, diagram]);

// DEPOIS
const hasDiagram = !!diagram;
// ... useEffect body: change `if (!diagram) return;` to `if (!hasDiagramRef.current) return;`
// or simpler:
}, [reactFlowInstance, hasDiagram]);
```

Ou, mais robusto:
```tsx
const diagramRef = useRef(diagram);
diagramRef.current = diagram;

useEffect(() => {
  const el = document.querySelector(".react-flow__renderer");
  if (!el || !diagramRef.current) return;
  const handleWheel = (e: WheelEvent) => {
    // ... same logic using reactFlowInstance (stable) ...
  };
  el.addEventListener("wheel", handleWheel, { passive: false });
  return () => el.removeEventListener("wheel", handleWheel);
}, [reactFlowInstance]);
```

**Por que**: Evita remove/add de event listener a cada store mutation (pode acontecer centenas de vezes por segundo durante drag).

---

### `src/features/diagram/store/slices/history.slice.ts`

**Problema**: `JSON.parse(JSON.stringify)` para deep clone.

**Mudança exata**:
```ts
// ANTES
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// DEPOIS
export function deepClone<T>(v: T): T {
  return structuredClone(v);
}
```

**Por que**: `structuredClone` é ~30% mais rápido e lida com mais tipos (embora irrelevante aqui).

**Cuidados**: Nenhum — `structuredClone` é suportado em todos os browsers modernos. Os dados são todos plain objects/arrays/primitivos.

---

### `src/features/diagram/store/selectors/layout.selectors.ts`

**Problema**: `useEdgeWaypoints` faz `.find()` linear.

**Mudança sugerida (longo prazo)**: Converter `edgeLayouts: EdgeLayout[]` para `edgeLayouts: Record<string, EdgeLayout>` no modelo.

**Mudança imediata (menor risco)**: Usar um selector que constrói um Map indexado e memoiza:
```ts
// Em um hook wrapper ou selector helper
const useEdgeLayoutMap = () =>
  useDiagramStore(
    useShallow((state) => {
      const d = state.diagrams[state.activeDiagramId ?? ""];
      if (!d) return {};
      return Object.fromEntries(d.edgeLayouts.map(l => [l.connectionId, l]));
    }),
  );
```

---

### `src/features/canvas/nodes/useCanvasNodes.ts`

**Problema principal**: Full rebuild O(N) em cada mudança visual.

**Mudança recomendada de longo prazo**: Split em structural + visual layers (ver seção 7 para exemplo).

**Mudança imediata de menor risco**: Pelo menos separar o sort dos componentes visíveis do memo que depende de visual state:

```ts
// sortedComponents não depende de visual state
const sortedComponents = useMemo(() => {
  return [...visibleComponents].sort((a, b) => {
    const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
    const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;
    if (aIsGroup && bIsGroup) {
      if (b.parentId === a.id) return -1;
      if (a.parentId === b.id) return 1;
    }
    return 0;
  });
}, [visibleComponents]);
```

Isso pelo menos evita re-sort quando só visual state muda.

---

## 5. Prioridade de Execução

### Onda 1 — Quick wins de alto impacto e baixo risco

| # | Item | Benefício | Risco | Observações |
|---|------|-----------|-------|-------------|
| 1 | Memoize `HandleHighlightProvider` value (F2) | Elimina re-render de TODOS os nós em Canvas re-renders não relacionados a highlight | Baixo | 10 linhas de mudança |
| 2 | Memoize `CollabProvider` context value (F5) | Elimina cascade re-render via collab context | Baixo | 15 linhas |
| 3 | `structuredClone` em history (F7) | ~30% mais rápido em pushHistory/undo/redo | Baixo | 1 linha |
| 4 | Remover `diagram` da dep array do wheel handler (F9) | Elimina event listener thrash durante mutations | Baixo | 3 linhas |
| 5 | Separar sort de visibleComponents do memo visual (F1 parcial) | Evita O(N log N) sort por clique | Baixo | 10 linhas |

**Benefício esperado**: Redução significativa de re-renders espúrios, especialmente em nodes que usam `useHandleHighlight` e `useCollabHighlight`. Estimativa: ~40-60% menos re-renders por interação de seleção.

---

### Onda 2 — Correções estruturais importantes

| # | Item | Benefício | Risco | Observações |
|---|------|-----------|-------|-------------|
| 6 | Fix multi-select race condition (F3) | Resolve o teste Cypress falhando | Médio | Testar com rubber-band selection |
| 7 | Refatorar `useVisibleComponents`/`useVisibleConnections` para refs estáveis (F4) | Reduz re-renders desnecessários em store mutations | Médio | Mudança de API, testar regressão |
| 8 | Converter `edgeLayouts[]` para `Record` (F8) | Elimina O(E²) lookup | Médio | Requer schema migration v5 |
| 9 | Split `useCanvasNodes` em structural + visual (F1 completo) | Elimina O(N) full rebuild por selection/highlight change | Alto | Mudança arquitetural significativa |

**Benefício esperado**: Eliminação do gargalo principal de performance em canvases com 500+ nós. Selection latency esperada: <50ms (down from 177ms).

---

### Onda 3 — Melhorias dependentes de profiling ou maior risco

| # | Item | Benefício | Risco | Observações |
|---|------|-----------|-------|-------------|
| 10 | Estabilizar `data` objects por nó (F6) | Permite `memo()` em CardNode/PanelNode funcionar | Alto | Requer refactoring de descriptors + node internals |
| 11 | Split FlowModeContext em state vs actions | Reduz re-renders durante playback | Médio | Requer profiling para confirmar impacto |
| 12 | Per-node memoização com `React.memo` + custom comparator | Precisão cirúrgica em re-renders | Alto | Complexidade de manutenção |

**Observações**: Onda 3 só vale após confirmar com profiling que os ganhos da Onda 1+2 são insuficientes.

---

## 6. Instrumentação Recomendada

### 6.1 React DevTools Profiler — Baseline

1. Abrir React DevTools > Profiler
2. Habilitar "Record why each component rendered"
3. Com diagrama de 500 nós:
   - Gravar: clicar nó → soltar → clicar outro nó
   - Verificar: quantos CardNode/PanelNode re-renderam e POR QUÊ (props changed? context changed?)
   - **Antes/depois** de F2 (HandleHighlight memoize)

### 6.2 Contador de render em nodes

```tsx
// Temporário em CardNode
const renderCount = useRef(0);
renderCount.current++;
if (renderCount.current % 10 === 0) {
  console.log(`[CardNode ${d.elementId}] renders: ${renderCount.current}`);
}
```

### 6.3 performance.now() em useCanvasNodes

```ts
// No useMemo final de useCanvasNodes
return useMemo(() => {
  const t0 = performance.now();
  // ... existing sort + map ...
  const t1 = performance.now();
  if (t1 - t0 > 5) console.warn(`useCanvasNodes took ${(t1-t0).toFixed(1)}ms for ${visibleComponents.length} nodes`);
  return result;
}, [/* deps */]);
```

### 6.4 Selector invocation counter

```ts
// Em connection.selectors.ts
let visibleCompCallCount = 0;
export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      visibleCompCallCount++;
      if (visibleCompCallCount % 20 === 0) {
        console.log(`[useVisibleComponents] called ${visibleCompCallCount} times`);
      }
      // ... existing
    }),
  );
```

### 6.5 Drag FPS measurement

```ts
// Em useNodeDragParenting.ts handlePositionChange
const lastDragFrame = useRef(0);
// No início de handlePositionChange quando change.dragging === true:
const now = performance.now();
if (lastDragFrame.current) {
  const fps = 1000 / (now - lastDragFrame.current);
  if (fps < 30) console.warn(`Drag FPS dropped to ${fps.toFixed(0)}`);
}
lastDragFrame.current = now;
```

### 6.6 History clone cost

```ts
// Em pushHistory, temporariamente:
const t0 = performance.now();
state.past.push({
  diagramId: d.id,
  timestamp: Date.now(),
  snapshot: deepClone(d.snapshot),
  nodeLayouts: deepClone(d.nodeLayouts),
});
const t1 = performance.now();
if (t1 - t0 > 5) console.warn(`pushHistory clone took ${(t1-t0).toFixed(1)}ms`);
```

---

## 7. Código Exemplo (Top 5)

### Exemplo 1: Memoize HandleHighlightProvider value (F2)

```tsx
// Canvas.tsx — dentro do componente Canvas, antes do return

const highlightContextValue = useMemo(
  () => ({
    highlightedConnectionId: visualState.highlightedConnectionId,
    highlightedNodeIds: visualState.highlightedNodeIds,
    setHighlight: visualState.setHighlight,
    clearHighlight: visualState.clearHighlight,
  }),
  [
    visualState.highlightedConnectionId,
    visualState.highlightedNodeIds,
    visualState.setHighlight,
    visualState.clearHighlight,
  ],
);

// No JSX:
return (
  <HandleHighlightProvider value={highlightContextValue}>
    {/* ... */}
  </HandleHighlightProvider>
);
```

---

### Exemplo 2: Fix multi-select race condition (F3)

```tsx
// useCanvasEventHandlers.ts

// Adicionar no topo da função:
const metaClickActiveRef = useRef(false);

// Modificar onNodeClick:
const onNodeClick = useCallback(
  (e: React.MouseEvent, node: Node) => {
    setQuickInsert(null);
    // ... existing endpoint / recording checks ...

    if (e.metaKey || e.ctrlKey) {
      metaClickActiveRef.current = true;
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        prevSelectionRef.current = [...next].sort().join(",");
        setSelectedNodeId(
          next.size === 0
            ? null
            : next.has(node.id)
              ? node.id
              : (next.values().next().value ?? null),
        );
        return next;
      });
      // Allow React Flow's internal selection to settle before
      // re-enabling onSelectionChange sync
      requestAnimationFrame(() => {
        metaClickActiveRef.current = false;
      });
    } else {
      prevSelectionRef.current = node.id;
      setSelectedNodeIds(new Set([node.id]));
      setSelectedNodeId(node.id);
    }
  },
  [/* existing deps */],
);

// Modificar onSelectionChange:
const onSelectionChange = useCallback(
  ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    // Skip if a meta-click just set selection programmatically
    if (metaClickActiveRef.current) return;
    
    const selectedIds = updatedNodes.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) return;
    if (isCompareMode) return;
    const key = [...selectedIds].sort().join(",");
    if (key === prevSelectionRef.current) return;
    prevSelectionRef.current = key;

    setSelectedEdgeId(null);
    setContextMenu(null);
    setSelectedNodeIds(new Set(selectedIds));
    setSelectedNodeId(selectedIds[0] ?? null);
  },
  [isCompareMode, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId, setContextMenu],
);
```

---

### Exemplo 3: Memoize CollabProvider context value (F5)

```tsx
// CollabProvider.tsx — antes do return

const isGuestComputed = isHost ? false : session !== null && !session.isHost;

const contextValue = useMemo<CollabContextValue>(
  () => ({
    session,
    isReady,
    status,
    isGuest: isGuestComputed,
    sessionClosedByHost,
    hostDisconnected,
    closeSession: handleCloseSession,
    provider: null,
    ydoc: null,
    collabUrl,
    updateCursor,
    updateSelectedNode,
    updateViewport,
    updateEditingComponent,
    editingComponents,
    peerLimitReached,
  }),
  [
    session,
    isReady,
    status,
    isGuestComputed,
    sessionClosedByHost,
    hostDisconnected,
    handleCloseSession,
    collabUrl,
    updateCursor,
    updateSelectedNode,
    updateViewport,
    updateEditingComponent,
    editingComponents,
    peerLimitReached,
  ],
);

return (
  <CollabContext.Provider value={contextValue}>
    {children}
  </CollabContext.Provider>
);
```

---

### Exemplo 4: Split sort de visibleComponents (F1 parcial)

```tsx
// useCanvasNodes.ts — substituir o useMemo monolítico

// Step 1: Sort estável (só depende de dados estruturais)
const sortedComponents = useMemo(() => {
  return [...visibleComponents].sort((a, b) => {
    const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
    const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;
    if (aIsGroup && bIsGroup) {
      if (b.parentId === a.id) return -1;
      if (a.parentId === b.id) return 1;
    }
    return 0;
  });
}, [visibleComponents]);

// Step 2: Build nodes (usa sortedComponents + visual state)
return useMemo(() => {
  if (!diagram || !nodeCtxBase) return [];
  const { highlightedNodeIds: hIds, isViewingCoverage: viewingCov, ...ctxBaseForBuild } = nodeCtxBase;
  const ctx: NodeBuildContext = { ...ctxBaseForBuild, ...nodeCtxPlayback };
  const collapsedPanelIds = buildCollapsedPanelIds(nodeCtxBase.resolvedComponents);
  const compareVisual = nodeCtxBase.compareVisualByComponentId;
  const isCmp = nodeCtxBase.isCompareMode ?? false;

  return sortedComponents.map((comp): Node => {
    // ... existing map body unchanged ...
  });
}, [
  diagram,
  nodeCtxBase,
  nodeCtxPlayback,
  sortedComponents,
  isNodeHiddenByTagFilter,
  pendingNodeIds,
]);
```

---

### Exemplo 5: useCanvasEffects wheel handler fix (F9)

```tsx
// useCanvasEffects.ts

// Substituir o useEffect do wheel handler:
const hasDiagram = !!diagram;

useEffect(() => {
  const el = document.querySelector(".react-flow__renderer");
  if (!el || !hasDiagram) return;

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y, zoom } = reactFlowInstance.getViewport();

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      reactFlowInstance.setViewport(
        { x, y, zoom: Math.min(MAX_ZOOM, Math.max(VIEWPORT_MIN_ZOOM, zoom * factor)) },
        { duration: 0 },
      );
    } else if (e.shiftKey) {
      reactFlowInstance.setViewport(
        { x: x - e.deltaY, y, zoom },
        { duration: 0 },
      );
    } else {
      reactFlowInstance.setViewport(
        { x, y: y - e.deltaY, zoom },
        { duration: 0 },
      );
    }
  };

  el.addEventListener("wheel", handleWheel, { passive: false });
  return () => el.removeEventListener("wheel", handleWheel);
}, [reactFlowInstance, hasDiagram]);
// ^^^ hasDiagram (boolean) em vez de diagram (object ref)
```

---

## Observações Finais

### O que está bem resolvido ✅

1. **`nodeTypes` e `edgeTypes`** são constantes module-level — não causam re-render do ReactFlow.
2. **`useLocalNodes`** merge logic é robusta — drag buffer, undo/redo detection, scene lock.
3. **`getCachedCanvasSnapshot` WeakMap** — boa estratégia; Immer replacement invalida cache naturalmente.
4. **`useCanvasConnectionDerivations`** — cada derivação tem seu próprio `useMemo` com deps precisas.
5. **`useFlowState`** — `EMPTY_FLOW_HIGHLIGHT` constant é boa; `useMemo` com deps corretas.
6. **`FlowModeProvider`** — value é `useMemo`'d (diferente dos outros providers).
7. **`useCanvasVisualState`** — `clearHighlight` e `clearCanvasSelection` fazem identity checks (`prev === null ? prev : null`) para evitar re-renders desnecessários.
8. **`onMoveEnd`** (não `onMove`) para viewport persistence — correto, evita spam.
9. **`commitNodeDrag`** como operação atômica (single pushHistory) — correto.
10. **Coalesce** de 1s para soft mutations no history — eficaz.

### Hipóteses que precisam de profiling

1. Custo real do `deepClone` com 500+ nós (F7) — precisa medir em device real.
2. Impacto real do `FlowModeContext` re-render durante playback (possível Onda 3).
3. Custo da comparação `useShallow` em `useVisibleComponents` com 500 componentes.
4. Se `buildData` closure allocation (F6) é o bottleneck principal ou se é o sort/map do F1.

# Análise Detalhada — Store, Canvas, Hooks e Panel System

## Sumário Executivo

Após análise aprofundada de ~40 arquivos do codebase (store slices, canvas hooks, node descriptors, parenting logic, drag pipeline), identifiquei **7 bugs prováveis** que explicam os problemas visuais de posição com Panels aninhados, **3 fontes de loops/re-renders desnecessários**, **5 áreas de dead code**, e **12 oportunidades de melhoria arquitetural**. 

---

## PARTE 1 — BUGS DE POSIÇÃO DO PANEL

### Bug 1: `findPanelContainingPoint` não resolve posições absolutas de painéis aninhados corretamente

**Arquivo:** `src/features/canvas/models/panelParenting.ts:39-69`

O `findPanelContainingPoint` usa `panels.find()` — retorna o **primeiro** panel que contém o ponto. Quando há panels dentro de panels, a ordem de iteração dos `nodes` determina qual panel é selecionado. Como o array `nodes` é derivado de `visibleComponents` (que é sorted em `useCanvasNodes` colocando panels primeiro, pais antes de filhos), **o panel pai externo é encontrado antes do panel filho interno**.

```typescript
// panelParenting.ts:50
return panels.find((panel) => {  // ← find() retorna o PRIMEIRO match
  // ...
});
```

**Impacto:** Ao dropar um nó dentro de um panel aninhado (panel B dentro de panel A), o nó é parented ao panel A (o externo) em vez do panel B (o mais interno e mais específico). Isso causa o "salto" visual de posição.

**Correção:** Trocar `find` por um algoritmo que selecione o panel **mais interno** (menor área, ou maior profundidade na árvore):

```typescript
// Encontrar todos os panels que contêm o ponto, retornar o mais interno
const candidates = panels.filter(panel => { /* hit test */ });
if (candidates.length === 0) return undefined;
// Retornar o que tem menor área (mais interno) ou maior depth
return candidates.reduce((best, p) => {
  const bestDim = getPanelDimensions(best);
  const pDim = getPanelDimensions(p);
  return (pDim.width * pDim.height) < (bestDim.width * bestDim.height) ? p : best;
});
```

---

### Bug 2: `resolveAbsolutePosition` usa `components` da store (snapshot) em vez dos `nodeLayouts` atuais durante drag

**Arquivo:** `src/features/canvas/hooks/useNodeDragParenting.ts:134-139` e `src/features/canvas/models/panelParenting.ts:95-112`

Durante o drag (`handlePositionChange`), o código chama `resolveAbsolutePosition` com `r.nodeLayouts` da **store** (via `getCachedCanvasSnapshot`). Mas o drag está acontecendo nos **localNodes** — as posições no local buffer podem ser significativamente diferentes das posições na store (que só atualiza no `dragStop`).

```typescript
// useNodeDragParenting.ts:134
const absolutePosition = resolveAbsolutePosition(
  change.id,
  change.position,
  r.components,     // ← from store snapshot
  r.nodeLayouts,    // ← from store snapshot, NOT local drag positions
);
```

**Impacto:** Quando um panel pai está sendo movido ou foi recentemente movido, a posição absoluta calculada para os filhos usa a posição **anterior** do pai (da store), não a posição visual atual. Isso faz o hit-test de `findPanelContainingPoint` errar o alvo, e os filhos "perdem a referência" do pai.

**Correção:** Passar os localNodes como source de posição, ou manter um ref com as posições locais atualizado a cada frame de drag.

---

### Bug 3: `onNodeDragStop` — `persistSelectedChildren` e `persistOtherSelectedNodes` usam `updateNodeLayout` em vez de `commitNodeDrag`

**Arquivo:** `src/features/canvas/hooks/useNodeDragParenting.ts:246-283`

Quando múltiplos nodes são selecionados e arrastados, o node principal passa por `commitNodeDrag` (atômico: pushHistory + parentId + position), mas os **outros nodes selecionados** passam por `updateNodeLayout` que **não faz pushHistory e não atualiza parentId**.

```typescript
const persistOtherSelectedNodes = () => {
  // ...
  for (const node of otherSelectedNodes) {
    // ...
    updateNodeLayout(node.id, node.position);  // ← SEM pushHistory, SEM parentId check
  }
};
```

**Impacto:** 
1. Ao arrastar um grupo de nodes para dentro de um panel, **apenas o node principal** é reparented. Os outros ficam com parentId=null mas com posição absoluta.
2. Se o usuário der undo, o node principal volta, mas os outros ficam na posição nova (inconsistência).

**Correção:** Cada node selecionado precisa de reparenting check no drag stop — todos devem usar uma variante de `commitNodeDrag` ou uma ação batch.

---

### Bug 4: Posição relativa não é recalculada ao mover panel pai

**Arquivo:** `src/features/canvas/hooks/useNodeDragParenting.ts:69-167` (handlePositionChange)

Quando um panel é arrastado, o ReactFlow move automaticamente os filhos (porque têm `parentId` no React Flow). Mas o `handlePositionChange` é chamado para **cada** change, incluindo os filhos. O código filtra endpoints (`isEndpointComponent`) mas não filtra **outros filhos** do panel sendo movido.

O React Flow envia position changes para filhos com posições **relativas** (já que estão em `extent: "parent"`). Mas o código tenta fazer hit-test de parenting para esses filhos como se fossem nós independentes, e pode tentar reparentá-los para o panel avô.

```typescript
// useNodeDragParenting.ts:128
if (!comp || isNoteComponent(comp) || isEndpointComponent(comp)) return;
// ← Notes e endpoints são filtrados, mas filhos de panel NÃO são
```

**Impacto:** Durante drag de panel, os filhos recebem chamadas desnecessárias de `setDragTargetPanelId` e `setUnparentCandidatePanelId`, causando re-renders visuais com bordas laranja piscando e, potencialmente, reparenting errado.

**Correção:** Ao detectar que o node sendo arrastado é filho de um panel que **também** está sendo arrastado (via `draggingNodeIdsRef`), pular o processamento de parenting para ele.

---

### Bug 5: `commitNodeDrag` no `component-parenting.slice` — race condition com scene-mode

**Arquivo:** `src/features/diagram/store/slices/component-parenting.slice.ts:41-75`

O `commitNodeDrag` resolve o layout target com lógica condicional:

```typescript
const layoutTarget = scene?.addedComponents[nodeId]
  ? scene!.nodeLayouts
  : d.nodeLayouts;
```

Mas o `comp` é resolvido com uma lógica diferente:

```typescript
const comp = scene?.addedComponents[nodeId] ?? d.snapshot.components[nodeId];
```

Se um componente existe em `d.snapshot.components` mas **não** em `scene.addedComponents`, o `comp` é encontrado (do base snapshot), o parentId é atualizado no **base snapshot** (mutação proibida em scene mode), mas o layout é atualizado em `d.nodeLayouts` (correto para o base, mas inconsistente porque o guard no topo deveria ter bloqueado).

**Impacto:** Em scene mode, componentes do base snapshot podem ter seu parentId silenciosamente mutado sem ser capturado no SceneDiff.

**Correção:** Após o guard `if (scene && !scene.addedComponents[nodeId]) return;`, o fallback `d.snapshot.components[nodeId]` nunca deveria ser atingido. Porém, se o guard for bypassed (e.g., componente foi adicionado à scene entre verificações), a mutação corrompe o base.

---

### Bug 6: `useCanvasNodes` — sort de panels aninhados é incompleto

**Arquivo:** `src/features/canvas/nodes/useCanvasNodes.ts:223-234`

O sorting coloca panels/apiGroups antes de nodes normais, e tenta ordenar pai antes de filho:

```typescript
.sort((a, b) => {
  const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
  const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
  if (aIsGroup && !bIsGroup) return -1;
  if (!aIsGroup && bIsGroup) return 1;
  if (aIsGroup && bIsGroup) {
    if (b.parentId === a.id) return -1;  // a é pai de b → a vem primeiro
    if (a.parentId === b.id) return 1;   // b é pai de a → b vem primeiro
  }
  return 0;
});
```

**Problema:** Isso só funciona para **um nível** de aninhamento. Com panels dentro de panels dentro de panels (3+ níveis), o sort comparativo não garante a ordem topológica correta. O comparador não é transitivo: se A contém B contém C, a comparação A↔C retorna 0 (não são pai/filho direto), podendo resultar em C antes de A.

**Impacto:** React Flow precisa que nós pai venham antes de nós filho no array. Se a ordem está errada, o `parentId` referencia um nó que ainda não foi renderizado, causando posicionamento incorreto ou nó invisível.

**Correção:** Usar um sort topológico completo baseado na cadeia `parentId`, não apenas comparação direta pai/filho:

```typescript
function getDepth(comp: Component, comps: Record<string, Component>): number {
  let depth = 0;
  let current = comp;
  while (current.parentId && comps[current.parentId]) {
    depth++;
    current = comps[current.parentId];
  }
  return depth;
}
// sort por: groups primeiro, depois por depth crescente
```

---

### Bug 7: `isOutsideParentBounds` não considera dimensões do filho

**Arquivo:** `src/features/canvas/models/panelParenting.ts:26-37`

```typescript
export function isOutsideParentBounds(
  childPos: { x: number; y: number },
  parent: Node,
): boolean {
  const { width, height } = getPanelDimensions(parent);
  return (
    childPos.x < 0 ||
    childPos.y < 0 ||
    childPos.x > width ||   // ← compara POSIÇÃO do filho, não bounding box
    childPos.y > height
  );
}
```

Apenas a posição (canto superior esquerdo) do filho é verificada. Se o filho é grande (e.g., outro panel), pode ter seu canto superior esquerdo dentro do pai mas 80% do corpo fora. O usuário arrasta "para fora", mas a posição (0,0 relativa) ainda está dentro → o filho não é unparented.

**Correção:** Considerar `childPos.x + childWidth > parentWidth` com margem de tolerância.

---

## PARTE 2 — LOOPS E PROBLEMAS DE PERFORMANCE

### Loop 1: `useCanvasVisualState` — `clearHighlight` cria instabilidade referencial controlada mas `emptySet` pode causar edge case

**Arquivo:** `src/features/canvas/hooks/useCanvasVisualState.ts:83-93`

```typescript
const emptySet = useRef(new Set<string>()).current;

const clearHighlight = useCallback(() => {
  setHighlightedConnectionId((prev) => prev === null ? prev : null);
  setHighlightedNodeIds((prev) => prev.size === 0 ? prev : emptySet);
}, [emptySet]);
```

O `emptySet` é reutilizado (boa otimização), mas `clearCanvasSelection` chama `setSelectedNodeIds((prev) => prev.size === 0 ? prev : emptySet)` — o mesmo `emptySet` ref. Se algo externo faz `emptySet.add("x")` (improvável, mas possível via closure leak), isso corrompe silenciosamente todas as futuras comparações de "está vazio?".

**Risco:** Baixo, mas se ocorrer, causa loop infinito de re-renders porque `prev.size === 0` retorna false quando `emptySet` foi mutado.

---

### Loop 2: `useCanvasNodes` — `useMemo` depende de `visibleComponents` que é recriado a cada mudança

**Arquivo:** `src/features/canvas/nodes/useCanvasNodes.ts:312-319`

A dependency list do `useMemo` final inclui `visibleComponents`. No seletor `useVisibleComponents`, é provável que retorne um novo array a cada Zustand state update (mesmo que o conteúdo não mude), porque `Object.values()` cria novo array.

```typescript
// Provavelmente no selector:
useVisibleComponents = () => useDiagramStore(
  useShallow(s => Object.values(getCachedCanvasSnapshot(d).components).filter(...))
);
```

**Impacto:** Cada mutação na store (incluindo posição de viewport, que é debounced mas frequente) causa recalculação de **todos os nodes**. Para diagramas grandes (50+ componentes), isso é perceptível.

**Correção:** Usar `useShallow` nos selectors que retornam arrays (já usado em alguns, verificar todos), e/ou memoizar o array de visible components por referência.

---

### Loop 3: `useCanvasGraphState` — recriação de `onSelectionFromChanges` causa cadeia de re-renders

**Arquivo:** `src/features/canvas/hooks/useCanvasGraphState.ts:144-153`

```typescript
const onSelectionFromChanges = useCallback(
  (selectedIds: string[]) => {
    // ...
    visualState.setSelectedNodeIds(new Set(selectedIds));  // ← new Set a cada call
    visualState.setSelectedNodeId(selectedIds[0] ?? null);
  },
  [visualState],  // ← visualState é um OBJETO que muda toda vez
);
```

`visualState` é o retorno de `useCanvasVisualState`, que retorna um novo objeto literal a cada render. Isso faz `onSelectionFromChanges` ser recriado a cada render, o que invalida `useLocalNodes` que o consome como dependency.

**Correção:** Desestruturar os setters usados e colocá-los na dependency list:

```typescript
const { setSelectedNodeIds, setSelectedNodeId, setSelectedEdgeId, setContextMenu } = visualState;
const onSelectionFromChanges = useCallback(
  (selectedIds: string[]) => { ... },
  [setSelectedNodeIds, setSelectedNodeId, setSelectedEdgeId, setContextMenu],
);
```

---

## PARTE 3 — DEAD CODE

### Dead Code 1: `onNoteStartEdit` e `onJsonViewerStartEdit` são no-ops

**Arquivo:** `src/features/canvas/hooks/useCanvasController.ts:36-42`

```typescript
const onNoteStartEdit = useCallback((_noteId: string) => {
  // Ensures note `data.onStartEdit` exists so NoteNode can replace it with inline edit.
  // Double-click invokes the patched handler on `node.data`.
}, []);
const onJsonViewerStartEdit = useCallback((_nodeId: string) => {
  // Ensures json-viewer `data.onStartEdit` exists so JsonViewerNode can replace it.
}, []);
```

São callbacks vazios que existem apenas para satisfazer a tipagem. Passam pela cadeia `useCanvasInteraction → useCanvasGraphState → useCanvasNodes → NodeBuildContext` sem efeito. O NoteNode e JsonViewerNode sobrescrevem via `data` override interno, tornando esses callbacks desnecessários.

---

### Dead Code 2: `void get` pattern nos slices

**Arquivo:** `src/features/diagram/store/slices/component-parenting.slice.ts:24,47`

```typescript
setParent: (childId: string, parentId: string | null) => {
  void get;  // ← Silencia "unused parameter" mas get NUNCA é usado
  set((state) => { ... });
},
```

Aparece em `setParent`, `commitNodeDrag`, `groupNodes`, `ungroupNodes`. A assinatura de slice requer `(set, get)` mas vários métodos não usam `get`.

---

### Dead Code 3: `OPACITY_DIM` e `OPACITY_RECORDING_DIM` em `canvas.constants.ts`

**Arquivo:** `src/features/canvas/canvas.constants.ts:2-3`

```typescript
export const OPACITY_DIM = 0.25;
export const OPACITY_RECORDING_DIM = 0.35;
```

Grep no codebase mostra que `OPACITY_DIM` e `OPACITY_RECORDING_DIM` **não são importados** por nenhum outro arquivo. O valor `0.3` é usado hardcoded em `OPACITY_FLOW_PLAYBACK_NODE_DIM` e o recording usa lógica inline.

---

### Dead Code 4: `isCanvasStructuralType` e `isCanvasApiType`

**Arquivo:** `src/features/diagram/model/component-type-constants.ts:104-109`

São exportados no index mas provavelmente não usados no codebase (functions compostas de guards que são usados diretamente por serem mais específicos).

---

### Dead Code 5: `CANVAS_PANEL_NOTE_TYPES` e `CANVAS_API_TYPES` arrays

**Arquivo:** `src/features/diagram/model/component-type-constants.ts:31-34`

Exportados mas provavelmente sem importadores — os type guards individuais (`isPanelType`, `isNoteType`) são preferidos.

---

## PARTE 4 — OPORTUNIDADES DE REUSO E MELHORIA ARQUITETURAL

### Melhoria 1: Extrair `resolveAbsolutePositionFromNodes` com suporte a local positions

Atualmente, `resolveAbsolutePosition` aceita `components + nodeLayouts` (da store). Para drag, precisa aceitar as posições dos `localNodes`. Criar um overload:

```typescript
export function resolveAbsolutePositionFromNodeArray(
  nodeId: string,
  nodes: Node[],
): { x: number; y: number } {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return { x: 0, y: 0 };
  if (!node.parentId) return node.position;
  const parentAbs = resolveAbsolutePositionFromNodeArray(node.parentId, nodes);
  return { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
}
```

---

### Melhoria 2: Unificar padrão de badge (SceneBadge / CollabHighlight / DragTarget)

`PanelNode.tsx` e `SwimlaneNode.tsx` têm blocos praticamente idênticos para:
- `collabHighlight` overlay
- `activePeer` presence
- `compareBadges` / `sceneBadge`
- `isDragTarget` glow
- `isUnparentCandidate` border

Extrair um `<NodeOverlayEffects />` componente compartilhado que recebe essas props e renderiza os overlays. Reduz ~40 linhas duplicadas entre PanelNode e SwimlaneNode.

---

### Melhoria 3: `useNodeDragParenting` — separar responsabilidades

O hook faz demais: tracking de drag state, hit-testing de panels, cálculo de posição absoluta, persisting de multi-selection, toast de lock. Separar em:

1. `useDragTracking` — gerencia `draggingNodeIdsRef`, `dragStopPendingNodeIdsRef`
2. `usePanelHitTest` — calcula `dragTargetPanelId`, `unparentCandidatePanelId`
3. `useNodeDragCommit` — executa o commit no drag stop
4. `useMultiNodeDragPersist` — persiste posições de nós selecionados secundários

---

### Melhoria 4: `panelDescriptor.buildData` — `childCount` é O(n) a cada render

```typescript
childCount: Object.values(ctx.resolvedComponents).filter(
  (c) => c.parentId === comp.id,
).length,
```

Isso é chamado para **cada panel** a cada render. Para diagramas com 200 componentes e 10 panels, são 2000 iterações por render. Pré-computar um `childrenIndex` (já existe `buildChildrenIndex`) e passá-lo via `NodeBuildContext`.

---

### Melhoria 5: `useCanvasVisualState` retorna objeto literal instável

O hook retorna um novo objeto a cada render. Todos os consumidores que usam `visualState` como dependency de `useCallback`/`useMemo` sofrem recriação desnecessária.

**Correção:** Usar `useMemo` no retorno:

```typescript
return useMemo(() => ({
  selectedNodeId,
  setSelectedNodeId,
  // ... etc
}), [selectedNodeId, setSelectedNodeId, /* ... stable refs */]);
```

Ou melhor, dado que os setters do `useState` são estáveis: retornar o objeto memoizado em duas partes — state values (mudam) e actions (estáveis):

```typescript
const state = useMemo(() => ({ selectedNodeId, selectedNodeIds, ... }), [...]);
const actions = useRef({ setSelectedNodeId, ... }).current;
return { ...state, ...actions };
```

---

### Melhoria 6: `constants.ts` re-exporta tudo de `@/features/diagram`

**Arquivo:** `src/features/canvas/constants.ts`

Este arquivo apenas re-exporta constantes do diagram feature. Consumidores poderiam importar diretamente de `@/features/diagram`. O arquivo existe para conveniência mas adiciona indireção sem valor. Candidato a remoção.

---

### Melhoria 7: `useCanvasController` é God Hook

**Arquivo:** `src/features/canvas/hooks/useCanvasController.ts`

Com 153 linhas, este hook orquestra **tudo**: store, visual state, collab, compare, flow, interaction, graph, keyboard, effects. É a raiz de quase todos os re-renders do canvas.

Considerar decomposição em sub-controllers especializados que são compostos no nível do `Canvas.tsx`:

```typescript
// Canvas.tsx
const coreState = useCanvasCoreState();    // diagram, actions, resolved
const visual = useCanvasVisualController(); // selection, highlight, context menu
const graph = useCanvasGraphController();   // nodes, edges, onNodesChange
const features = useCanvasFeatures();       // flow, compare, scenes, collab
```

---

### Melhoria 8: `getCachedCanvasSnapshot` WeakMap cache pode ter false negatives com Immer

**Arquivo:** `src/features/diagram/utils/snapshot-cache.ts`

O cache usa `WeakMap<Diagram, ResolvedSnapshot>`. Immer produz um novo objeto Diagram a cada mutação (correto para invalidação). Porém, múltiplas chamadas a `getCachedCanvasSnapshot` no **mesmo tick** com o **mesmo** diagram ref aproveitam o cache. Isso é bom.

Porém, se houver mutações **dentro do mesmo render** (e.g., batch updates do Zustand), cada uma cria um novo Diagram ref, e o snapshot anterior no cache nunca será coletado pelo GC até o Diagram anterior ser GC'd. Com undo/redo frequente, pode haver dezenas de resolved snapshots retidos.

**Sugestão:** Considerar um LRU cache com tamanho máximo de 3-5 entries em vez de WeakMap ilimitado.

---

### Melhoria 9: `deepClone` via JSON.parse/stringify no history

**Arquivo:** `src/features/diagram/store/slices/history.slice.ts:13`

```typescript
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
```

Para diagramas grandes, `JSON.stringify` + `JSON.parse` é lento (10-50ms para 500+ componentes). `structuredClone` (disponível em todos os browsers modernos) é ~2x mais rápido para objetos grandes e preserva mais tipos.

---

### Melhoria 10: Batch de position updates durante multi-node drag

Em `persistOtherSelectedNodes` e `persistSelectedChildren`, cada nó recebe uma chamada individual a `updateNodeLayout`. Cada chamada dispara `set()` no Zustand → nova derivação Immer → novo state. Para 10 nós selecionados, são 10 state updates em sequência.

**Correção:** Criar um `batchUpdateNodeLayouts(updates: Array<{id, position}>)` que faz tudo em um único `set()`.

---

### Melhoria 11: `handlePositionChange` chama `setDragTargetPanelId` (setState) para cada pixel de drag

**Arquivo:** `src/features/canvas/hooks/useNodeDragParenting.ts:162-165`

```typescript
if (newTarget !== dragTargetRef.current) {
  dragTargetRef.current = newTarget;
  setDragTargetPanelId(newTarget);  // ← setState a cada mudança de target
}
```

O guard `newTarget !== dragTargetRef.current` evita calls redundantes, mas quando o nó passa por múltiplos panels rapidamente, cada transição causa re-render de toda a árvore que consome `dragTargetPanelId`.

**Otimização:** Debounce o `setDragTargetPanelId` com 50ms, mantendo apenas o `ref` atualizado em tempo real para lógica interna.

---

### Melhoria 12: `useCanvasNodes` tem 30+ dependencies no useMemo principal

**Arquivo:** `src/features/canvas/nodes/useCanvasNodes.ts:161-191`

O `nodeCtxBase` useMemo tem ~22 dependencies. Qualquer mudança em qualquer uma delas recalcula todos os contextos de build. Considerar quebrar em:
- `layoutContext` (resolvedNodeLayouts, resolvedComponents — muda em drag)
- `selectionContext` (selectedNodeId, selectedNodeIds, highlightedNodeIds — muda em click)
- `featureContext` (compare, scene, flow — muda raramente)

---

## PARTE 5 — RESUMO DE PRIORIDADES

| Prioridade | Item | Impacto |
|:---:|---|---|
| 🔴 P0 | Bug 1 — `find` vs `findSmallest` em panels aninhados | Causa direta dos bugs de posição |
| 🔴 P0 | Bug 2 — posições da store vs local durante drag | Causa filhos "perdendo referência" |
| 🔴 P0 | Bug 6 — sort topológico incompleto para 3+ níveis | Nós podem ficar invisíveis |
| 🟠 P1 | Bug 3 — multi-select drag sem reparenting | Inconsistência em grupo |
| 🟠 P1 | Bug 4 — filhos do panel processados no handlePositionChange | Flickering visual |
| 🟠 P1 | Loop 3 — `visualState` como dependency instável | Re-renders em cascata |
| 🟡 P2 | Bug 7 — isOutsideParentBounds sem dimensão do filho | UX ruim para panels grandes |
| 🟡 P2 | Loop 2 — visibleComponents re-criado | Performance em diagramas grandes |
| 🟡 P2 | Melhoria 4 — childCount O(n) | Performance |
| 🟢 P3 | Melhoria 5 — estabilizar retorno de useCanvasVisualState | Performance |
| 🟢 P3 | Melhoria 9 — structuredClone vs JSON | Performance undo/redo |
| 🟢 P3 | Dead Code 1-5 — limpeza | Mantenabilidade |
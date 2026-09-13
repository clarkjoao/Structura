# EdgeLabelRenderer, shallowEqualRecord e useNodeDragParenting

Notas a partir dos commits de perf do canvas (set/2026):

- `a91147a` — um `EdgeLabelRenderer` por canvas
- `079d0b4` — identidade estável de edges + `shallowEqualRecord`
- `5c14bb4` / `fb1b40b` / `9e1a22d` — hot path e commit de drag parenting

Relacionado: [canvas-engine.md](./canvas-engine.md), [node-system.md](./node-system.md),
[canvas-hot-path.md](./canvas-hot-path.md) (English rules + remaining opportunities).

---

## 1. O que é e o que faz o `EdgeLabelRenderer`?

### No React Flow

`<EdgeLabelRenderer>` (de `@xyflow/react`) é o portal oficial para UI “colada” a edges — labels, toolbars, highlights — mas **fora** do SVG das arestas.

Ele:

1. Assina o store interno do React Flow.
2. Em cada notificação, resolve o DOM com um seletor do tipo  
   `domNode?.querySelector('.react-flow__edgelabel-renderer')`.
3. Renderiza os filhos nesse container (posição absoluta no plano do viewport, não dentro do path da edge).

Sem isso, labels/toolbars ficariam presos ao SVG da edge (clipping, `pointer-events` ruins, z-index difícil).

### Por que Structura não monta um por edge

Cada instância é um subscriber que roda `querySelector` em **toda** notificação do store. Em drag, `setNodes` notifica o store a cada frame.

Antes: um renderer por edge (label, toolbar, collab highlight, overlay de playback…) → em um diagrama ~400 nós / ~439 edges, **~439 `querySelector` por frame** (~291 ms de um gesto de ~2.1 s).

### O padrão atual: um host, N portals

| Peça | Papel |
| --- | --- |
| `EdgeLabelPortalProvider` | Cria um `div` detached e o expõe via context |
| `EdgeLabelPortalHost` | Único `<EdgeLabelRenderer>` no canvas; anexa o container ao renderer do RF |
| `EdgeLabelPortal` | Drop-in nos componentes de edge: `createPortal(children, container)` |

Montagem em `Canvas.tsx` (dentro de `<ReactFlow>`, sob o provider). Consumidores: `EdgeLabel`, `EdgeToolbar`, `CollabEdgeHighlight`, overlays de playback em `EditableEdge`, etc.

**Regra:** só `EdgeLabelPortal.tsx` importa `EdgeLabelRenderer` de `@xyflow/react`. O restante usa `EdgeLabelPortal`. Há teste que caminha `features/canvas` e falha se alguém reintroduzir o import direto.

Medido depois: ~1.4 `querySelector`/frame e self-time de ~4.3 ms no mesmo fixture.

**Armadilha (já corrigida):** o host precisa anexar o container com **ref callback**, não com `useEffect([container])`. Na primeira paint o `EdgeLabelRenderer` muitas vezes ainda retorna `null` (`domNode` do RF não pronto); depois ele portaliza o mount **sem** re-renderizar o host. Um effect nesse caso roda uma vez com `mount === null` e nunca anexa — toolbar/labels ficam num nó detached e somem. Isso **não** foi remoção intencional da toolbar.

---

## 2. Quando e por que `shallowEqualRecord`?

Definida **só** em `useCanvasEdges.ts` (função local, não exportada).

Compara dois records pelas **own keys** e igualdade referencial dos valores (`===`). Não é deep equal.

### Por quê

`buildEdge` aloca objetos novos a cada chamada (`data`, `style`, `markerEnd`, `markerStart`). Sem estabilizar:

1. Todo edge vira objeto novo.
2. React Flow remonta a camada de edges.
3. Portals de label remountam → churn de DOM.

Um commit de drag com 439 edges gerava milhares de `childList` mutations **só** por edges/labels, sem criar/remover nodes.

### Quando roda

Dentro do `useMemo` de `useCanvasEdges`, **depois** de `buildEdge`, para cada connection visível:

1. Compara nested objects com o cache (`prevPartsRef`) via `shallowEqualRecord`.
2. Se iguais → reusa a referência antiga.
3. `isSameBuiltEdge` pode então ser comparação por referência nos nested fields.
4. Se **todos** os edges batem com o array anterior → devolve o **mesmo** array (`prevArrayRef`).

Isso espelha o cache de identidade que `useCanvasNodes` já tinha para nodes.

### Quando **não** importa

- Durante o frame de drag: o store do diagrama não escreve; `useCanvasEdges` não rebuilda por causa do gesto.
- No **commit** do drag e em qualquer outro `set()` do store: é exatamente aí que a identidade estável evita remount em massa.

Se o conteúdo de `data`/`style`/markers mudou de verdade, `shallowEqualRecord` falha → objeto novo → edge novo (só o que mudou).

---

## 3. Quando `useNodeDragParenting` é usado — e quando não?

### O que faz

Hook de **contenção em painéis** (parent/unparent) no editor:

| Durante o drag | No soltar (`onNodeDragStop`) |
| --- | --- |
| Detecta painel sob o cursor → `dragTargetPanelId` (highlight) | Calcula `newParentId` + posição relativa |
| Detecta saída do pai → `unparentCandidatePanelId` | Um `batchCommitNodeDrag` para **todos** os nós do gesto |
| Flush de dimensões medidas → `batchUpdateNodeLayouts` | Recusa painel virar filho do próprio descendente |

Também: bloqueia move em scene mode (`canMoveNodeInSceneMode`), nós locked / ancestral locked (toast), e ignora endpoints no path de parenting.

Índice de gesto (`GesturePanelIndex`): montado **uma vez** no primeiro frame; frames seguintes são O(1) lookup (não re-filtram a lista de nodes).

### Quando **é** usado

Sempre no canvas **editável**, via `useCanvasInteraction` → `useCanvasController`:

- `onNodesChange` (position + dimensions)
- `onNodeDragStop`
- `dragTargetPanelId` / `unparentCandidatePanelId` → descriptors de panel/swimlane (`isDragTarget`, `isUnparentCandidate`)

Ou seja: usuário arrasta nós no editor com `nodesDraggable` ligado.

### Quando **não** aplica (comportamento / early return)

O hook **está montado** no editor, mas a lógica de parenting **não age** (ou só faz layout) nestes casos:

| Situação | Efeito |
| --- | --- |
| **Endpoint** | Ignorado no drag parenting e no drag stop |
| **Note** (enquanto `dragging`) | Sem candidate de parent no frame |
| **Locked** / ancestral locked | Toast; sem update de layout/parent |
| **Scene mode** bloqueia move | Toast / return |
| Filho arrastado **junto com o painel pai** | Position do filho ignorada no frame (pai move o grupo) |
| **Viewer** / read-only | Hook **não** é montado; context força `dragTargetPanelId` / `unparentCandidatePanelId` = `null` |
| `nodesDraggable={false}` (playback, compare sem edit, etc.) | Sem gesto de drag → parenting não dispara |

Parenting de verdade só no **drag stop**. Frames só atualizam highlights e (via outro caminho) posição local / store layout conforme o caso.

---

## 4. Conceitos irmãos (vale conhecer juntos)

### `useLocalNodes`

Cópia local dos nodes **durante** o drag para o canvas ficar fluido sem escrever o Zustand a cada frame. No settle, merge de volta com o store. Sharp edge documentado em `AGENTS.md` — não refatorar de leve.

`useNodeDragParenting` recebe `nodes: localNodesRef.current` (posições do gesto), não só o snapshot do store.

### Um `set()` por gesto / por round de measure

- **Commit do drag:** um `batchCommitNodeDrag` (antes: até K+2 writes → múltiplos checkpoints de undo e ~1 s de long tasks em diagrama grande).
- **Re-measure (ResizeObserver):** um `batchUpdateNodeLayouts` (sem history — tamanho medido não é “edit” do usuário).

Custo dominante: cada `set()` no store serializa o workspace inteiro no persist middleware.

### Identidade de edges ↔ EdgeLabelPortal

São o mesmo tema de perf em duas pontas:

1. **Um** `EdgeLabelRenderer` → barato assinar o store do RF durante o drag.
2. **Edges estáveis** → no commit, não remountar labels/portals à toa.

### Handles L→R (contrato do produto)

Independente de parenting: edge sai pela direita e entra pela esquerda, sempre. Mover nó não rewire lados. Ver `AGENTS.md` e `connectionDerivations.fixedSides.test.ts`.

---

## Mapa mental rápido

```
Drag frame
  ├─ useLocalNodes          → UI fluida (RF nodes locais)
  ├─ useNodeDragParenting   → highlight parent/unparent (índice O(1))
  └─ EdgeLabelPortalHost    → 1× querySelector (não N×)

Store write (commit / seleção / …)
  ├─ batchCommitNodeDrag / batchUpdateNodeLayouts → 1 set()
  └─ useCanvasEdges + shallowEqualRecord → mesmos Edge objects → portals vivos
```

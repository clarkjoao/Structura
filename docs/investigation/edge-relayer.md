# Reinserção da camada de arestas no commit de arraste

Sessão de diagnóstico, 2026-09-13. Branch `investigation/edge-relayer`, base `f9d0310`.
Nenhum arquivo de `src/` alterado — toda instrumentação viveu numa worktree
descartável (`/tmp/structura-inv`), removida ao final.

Convenção: cada afirmação está marcada **MEDIDO**, **LIDO NO CÓDIGO** ou **HIPÓTESE**.

---

## 1. Causa, em três linhas

**Causa encontrada, e não é z-index.** Todo commit de arraste troca a identidade de
`diagram.nodeLayouts`, `isUndoRedoTransition` interpreta isso como undo/redo e
`useLocalNodes` substitui o array local inteiro pelo array vindo da store — que não
carrega `measured`. Sem `measured`, `adoptUserNodes` do React Flow descarta o
`handleBounds` **dos 400 nós**, `getEdgePosition` passa a devolver `null` para **todas**
as arestas, e a camada inteira desmonta e remonta um ciclo depois que o
ResizeObserver remede.

**Vale corrigir.** Contrafactual medido em build de produção, fixture G: 1.756 mutações
de `childList` → 0, e a mediana do tempo de long task após o `pointerup` cai de
**258 ms para 74 ms** (−71%).

**Ressalva sobre o número 3.** Em 7 repetições no fixture G, 7 no fixture L e um arraste
com reparentagem, medi sempre **1 ciclo**, nunca 3. Detalhes em §2.

---

## 2. Tarefa 1 — caracterização das reinserções

`MutationObserver` com `childList` em `.react-flow__edges` (filhos diretos) e em
`.react-flow__edgelabel-renderer` (com `subtree: true`, porque a Structura monta um
único `EdgeLabelPortalHost` e todos os rótulos entram por dentro dele).

Arrastes conduzidos por entrada real (`Input.dispatchMouseEvent` via CDP), 14 passos de
~16 ms, num Chrome dedicado (headless novo, 1600×900). Todos os arrastes confirmados
como efetivos: `moved=true` em 7/7 e 7/7.

### 2.1 Fixture G — 400 nós (60 painéis, 6 níveis) / 439 arestas — build de dev — MEDIDO

| Métrica | Valor |
| --- | --- |
| Ciclos de remoção+reinserção por `drag stop` | **1** em 7 de 7 repetições |
| `childList` por `drag stop` | **1.756** = `edges` 439 removidos + 439 inseridos, `edgelabel-renderer` 439 + 439 |
| Remoção dos `<svg>` | mediana **+179,8 ms** após `pointerup` (mín 137,2; máx 182,7) |
| Reinserção dos `<svg>` | mediana **+316,0 ms** (mín 299,4; máx 321,5) |
| Intervalo sem arestas | mediana **139,0 ms** (mín 133,4; máx 171,1) |
| `nodesInitialized` no instante da remoção | `false` em 7/7 |
| Nós com `internals.handleBounds` na remoção | **0 de 400** em 7/7 |
| Nós com `measured` na remoção | **0 de 400** em 7/7 |
| Nós com `internals.userNode.measured` na remoção | **0 de 400** em 7/7 |
| Mutações em `.react-flow__viewport` | 0 |

**Mesmo frame ou frames distintos?** Frames distintos. Contando ticks de
`requestAnimationFrame`, a remoção e a reinserção caem em ticks consecutivos
(`addFrame − rmFrame == 1` em 7/7) separados por ~139 ms — ou seja, **um único frame
bloqueado** entre as duas metades, não uma sequência de frames.

**Uniforme ou irregular?** Uniforme. Os sete intervalos ficam em 133–171 ms, e a
sequência interna (ver §4) é idêntica repetição a repetição.

### 2.2 Fixture L — 100 nós, **zero painéis** / 99 arestas — build de dev — MEDIDO

| Métrica | Valor |
| --- | --- |
| Ciclos por `drag stop` | **1** em 7 de 7 |
| `childList` por `drag stop` | **396** = 99+99 nas arestas, 99+99 nos rótulos |
| Remoção | mediana **+43,4 ms** (mín 40,8; máx 49,9) |
| Reinserção | mediana **+79,6 ms** (mín 73,1; máx 88,7) |
| Intervalo | mediana **34,8 ms** (mín 32,3; máx 38,8) |
| `handleBounds` / `measured` na remoção | **0 de 100** em 7/7 |

**O número de painéis não importa.** O fixture L não tem nenhum painel e reproduz o
mesmo ciclo, com a mesma assinatura de estado. O custo escala com o número de
arestas e de nós, não com painéis.

### 2.3 Arraste com reparentagem — MEDIDO

Arrastando `root_inv_163` (raiz) para dentro de `panel_inv_8` (confirmado:
`parentId` depois do arraste = `panel_inv_8`), build de produção, fixture G:
**1 ciclo**, 1.756 mutações, remoção em +123,5 ms, reinserção em +213,7 ms,
`handleBounds` = 0 na remoção. Reparentar não acrescenta ciclos.

### 2.4 Sobre "três ciclos" e sobre "2.556"

Não reproduzi nem um nem outro. Em 15 arrastes medidos (7 em G dev, 7 em L dev, 1
com reparentagem em produção), mais 7 em G produção, o resultado foi sempre
**1 ciclo** e, no fixture G, **1.756** mutações de `childList` — não 1.317 por alvo
nem 2.556 no total.

O que posso afirmar: 1.317 = 439 × 3 e 1.756 = 439 × 4 = (439 remoções + 439
inserções) × 2 alvos observados. Os dois números contam coisas diferentes, então não
são diretamente comparáveis, e não sei qual instrumentação produziu os originais.
Se a medição da sprint contou os dois alvos separadamente com 439 em cada direção,
1.317 por alvo continuaria significando 3 ciclos, e eu não os vejo. Registro a
divergência em vez de tentar conciliá-la — ver §8.

---

## 3. Tarefa 2 — leitura do `@xyflow/system`

Versões instaladas: `@xyflow/system` 0.0.79, `@xyflow/react` 12.11.2.

### 3.1 A constante — LIDO NO CÓDIGO

`node_modules/@xyflow/system/dist/esm/index.mjs:1548`

```js
const ROOT_PARENT_Z_INCREMENT = 10;
```

Vizinha em `:1547`, `const SELECTED_NODE_Z = 1000;`. O valor é **10**.

### 3.2 `updateChildNode` e o `parentNode.internals.z` — LIDO NO CÓDIGO

`node_modules/@xyflow/system/dist/esm/index.mjs:1679` declara
`function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex)`.
O trecho que muta o z está em `:1689-1695`:

```js
// We just want to set the rootParentIndex for the first child
if (rootParentIndex &&
    !parentNode.parentId &&
    parentNode.internals.rootParentIndex === undefined &&
    zIndexMode === 'auto') {
    parentNode.internals.rootParentIndex = ++rootParentIndex.i;
    parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
}
```

Três guardas: o painel tem de ser raiz (`!parentNode.parentId`), tem de ainda não ter
`rootParentIndex`, e **`zIndexMode` tem de ser `'auto'`**.

### 3.3 A função roda no `drag stop`? — LIDO NO CÓDIGO + MEDIDO

`updateChildNode` é chamada por `adoptUserNodes`
(`@xyflow/system/dist/esm/index.mjs:1615`) e por `updateAbsolutePositions` (`:1570`),
e `adoptUserNodes` de fato roda no commit (§4, passo 3). **Mas o ramo do z não roda**,
porque `zIndexMode` não é `'auto'`:

- `@xyflow/system/dist/esm/index.mjs:1553` — o default das opções é `zIndexMode: 'basic'`.
- `@xyflow/react/dist/esm/index.mjs:3262` — `getInitialState({ …, zIndexMode = 'basic' })`.
- `@xyflow/react/dist/esm/index.mjs:3728` — a prop de `<ReactFlow>` também tem default `zIndexMode = 'basic'`.
- `grep -rn "zIndexMode" src/` não retorna nada: a Structura nunca passa a prop.
  O único `<ReactFlow>` do app está em `src/features/canvas/Canvas.tsx:391` e não a passa.

MEDIDO, lendo a store interna do React Flow no navegador, fixture G em repouso:
`store.zIndexMode === "basic"`, e nos painéis raiz amostrados
`internals.rootParentIndex === undefined` com `internals.z === -1`. O ramo nunca
executou.

### 3.4 Se o z do painel mudasse, o React Flow reordenaria as arestas? — LIDO NO CÓDIGO

Não, a camada de arestas não é ordenada por z.

- `@xyflow/react/dist/esm/index.mjs:2403` — `useVisibleEdgeIds(onlyRenderVisible)`
  devolve `s.edges.map((edge) => edge.id)` quando `onlyRenderVisibleElements` é falso.
  A Structura não passa `onlyRenderVisibleElements` em `Canvas.tsx:391`, então esse é
  o caminho ativo: a ordem do DOM é a ordem do array `edges`, sem qualquer sort.
- `@xyflow/react/dist/esm/index.mjs:3037-3043` — `EdgeRendererComponent` renderiza
  `<div className="react-flow__edges">` com um `EdgeWrapper` por id, **com `key={id}`**.
  Chaves estáveis: uma mudança de ordem viraria `insertBefore` (movimento), nunca
  desmontagem de todos.

O z de aresta é aplicado como `style.zIndex` no `<svg>` de cada aresta, não como
posição no DOM — mudar z não move nada na árvore.

### 3.5 O que de fato importa nesse arquivo — LIDO NO CÓDIGO

Duas linhas explicam tudo:

`@xyflow/system/dist/esm/index.mjs:1584-1587`

```js
function parseHandles(userNode, internalNode) {
    if (!userNode.handles) {
        return !userNode.measured ? undefined : internalNode?.internals.handleBounds;
    }
```

`adoptUserNodes` usa isso em `:1644` (`handleBounds: parseHandles(userNode, internalNode)`)
sempre que reconstrói o nó interno — o que acontece quando o objeto de nó do usuário
muda de identidade (`:1630`, `if (_options.checkEquality && userNode === internalNode?.internals.userNode)`
é o caminho de reúso; qualquer outro cai na reconstrução). Nós da Structura não
carregam `handles`, então **se o nó chegar sem `measured`, o `handleBounds` é jogado fora**.

`@xyflow/system/dist/esm/index.mjs:1374-1382`

```js
function isNodeInitialized(node) {
    return (node &&
        !!(node.internals.handleBounds || node.handles?.length) &&
        !!(node.measured.width || node.width || node.initialWidth));
}
function getEdgePosition(params) {
    const { sourceNode, targetNode } = params;
    if (!isNodeInitialized(sourceNode) || !isNodeInitialized(targetNode)) {
        return null;
    }
```

E `@xyflow/react/dist/esm/index.mjs:2957`, dentro de `EdgeWrapper`:

```js
if (edge.hidden || sourceX === null || sourceY === null || targetX === null || targetY === null) {
    return null;
}
```

Sem `handleBounds`, toda aresta renderiza `null`. Não é reordenação: é desmontagem.

---

## 4. Tarefa 3 — profile de CPU

Build de dev com source maps, `Profiler` do CDP a 100 µs, fixture G, um arraste.
Além do profile, envolvi `removeChild`/`insertBefore`/`appendChild` do container
`.react-flow__edges` para carimbar o instante exato de cada mutação — os dois relógios
foram alinhados por esses carimbos (offset de 895,8 ms entre a base do profile e o
`performance.now()` do `pointerup`).

Os tempos abaixo são **em build de dev**, que é mais lento que produção; o que importa
aqui é a ordem e o encadeamento, não a magnitude. Os números de produção estão em §6.

### 4.1 A cadeia, em ms após o `pointerup` — MEDIDO

| ms | O que roda |
| --- | --- |
| **+10,5 … +17,6** | `batchCommitNodeDrag` — o único `set()` da gestura |
| **+23,4 … +25,2** | `useCanvasNodes` reconstrói o array de nós |
| **+25,4 … +25,8** | `useCanvasEdges` reconstrói o array de arestas |
| **~+19 … +22** | `useLocalNodes` entra no ramo `undoRedo` (contador dedicado, §5) |
| **+86,5 … +89,9** | React Flow `setNodes` → `adoptUserNodes` (efeito passivo) |
| **+142,6 … +190,1** | React `commitDeletionEffects` → `removeChildFromContainer` × 439 |
| **+191,7 … +216,2** | React `commitPlacement` (recriação da camada de nós) |
| **+244,9 … +249,7** | React Flow `updateNodeInternals` → `getHandleBounds` → `querySelectorAll` |
| **+380,5 … +431,1** | React `commitPlacement` → `appendChild` × 439 |

Os carimbos diretos nos métodos do container confirmam a janela:
`removeChild` × 439 entre +142,6 e +189,9 ms; `appendChild` × 439 entre +379,4 e +431,1 ms.

### 4.2 As cadeias de chamada — MEDIDO

**Quem dispara o commit** (amostra em +10,5 ms):

```
mouseupped                @ @xyflow_react.js:976
  (anonymous)             @ @xyflow_react.js:4846
    (anonymous)           @ src/features/canvas/hooks/useNodeDragParenting.ts:251
      flush               @ src/features/canvas/hooks/useNodeDragParenting.ts:331
        batchCommitNodeDrag @ src/features/diagram/store/slices/component-parenting.slice.ts:84
          store.setState  @ zustand_middleware_immer.js:4
            Immer2.produce @ immer.js:510
              resolveComponent @ src/features/diagram/store/helpers/scene-helpers.ts:24
```

**Quem entrega o array sem `measured` ao React Flow** (amostra em +86,5 ms):

```
flushPassiveEffects       @ react-dom:15748
  commitPassiveMountOnFiber @ react-dom:14754
    commitHookEffectListMount @ react-dom:13808
      (anonymous)         @ @xyflow_react.js:6242      (o StoreUpdater de <ReactFlow nodes>)
        setNodes          @ @xyflow_react.js:9542
          adoptUserNodes  @ @xyflow_react.js:4313
```

**A desmontagem das 439 arestas** (amostra em +142,6 ms):

```
flushSyncCallbacks        @ react-dom:7784
  performSyncWorkOnRoot   @ react-dom:15283
    commitRoot            @ react-dom:15626
      commitMutationEffects @ react-dom:14344
        commitDeletionEffects @ react-dom:14191
          commitDeletionEffectsOnFiber @ react-dom:14223
            removeChildFromContainer @ react-dom:7313
              removeChild   @ (nativo)
```

**A remedição que restaura** (amostra em +244,9 ms):

```
(anonymous)               @ @xyflow_react.js:7945      (callback do ResizeObserver)
  updateNodeInternals     @ @xyflow_react.js:9584
    updateNodeInternals   @ @xyflow_react.js:4467
      getHandleBounds     @ @xyflow_react.js:3640
        querySelectorAll  @ (nativo)
```

**A remontagem das 439 arestas** (amostra em +380,5 ms):

```
flushSyncCallbacks        @ react-dom:7784
  performSyncWorkOnRoot   @ react-dom:15283
    commitRoot            @ react-dom:15626
      commitMutationEffects @ react-dom:14344
        commitReconciliationEffects @ react-dom:14538
          commitPlacement @ react-dom:14132
            insertOrAppendPlacementNode @ react-dom:14170
              appendChild @ (nativo)
```

### 4.3 As três perguntas da tarefa — MEDIDO

1. **Qual função é chamada imediatamente antes de cada ciclo?** Antes da remoção,
   `adoptUserNodes` (+86 ms), que é onde os `handleBounds` são perdidos. Antes da
   reinserção, `updateNodeInternals` → `getHandleBounds` (+245 ms), que é onde eles
   voltam.
2. **Existe uma cadeia que se repete três vezes?** Não. Há **uma** rajada de
   `commitDeletionEffects` e **uma** rajada de `commitPlacement` sobre o container de
   arestas. Nenhum código relevante roda três vezes.
3. **O que é diferente nos três ciclos?** A pergunta não se aplica: há um ciclo. E ele
   não é reordenação nem re-render — a metade de saída é `commitDeletionEffects`
   (deleção de fiber) e a de volta é `commitPlacement` (montagem de fiber). É
   **desmontagem e remontagem**, com dois caminhos distintos do React.

`getEdgePosition` aparece em amostras **antes** do `pointerup` e desaparece
completamente entre a remoção e a remedição — consistente com arestas devolvendo
`null` sem sequer calcular caminho.

---

## 5. Tarefa 4 — a causa, confirmada

### 5.1 A reinserção é causada pelo z-index de painel sendo mutado?

**Não.** Descartada por três evidências independentes:

1. **LIDO NO CÓDIGO** — o ramo em `@xyflow/system:1689-1695` exige
   `zIndexMode === 'auto'`; o valor efetivo é `'basic'` (§3.3) e a Structura nunca
   passa a prop.
2. **MEDIDO** — na store do React Flow, `zIndexMode === "basic"` e
   `internals.rootParentIndex === undefined` nos painéis raiz. O ramo nunca rodou,
   então nenhum z foi mutado. "Valor antes e depois de cada ciclo" não se aplica.
3. **LIDO NO CÓDIGO** — mesmo que o z mudasse, a camada de arestas não é ordenada
   por z (§3.4): as chaves de `EdgeWrapper` são estáveis e a ordem vem do array
   `edges`. Um z diferente mudaria `style.zIndex`, não a árvore.

### 5.2 O que causa o ciclo

`src/features/canvas/hooks/useLocalNodes.ts:42-49`:

```ts
function isUndoRedoTransition(
  prevDiagram: Diagram | DiagramModel | null | undefined,
  nextDiagram: Diagram | DiagramModel | null | undefined,
): boolean {
  if (!prevDiagram || !nextDiagram) return false;
  if (prevDiagram.id !== nextDiagram.id) return false;
  return prevDiagram.nodeLayouts !== nextDiagram.nodeLayouts;
}
```

O único critério é a **identidade** de `nodeLayouts`. `batchCommitNodeDrag`
(`src/features/diagram/store/slices/component-parenting.slice.ts:106`) escreve
posições dentro de um `produce` do Immer, o que necessariamente dá a `nodeLayouts`
uma identidade nova. Um arraste comum é, para essa função, indistinguível de um
undo/redo.

E o ramo que ela habilita, `src/features/canvas/hooks/useLocalNodes.ts:119-121`:

```ts
if (prev.length === 0 || undoRedo) {
  localNodesStateRef.current = storeNodes;
  localNodesRef.current = storeNodes;
}
```

Substituição integral. Os outros dois ramos (`:122` e `:154`) fazem `{ ...ln, … }`,
espalhando o nó **local** e por isso preservando `measured`, que o React Flow foi
acumulando via changes de `dimensions`. Este ramo joga os locais fora inteiros, e
`storeNodes` vem de `useCanvasNodes`/`buildNode`, que nunca põe `measured`.

### 5.3 Instrumentação: contador no ponto suspeito — MEDIDO

Contador colocado na worktree, no ramo de `useLocalNodes`, registrando qual ramo foi
tomado e quantos nós de cada lado carregavam `measured`. Resultado idêntico em 7/7
arrastes no fixture G e 7/7 no fixture L:

```
branch = "undoRedo->storeNodes"   undoRedo = true
dt     = +18,4 … +24,4 ms após o pointerup      (uma única vez por drag stop)
storeNodesMeasured   = 0   de 400
prevLocalMeasured    = 400 de 400
```

Nos ramos de merge, que rodam durante o arraste, o mesmo contador mostra
`sameLength->merge` com `storeMeasured = 0 / prevLocalMeasured = 400` — e nada
acontece com as arestas, porque o merge preserva `measured`. A diferença é
exatamente o ramo.

E, na store do React Flow, um `subscribe` mostra a transição num único update, em
+93 ms:

```
antes:  nodes 400  edges 439  handleBounds 400  measured 400  userNode.measured 400  nodesInitialized true
depois: nodes 400  edges 439  handleBounds   0  measured   0  userNode.measured   0  nodesInitialized false
+478ms: nodes 400  edges 439  handleBounds 400  measured 400  userNode.measured 400  nodesInitialized true
```

`edges` nunca muda: as 439 arestas continuam na store o tempo todo. Elas somem do
DOM porque renderizam `null`, não porque foram removidas do estado.

### 5.4 Contrafactual — MEDIDO

Para separar causa de correlação, na worktree o ramo passou a fazer a **mesma**
substituição integral, mudando uma única variável: recolar `measured` do array local
sobre os nós vindos da store. Nada de posições, parentesco ou seleção foi tocado, e o
ramo `undoRedo` continua sendo tomado no mesmo instante.

Build de dev, fixture G, 7 repetições de cada lado:

| | ciclos por drag stop | `childList` por drag stop |
| --- | --- | --- |
| Como está hoje | 1, 1, 1, 1, 1, 1, 1 | 1.756 × 7 |
| Com `measured` preservado | 0, 0, 0, 0, 0, 0, 0 | 0 × 7 |

`moved = true` em 14 de 14: os arrastes de ambos os lados de fato moveram o nó, e o
ramo `undoRedo->storeNodes` continuou disparando em +18…+23 ms nos dois. O ciclo
desaparece por completo.

---

## 6. Tarefa 5 — impacto

Medido em **build de produção** (`vite build` + `vite preview`), fixture G,
7 repetições de cada lado, mesma máquina e mesma sessão de navegador.

| | mutações `childList` por drag stop | long task após `pointerup` |
| --- | --- | --- |
| Hoje | **1.756** (mediana; mín 1.756, máx 1.756) | mediana **258 ms** (mín 238, máx 312) |
| Sem a perda de `measured` | **0** | mediana **74 ms** (mín 70, máx 84) |

**Quantas mutações o commit gera hoje?** 1.756 no fixture G — 439 remoções + 439
inserções de `<svg>` em `.react-flow__edges`, e o mesmo par para os portais de rótulo
dentro de `.react-flow__edgelabel-renderer`. Não consegui reproduzir os ~2.556
citados; ver §2.4.

**Quantas restariam?** **Zero**, não um terço. O ciclo não é "três vezes o necessário":
ele é inteiramente desnecessário. Movimentar um nó não precisa desmontar aresta
nenhuma — as identidades de aresta já são estáveis (o cache de identidade do item 4
da sprint funciona; só não adianta nada enquanto os nós perdem `measured`).

**Efeito mensurável no tempo do commit?** Sim, e grande: **−184 ms na mediana, −71%**
do tempo de long task após o `pointerup`, em produção. A mediana da última mutação de
DOM cai de +202,8 ms para "nenhuma mutação". O baseline mostra sempre duas long tasks
— uma de ~80–125 ms a partir do `pointerup` (o `set()` e o re-render) e outra de
~134–174 ms logo em seguida (desmontar + remontar a camada); com `measured`
preservado sobra só a primeira.

Não meço os ~385 ms citados no enunciado — a máquina e o cenário de arraste são
outros. O que posso afirmar é a **razão**: a camada de arestas responde por cerca de
dois terços do custo de main thread do commit.

**Risco de quebrar colaboração, viewer ou export.**

- **Undo/redo** — o motivo de existir do ramo é descartar posições locais obsoletas
  depois de um undo/redo (`useLocalNodes.ts:119`). Preservar `measured` não mexe em
  `position`, `parentId` nem `extent`: a semântica de undo/redo fica intacta. **LIDO
  NO CÓDIGO**; não medi undo/redo, ver §8.
- **Colaboração** — `measured` é estado local do React Flow, não é persistido nem
  entra em patch de colaboração. Nenhum caminho de `features/collaboration` lê o
  array local de nós.
- **Viewer e export** — o viewer e `lib/export-service` partem do diagrama, não dos
  nós do React Flow.
- **Auto-layout** — `measuredSizesOf` (`src/features/canvas/layout/applyLayout.ts:71`)
  lê `node.measured` e é usada por `useAutoLayout.ts:58` e `usePanelChildLayout.ts:36`.
  Hoje, logo após todo commit de arraste, `measured` fica `undefined` em todos os nós
  por ~139 ms; um auto-layout disparado nessa janela cairia no fallback de tamanho.
  Preservar `measured` **melhora** esse caminho. É o único consumidor que muda de
  comportamento, e muda para melhor.

O risco real não está em preservar `measured` — está em qualquer correção que mexa no
próprio `useLocalNodes`, que o `AGENTS.md` marca como frágil e que tem três arquivos
de teste (`useLocalNodes.test.ts`, `useLocalNodes.dragFrame.test.tsx`,
`useLocalNodes.dragSelection.test.ts`).

---

## 7. DECISÕES DO DONO

1. **A hipótese do z-index está morta.** `ROOT_PARENT_Z_INCREMENT` só é aplicado com
   `zIndexMode === 'auto'`; o app roda em `'basic'` e nunca passa a prop. Não gastar
   mais tempo aí, e não "consertar" nada em `@xyflow/system`.

2. **A causa é `isUndoRedoTransition` confundir commit de arraste com undo/redo**
   (`src/features/canvas/hooks/useLocalNodes.ts:42-49`), levando à substituição
   integral em `:119-121`, que entrega ao React Flow 400 nós sem `measured`. O
   sintoma — camada de arestas desmontada e remontada — é uma consequência, não a
   doença.

3. **Corrigir vale a pena e não é caro:** 1.756 → 0 mutações de `childList` e −71% de
   long task no commit, em build de produção.

4. **Há dois caminhos; eu recomendo o segundo, ou os dois.**
   - *Preservar `measured` na substituição.* Foi o contrafactual medido, é de baixo
     risco e resolve o sintoma inteiro. Mas mantém a substituição integral rodando em
     todo arraste, que é trabalho inútil.
   - *Fazer `isUndoRedoTransition` detectar undo/redo de verdade.* A store já tem o
     discriminador: `_lastUndoRedoAt`, escrito em
     `src/features/diagram/store/slices/history.slice.ts:100` e `:142`. Comparar por
     ele (e não pela identidade de `nodeLayouts`) faz o commit de arraste cair no ramo
     de merge, que já preserva `measured` — e mata a substituição integral junto.
     **Não medi essa variante**; medi só a primeira.
   - Fazer as duas dá cinto e suspensório: o merge passa a ser o caminho normal, e a
     substituição, quando de fato houver undo/redo, não derruba as medições.

5. **Renomear ou documentar `isUndoRedoTransition`.** O nome afirma algo que a função
   não verifica. Foi o que fez a hipótese do z-index parecer plausível por tanto tempo.

6. **Regressão a travar em teste:** um `drag stop` num diagrama com arestas não pode
   levar nó nenhum a perder `measured` / `handleBounds`. Um teste que conte mutações
   de `childList` em `.react-flow__edges` durante um commit — esperado 0 — é direto de
   escrever e é o contrato que faltava. Vale ficar ao lado de
   `useCanvasEdges.identity.test.ts`, que hoje prova identidade de objeto mas não
   impede a camada inteira de desmontar.

7. **Atualizar `docs/concepts/canvas-hot-path.md`.** A estratégia §5 ("Identity caches
   for arrays React Flow owns") está correta e implementada, mas é insuficiente: manter
   a identidade das arestas não adianta enquanto os nós chegam sem `measured`. Vale uma
   linha nova: *o que o React Flow recebe em `nodes` precisa carregar `measured`, ou
   `adoptUserNodes` descarta `handleBounds` e toda aresta desmonta.*

Nada foi implementado. Nenhum arquivo de `src/` foi alterado nesta branch.

---

## 8. NÃO VERIFICADO

- **Os três ciclos e as 2.556 mutações do enunciado.** Não reproduzidos em 22 arrastes
  medidos. Não sei qual instrumentação os produziu, então não sei se meço outra coisa
  ou se o comportamento mudou desde então. Não investiguei mais a fundo.
- **A variante de correção via `_lastUndoRedoAt`.** Recomendada em §7 por leitura de
  código; o contrafactual que medi foi o outro (preservar `measured`).
- **Undo/redo de verdade.** Não arrastei-e-desfiz para conferir que o ramo continua
  necessário e correto. Afirmo só o que li.
- **Arraste multi-seleção.** Todos os arrastes medidos foram de um nó só (mais um com
  reparentagem). Uma gestura multi-seleção pode escrever mais layouts; não medi.
- **Os ~385 ms de produção citados no enunciado.** Minha linha de base de produção é
  outra máquina/cenário; reporto a razão (−71%), não a diferença absoluta esperada lá.
- **Colaboração, viewer e export sob a correção.** O risco em §6 vem de leitura de
  código e de busca por consumidores de `measured`; não rodei sessão de colaboração
  nem export.
- **A suíte de testes.** Não rodei `npm run test`, `typecheck` nem `lint` — não há
  mudança de `src/` para validar, e o código na worktree é instrumentação descartada.
- **Eventos de ponteiro sintéticos.** `PointerEvent` despachado por script não aciona o
  d3-drag do React Flow neste app (o nó fica selecionado mas não move). Não descobri
  por quê; troquei por entrada real via `Input.dispatchMouseEvent` do CDP, que funciona.
  Isso é uma limitação da instrumentação, não um achado sobre o produto.

---

## 9. Estado final

**Repositório**

- Branch: `investigation/edge-relayer`, criada a partir de `main` em `f9d0310`.
- `git rev-list --left-right --count origin/main...HEAD` no início: `0 0`.
- `git status --porcelain` no início: vazio.
- `git status --porcelain` no fim: vazio (após o commit do relatório).
- Commits desta sessão nesta branch: **1**, só este relatório
  (`docs/investigation/edge-relayer.md`).
- Nenhum arquivo de `src/` alterado. Nenhum `git stash` usado.
- Nenhum PR aberto.

**Worktree**

- Criada: `git worktree add /tmp/structura-inv f9d0310` (detached em `f9d0310`).
- Recebeu: `node_modules` por symlink para o repo principal; os fixtures em
  `public/inv-fixture-{g,l}.json`; os scripts em `scripts/inv-*.mjs`; a instrumentação
  e o contrafactual em `src/features/canvas/hooks/useLocalNodes.ts` (só ali).
- Removida ao final com `git worktree remove /tmp/structura-inv --force`, confirmado
  por `git worktree list`.

**Processos**

- Servidor de dev: `npm run dev -- --port 8199 --strictPort`, grupo próprio via
  `perl setpgrp`, PID em `/tmp/structura-inv/dev.pid` — PID 81711 (filho vite 81737).
- Servidor de produção: `vite preview --port 8299 --strictPort`, grupo próprio,
  PID em `/tmp/structura-inv/preview.pid` — PID 37115 (filho vite 37133).
- Navegador dedicado: Chrome headless, `--remote-debugging-port=9333`,
  `--user-data-dir=/tmp/structura-inv/chrome-profile`, grupo próprio, PID em
  `/tmp/structura-inv/chrome.pid` — PID 23116 (17 processos filhos no mesmo grupo).
- Encerrados com `kill -TERM <PID>` sobre cada PID gravado, um a um. Sem `pkill`,
  `killall`, `killpg`, `kill -- -PID`, `fuser -k`, nem kill por nome ou porta.
- Verificação final: nenhum dos PIDs registrados sobreviveu; nada escutando em
  8199, 8299 ou 9333.
- Uma única instância de navegador de medição (o Chrome headless dedicado). A aba do
  Chrome do usuário usada na exploração inicial foi fechada e a janela teve os bounds
  restaurados para `{0, 31, 1600, 810}`.

**Porta 8080**

- `lsof -i :8080 -sTCP:LISTEN` no início: nada escutando.
- `lsof -i :8080 -sTCP:LISTEN` no fim: nada escutando.
- Nenhum servidor desta sessão usou a 8080.

# Correção — substituição integral de nós no commit de arraste

Branch `investigation/edge-relayer`, sobre `1a19b9c`. Continuação de
[edge-relayer.md](./edge-relayer.md), que diagnosticou a causa sem implementar.

---

## 1. Resultado, em duas linhas

Build de produção, fixture G (400 nós / 439 arestas), 7 repetições de cada lado:
**mutações de `childList` no commit: 1.756 → 0**; **long task após o `pointerup`:
mediana 265 ms → 73 ms** (−72%).

O ciclo de desmontagem e remontagem da camada de arestas desapareceu por completo,
e undo/redo continua funcionando — verificado no navegador, não só em teste.

---

## 2. Medição antes — a reprodução

Antes de tocar em qualquer código, reproduzi o número do diagnóstico. Build de
produção (`vite build` + `vite preview --port 8299 --strictPort`), Chrome headless
dedicado dirigido por CDP, arrastes com entrada real (`Input.dispatchMouseEvent`),
`MutationObserver` com `childList` em `.react-flow__edges` (filhos diretos) e em
`.react-flow__edgelabel-renderer` (`subtree: true`).

```
rep 1 root_inv_170 moved=true cycles=1 childList=1756 longTaskMs=278 hbAtRemove=0
rep 2 root_inv_187 moved=true cycles=1 childList=1756 longTaskMs=263 hbAtRemove=0
rep 3 root_inv_204 moved=true cycles=1 childList=1756 longTaskMs=271 hbAtRemove=0
rep 4 root_inv_212 moved=true cycles=1 childList=1756 longTaskMs=276 hbAtRemove=0
rep 5 root_inv_228 moved=true cycles=1 childList=1756 longTaskMs=265 hbAtRemove=0
rep 6 mid_inv_118 moved=true cycles=1 childList=1756 longTaskMs=262 hbAtRemove=0
rep 7 leaf_inv_98 moved=true cycles=1 childList=1756 longTaskMs=258 hbAtRemove=0

moved 7/7   cycles [1,1,1,1,1,1,1]
childListTotal  min 1756  med 1756  max 1756
longTaskMs      min 258   med 265   max 278
```

**1.756 confirmado em 7 de 7**, com `hbAtRemove = 0` — no instante da remoção, zero
dos 400 nós tinham `internals.handleBounds`. É o mesmo mecanismo do diagnóstico,
reproduzido numa sessão nova.

---

## 3. As três mudanças

Um único arquivo de produção: `src/features/canvas/hooks/useLocalNodes.ts`
(+78 −7). Mais um arquivo de teste novo.

### 3.1 Renomear `isUndoRedoTransition` → `shouldDiscardLocalNodes`

```diff
-function isUndoRedoTransition(
+/**
+ * True when the store jumped to another point in history, so the local node
+ * copy describes a diagram that no longer exists and has to be dropped.
+ *
+ * Named for the decision, not for the signal: this used to compare
+ * `nodeLayouts` by identity, which *every* store write changes — a plain drag
+ * commit was indistinguishable from an undo, so every commit took the discard
+ * path below and handed React Flow 400 nodes stripped of `measured`. The name
+ * said "undo/redo" while the body said "something moved", and that gap cost
+ * several investigations. `_lastUndoRedoAt` is stamped only by `undo` and
+ * `redo` in `history.slice.ts`, which is the question actually being asked.
+ */
+function shouldDiscardLocalNodes(
```

`grep -rn "isUndoRedoTransition" src/` retorna zero.

**Desvio deliberado do enunciado, e por quê.** O enunciado sugeria
`nodeLayoutsChanged`. Depois da mudança 3.2 a função não olha mais para
`nodeLayouts` — esse nome seria uma mentira nova, do mesmo tipo que a 3.1 existe
para eliminar. `shouldDiscardLocalNodes` descreve a decisão que o chamador toma,
que continua verdadeira independentemente de como a detecção for feita — e é
justamente o acoplamento nome↔mecanismo que acabou de custar caro. Respeita a
restrição dada (sem "undo", "redo" ou "transition" no nome).

### 3.2 Detectar undo/redo de verdade

`_lastUndoRedoAt` é escrito só em `history.slice.ts:100` (undo) e `:142` (redo).

```diff
 function shouldDiscardLocalNodes(
   prevDiagram: Diagram | DiagramModel | null | undefined,
   nextDiagram: Diagram | DiagramModel | null | undefined,
+  prevLastUndoRedoAt: number,
+  lastUndoRedoAt: number,
 ): boolean {
   if (!prevDiagram || !nextDiagram) return false;
   if (prevDiagram.id !== nextDiagram.id) return false;
-  return prevDiagram.nodeLayouts !== nextDiagram.nodeLayouts;
+  return prevLastUndoRedoAt !== lastUndoRedoAt;
 }
```

O hook lê o campo direto da store, porque a mudança tinha de caber num arquivo só:

```diff
+  /**
+   * Stamped only by `undo`/`redo`. A primitive, so this subscription re-renders
+   * the canvas on history jumps and on nothing else.
+   */
+  const lastUndoRedoAt = useDiagramStore((state) => state._lastUndoRedoAt);
+  const prevLastUndoRedoAtRef = useRef(lastUndoRedoAt);
```

`useDiagramStore` já estava no grafo de imports deste módulo (o barrel
`@/features/diagram` faz `export * from "./store"`, e o arquivo já importava
`canMoveNodeInSceneMode` de lá), então não há aresta nova de bundle. O seletor
devolve um `number`, então a igualdade padrão do Zustand só re-renderiza em
undo/redo — não viola a §6 de `canvas-hot-path.md`, que trata de assinatura por
entidade.

O ref anterior é atualizado **só** nos dois pontos onde `prevDiagramRef` também é,
espelhando-o. Atualizá-lo em todo render consumiria a mudança num render que não
recebeu `storeNodes` novos, e a detecção se perderia:

```diff
       prevDiagramRef.current = diagram;
+      prevLastUndoRedoAtRef.current = lastUndoRedoAt;
     } else if (storeNodes !== prevStoreNodesRef.current) {
       prevStoreNodesRef.current = storeNodes;

-      const undoRedo = isUndoRedoTransition(prevDiagramRef.current, diagram);
+      const discardLocal = shouldDiscardLocalNodes(
+        prevDiagramRef.current,
+        diagram,
+        prevLastUndoRedoAtRef.current,
+        lastUndoRedoAt,
+      );
       prevDiagramRef.current = diagram;
+      prevLastUndoRedoAtRef.current = lastUndoRedoAt;
```

### 3.3 Preservar `measured` na substituição integral

```diff
-      if (prev.length === 0 || undoRedo) {
-        localNodesStateRef.current = storeNodes;
-        localNodesRef.current = storeNodes;
+      if (prev.length === 0 || discardLocal) {
+        // Positions, parenting and selection come from the store — that is the
+        // point of discarding. `measured` is not stale state, it is the only
+        // record of what React Flow painted, so it has to survive.
+        const adopted = withLocalMeasured(storeNodes, prev);
+        localNodesStateRef.current = adopted;
+        localNodesRef.current = adopted;
```

com o helper:

```ts
function withLocalMeasured(storeNodes: Node[], localNodes: Node[]): Node[] {
  if (localNodes.length === 0) return storeNodes;

  const measuredById = new Map<string, Node["measured"]>();
  for (const node of localNodes) {
    if (node.measured?.width !== undefined) measuredById.set(node.id, node.measured);
  }
  if (measuredById.size === 0) return storeNodes;

  let changed = false;
  const adopted = storeNodes.map((node) => {
    const measured = measuredById.get(node.id);
    if (!measured || node.measured === measured) return node;
    changed = true;
    return { ...node, measured };
  });
  return changed ? adopted : storeNodes;
}
```

Só `measured` atravessa — nada de `position`, `parentId`, `selected` ou `data`.
O early-return devolve o array de entrada quando não há nada a copiar, para que
uma substituição sem novidade não entregue ao React Flow um array de identidade
nova de graça (o que por si só reexecutaria `adoptUserNodes`).

---

## 4. Testes

Arquivo novo: `src/features/canvas/hooks/useLocalNodes.measured.test.ts`.
Escritos primeiro, executados contra o código antigo, os três falharam:

```
 ❯ useLocalNodes.measured.test.ts (3 tests | 3 failed)
   × keeps measured across a drag commit
   × replaces local positions on a real undo, but still keeps measured
   × never hands React Flow a node that lost measured, on any store write

AssertionError: expected [ undefined, undefined ] to deeply equal [ { width: 100, height: 40 }, …(1) ]
AssertionError: drag commit dropped measured on: a, b: expected [ 'a', 'b' ] to deeply equal []
```

Depois da implementação, os três passam:

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Teste 1 — `keeps measured across a drag commit`.** Mede os nós via change de
`dimensions` (é assim que `measured` chega ao array local, por
`applyNodeChanges`), depois simula o commit: `storeNodes` de identidade nova e
`nodeLayouts` de identidade nova, mesmo `id` de diagrama. Antes: `measured`
sumia. Depois: sobrevive.

**Teste 2 — `replaces local positions on a real undo, but still keeps measured`.**
É a trava contra corrigir demais. Move o nó localmente para `x=999`, dispara um
undo de verdade (`useDiagramStore.setState({ _lastUndoRedoAt: Date.now() })`) e
exige as duas coisas: a posição local obsoleta **é** descartada (`x` volta a `0`,
que é a razão de o ramo existir) e `measured` **não** é. Se alguém "simplificar" a
correção para nunca descartar nada, este teste fica vermelho.

**Teste 3 — `never hands React Flow a node that lost measured, on any store write`.**
O contrato que faltava. Percorre os três ramos do merge — commit de arraste,
commit com reparentagem e adição de nó (o ramo de tamanho diferente) — e exige que
nenhum nó que tinha `measured` o perca. A mensagem de falha diz quais nós
perderam. O comentário de topo do arquivo explica *por que* isso importa, citando
`parseHandles` e `getEdgePosition`, para que um leitor futuro não tome o teste por
zelo excessivo.

Não usei spy em `adoptUserNodes`: ela não é exportada pelos tipos públicos de
`@xyflow/react`, e `@xyflow/system` não está em `package.json` — importá-la seria
uma dependência fantasma. O teste afirma a precondição que governa
`adoptUserNodes`, que é o que está sob nosso controle.

**Os três arquivos de teste existentes seguem sem alteração e verdes** (12 testes).
Nenhum deles exercitava o parâmetro `diagram`, então nenhum dependia do ramo
antigo — a superfície de regressão ali era zero, e continua.

### Portões

| Portão | Resultado |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — **207 arquivos, 1916 testes, 0 falhas** |
| `npm run build` | exit 0 (`✓ built in 4.05s`) |
| `npx prettier --check` nos dois arquivos tocados | `All files formatted correctly` |

`npm run format:check` e `npm run lint` **falham no repositório**, e falhavam
antes desta mudança: os 11 arquivos que o prettier reprova e os 2 erros de lint
(`JsonViewerPanel.tsx`, `EdgeLabelPortal.test.tsx`) estão todos fora do meu
`git status`, que lista só os dois arquivos que criei/alterei. Não corrigi nada
disso — está fora do escopo desta tarefa.

---

## 5. Medição depois

Mesmo harness, mesmos alvos, mesma sessão de navegador, build de produção recém
gerado a partir do código corrigido.

| Métrica | Antes | Depois | Meta | |
| --- | ---: | ---: | --- | --- |
| Mutações `childList` no commit (fixture G) | 1.756 | **0** | 0 | ✅ |
| Long task após `pointerup`, mediana (fixture G) | 265 ms | **73 ms** | ≤80 ms | ✅ |
| Long task, mín–máx | 258–278 ms | **65–79 ms** | | |
| Ciclos de desmontagem/remontagem | 1 em 7/7 | **0 em 7/7** | | |
| Arrastes efetivos (`moved`) | 7/7 | 7/7 | | |

Os sete arrastes movem os nós exatamente para as mesmas posições nos dois lados
(`translate(1100px, 540px)`, `translate(400px, 800px)`, …, idênticas repetição a
repetição), então a comparação é entre execuções equivalentes — a única diferença
medida é o trabalho que sumiu.

O baseline mostrava sempre **duas** long tasks por commit: uma de ~80–126 ms
(o `set()` e o re-render) e outra de ~144–186 ms colada nela (desmontar e
remontar a camada). Depois da correção sobra só a primeira.

**Fixture L** (100 nós, zero painéis, 99 arestas), 7 repetições: `childList` 0 em
7/7 e **nenhuma long task registrada** — o commit inteiro passou a caber abaixo do
limiar de 50 ms do `PerformanceObserver`.

### Undo/redo, verificado no navegador

O diagnóstico anterior listou "undo/redo de verdade" como NÃO VERIFICADO. Como esta
mudança altera exatamente o discriminador de undo/redo, verifiquei ponta a ponta:
arrastar, `Cmd+Z`, `Cmd+Shift+Z`, lendo o `transform` do nó e a contagem de filhos
de `.react-flow__edges`.

```
node: root_inv_168
before:    translate(1320px, 1120px)
afterDrag: translate(1090px, 820px)     dragMoved: true
afterUndo: translate(1320px, 1120px)    undoReverted: true
afterRedo: translate(1090px, 820px)     redoReapplied: true
edgesBefore 440   edgesAfterUndo 440   edgesAfterRedo 440
```

Undo reverte, redo reaplica, e a camada de arestas fica montada (440 = 439 arestas
+ o `<svg>` de marcadores) durante todo o percurso.

---

## 6. DECISÕES DO DONO

1. **O nome novo é `shouldDiscardLocalNodes`, não `nodeLayoutsChanged`.** Ver 3.1:
   depois de 3.2 a função não consulta `nodeLayouts`, e repetir o padrão
   "nome descreve o mecanismo" era reintroduzir o bug de legibilidade que
   causou o problema. Se preferir o nome sugerido, é um `sed` — mas registro que
   ele descreveria algo que a função não faz.

2. **`useLocalNodes` passou a assinar a store de diagrama.** Foi o preço de manter
   a mudança num arquivo só. A alternativa é passar `_lastUndoRedoAt` como
   parâmetro a partir de `useCanvasGraphState.ts:215` — mais explícito, mais
   testável, e tira uma assinatura do caminho quente do canvas. Custa tocar um
   segundo arquivo. Recomendo fazer isso se/quando esse arquivo for aberto por
   outro motivo; não vale um PR próprio.

3. **`_lastUndoRedoAt` é `Date.now()`, com resolução de milissegundo.** Dois
   undos no mesmo milissegundo, com um render entre eles, produziriam o mesmo
   carimbo e o segundo não seria detectado — o efeito seria manter posições locais
   obsoletas, não corromper dados. Não achei caminho realista para isso
   (`undo` faz troca de snapshot inteiro), e o campo já era usado como
   discriminador temporal em `history.slice.ts:49`. Se quiser eliminar a classe
   inteira, o campo vira um contador monotônico em vez de timestamp — mudança de
   uma linha em cada uma das três referências.

4. **`docs/concepts/canvas-hot-path.md` merece a linha nova** que o diagnóstico
   recomendou (item 7): manter identidade de aresta não adianta enquanto os nós
   chegam sem `measured`. Não a escrevi aqui porque esta branch é de correção e o
   enunciado pediu arquivo único; é um doc-only de duas linhas.

---

## 7. NÃO VERIFICADO

- **Arraste multi-seleção.** Todos os 21 arrastes medidos foram de um nó só. Uma
  gestura multi-seleção escreve mais layouts no mesmo `set()`; o caminho de código
  é o mesmo, mas não medi.
- **Colaboração, viewer e export.** O argumento de risco continua o do diagnóstico
  (§6 de `edge-relayer.md`), por leitura de código: `measured` é estado local do
  React Flow, não é persistido nem entra em patch. Não rodei sessão de colaboração
  nem export.
- **Auto-layout.** `measuredSizesOf` (`src/features/canvas/layout/applyLayout.ts:71`)
  lê `node.measured`; a correção deve melhorá-lo, porque hoje ele encontra
  `undefined` em todos os nós durante a janela pós-commit. Não medi auto-layout.
- **Cypress.** Rodei `npm test` (Vitest). As suítes `cypress/e2e/stress-*` não
  foram executadas.
- **Undo/redo com reparentagem.** A verificação de navegador cobriu arrastar e
  desfazer um nó raiz. Não testei desfazer um arraste que mudou de painel.
- **Outros diagramas.** Só os fixtures G e L, gerados pelo mesmo gerador do
  diagnóstico.

---

## 8. Estado final

**Repositório**

- Branch `investigation/edge-relayer`, sobre `1a19b9c` (o relatório de diagnóstico).
- `git status --porcelain` no início: vazio.
- `git status --porcelain` no fim: vazio.
- Um commit nesta sessão, com três arquivos:
  - `src/features/canvas/hooks/useLocalNodes.ts` (+78 −7) — única mudança de produção
  - `src/features/canvas/hooks/useLocalNodes.measured.test.ts` (novo)
  - `docs/investigation/correcao-edge-relayer.md` (este relatório)
- Nenhum `git stash`. Nenhuma outra branch, tag ou remoto tocado. Nenhum PR aberto.
- Nenhuma worktree criada.

**Portões**

`npm run typecheck` exit 0 · `npm test` exit 0 (207 arquivos, 1916 testes, 0 falhas)
· `npm run build` exit 0 · prettier limpo nos dois arquivos tocados.
`format:check` e `lint` seguem vermelhos por 11 arquivos e 2 erros pré-existentes,
todos fora desta mudança.

**Processos**

- Servidor de produção: `vite preview --port 8299 --strictPort`, grupo próprio via
  `perl setpgrp`, PID em arquivo — PID 96273 (filho vite 96300).
- Navegador: **uma única instância**, Chrome headless dedicado,
  `--remote-debugging-port=9333`, `--user-data-dir` no scratchpad, grupo próprio,
  PID em arquivo — PID 96276 (11 processos filhos no mesmo grupo).
- Encerrados com `kill -TERM <PID>` sobre cada PID gravado, um a um. Sem `pkill`,
  `killall`, `killpg`, `kill -- -PID`, `fuser -k`, nem kill por nome ou porta.
- Verificação final: nenhum PID registrado sobreviveu; nada escutando em 8299 ou 9333.
- Fixtures, harness CDP e perfil do navegador ficaram no diretório de scratchpad da
  sessão, fora do repositório. `dist/` é ignorado pelo git.

**Porta 8080**

- `lsof -i :8080 -sTCP:LISTEN` no início: nada escutando.
- `lsof -i :8080 -sTCP:LISTEN` no fim: nada escutando.
- Nenhum servidor desta sessão usou a 8080.

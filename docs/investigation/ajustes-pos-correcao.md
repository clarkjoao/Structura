# Ajustes pós-correção — edge-relayer

## Resultado em três linhas

1. `_lastUndoRedoAt` agora é um contador monotônico; o cooldown preserva seu timestamp separado.
2. `canvas-hot-path.md` documenta por que cachear apenas a identidade das arestas não basta sem `measured` nos nós.
3. `useLocalNodes` não assina mais a store; `useCanvasGraphState` lê `_lastUndoRedoAt` e o repassa ao hook.

## Ajuste 1 — contador monotônico

Em `src/features/diagram/store/slices/history.slice.ts`:

```diff
- state._lastUndoRedoAt = Date.now();
+ state._lastUndoRedoAt = (state._lastUndoRedoAt ?? 0) + 1;
```

O cooldown deixou de tratar esse contador como epoch: `_lastUndoRedoTimestamp` guarda separadamente o horário usado por `UNDO_REDO_COOLDOWN_MS`. O estado inicial, a persistência e o adapter de filesystem foram atualizados para inicializar esse campo.

Confirmação de `grep -rn "_lastUndoRedoAt" src/`: os writes de produção estão somente nos dois caminhos de `undo`/`redo` em `history.slice.ts`; a leitura está em `useCanvasGraphState.ts`. As demais ocorrências são tipo, inicialização, persistência, documentação ou testes. Não há atribuição `Date.now()` ao contador.

## Ajuste 2 — documentação

Foi adicionada, logo após a seção **Identity caches for arrays React Flow owns**, a nota:

> **Note:** keeping edge identity stable is not enough if nodes arrive without
> `measured`. `adoptUserNodes` in `@xyflow/system` calls `parseHandles`, which
> discards `handleBounds` when `userNode.measured` is absent. Without
> `handleBounds`, `getEdgePosition` returns `null` and every edge unmounts.
> The fix is in `useLocalNodes.ts` (`shouldDiscardLocalNodes` +
> `withLocalMeasured`): `measured` must survive any node array replacement,
> including the discard path for undo/redo.

## Ajuste 3 — assinatura da store

Em `src/features/canvas/hooks/useCanvasGraphState.ts`:

```diff
+ const lastUndoRedoAt = useDiagramStore((s) => s._lastUndoRedoAt);
...
  useLocalNodes(..., publishDragFrame,
+   lastUndoRedoAt,
  );
```

Em `src/features/canvas/hooks/useLocalNodes.ts`:

```diff
- import { canMoveNodeInSceneMode, useDiagramStore } from "@/features/diagram";
+ import { canMoveNodeInSceneMode } from "@/features/diagram";
...
+ lastUndoRedoAt = 0,
```

A lógica de descarte não mudou. O parâmetro foi colocado depois de `publishDragFrame` para preservar os chamadores existentes; o teste de `measured` passou o sinal explicitamente. `grep -n "useDiagramStore" src/features/canvas/hooks/useLocalNodes.ts` não retorna linhas.

## Validação

Os três ajustes passam por caminhos que teste unitário não cobre sozinho: o
contador é escrito pela store e lido pelo `useCanvasGraphState`, e o parâmetro
novo é passado por um chamador que o teste de `measured` não exercita — ele
injeta o sinal diretamente. Um fio errado ali deixaria a suíte verde e o app
quebrado. Então a validação foi refeita em navegador, sobre um build de
produção gerado a partir deste código.

### Portões

| Portão | Resultado |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — 207 arquivos, 1.916 testes, 0 falhas |
| `npm run build` | exit 0 (`✓ built in 4.53s`) |
| `npx prettier --check` nos arquivos tocados | `All matched files use Prettier code style!` |

### A correção continua valendo

Build de produção, fixture G (400 nós / 439 arestas), 7 repetições, mesmo
harness e mesmos alvos das medições anteriores:

```
cycles [0,0,0,0,0,0,0]     moved 7/7
childListTotal  min 0   med 0   max 0
longTaskMs      min 69  med 73  max 84
```

Idêntico ao medido antes de trocar a assinatura por parâmetro (mediana 73 ms),
e os sete arrastes terminam exatamente nas mesmas posições. A reescrita não
custou nada e não regrediu nada.

### Undo/redo em cadeia — o que o contador existe para garantir

Dois arrastes, depois **dois `Cmd+Z` em sequência imediata**, depois dois
`Cmd+Shift+Z`. Dois saltos de histórico colados são justamente o caso que
`Date.now()` podia colapsar num único carimbo:

```
A root_inv_166   B root_inv_172
start        a translate(880px, 1120px)    b translate(2200px, 1120px)
afterDrags   a translate(400px, 690px)     b translate(1520px, 780px)
after2Undo   a translate(880px, 1120px)    b translate(2200px, 1120px)
after2Redo   a translate(400px, 690px)     b translate(1520px, 780px)

dragsMoved true   bothUndosLanded true   bothRedosLanded true
edges 440 -> 440 -> 440   edgeLayerStable true
```

Os dois undos pousaram, os dois redos pousaram, e a camada de arestas ficou
montada (440 = 439 arestas + o `<svg>` de marcadores) o percurso inteiro.

### O cooldown, que foi o campo dividido em dois

`history.slice.test.ts:106` (`does not push a new checkpoint within
UNDO_REDO_COOLDOWN_MS after redo`) já cobre exatamente a semântica movida para
`_lastUndoRedoTimestamp`: faz `undo()`, `redo()`, e exige supressão em
`COOLDOWN - 1` e checkpoint em `COOLDOWN + 1`. Se o `Date.now()` não tivesse
sido escrito no campo novo, o timestamp ficaria em 0, `Date.now() - 0` estouraria
o cooldown e o teste falharia. Passa — logo o campo novo está sendo escrito e
lido nos dois caminhos.

### Persistência

`_lastUndoRedoAt` **não** está em `partializeState`
(`persist.config.ts:37-45`), então nenhum dos dois campos é persistido e não há
migração pendente — `PERSIST_SCHEMA_VERSION` segue em 12, corretamente intocado.
`mergePersistedState` zera ambos por garantia. Os seeds do Cypress que escrevem
`_lastUndoRedoAt: 0` no payload de localStorage continuam inertes pelo mesmo
motivo.

## Pontos para o dono

1. **O nome `_lastUndoRedoAt` agora mente um pouco.** Ele guarda uma contagem,
   e quem guarda o "at" é `_lastUndoRedoTimestamp`. É o mesmo tipo de armadilha
   que motivou renomear `isUndoRedoTransition`, em escala menor. Renomear para
   algo como `_undoRedoSeq` custa tocar 7 arquivos, incluindo seeds de Cypress
   onde o campo é inerte. Não bloqueia; fica registrado.
2. **`(state._lastUndoRedoAt ?? 0) + 1`** — o `?? 0` é defensivo morto:
   `AppState._lastUndoRedoAt` é `number` não-opcional, inicializado em
   `diagram.store.ts:44` e zerado em `mergePersistedState`. Inofensivo.

## NÃO VERIFICADO

- **Arraste multi-seleção** — todos os arrastes medidos foram de um nó só.
- **Undo de um arraste com reparentagem** — a verificação em navegador cobriu
  arrastar e desfazer nós de raiz, não troca de painel.
- **Colaboração, viewer e export** — o argumento de risco segue por leitura de
  código (`measured` é estado local do React Flow, não persistido, não entra em
  patch). Nenhuma sessão de colaboração ou export foi executada.
- **Cypress** — só Vitest foi executado; as suítes `cypress/e2e/stress-*` não.
- **`npm run lint` e `npm run format:check`** seguem vermelhos no repositório,
  como já estavam antes desta branch: 11 arquivos reprovados pelo Prettier e 2
  erros de lint (`EdgeLabelPortal.test.tsx`, `JsonViewerPanel.tsx`), todos fora
  dos arquivos desta mudança. Não foram corrigidos — fora de escopo.

## Estado final

- Branch `investigation/edge-relayer`, sobre `c541637`. Um commit nesta rodada,
  sem push e sem PR. Nenhuma worktree criada, nenhum `git stash`.
- `git status --porcelain` inicial: vazio. Final: vazio após o commit.
- Arquivos no commit: `history.slice.ts`, `store.types.ts`, `diagram.store.ts`,
  `persist.config.ts`, `useFileSystemStorage.ts`, `useCanvasGraphState.ts`,
  `useLocalNodes.ts`, `useLocalNodes.measured.test.ts`,
  `useFlowRecording.test.tsx`, `useFlowSewNotices.test.tsx`,
  `canvas-hot-path.md` e este relatório.
- Processos da validação: `vite preview --port 8299 --strictPort` (PID 98389,
  filho 98442) e **uma única instância** de Chrome headless em
  `--remote-debugging-port=9333` (PID 98392, 9 filhos no mesmo grupo). Grupo
  próprio via `perl setpgrp`, PID em arquivo, encerrados com `kill -TERM` sobre
  cada PID gravado, um a um — sem `pkill`, `killall`, `killpg`, `kill -- -PID`
  ou `fuser -k`. Verificação final: nenhum sobreviveu, nada escutando em 8299
  ou 9333.
- `lsof -i :8080 -sTCP:LISTEN` inicial e final: nenhuma saída. Nenhum servidor
  desta sessão usou a 8080.
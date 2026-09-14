# Validação e unificação — `feat/layout-visualization`

Continuação da branch. Base da validação: `89291d3`.

> **Parte 1 de 2.** Esta metade valida o que foi entregue contra o que foi
> especificado. A unificação de `/view` e `/viewer` vem no commit seguinte e é
> acrescentada a este mesmo documento.

Toda afirmação marcada **MEDIDO**, **LIDO NO CÓDIGO** ou **HIPÓTESE**. Todo
`arquivo:linha` citado foi aberto nesta sessão.

---

## 1. Resultado em duas linhas

1. **13 de 14 itens CONFORME, nenhuma correção de código necessária.** O único
   item DIVERGENTE é `MAX_HANDLES`, que não foi reduzido — deliberado e medido,
   porque reduzir piora a métrica que a redução deveria melhorar.
2. **A reversão do dono não desfez nada legítimo.** Ela *foi* a correção: a
   premissa da especificação (`note`, `json-viewer`, `db-table` "sem handle de
   origem" = lacuna) estava errada, e o dono a corrigiu. Re-adicionar seria
   repetir o erro.

---

## 2. Tabela de validação

| # | Item | Especificado | Entregue | Status |
|---|---|---|---|---|
| 1 | `MAX_HANDLES` reduzido? | "Reduzir o número máximo de handles por nó" | **4, inalterado** (`layout.constants.ts:18`) | **DIVERGENTE** — ver §2.1 |
| 2 | Tipos com handles alterados | seis tipos | 3 declaram `outgoing: 0`, 3 declaram par único; nenhum handle adicionado | CONFORME |
| 3 | O que o dono reverteu | — | handles de origem em `note`/`json-viewer`/`db-table`, commit `eabf2e5` | CONFORME |
| 4 | A reversão desfez correção legítima? | — | **Não** — ver §3 | CONFORME |
| 5 | Testes de handles passam? | — | 19 testes, verdes | CONFORME |
| 6 | `ELK_OPTIONS_INTERACTIVE` = comportamento anterior | sem mudança | **byte-a-byte idêntico ao `ELK_OPTIONS` do `main`** | CONFORME |
| 7 | `ELK_OPTIONS_VISUALIZATION` com `LEFT → RIGHT` | direção LR | `elk.direction: "RIGHT"`, herdado | CONFORME |
| 8 | Perfis usados nos lugares certos | interativo no botão, visualização no `/view` | `layout(graph, "visualization")` só em `layoutForVisualization.ts:28`; os outros 5 chamadores usam o default | CONFORME |
| 9 | Botão de auto layout não mudou | restrição mais importante | `useAutoLayout.ts:60` chama `layout(graph)`, default `"interactive"` | CONFORME |
| 10 | Rota existe em `App.tsx` | sim | `App.tsx:100` (agora `/viewer`) | CONFORME |
| 11 | Aceita `?diagramId` e `?source=file&path` | sim | ambos | CONFORME |
| 12 | Aplica ELK automaticamente | sem interação | `useEffect` de montagem, sem botão | CONFORME |
| 13 | Modo de leitura | sem edição | `ViewerCanvas` com `nodesDraggable/Connectable/elementsSelectable = false` | CONFORME |
| 14 | Polling de arquivo | sim | `FileSystemObserver`, senão `setInterval` 500ms (`useStructuraFile.ts:23,132`) | CONFORME |

### 2.1 Por que o item 1 não foi "corrigido"

A especificação pede redução. **MEDIDO** na sessão anterior, varrendo a constante
e medindo sobreposição colinear no fixture G:

| `MAX_HANDLES` | 1 | 2 | 3 | **4 (atual)** | 5 | 6 |
|---|---|---|---|---|---|---|
| sobreposição colinear | 212.936px | 96.541px | 14.310px | **3.213px** | 2.588px | 2.306px |
| cruzamentos | 20.713 | 20.722 | 20.743 | 20.742 | 20.740 | 20.734 |

Reduzir **piora** monotonicamente a métrica que a redução deveria melhorar, e a
causa é direta (**LIDO NO CÓDIGO**, `renderedEdgePath.ts` `handleAnchor` +
`Handles.tsx` `buildHandles`): com menos slots, mais arestas saem do mesmo ponto
de ancoragem e seus primeiros trechos são a mesma reta.

Cumprir a letra da especificação aqui pioraria o produto contra medição. Fica
DIVERGENTE, registrado, não corrigido.

---

## 3. O que a reversão do dono desfez — legítimo ou não

**LIDO NO CÓDIGO**, `git show eabf2e5`: a reversão removeu o `<Handle id="source-0">`
que a sessão anterior tinha adicionado a `NoteNode`, `JsonViewerNode` e
`DbTableNode`.

**Nada legítimo foi desfeito.** A especificação lista esses três como "lacuna
conhecida (sem handle de origem)" a corrigir. Essa premissa estava errada: são
coisas para as quais o diagrama **aponta** — a seta corre em direção a elas e
nunca sai. O dono corrigiu. A reversão é a correção, não um dano a reparar.

O que a sessão anterior usara como evidência (111 de 550 conexões do fixture G
saindo de notas) não sustentava a conclusão: o gerador do fixture sorteia origem
e destino uniformemente entre todos os nós folha, dos quais 20% são notas.

**O que sobreviveu da fatia, e é o valor real dela:** a declaração. Antes, "nota
não é origem" existia só implicitamente, em três componentes que por acaso não
renderizavam o handle. Agora é `SINGLE_INCOMING_HANDLES` com `outgoing: 0`
(`handle-spec.ts`), lida por `buildEdgeHandleAssignments`, travada por teste de
render que conta handles no DOM, e reforçada em `89291d3` pelo bloqueio na
criação da conexão.

Estado atual verificado componente a componente (**LIDO NO CÓDIGO**):

| tipo | declara | renderiza | bate? |
|---|---|---|---|
| `note` | `shared` / `0` | só `in-<id>` | sim |
| `json-viewer` | `shared` / `0` | só `in-<id>` | sim |
| `db-table` | `shared` / `0` | só `in-<id>` | sim |
| `external-element` | `1` / `1` | `target-0`, `source-0` | sim |
| `svg` | `1` / `1` | `target-0`, `source-0` | sim |
| `endpoint` | `1` / `1` | `target-0`, `source-0` | sim |

---

## 4. Correções aplicadas na Parte 1

**Nenhuma.** Os 13 itens CONFORME não pedem nada, e o único DIVERGENTE é uma
decisão medida que corrigir pioraria. Parte 1 é relatório, não patch.

---

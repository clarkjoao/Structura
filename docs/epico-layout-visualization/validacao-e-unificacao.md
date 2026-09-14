# Validação e unificação — `feat/layout-visualization`

Continuação da branch. Base da validação: `89291d3`.

Toda afirmação marcada **MEDIDO**, **LIDO NO CÓDIGO** ou **HIPÓTESE**. Todo
`arquivo:linha` citado foi aberto nesta sessão.

---

## 1. Resultado em três linhas

1. **Validação: 13 de 14 itens CONFORME, nenhuma correção de código necessária.**
   O único item DIVERGENTE é `MAX_HANDLES`, que não foi reduzido — deliberado e
   medido, porque reduzir piora a métrica que a redução deveria melhorar.
2. **A reversão do dono não desfez nada legítimo.** Ela *foi* a correção: a
   premissa da especificação (`note`, `json-viewer`, `db-table` "sem handle de
   origem" = lacuna) estava errada, e o dono a corrigiu. Re-adicionar seria
   repetir o erro.
3. **Unificação: Opção A** — `/viewer` absorveu `/view` e `/view` foi removida.
   Escolha não foi próxima: `/viewer` já está escrita em links compartilhados e
   em snippets de iframe colados em páginas de terceiros; `/view` tinha um dia de
   vida e zero referências fora da branch.

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

## 5. Mapeamento dos chamadores do `/viewer`

### 5.1 Quem escreve a URL

| origem | produz | onde |
|---|---|---|
| `generateViewerUrl()` | `{base}/viewer#data=<lz>` | `share-url/viewer.ts:19` |
| ↳ usado por | link de compartilhamento | `ShareModal.tsx:54` |
| ↳ usado por | URL de embed por hash | `EmbedModal.tsx:51` |
| `getViewerPostMessageUrl()` | `{base}/viewer` | `share-url/viewer.ts:10` |
| ↳ usado por | `<iframe src="...">` no snippet copiável | `EmbedModal.tsx:80` |

As duas produzem coisas que o usuário **copia e leva para fora do app**: um link
que ele manda para alguém, e um trecho de React que ele cola na página dele.
Ambos já estão no mundo.

### 5.2 O protocolo `postMessage` é da rota ou do componente?

**Da rota.** `STRUCTURA_READY` / `STRUCTURA_LOAD` / `STRUCTURA_LOADED` vivem no
componente de rota (`ViewerPage.tsx`), não no `ViewerCanvas`. Mover a rota moveria
o protocolo junto.

### 5.3 Modo embed em iframe?

**Sim** — `EmbedModal.tsx:80` gera literalmente
`<iframe src="${getViewerPostMessageUrl()}" ...>`. Mudar a URL quebra todo
snippet já colado.

### 5.4 Um achado que muda o escopo

**`#share=` não é da rota `/viewer`.** `useSharedDiagram` é chamado em
`App.tsx:81`, **acima do router**, e curto-circuita as rotas inteiras para
renderizar `SharedDiagramView`. Funciona em qualquer caminho. Só `#data=` estava
preso ao `/viewer`.

A especificação (§4.1) descreve `/viewer` como carregando "via hash `#data=` ou
`#share=`". A segunda metade não é verdade, e é bom que não seja: nada de `#share=`
precisou ser tocado.

---

## 6. A opção escolhida, e por quê

**Opção A: `/viewer` absorve `/view`; `/view` é removida.**

Não é uma escolha próxima, então não parei para decisão:

1. `/viewer` está escrita em links já compartilhados e em iframes já colados em
   páginas de terceiros (§5.1, §5.3). Quebrá-los é dano real e irreversível pelo
   lado de cá.
2. `/view` tem um dia de vida, nunca foi publicada, e fora desta branch não é
   referenciada em lugar nenhum.
3. A Opção B precisaria redirecionar `/viewer → /view` **carregando o `#data=`
   junto**. O `<Navigate>` do react-router substitui a location e não preserva
   hash: seria código à mão no caminho mais crítico que existe (o link que já
   está no mundo), para renomear uma rota que ninguém usa.

**Sem redirect `/view → /viewer`.** O ponto da unificação é uma rota só; um
redirect recria o segundo nome permanentemente, para uma URL que nunca existiu
publicamente. **MEDIDO no browser:** `/view?diagramId=...` agora cai no 404 do
app. Está em DECISÕES, é uma linha se o dono quiser.

### 6.1 A regra que a fusão precisava respeitar

**ELK automático só onde ninguém arranjou nada.** Um diagrama que chega com as
posições dentro — payload de share, ou entregue por `postMessage` — foi arranjado
por quem está compartilhando, e re-arranjar trocaria a figura compartilhada por
outra. Um diagrama nomeado por `?diagramId` ou lido de arquivo não carrega
arranjo escolhido para esta visão, então o ELK arruma.

Resolução na rota, em ordem (`ViewerPage.tsx`):

| entrada | fonte | layout? |
|---|---|---|
| `?source=file&path=` | arquivo do disco | **sim** |
| `?diagramId=` | store local | **sim** |
| `#data=` | payload do link | **não** |
| nada | espera `STRUCTURA_LOAD` | **não** |

---

## 7. Testes — falhou antes, passa depois

`src/pages/ViewerPage.unified.test.tsx`, 9 testes. Antes da fusão: **5 falharam,
3 passaram** (hash e `postMessage` já funcionavam — é exatamente o que deviam
mostrar). Depois: 9 verdes.

| teste | o que trava |
|---|---|
| carrega diagrama do `#data=` | o link de compartilhamento continua funcionando |
| diagrama do share renderiza onde foi autorado | **nenhum layout roda** — dois nós autorados na origem continuam com um único transform |
| anuncia `STRUCTURA_READY` e renderiza o `STRUCTURA_LOAD` | o protocolo de embed continua funcionando |
| `?diagramId=beta` renderiza Beta e não Alpha | a fonte que o `/view` tinha |
| id inexistente vira `role="alert"` | erro visível |
| arranja o diagrama nomeado por id **sem clique** | ELK automático (dois transforms distintos a partir de nós na origem) |
| não mexe no diagrama da store | a rota não escreve |
| oferece o seletor de arquivo, nomeando o `path` | a outra fonte que o `/view` tinha |
| diz que o navegador não abre arquivo local | o jsdom sem a API cai no caminho certo |

Um ajuste honesto durante a execução: o teste do seletor falhava porque o jsdom
não tem `showOpenFilePicker` — a rota corretamente mostrava "navegador não
suporta". A presunção era minha, não do código. Passei a dar stub da API (que é a
condição real do browser) e acrescentei o teste do caminho sem ela.

---

## 8. Referências atualizadas

`grep -rn` sobre `src/`, `docs/`, `README.md`, `cypress/`.

| referência | ação |
|---|---|
| `App.tsx` — rota `/view` e o `lazy(ViewPage)` | **removidos** |
| `src/pages/ViewPage.tsx`, `ViewPage.test.tsx` | **removidos** (`git rm`) |
| `layoutEngine.ts:51` — "como o `/view` desenha" | **atualizado** para `/viewer` |
| `layoutProfiles.test.ts:51` — idem | **atualizado** |
| `layoutForVisualization.ts:10` — "usável a partir do `/view`" | **atualizado** |
| `ViewerPage.tsx`, `ViewerPage.unified.test.tsx` — "o que o `/view` fazia" | **mantidos**: são referências históricas, e descrevem corretamente o passado |
| `relatorio.md` (sessão anterior) | **mantido**: é registro do que foi entregue naquele momento; reescrevê-lo falsificaria o histórico. Este documento o atualiza |
| `share-url/viewer.ts`, `EmbedModal`, `ShareModal` | **intocados** — já apontam para `/viewer`, que é o nome que ficou |
| `README.md` | **sem ação** — a única menção é a pasta `viewer/` na árvore, não uma rota |

---

## 9. DECISÕES DO DONO

1. **Redirect `/view` → `/viewer`?** Não coloquei, pelo motivo do §6. Hoje
   `/view` dá 404 (**MEDIDO**). Se você chegou a anotar ou favoritar essa URL no
   último dia, é uma linha em `App.tsx`. Diga e eu ponho.
2. **`MAX_HANDLES` continua em 4, contra a letra da especificação** (§2.1).
   Aberta desde a sessão anterior; a medição está acima.
3. **Os dois itens abertos da sessão anterior seguem abertos** e não foram
   tocados aqui: container que não é painel quebra o auto layout
   (`dp-vpc` no seed de deployment), e o viewer descarta o roteamento do ELK.

---

## 10. NÃO VERIFICADO

- **Link de compartilhamento real no browser.** O `#data=` foi verificado em
  jsdom (dois testes, incluindo o de "não re-arranja"). No browser verifiquei
  `?diagramId=`, o estado de espera do embed sem parâmetros, e o 404 do `/view`
  — não gerei um link de share pela UI para abrir.
- **`postMessage` entre origens de verdade.** Testado com um `MessageEvent`
  despachado em jsdom. Iframe real cruzando origem, não.
- **O snippet de iframe do `EmbedModal` colado numa página de terceiro.** O que
  verifiquei é que a URL que ele produz não mudou (`share-url/viewer.ts`
  intocado) e que `/viewer` sem parâmetros ainda entra em espera.
- **`?source=file` de ponta a ponta.** Escolher o arquivo abre diálogo nativo,
  que travaria a sessão do browser. Verificado: a tela do seletor e o rótulo do
  `path`.
- **Itens 1 e 6 da tabela** vêm de medição da sessão anterior, não re-executada
  aqui. O item 6 eu **re-verifiquei** nesta sessão por `diff` contra o `main`
  (byte-a-byte idêntico); o item 1 não re-medi — reproduzi só a leitura do código
  que explica o efeito.

---

## 11. Estado final

**Branch:** `feat/layout-visualization`. Sem PR.

| sha | assunto |
|---|---|
| `89291d3` | (base desta sessão) `feat(diagram): refuse a connection whose source…` |
| _parte 1_ | `docs(viewer): validate the delivered epic against its specification` |
| _parte 2_ | `refactor(viewer): fold /view into /viewer, one reading route` |

Nenhuma menção a Claude em mensagem, autor ou co-autor.

**Portões, na Parte 2:**

| portão | resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 213 arquivos, **1.971 testes, zero falhas** |
| `npm run build` | exit 0 |
| prettier nos arquivos tocados | `All matched files use Prettier code style!` |

Nota sobre a contagem: a especificação diz "1.916 testes". Esse era o número do
`main` antes desta branch. A branch trouxe 55 testes novos (30 até `89291d3`, 9
da unificação, e os demais das fatias anteriores), menos 4 removidos junto com
`ViewPage.test.tsx`. **MEDIDO:** 1.971, zero falhas.

**`git status --porcelain`:** vazio no início, vazio no fim.

**Processos:** um `vite` em `--port 8097 --strictPort`, PID em
`scratchpad/vite-8097.pid`, derrubado por `kill <PID>` desse arquivo. Nenhum
`pkill`, `killall`, `killpg`, `kill -- -PID` ou `fuser -k`. Nenhum `git stash`.
Uma única aba de browser, criada e fechada.

**`lsof -i :8080`:** livre no início. Estado no fim registrado no fecho da
resposta.

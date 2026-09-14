# Épico — qualidade de traçado e fundação do modo de visualização

Branch `feat/layout-visualization`, base `main` em `37b43e6`. Dois commits.

Toda afirmação abaixo está marcada **MEDIDO**, **LIDO NO CÓDIGO** ou **HIPÓTESE**.

---

## 1. Resultado em quatro linhas

1. **Fatia 1 — a premissa estava invertida.** Reduzir `MAX_HANDLES` não corta a
   sobreposição colinear em ~9×: multiplica-a. **MEDIDO** no fixture G, por valor
   de `MAX_HANDLES`: 1 → 212.936px, 2 → 96.541px, 3 → 14.310px, **4 (atual) →
   3.213px**, 5 → 2.588px, 6 → 2.306px. Cruzamentos ficam praticamente imóveis em
   toda a faixa (20.713–20.743). `MAX_HANDLES` **foi mantido em 4**, com
   justificativa, e a fatia entregou a outra metade: o conjunto de handles agora é
   declarado por tipo.
2. **Fatia 1 — o conjunto de handles agora é declarado.** `note`, `json-viewer` e
   `db-table` **continuam sem handle de origem, de propósito** — são coisas para as
   quais o diagrama aponta, e a seta nunca sai delas. A declaração
   (`outgoing: 0`) agora registra isso, com teste, para que a ausência não seja
   lida como lacuna e "corrigida" de novo. `external-element`, `svg` e `endpoint`
   declaram o par único que desenham, e a atribuição parou de pedir slot além
   dele.
3. **Fatia 2 — perfis separados e rota no ar.** `ELK_OPTIONS_INTERACTIVE`
   (idêntico ao anterior) e `ELK_OPTIONS_VISUALIZATION` (novo). Rota `/view`
   funcionando com `?diagramId=` e `?source=file&path=`, aplicando o layout ao
   carregar, sem botão e sem animação.
4. **Fatia 2 — qualidade do traçado.** **MEDIDO** do jeito que `/view` realmente
   desenha, nos quatro diagramas de referência: interativo 15 cruzamentos / 2
   sobreposições de rótulo / 1.959px de sobreposição colinear; visualização
   **13 / 1 / 1.772px**. Melhor nas três. O portão do §4.5 passa.

---

## 2. Fatia 1 — `MAX_HANDLES` e os handles declarados

### 2.1 O que foi medido antes

Instrumento: o próprio `measureRenderedReadability` do repo (caminho renderizado,
não o roteamento do ELK), mais um contador de sobreposição colinear que escrevi
para esta medição — comprimento total, em px, compartilhado por segmentos
paralelos de arestas **diferentes** sobre a mesma reta. Ele existe porque nenhuma
métrica do repo enxergava esse caso: duas arestas desenhadas uma em cima da outra
nunca se cruzam propriamente, então o contador de cruzamentos é cego a elas.

Baseline no fixture G (`~/structura-scratch/auditoria-core-canvas/fixtures/G.json`):

| métrica | valor |
|---|---|
| nós / arestas no grafo de layout | 400 / 550 |
| cruzamentos renderizados | 20.742 |
| cruzamentos de posicionamento | 21.551 |
| sobreposição colinear | 3.213px em 30 pares |
| handles no nó mais conectado | 8 (4 de cada lado) |
| handles totais nos nós conectados | 1.220 |

Baseline nos quatro diagramas de referência do repo: 14 cruzamentos, 40px de
sobreposição colinear.

### 2.2 Os números herdados não reproduziram

- **"439 arestas" no fixture G** — **MEDIDO**: são **550**. O arquivo tem 400
  componentes e 550 conexões.
- **"19 cruzamentos" de distância entre ELK e tela** — não reproduzi e não achei
  de onde vem. O registro do próprio repo, em
  `layoutReadability.baseline.test.ts`, é **15** cruzamentos renderizados somados
  nos quatro diagramas de referência, e esse arquivo já documenta uma correção
  anterior de um número que também não reproduzia ("16 → 15 nunca foi a
  comparação"). Medi 14 com os waypoints do ELK aplicados e 15 sem eles. O número
  19 não corresponde a nenhuma configuração que consegui produzir.
- **"reduzir `MAX_HANDLES` elimina ~9× a sobreposição colinear"** — **MEDIDO como
  falso, e com o sinal trocado.** Ver a tabela abaixo.

### 2.3 A varredura de `MAX_HANDLES`

Método: alterar a constante em `layout.constants.ts`, medir, restaurar. É o
caminho de código real, não uma reimplementação.

| `MAX_HANDLES` | refs: cruz. | refs: colinear | G: cruz. | G: colinear | G: pares | G: max handles/nó |
|---|---|---|---|---|---|---|
| 1 | 13 | 2.856px | 20.713 | **212.936px** | 469 | 2 |
| 2 | 16 | 1.805px | 20.722 | 96.541px | 176 | 4 |
| 3 | 16 | 408px | 20.743 | 14.310px | 62 | 6 |
| **4 (atual)** | **14** | **40px** | **20.742** | **3.213px** | **30** | **8** |
| 5 | 14 | 75px | 20.740 | 2.588px | 17 | 8 |
| 6 | 13 | 0px | 20.734 | 2.306px | 13 | 9 |

Duas leituras, ambas **MEDIDAS**:

1. **`MAX_HANDLES` não é alavanca de cruzamento.** A faixa inteira cabe em 30
   cruzamentos de diferença sobre ~20.700 no fixture G, e em 3 sobre 14 nos
   diagramas de referência. Não há sinal aqui.
2. **Reduzir piora a sobreposição colinear, monotonicamente.** A causa é direta e
   **LIDA NO CÓDIGO** (`handleAnchor` em `renderedEdgePath.ts`, `buildHandles` em
   `Handles.tsx`): com menos slots, mais arestas saem do mesmo ponto de ancoragem,
   e o primeiro trecho horizontal delas é literalmente a mesma reta. Com
   `MAX_HANDLES = 1` todas as arestas de um nó saem do mesmo pixel.

**Decisão: `MAX_HANDLES` fica em 4.** 6 é 28% melhor em sobreposição colinear, mas
custa mais handles no DOM por nó em um caminho que o `AGENTS.md` marca como
quente, e 4 já está a 40% do piso. Não reduzi, porque reduzir é que era a hipótese
e ela mede o contrário.

### 2.4 O que mudou de fato

**LIDO NO CÓDIGO** — o defeito: `buildEdgeHandleAssignments` limitava todo slot a
`MAX_HANDLES` e tratava três tipos por nome, enquanto cada componente de nó
decidia sozinho quantos `<Handle>` renderizar. Os dois discordavam em seis tipos:

| tipo | renderiza | a atribuição podia pedir | correção |
|---|---|---|---|
| `note` | só `in-<id>` | `source-0..3` | declara `outgoing: 0` — **não é origem** |
| `json-viewer` | só `in-<id>` | idem | idem |
| `db-table` | só `in-<id>` | idem | idem |
| `external-element` | `target-0`, `source-0` | `target-1..3`, `source-1..3` | declara `1`/`1` |
| `svg` | `target-0`, `source-0` | idem | idem |
| `endpoint` | `target-0`, `source-0` | idem | idem |

A correção: `NodeTypeDescriptor.handles` passa a ser a única declaração do que um
tipo renderiza, e `buildEdgeHandleAssignments` lê essa declaração. Os doze
descritores declaram; descritores de plugin recebem o padrão em
`toInternalDescriptor`. A spec vive num módulo folha (`handle-spec.ts`) porque os
três componentes precisam do id do handle compartilhado e a atribuição precisa das
specs — juntá-los no registry fecharia um ciclo de import
(`connectionDerivations → registry → descriptor → NoteNode → connectionDerivations`).

**Correção de rumo, depois de revisão do dono.** Uma primeira versão desta fatia
adicionou um handle de origem a `note`, `json-viewer` e `db-table`, tratando a
ausência como lacuna. Estava errado: esses três tipos não devem ter saída — são
coisas para as quais o diagrama aponta. Revertido. O que ficou é a declaração
`outgoing: 0`, que registra a intenção onde antes ela só existia implicitamente em
três componentes, mais um teste que falha se alguém acrescentar o handle outra vez.

**A evidência que usei para justificar a adição não sustentava a conclusão.** Os
"111 de 550" vinham do fixture G, cujo gerador (`make-fixtures.mjs`) sorteia
origem e destino **uniformemente entre todos os nós folha**, dos quais 20% são
notas. Notas como origem ali são artefato do gerador aleatório, não evidência de
uso real. Usei um grafo sintético para responder uma pergunta de produto.

**Fora do escopo pedido, mas o mesmo defeito:** `to-export-model.ts` tinha
`const MAX_HANDLES = 9`, sob um comentário afirmando que batia com o canvas, que é
4. **LIDO NO CÓDIGO**: o número define a altura da âncora — slot `i` de `n` fica em
`(i+1)/(n+1)` da altura do nó — então um nó com quatro arestas de saída ancorava em
20/40/60/80% na tela e em 10/20/30/40% em todo export. Passou a importar a
constante real.

### 2.5 Testes, escritos antes e vistos falhar

- `handle-spec.test.ts` (10 testes) — todo descritor declara; nenhuma declaração
  passa de `MAX_HANDLES`; a atribuição nunca emite slot que o tipo não declarou;
  um teste nomeado por tipo para cada um dos seis corrigidos.
- `handle-spec.render.test.tsx` (7 testes) — renderiza cada tipo corrigido dentro
  de um `<ReactFlow>` real e conta `.react-flow__handle` no DOM, comparando com a
  declaração. É a metade que os tipos não pegam: um handle ausente não lança nada
  em jsdom, a aresta só não existe.

Ambos falharam antes da implementação (`Failed to resolve import "./handle-spec"`
e `handleSpecForType is not a function`).

### 2.6 Medição depois

**MEDIDO**: cruzamentos e sobreposição colinear **não mudaram** — G segue em
20.742 / 3.213px, refs em 14 / 40px. Isso é esperado e vale dizer claramente: a
métrica de cruzamento é cega a esta correção. Ela mede geometria de arestas
desenhadas; a correção é sobre arestas **chegarem** a ser desenhadas.

Para `external-element`, `svg` e `endpoint` a correção é real e mensurável: a
atribuição não pede mais `target-1..3` / `source-1..3` em tipos que desenham um
par único. Nenhum dos fixtures medidos contém esses tipos, então não há número de
antes/depois para eles — o que os cobre é o teste de render, que conta os handles
no DOM contra a declaração.

Para `note`, `json-viewer` e `db-table` não há correção de comportamento: o
comportamento deles está como sempre esteve. O que mudou é que agora está
declarado.

**Declarado, como a regra pede:** a sobreposição colinear **não caiu ~9×**. Ela
não caiu nada, porque a alavanca que deveria produzir essa queda mede o contrário
do que a hipótese dizia. Nenhum ganho é atribuído a esta fatia nessa métrica.

---

## 3. Fatia 2 — perfis de ELK e rota `/view`

### 3.1 Duas premissas do enunciado que já eram verdade

**LIDO NO CÓDIGO**, antes de mexer em qualquer coisa:

- **"Direção: `DOWN` (atual) → `LEFT → RIGHT`"** — o `ELK_OPTIONS` já usava
  `"elk.direction": "RIGHT"`, e o comentário do módulo já explicava por quê (ELK
  não tem token `LEFT_TO_RIGHT`; um valor errado é ignorado em silêncio). Não há
  mudança de direção a fazer, nos dois perfis. Isso também esvazia a parada
  obrigatória do §5 sobre `LEFT → RIGHT` produzir resultado pior: nada mudou de
  direção, então nada pode piorar por causa dela.
- **"Sem posições de usuário: o ELK ignora `x`/`y`"** — já era verdade por
  construção: `LayoutNode` (em `contract.ts`) não tem campo `x` nem `y`. O ELK
  nunca viu posição de usuário nenhuma.

### 3.2 A medição que mudou a resposta

**LIDO NO CÓDIGO**: `EditableEdge` lê pontos de controle via `useEdgeControlPoints`,
que consulta `state.diagrams[state.activeDiagramId]`. Uma rota de leitura não tem
diagrama ativo, então **o `ViewerCanvas` descarta o roteamento do ELK** e desenha
degraus ortogonais entre handles.

Isso não é detalhe: uma opção afinada contra o roteamento do ELK pode ser pior na
tela. E uma foi. **MEDIDO**, nos quatro diagramas de referência:

| opção | com waypoints do ELK | como o `/view` desenha |
|---|---|---|
| `bk.fixedAlignment=BALANCED` | 14 → **12** cruzamentos | 15 → **20** cruzamentos |
| `nodePlacement.strategy=NETWORK_SIMPLEX` | — | 15 → **13** cruzamentos |

Optei pela segunda métrica, que é a que o usuário vê nesta rota.

### 3.3 Os dois perfis

**`ELK_OPTIONS_INTERACTIVE`** — o `ELK_OPTIONS` anterior, byte por byte. Só o nome
mudou. Um teste fixa o objeto inteiro para que a separação não possa alterá-lo.

**`ELK_OPTIONS_VISUALIZATION`** — herda tudo e sobrescreve quatro coisas. Cada
valor com fonte ou medição, como a regra pede:

| opção | valor | justificativa |
|---|---|---|
| `layered.nodePlacement.strategy` | `NETWORK_SIMPLEX` | **MEDIDO**: única opção que moveu cruzamentos, 15 → 13 sozinha. **HIPÓTESE** para o porquê: BRANDES_KOEPF otimiza retidão de arestas longas, e com o roteamento descartado a retidão não é o que chega ao leitor. |
| `spacing.edgeNode` | `40` | **MEDIDO**: junto com `edgeEdge`, tira a última sobreposição de rótulo (2 → 1). Rótulos são desenhados como pílula no meio do caminho e o ELK nunca é informado deles, então espaço entre caminhos é a única alavanca. |
| `spacing.edgeEdge` | `25` | idem |
| `spacing.nodeNode` | `110` | Espaçamento generoso de leitura. **FONTE**: o exemplo do React Flow com ELK usa `80`/`100`; o perfil interativo já excede isso em `80`/`150`, então estes não corrigem o exemplo, ampliam. **MEDIDO**: `140`/`260` foi testado e é pior em sobreposição (2.060px) por mais largura. |
| `layered.spacing.nodeNodeBetweenLayers` | `220` | idem |

**Medidos e rejeitados** (registrado no comentário da constante):
`layered.thoroughness`, `spacing.edgeLabel`, `spacing.labelNode` e
`separateConnectedComponents` não mudam absolutamente nada — saída idêntica byte a
byte ao controle, o mesmo resultado que uma chave de opção deliberadamente
inválida produz, que é como o ELK reporta uma opção que não usa. `SIMPLE` (31
cruzamentos) e `LINEAR_SEGMENTS` (26) são muito piores.
`considerModelOrder.strategy` **lança exceção dentro do elkjs 0.12** nestes grafos
(`TypeError: Cannot read properties of undefined (reading 'a')`).

### 3.4 A rota `/view`

`src/pages/ViewPage.tsx`, registrada fora de `MainPages` junto com `/viewer`:
ambas são superfícies de janela inteira sem chrome, e uma webview apontada para
uma delas não deve montar o toaster, o host de modal de plugin nem o preview sync.

- `?diagramId=<id>` — lê da store, arruma, renderiza.
- `?source=file&path=<caminho>` — lê um `.structura.json` do disco.
- Sem parâmetro — mensagem dizendo o que falta.

**Layout ao carregar, sem interação**: `useVisualizationLayout` roda no `useEffect`
de montagem e de novo sempre que a fonte muda. Não há botão em lugar nenhum da
rota.

**Instantâneo, sem animação**: não há animação a suprimir. `layoutForVisualization`
é pura e devolve um `Diagram` novo; o React Flow re-renderiza nas posições novas e
nada interpola. A transição do editor vive no caminho de arraste do canvas, que o
viewer não monta. Foi por isso que não precisei de `{animate: false}` — não existe
esse caminho aqui.

**Nada é escrito.** A função é pura: abrir um link nunca reescreve as posições que
o usuário salvou. Um teste fixa isso.

### 3.5 Integração com o `ViewerCanvas` — nenhuma mudança necessária

**LIDO NO CÓDIGO**: `ViewerCanvas` já recebe `diagram` por prop e nunca consulta a
store. O ponto de extensão que o §4.3 previa ter de adicionar já existe. Não
adicionei prop `externalDiagram` nem toquei no componente. A parada obrigatória do
§5 sobre refatoração maior do `ViewerCanvas` **não se aplica**.

### 3.6 Leitura do arquivo — como e por quê

**Escolha: File System Access API com `showOpenFilePicker`.** O `path` da query é
um rótulo, não um caminho aberto.

O motivo é uma regra de plataforma, não uma lacuna: uma página não abre caminho
arbitrário; a API só entrega um handle que o usuário escolheu no seletor. `fetch`
era a alternativa e é pior — alcança os arquivos do dev server, não os do usuário,
então também não abre o que o chamador está nomeando. Há precedente no projeto:
`FileSystemAdapter.ts` já usa `showDirectoryPicker`.

**Detecção de mudança:** `FileSystemObserver` onde o browser tem (Chrome 129+),
porque reporta a escrita em vez de ser perguntado sobre ela. Onde não tem,
`getFile()` a cada **500ms** comparando `lastModified` — um `File` é um snapshot
barato dos metadados do handle, então não é leitura de conteúdo, e 500ms fica
abaixo do que um leitor percebe sem chegar perto de laço ocupado.

Formatos aceitos: um `Diagram` puro, ou um payload de workspace persistido (de
onde sai o diagrama de `activeDiagramId`, ou o único que houver).

### 3.7 Testes, escritos antes e vistos falhar

- `layoutProfiles.test.ts` (4) — os dois perfis leem da esquerda para a direita; o
  perfil interativo é fixado objeto inteiro; o de visualização preserva a
  hierarquia e gasta mais espaço; os dois posicionam nós por estratégias
  diferentes, de propósito.
- `ViewPage.test.tsx` (4) — `?diagramId=beta` renderiza Beta e não Alpha; um id
  inexistente vira `role="alert"`; o layout roda **sem nenhum clique** (dois nós
  semeados em (0,0) terminam em transforms distintos); a store fica intacta.

Falharam antes (`Cannot find module './ViewPage'`, quatro asserts de perfil).

### 3.8 Medição de qualidade — o portão do §4.5

**MEDIDO**, quatro diagramas de referência, renderizados como o `/view` renderiza
(sem waypoints, com a ordem de handles do ELK):

| | interativo | visualização |
|---|---|---|
| cruzamentos renderizados | 15 | **13** |
| sobreposições de rótulo | 2 | **1** |
| sobreposição colinear | 1.959px | **1.772px** |

Fixture G, com waypoints:

| | interativo | visualização |
|---|---|---|
| cruzamentos | 20.742 | 20.739 |
| sobreposição colinear | 3.213px | **2.517px** (−22%) |
| tamanho | 20700×18591 | 20530×**16501** (11% mais curto) |

**Melhor ou igual em tudo. O portão passa.** Registro por honestidade que, medido
*com* os waypoints do ELK — cenário que não é o desta rota — a sobreposição
colinear do perfil de visualização é pior (150px contra 40px). Não afeta o `/view`,
mas afeta se algum dia o viewer passar a desenhar os waypoints.

### 3.9 Avaliação visual

Abri `/view` no workspace-semente real do projeto (`URLShort`, quatro diagramas de
arquitetura), num dev server em porta própria.

**`d-us-containers` (11 nós / 11 arestas) — bom.** A leitura sai limpa da esquerda
para a direita: atores (Criador de Links, Visitante) → Dashboard SPA / Redirect API
→ Management API → SQS → Analytics Worker → PostgreSQL. Todo nó recebe pela
esquerda e sai pela direita. O painel "URLShort Platform" contém seus filhos
corretamente. Ampliando, contei **uma** colisão de rótulo — "Aquece cache
(write-through)" sobre "Publica click.registered" — exatamente a sobreposição
única que a métrica reportou. Os outros três diagramas do seed não têm problema de
contenção.

**`d-us-deployment` (22 nós / 17 arestas) — ruim, e não por causa desta mudança.**
Dois painéis escapam da caixa do pai e o diagrama fica ilegível. Isolei a causa e
**MEDI os dois perfis**, com resultado idêntico:

```
interactive: dp-public-subnet  at 40,62  1160x567 fora de dp-vpc 260x109
             dp-private-subnet at 1360,40 1445x647 fora de dp-vpc 260x109
visualization: dp-public-subnet  at 40,81  1300x627 fora de dp-vpc 260x109
               dp-private-subnet at 1585,59 1623x707 fora de dp-vpc 260x109
```

**LIDO NO CÓDIGO**: `dp-vpc` é do tipo `aws-networking`, não `panel`, e tem dois
painéis como filhos. `resizableIds` (em `fromDiagram.ts`) só marca painéis como
redimensionáveis — o comentário dele argumenta deliberadamente por isso — então o
ELK dimensiona `dp-vpc` para caber ~3.000px de filhos e o canvas continua
desenhando a caixa de 260×109 que ele tinha. Os filhos vazam.

É um defeito **pré-existente do auto layout**, que a rota `/view` apenas torna
visível por sempre aplicar layout. Não corrigi: a correção é mudar a política de
`resizableIds`, que é uma decisão deliberada documentada no código. Está no §4
abaixo.

Não rodei o botão de auto layout no workspace do dono para comparar — isso teria
reescrito os dados dele. A comparação acima foi feita fora do browser, sobre os
mesmos diagramas-semente.

---

## 4. DECISÕES DO DONO

0. **Aresta saindo de uma nota continua desaparecendo em silêncio.** Com
   `outgoing: 0` declarado, `note` / `json-viewer` / `db-table` não têm handle de
   origem — correto. Mas se uma conexão com uma nota como origem existir nos dados
   (importação, geração por LLM, plugin), a atribuição ainda emite `source-0`,
   React Flow recusa (erro #008) e a aresta simplesmente não aparece. A UI não
   permite desenhá-la, então isso só chega por esses caminhos. **Decisão:** bloquear
   na criação da conexão, mostrar como inválida, ou deixar como está? Não decidi
   por você — é regra de produto, e foi exatamente por presumir aqui que eu errei
   antes.

1. **`MAX_HANDLES` fica em 4, contra o enunciado.** Reduzir mede o oposto do que a
   hipótese dizia. Se você quiser o piso de sobreposição colinear, 6 dá −28% sobre
   4 (2.306px contra 3.213px), ao custo de mais handles no DOM por nó num caminho
   que o `AGENTS.md` marca como quente. Precisa da sua chamada, e eu não a faria
   sem medir o custo de render primeiro.

2. **Container que não é painel quebra o auto layout.** `dp-vpc` no diagrama de
   deployment do seed é o caso. Atinge o botão de auto layout hoje, não só a rota
   nova. As saídas que vejo: (a) `resizableIds` passa a incluir qualquer
   componente que tenha filhos, contrariando o comentário que argumenta o
   contrário; (b) `fromDiagram` deixa de aninhar filhos sob um pai não-painel; (c)
   fica como está e o `/view` fica ruim nesse diagrama. Não escolhi por você.

3. **`?source=file&path=` não abre o caminho, e isso é regra de plataforma.** Uma
   webview do VSCode é um iframe: `showOpenFilePicker` é bloqueado lá. **Isto não
   bloqueia a feature** — o caminho real para a extensão é `postMessage`, que é
   como o `hediet.vscode-drawio` funciona e como o `/viewer` deste projeto já
   funciona (`STRUCTURA_READY` / `STRUCTURA_LOAD`). Deixei o `/view` no escopo que
   você pediu. **Decisão:** quer que eu acrescente o canal `postMessage` ao
   `/view` antes da extensão, ou a extensão aponta para o `/viewer` existente e o
   `/view` fica sendo a superfície de browser?

4. **O viewer descarta o roteamento do ELK.** É por isso que o perfil de
   visualização teve de ser afinado contra degraus ortogonais em vez do caminho
   que o ELK calculou. Fazer o viewer desenhar os waypoints significa tirar
   `useControlPoints` da store e passá-lo por contexto — mexida na camada de
   arestas, que o `AGENTS.md` marca como frágil e cujo commit mais recente do
   `main` (`37b43e6`) é justamente sobre ela. Não encostei. **HIPÓTESE**, não
   medida: com os waypoints desenhados, o perfil de visualização provavelmente
   deveria voltar a `BALANCED`.

---

## 4b. Correção fora do escopo: auto layout não aparecia sem refresh

Reportado pelo dono durante a revisão. **Não é regressão deste épico** — verifiquei
no `main` intocado (worktree em `37b43e6`, porta separada), com números idênticos.

**Sintoma, MEDIDO no browser** (diagrama-semente `d-us-containers`, um Auto Layout
(LR)):

| | antes da correção |
|---|---|
| nós movidos em `nodeLayouts` | **11 de 11** |
| nós movidos no DOM | **0 de 11** |

O layout novo só aparecia depois de recarregar a página.

**Causa, LIDA NO CÓDIGO** — `useLocalNodes.ts`, no merge da cópia local:

```ts
const useRemotePosition = sn.parentId !== ln.parentId;
position: useRemotePosition ? sn.position : ln.position,
```

A posição local sempre vence, exceto se o nó trocar de pai. Isso está certo para
arraste — durante um arraste a store está um frame atrás do ponteiro — e errado
para um layout calculado, que move nós sem trocar pai. A cópia local ficava com a
posição velha até algo forçar o descarte: trocar de diagrama, desfazer, ou
recarregar. **Desfazer funcionava**, e é isso que deixa a forma do bug legível:
`shouldDiscardLocalNodes` só olhava `_lastUndoRedoAt`.

**Correção:** um segundo selo, `_lastLayoutWriteAt`, na mesma forma do que já
existia, incrementado por `applyAutoLayout` — o que cobre de uma vez o botão de
auto layout, o layout de filhos de painel, `layoutScopedNodes`, a API de plugin e
o patch do LLM, que todos passam por lá. `shouldDiscardLocalNodes` passa a
descartar quando qualquer um dos dois muda.

**Depois, MEDIDO no browser** (`d-us-components`, 18 nós):

| | depois |
|---|---|
| nós movidos no DOM | **18 de 18**, sem refresh |
| arestas no DOM | **7 de 7** — a camada de arestas não desmontou |

O segundo número importa: o caminho de descarte é o que o
`docs/investigation/edge-relayer.md` documenta como caro (1756 mutações, ~184ms em
400 nós). Ele é seguro aqui porque `withLocalMeasured` preserva `measured`, e
porque um auto layout é uma ação deliberada e pontual, não um frame de arraste.

**Teste antes, visto falhar:** `useLocalNodes.layoutWrite.test.ts` (3) — o layout
chega ao canvas (falhou com `x: 0` esperando `x: 640`); `measured` sobrevive; e o
guarda que impede isso de virar "sempre usar a posição da store", porque um commit
de arraste escreve a store sem incrementar o selo e ali a cópia local é a verdade.

---

## 5. NÃO VERIFICADO

- **A extensão do VSCode.** Fora de escopo por decisão sua. Que uma webview do
  VSCode consiga carregar `/view` e que o `postMessage` atravesse é **HIPÓTESE**,
  baseada no `hediet.vscode-drawio` e no `/viewer` deste projeto. Não testei.
- **`FileSystemObserver`.** O caminho de polling foi o exercitado. O ramo do
  observer não rodou: o Chrome desta máquina não expõe a API. É código não
  executado.
- **Re-leitura de arquivo de ponta a ponta.** Escolher o arquivo abre um diálogo
  nativo do sistema, que travaria a sessão do browser — o aviso é explícito nas
  minhas instruções. Verifiquei a tela do seletor e o rótulo do `path`; **não**
  verifiquei ler → salvar em disco → ver redesenhar.
- **Sobreposição colinear como proxy de legibilidade.** É uma métrica que escrevi
  para este épico. Ela captura o caso real de arestas desenhadas uma sobre a outra,
  mas não foi validada contra julgamento humano além da inspeção do §3.9.
- **Custo de render dos handles.** A varredura de `MAX_HANDLES` mediu geometria,
  não tempo de frame. A afirmação de que 6 "custa mais no caminho quente" é
  **LIDA NO CÓDIGO** (mais elementos `<Handle>` por nó), não cronometrada.
- **Fixture G como proxy de arquitetura.** É um grafo sintético de 400 nós com
  arestas aleatórias; ~20.700 cruzamentos são dominados pela aleatoriedade, não
  pelo layout. Os quatro diagramas de referência e o seed `URLShort` são o sinal
  que importa; G serve para ordem de grandeza e para a contagem de arestas
  descartadas.
- **Os outros três diagramas do seed em `/view`.** Verifiquei contenção nos quatro
  fora do browser; olhei na tela apenas `d-us-containers` e `d-us-deployment`.
- **`external-element`, `svg` e `endpoint` com muitas conexões, na tela.** A
  correção da atribuição neles está coberta por teste de render, não por inspeção
  visual: nenhum fixture medido contém esses tipos.
- **O selo `_lastLayoutWriteAt` sob arraste em diagrama grande.** Medi o caminho
  novo em 18 nós. Não cronometrei o descarte em 400 nós, onde o
  `edge-relayer.md` registra ~184ms — um auto layout ali paga esse custo uma vez,
  por desenho, mas não medi.

---

## 6. Estado final

**Branch:** `feat/layout-visualization`, a partir de `main` em `37b43e6`. Sem PR.

**Commits:**

| sha | assunto |
|---|---|
| `aaa18c9` | `fix(canvas): declare each node type's handle set on its descriptor` |
| `3d301c0` | `feat(viewer): add the /view reading route and a layout profile for it` |

Nenhuma menção a Claude em mensagem, autor ou co-autor.

**Portões, nos dois commits:**

| portão | resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 212 arquivos, **1.946 testes, zero falhas** (1.916 do baseline + 30 novos) |
| `npm run build` | exit 0 |
| prettier nos arquivos tocados | `All matched files use Prettier code style!` |

**`git status --porcelain`:** vazio no início (em `main`), vazio no fim.

**Processos:** um `vite` em `--port 8097 --strictPort`, PID em
`scratchpad/vite-8097.pid`, derrubado por `kill <PID>` desse arquivo. Nenhum
`pkill`, `killall`, `killpg`, `kill -- -PID` ou `fuser -k`. Nenhum `git stash`.
Uma única aba de browser, criada e fechada.

**`lsof -i :8080`:** livre no início. **No fim, ocupada** — `node` PID 39084 em
LISTEN, com uma conexão estabelecida do Chrome. **Não é meu**: nunca usei a 8080,
todo o trabalho correu na 8097, e a 8080 estava comprovadamente livre quando
comecei. Subiu durante a sessão, presumivelmente na janela ao lado. Deixei em paz.
A 8097, que era minha, está livre e sem processo `vite` restante.

**Arquivos novos:**

```
src/features/canvas/nodes/node-types/handle-spec.ts
src/features/canvas/nodes/node-types/handle-spec.test.ts
src/features/canvas/nodes/node-types/handle-spec.render.test.tsx
src/features/canvas/layout/layoutProfiles.test.ts
src/features/viewer/layoutForVisualization.ts
src/features/viewer/hooks/useStructuraFile.ts
src/pages/ViewPage.tsx
src/pages/ViewPage.test.tsx
src/features/canvas/hooks/useLocalNodes.layoutWrite.test.ts
docs/epico-layout-visualization/relatorio.md
```

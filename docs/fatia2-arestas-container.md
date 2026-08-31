# Épico de Geração — Fatia 2: arestas de container, aplicador único e fixtures congelados

Sessão de implementação sobre `main`. Artefatos em `docs/fatia2-arestas-container/`.
Três seções separadas — **Medido**, **Inferido**, **NÃO VERIFICADO**.

---

## Veredito

As cinco tarefas foram entregues.

**A aresta para container renderiza.** No app real, com o prompt verbatim do Caso B,
duas gerações com arestas endereçadas a container: **33 de 33** e **44 de 44**
conexões chegaram ao DOM, **zero React Flow #008**. Na Fatia 1 a mesma forma
perdia 16 de 27.

**A distância ELK ↔ renderizado não mudou de patamar** — e a Tarefa 5 previa que o
número renderizado subisse. Não subiu, e a previsão estava errada por uma razão
específica: as medições da Fatia 1 **já contavam** as arestas de container. Detalhe
em §1.5.

**Achado que dispara a parada:** o defeito não era só do painel. Mais **seis tipos
de nó** renderizam menos handles do que a atribuição pede e perdem aresta do mesmo
jeito silencioso — `external-element`, `svg`, `endpoint`, `note`, `json-viewer` e
`db-table`. Nenhum deles é alcançável pelo caminho do IR, então o invariante desta
fatia se mantém. **Reportado, não corrigido** (§4).

**Uma mutação da tabela não mordeu** — a D. Está em §1.7 com essa palavra.

---

## 0. O que mudou no código

| Arquivo | Mudança |
|---|---|
| `canvas/layout/applyLayoutResult.ts` | novo `options.idMap` — tradução id-do-grafo → id-da-store, para nó e para aresta |
| `llm/ir/apply-ir.ts` | os dois laços próprios (handleOrder e waypoints) removidos; passa a chamar `applyLayoutResultEdges` com `idMap` e `waypointOffset` |
| `canvas/nodes/CustomNode/Handles.tsx` | `HandleBehaviour` (subconjunto de `NodeData`), `handleSlotCount`, `handleTopPercent` extraídos; novo `buildPanelHandles` |
| `canvas/nodes/PanelNode.tsx` | renderiza `target-N` à esquerda e `source-N` à direita, nos dois ramos (expandido e recolhido) |
| `canvas/nodes/node-types/panel.descriptor.ts` | passa `incomingCount`/`outgoingCount` da mesma fonte e com o mesmo clamp do descritor C4 |
| `canvas/layout/generated-diagrams/` | **novo** — 6 IRs reais congelados (`A-run{1,2,3}.ts`, `B-run{1,2,3}.ts`, `index.ts`) |

Testes novos: `canvas/edges/ir-edges-reach-the-dom.test.tsx` (22),
`canvas/edges/connectionDerivations.panelPorts.test.ts` (10),
`canvas/layout/generated-diagrams.baseline.test.ts` (10),
`llm/ir/apply-ir.applicator.test.ts` (6).

Nada da lista de fora-de-escopo foi tocado: qualidade de traçado, waypoints do ELK,
canal de aviso do validator e as 17 regras, colocação do grafo gerado, passo de
histórico espúrio, tipo `database`, regras de domínio AWS.

---

## 1. MEDIDO

### 1.1 Tarefa 1 — o `apply-ir` entrou no aplicador único

O laço próprio de waypoints existia por um motivo real: o grafo de layout é
chaveado por **ids do IR** e a store acabou de cunhar **ids próprios**. Isso não
impediu a consolidação — virou um parâmetro:

```ts
idMap?: {
  node?: (graphNodeId: string) => string | undefined;
  edge?: (graphEdgeId: string) => string | undefined;
};
```

Os outros quatro consumidores montam o grafo a partir da store, então a identidade
é a tradução certa e eles não passam nada. O mapeamento deixou de estar espalhado
por dois laços que podiam divergir e passou a ser construído em um lugar só.

**Aceite, medido com `--retry=0`:** os cruzamentos do caminho IR nos quatro
fixtures de referência continuam **48 → 15**, por diagrama e no total:

```
C4 e-commerce            round-robin  10 -> elk   2
AWS ECS Fargate          round-robin  12 -> elk   3
C4 Context healthcare    round-robin  12 -> elk   3
AWS microservices        round-robin  14 -> elk   7
TOTAL rendered crossings 15
```

Guarda nova: `apply-ir.applicator.test.ts` prova que **nenhum id do IR chega à
store** — nem como chave de `handleOrder`, nem como valor dentro dela, nem como
id de conexão em `setEdgeControlPoints` — e que uma aresta sem contrapartida na
store é pulada em vez de escrita com o id errado. Escrever um id do IR ali é
silencioso: nada estoura, o canvas só ignora uma ordenação que nomeia conexões que
ele nunca viu, e o diagrama volta para handles round-robin.

### 1.2 Tarefa 2 — handles no `PanelNode`

`buildEdgeHandleAssignments` nunca tratou painel como caso especial: ele já
produzia `target-1`, `source-2` para um painel. O que faltava era o elemento no
DOM. Agora o painel renderiza `handleSlotCount(count)` slots por lado, com a mesma
fórmula vertical `(i+1)/(n+1)` de todo mundo — a mesma que `handleAnchor` usa para
medir, com um teste ligando as duas.

Duas restrições respeitadas, e verificadas:

- **`FIXED_EDGE_SIDES` intacta.** `buildPanelHandles` chama `buildHandles` com
  `Position.Left` para `target` e `Position.Right` para `source`, sem olhar
  geometria nenhuma. Nada de lado dinâmico, nem "só para painéis".
- **`handleOrder` vale para painel.** Medido em
  `connectionDerivations.panelPorts.test.ts`: com três conexões chegando num
  painel na ordem `c1, c2, c3` e `handleOrder.incoming = [c3, c2, c1]`, os slots
  saem `c1→target-2, c2→target-1, c3→target-0`. O controle ao lado — o mesmo
  painel sem `handleOrder` — sai `target-0/1/2`, então as duas asserções não
  medem a mesma coisa.

**Conflito de ponteiro: não houve, e a decisão foi tomada em cima disso.** Os
handles do painel saem com `pointer-events: none` e invisíveis
(`!bg-transparent !opacity-0`). O painel é `connectable: false` — o usuário não
pode puxar conexão dele — então um ponto visível anunciaria uma affordance que não
existe, e um handle clicável competiria com `.panel-header`, `.panel-border` e
`.panel-body`, as três regiões de hit que a Fatia 1 do épico de seleção
estabeleceu. Nada delas foi tocado.

### 1.3 Tarefa 3 — o invariante

`src/features/canvas/edges/ir-edges-reach-the-dom.test.tsx` roda os **10** diagramas
(6 congelados + 4 de referência) por um `<ReactFlow>` de verdade, com o registro de
tipos de nó de verdade e a atribuição de handle de verdade, e afirma:

1. `connections.length === ir.edges.length` — nada se perdeu antes da store;
2. toda conexão produz um `.react-flow__edge` no DOM;
3. todo handle que a atribuição pede existe no nó que o renderiza.

A checagem (2) é contada **contra o IR**, não contra as conexões da store: comparar
DOM com store deixaria passar uma aresta perdida antes da store, que sumiria dos
dois lados da igualdade.

**Duas medições feitas ao escrever isso, e ambas mudaram o desenho do teste:**

- Com os handles do painel removidos, este harness renderiza **11 das 27 arestas do
  B-run1** — exatamente as 11 que o browser real renderizou na Fatia 1. O teste
  unitário reproduz o defeito de produção no número.
- **O React Flow não emite aviso nenhum em jsdom**, nem com 16 arestas
  descartadas. No Chrome ele ao menos loga `error#008`. Aqui a aresta simplesmente
  não está. Por isso a checagem de console é secundária e está marcada como tal no
  arquivo — quem carrega a garantia é a contagem de arestas no DOM. A checagem
  explícita de console limpo que a tarefa pediu foi feita **no browser** (§1.4).

Perigo conhecido, tratado: o React Flow renderiza **zero** arestas em jsdom se os
nós não forem medidos, e um stub de `ResizeObserver` que nunca dispara deixaria
todas as asserções passando sobre um canvas vazio. O teste
`renders any edges at all` existe só para isso não acontecer calado.

### 1.4 Verificação no browser — console limpo e paridade de arestas

App real, diagrama novo por run, prompt verbatim do Caso B, "Aceitar" clicado antes
de medir, `console.warn` e `console.error` grampeados na página.

| run | nós IR | arestas IR | **arestas para container** | `.react-flow__edge-path` | handles de painel no DOM | **#008** |
|---|---:|---:|---:|---:|---:|---:|
| F2-B-check1 | 41 | 33 | **14** | **33** | 26 | **0** |
| F2-B-check2 | 38 | 44 | **4** | **44** | 16 | **0** |

As 14 do primeiro run incluem `alb-a-to-ecs`, `alb-b-to-ecs`,
`ecs-cluster-to-ecs-fargate-a` — exatamente o idioma AWS que derrubava o B-run1.
Pelo comportamento da Fatia 1, o run 1 teria desenhado 19 das 33 e o run 2, 40 das 44.

`docs/fatia2-arestas-container/measure-browser-check.json`,
`F2-B-check1-render.jpg`, `F2-B-check1.ir.json`.

### 1.5 Tarefas 4 e 5 — os fixtures congelados, e por que o número não subiu

Os 6 IRs dos runs A e B da Fatia 1 estão em
`src/features/canvas/layout/generated-diagrams/`, como literais TypeScript
tipados `DiagramIR` — capturados verbatim, sem reparo e sem arrumação. Ids fixos
por construção: são strings literais.

**Eles reproduzem o browser à unidade.** Medidos pelo caminho de produção
(`irToLayoutGraph → layoutElkGraph → readElkHandleOrder → measureRenderedReadability`),
os seis dão exatamente os números que os mesmos runs deram no Chrome na Fatia 1:

| fixture | nós | arestas | p/ container | ELK | renderizado | sobrep. renderizadas | prof. | fora do pai |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A-run1 | 33 | 33 | 0 | 1 | 10 | 5 | 2 | **0** |
| A-run2 | 34 | 40 | 0 | 0 | 7 | 5 | 2 | **0** |
| A-run3 | 34 | 40 | 0 | 4 | 51 | 14 | 2 | **0** |
| B-run1 | 39 | 27 | **16** | 7 | 23 | 23 | **4** | **0** |
| B-run2 | 42 | 33 | 0 | 33 | 99 | 36 | 3 | **0** |
| B-run3 | 33 | 37 | 0 | 52 | 83 | 7 | **4** | **0** |

Os números são **exatos, não teto**. Com a entrada congelada o caminho é
determinístico, então qualquer movimento é mudança de layout e nada mais.

**A previsão da Tarefa 5 não se confirmou, e a razão é verificável.** A tarefa
esperava que o número renderizado subisse porque "os 99 cruzamentos do B-run2 foram
medidos num diagrama a que faltavam arestas". Não faltavam: `measureRenderedReadability`
ancora uma aresta na caixa que ela nomeia, painel ou folha, sem saber se o DOM tem
handle. Os 23 cruzamentos do B-run1 **já incluíam** as 16 arestas que o canvas não
desenhava. Medi os seis fixtures **antes** da mudança do `PanelNode` e **depois**:
idênticos, os doze números.

Quem subcontava era o **DOM**, não a medição. O que a Fatia 2 mudou foi fazer os
dois concordarem — e é isso que licencia usar estes fixtures no lugar de dirigir o
Chrome para cada pergunta de layout.

**A distância ELK ↔ renderizado**, que é o número que a Fatia 3 vai atacar:

```
A-run1  elk   1 -> rendered  10   gap   9
A-run2  elk   0 -> rendered   7   gap   7
A-run3  elk   4 -> rendered  51   gap  47
B-run1  elk   7 -> rendered  23   gap  16
B-run2  elk  33 -> rendered  99   gap  66
B-run3  elk  52 -> rendered  83   gap  31
TOTAL   elk  97 -> rendered 273   gap 176
```

**Não mudou de patamar** — é o mesmo antes e depois desta fatia. E o containment
aguenta: `childrenOutsideParent` é **0 nos seis**, incluindo os dois que chegam a
quatro níveis (VPC → AZ → Subnet → serviço). Nenhum outro fixture do repo chega
nessa profundidade.

### 1.6 Sensibilidade a id — medida, porque a mutação D dependia disso

| fixture | como está | todos os ids prefixados `zz-` | ordem lexical invertida |
|---|---|---|---|
| A-run1 | elk 1 / rend 10 | 1 / 10 | 2 / **5** |
| A-run2 | 0 / 7 | 0 / 7 | 0 / 7 |
| A-run3 | 4 / 51 | 4 / 51 | 4 / **43** |
| B-run1 | 7 / 23 | 7 / 23 | 7 / **11** |
| B-run2 | 33 / 99 | 33 / 99 | **11** / **55** |
| B-run3 | 52 / 83 | 52 / 83 | **60** / **78** |

O layout é **insensível ao valor** de um id e a uma renomeação uniforme, e
**sensível à ordem relativa**. Renomear nada além dos ids move o layout mais do que
a maioria das mudanças de layout moveria. Isso é assunto da Fatia 3; está aqui
porque é o que torna congelar os fixtures útil.

`docs/fatia2-arestas-container/measure-id-sensitivity-frozen.json`

### 1.7 Tabela de mutações — três mordem, **a D não**

Log completo em `docs/fatia2-arestas-container/mutation-log.txt`. Baseline:
4 arquivos, 48 testes, verde.

| # | mutação | o que caiu |
|---|---|---|
| **A** | remover os handles do `PanelNode` | 2 testes, só no B-run1 — o único fixture com aresta para container: `every IR edge produces an edge element` e `every assigned handle exists on the node that renders it` |
| **B** | descartar uma aresta em silêncio no aplicador do IR (`buildGeneratedGraphInputs` emitindo `ir.edges.slice(1)`) | **10 testes**, um por diagrama |
| **C** | ignorar `handleOrder` quando o alvo é painel | `assigns the slot the order names, not the arrival order` |
| **D** | trocar um id fixo de fixture por um gerado | **NADA. ACHADO.** |
| extra | remover o `idMap` do `apply-ir` (consolidação da Tarefa 1) | 4 testes |

**A mutação D não derrubou nada**, e a investigação está em §1.6: trocar `"az-a"`
por `"n-7f3c91a2"` no B-run1 não move número nenhum, porque a sensibilidade é à
ordem relativa dos ids e não ao valor de um id isolado. Some-se a isso que os
fixtures são literais congelados — **não existe caminho de código que gere id para
mutar**. O teste de estabilidade continua fazendo o trabalho dele (pina os números
exatos), mas não é ele que fecharia essa mutação, e afirmar o contrário seria
justamente o tipo de teste decorativo que este projeto já achou seis vezes.

Estado final: `npx vitest run --retry=0` → **884 testes, 113 arquivos, 0 falhas**.
`npx tsc -b` → **exit 0**.

---

## 2. INFERIDO

1. **O painel recolhido resolve suas arestas igual ao expandido.** Os handles são
   renderizados nos dois ramos do `PanelNode`, e o React Flow não distingue — mas
   nenhum run recolheu um painel. Ver §3.2.

2. **A ausência de aviso do React Flow em jsdom é do ambiente, não da versão.** O
   Chrome logou `error#008` na Fatia 1 com a mesma versão do `@xyflow/react`. Não
   localizei a guarda que suprime o log em jsdom.

3. **Os handles invisíveis não confundem o usuário.** É julgamento, não medição:
   ninguém usou a build. A aresta termina visivelmente na borda do painel porque o
   caminho é desenhado até a posição do handle, que é o que importa.

4. **A ordem `handleOrder` do ELK melhora as arestas de container tanto quanto as
   de folha.** O mecanismo é o mesmo e o teste de ordenação prova que se aplica,
   mas os seis fixtures não permitem separar o efeito: só o B-run1 tem arestas de
   container, e não medi ele com e sem `handleOrder` isoladamente.

---

## 3. NÃO VERIFICADO

1. **Se as seis tipagens do §4 quebram algum diagrama real do usuário.** Medi que a
   incompatibilidade existe e o que ela custa em um caso sintético de 3+3 conexões.
   Não sei quantos diagramas reais têm um `note` com aresta de saída ou um
   `endpoint` com duas entradas.

2. **Painel recolhido, no browser.** Implementado, não observado.

3. **Arrasto e marquee no painel depois da mudança.** Os handles saem com
   `pointer-events: none`, então em princípio não competem — mas não repeti o
   roteiro manual de ponteiro da Fatia 1 do épico de seleção no Chrome. É a
   verificação que faltou nesta fatia.

4. **A causa da distância ELK ↔ renderizado.** Medida (176 sobre os seis), não
   explicada. É a Fatia 3.

5. **Por que o `handleOrder` do ELK não fecha o gap.** O A-run3 tem 4 cruzamentos
   no ELK e 51 no desenho *com* a ordenação aplicada. Não investiguei.

6. **Se `insertGeneratedGraph` sempre devolve `connectionIds` na ordem de `edges`.**
   O `idMap` do `apply-ir` pareia por índice, como o código anterior pareava. Li a
   implementação, não escrevi teste que prove a ordem, e o meu teste do aplicador
   usa um stub que devolve na ordem por construção.

7. **Efeito da mudança sobre exportação (PNG/SVG/drawio).** As arestas de container
   agora existem no canvas; o `export-service` tem o seu próprio roteamento
   (`FIXED_EDGE_SIDES`) e não o exercitei.

---

## 4. Modo de falha novo — parada obrigatória

**Seis outros tipos de nó perdem aresta pelo mesmo mecanismo.**

Não fui procurar: montar o invariante da Tarefa 3 exigia saber quais ids de handle
cada tipo de nó renderiza, e ler os componentes trouxe isso. Foi então **medido**,
não deixado como leitura de código — 3 conexões de entrada e 3 de saída em cada
tipo, renderizado pelo registro real, handles lidos do DOM:

| tipo | handles renderizados | a atribuição pede | arestas no DOM |
|---|---|---|---:|
| `external-element` | `target-0`, `source-0` | `target-0..2`, `source-0..2` | **2 de 6** |
| `svg` | `target-0`, `source-0` | idem | **2 de 6** |
| `endpoint` | `target-0`, `source-0` | idem | **2 de 6** |
| `note` | `in-x` | `in-x`, `source-0..2` | **3 de 6** |
| `json-viewer` | `in-x` | idem | **3 de 6** |
| `db-table` | `in-x` | idem | **3 de 6** |
| `process-node` | `target-0..3`, `source-0..3` | `target-0..2`, `source-0..2` | 6 de 6 |
| `container` (C4) | `target-0..2`, `source-0..2` | idem | 6 de 6 |
| **`panel`** | **`target-0..2`, `source-0..2`** | idem | **6 de 6** (era 1 de 6) |

`note`, `json-viewer` e `db-table` são o caso mais forte: **não renderizam handle de
origem nenhum**, então uma aresta *saindo* de uma nota nunca pode ser desenhada, com
qualquer contagem.

**O invariante desta fatia continua valendo**: nenhum desses seis tipos é produzido
por `mapNodeToComponent` — o caminho do IR gera `panel` e os tipos folha C4/AWS — e
os 10 diagramas do teste passam. Eles são alcançáveis desenhando à mão.

**Reportado, não corrigido.** Consertar significa ou dar a esses componentes os
handles que a atribuição espera, ou fazer a atribuição respeitar o que cada tipo
renderiza. As duas saídas são decisão de produto sobre como uma nota ou um endpoint
recebe uma segunda aresta — e a decisão desta fatia foi explicitamente sobre painel.

`docs/fatia2-arestas-container/finding-other-node-types.json`

---

## 5. Erros próprios desta sessão

**1. Escrevi um teste de waypoints vacuoso e quase o deixei passar.** A primeira
versão de `apply-ir.applicator.test.ts` usava um IR de três nós em linha. Linha reta
não tem bend point: `setEdgeControlPoints` **nunca foi chamado**, e as duas
asserções sobre waypoints — inclusive a do offset de viewport — passavam sobre uma
lista vazia. Peguei porque instrumentei o mock e imprimi `WAYPOINTS []` antes de
seguir. Corrigido trocando o fixture por um diagrama de referência e adicionando
`writes waypoints at all — without this the assertions below are vacuous` como
primeiro teste do arquivo. É o mesmo padrão do teste decorativo da Fatia 1: **número
suposto onde cabia número observado**, agora na forma "chamada suposta onde cabia
chamada observada".

**2. Afirmei um comentário que a medição desmentiu.** O cabeçalho de
`generated-diagrams.baseline.test.ts` dizia que a exatidão dos números pegaria "um
id virando não-determinístico". A mutação D provou que não pega. Reescrevi o
comentário com o que foi medido: insensível ao valor do id, sensível à ordem.

**3. Deixei um "não medido" num artefato por preguiça de 30 segundos.** A primeira
versão de `measure-id-sensitivity-frozen.json` registrava as duas últimas células da
permutação como não medidas porque a saída da sonda tinha sido truncada por um
`head`. As células existiam; bastou rodar de novo. Corrigido — a tabela está
completa.

**4. Dois `tsc` quebrados por tipos de teste**, ambos corrigidos no mesmo turno
(`string | null | undefined` no cursor de profundidade). Sem consequência, mas
registrados porque o hábito de rodar `tsc -b` só no fim já custou uma afirmação
errada na Fatia 1.

Perdi ainda algum tempo com o React Flow em jsdom: os nós renderizavam e as arestas
não, até descobrir que o stub de `ResizeObserver` precisa **disparar** o callback
para o React Flow considerar o nó medido. O teste carrega uma guarda contra isso
justamente porque foi assim que quase virou um harness que media zero.

---

## 6. Como reproduzir

```bash
# suíte inteira, sem o retry: 2 do vitest.config.ts
npx vitest run --retry=0

# o invariante (10 diagramas, React Flow de verdade em jsdom)
npx vitest run --retry=0 src/features/canvas/edges/ir-edges-reach-the-dom.test.tsx

# os fixtures congelados, com a tabela ELK -> renderizado
npx vitest run --retry=0 --reporter=verbose \
  src/features/canvas/layout/generated-diagrams.baseline.test.ts

# o aceite da Tarefa 1: 48 -> 15
npx vitest run --retry=0 --reporter=verbose \
  src/features/canvas/layout/layoutReadability.baseline.test.ts

# mutação A
# (remover a linha `{panelHandles}` das duas ocorrências em PanelNode.tsx)
npx vitest run --retry=0 src/features/canvas/edges/ir-edges-reach-the-dom.test.tsx
git checkout src/features/canvas/nodes/PanelNode.tsx
```

A verificação de browser (§1.4) precisa da aba em primeiro plano e de uma conexão
OpenAI configurada; o método está no campo `how` de
`docs/fatia2-arestas-container/measure-browser-check.json`.

---

## 7. O que a próxima fatia herda

1. **A distância ELK ↔ renderizado: 97 → 273 nos seis fixtures congelados**, com o
   gap concentrado em A-run3 (47) e B-run2 (66). Agora é mensurável sem browser e
   sem o modelo no meio.
2. **A instabilidade sob permutação de ids** (§1.6): renomear só os ids move o
   layout em 5 dos 6 fixtures. Enquanto isso não for entendido, "melhorou o
   traçado" é difícil de distinguir de "os ids saíram diferentes".
3. **Os seis tipos de nó do §4**, com decisão de produto no meio.
4. **Waypoints do ELK**, incluindo a hipótese híbrida — anotada na Fatia 1, ainda
   não implementada.

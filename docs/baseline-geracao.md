# Épico de Geração — Fase 0: baseline medida

Data da medição: **2026-08-27**. Base: `main` em `68679d7` (working tree limpo no
início da sessão).

Sessão de descoberta. Nenhuma correção foi implementada. Nenhuma mudança de
código de produto foi feita — a exceção prevista na Tarefa 2 (fixar ids de
fixture) **não foi necessária**, e a justificativa está medida na §2.

Evidência bruta em [`docs/baseline-geracao/`](baseline-geracao/). Os harnesses de
medição estão em [`docs/baseline-geracao/harness/`](baseline-geracao/harness/) com
extensão `.ts.txt` — ficam fora de `src/**`, então nem o `tsc -b` nem o Vitest os
enxergam. Para reproduzir um número, copie o arquivo para `src/` e rode o comando
indicado.

---

## Resumo executivo

Três coisas mudam a leitura do épico:

1. **O que derruba a geração de ~40 nós não é o validator. É `max_tokens: 3000`.**
   Nos 6 runs de ~40 nós (Casos A e B), a resposta do modelo chega **cortada no
   meio de uma string** e falha com `invalidJson`. Reparando só a cauda truncada,
   as 6 respostas **passam pelo validator sem uma única diagnostic** (33–41 nós).
   O modelo modelou certo; o transporte cortou.

2. **A pergunta em aberto está respondida: é escala, não modelagem C4.**
   A (C4, ~40) e B (AWS, ~40) falham 3/3 de forma idêntica. C (C4, ~10) e
   D (AWS, ~10) renderizam 3/3. O eixo é tamanho, não provider nem aninhamento.

3. **O número 48 → 15 não está morto. Ele reproduz exatamente na `main` de hoje.**
   Medido 10 vezes, com variância zero.

Duas premissas do prompt desta sessão não se sustentaram na medição, e estão
tratadas em detalhe abaixo: a de que o `apply-ir` teria invalidado a medição de
cruzamentos (§2), e a de que o risco restante seria "validator estrito demais"
(§3).

### Provência do modelo

Todos os 12 runs usaram a conexão LLM já configurada no app do usuário:
**provider `openai`, modelo `gpt-4.1`, modo `direct`** (lido de
`structura:llm:connections`, com a chave redigida). Nenhum run usou Claude. Isso
importa: os limites observados na §1 são do caminho `openai.ts`, e `anthropic.ts`
tem o mesmo `max_tokens: 3000` (`src/features/llm/providers/anthropic.ts:22`).

---

# 1. MEDIDO — Baseline do `/generate` em quatro casos

12 runs, no app real (`http://localhost:8080`), dirigindo a UI de verdade:
clique no campo de chat, digitação, clique no botão de enviar. Sem
`force`, sem input sintético, sem bypass de DOM.

## 1.1 Prompts usados, verbatim

Digitados **sem acentuação** (a ferramenta de digitação do browser não emite
caracteres acentuados de forma confiável). Isso é um desvio conhecido do que um
usuário digitaria; nenhum dos modos de falha observados depende de acento.

| Caso | Prompt |
|---|---|
| **A** | `/generate Diagrama C4 de container para uma seguradora, com cerca de 40 nos. Dominios: emissao de apolice, gestao de sinistro, subscricao (underwriting), pagamento, portal do corretor e deteccao de fraude. Inclua os atores (segurado, corretor, analista de sinistro, subscritor), os containers de cada dominio (API, worker, servico de regras) e os bancos de dados de cada dominio.` |
| **B** | `/generate Diagrama de deployment AWS com cerca de 40 nos para uma aplicacao web de producao. Inclua uma VPC com duas Availability Zones, cada uma com subnet publica e subnet privada; Application Load Balancer na subnet publica; servicos ECS Fargate e funcoes Lambda nas subnets privadas; RDS Multi-AZ; buckets S3; filas SQS e topicos SNS; CloudFront e Route 53 na borda; NAT Gateway por AZ; e Secrets Manager e CloudWatch.` |
| **C** | `/generate Diagrama C4 de container com cerca de 10 nos para um encurtador de URLs: usuario, aplicacao web, API de encurtamento, servico de redirecionamento, banco de dados e cache.` |
| **D** | `/generate Diagrama de deployment AWS com cerca de 10 nos: uma VPC com uma subnet publica e uma subnet privada, Application Load Balancer, uma funcao Lambda, um banco RDS e um bucket S3.` |

## 1.2 Resultado dos 12 runs

`domNodes` = nós contados no DOM do React Flow depois da geração.
`ms` = do clique em enviar até a última linha de log do pipeline IR.

| Run | ms | bytes da resposta | JSON parseia | domNodes | nós no IR | arestas no IR | veredito |
|---|---:|---:|---|---:|---:|---:|---|
| A-run1 | n/d¹ | 9334 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| A-run2 | 18098 | 9308 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| A-run3 | 22664 | 9523 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| B-run1 | 18605 | 8532 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| B-run2 | 17533 | 8732 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| B-run3 | 20307 | 8910 | **não** | 0 | — | — | **NÃO RENDERIZA** |
| C-run1 | 8534 | 2921 | sim | 10 | 10 | 10 | renderiza |
| C-run2 | 6685 | 2739 | sim | 10 | 10 | 10 | renderiza |
| C-run3 | 5400 | 2577 | sim | 9 | 9 | 10 | renderiza |
| D-run1 | 6237 | 2101 | sim | 8 | 8 | 3 | renderiza |
| D-run2 | 5392 | 2507 | sim | 9 | 9 | 4 | renderiza |
| D-run3 | 4774 | 1894 | sim | 9 | 9 | 4 | renderiza |

¹ A-run1 rodou antes de eu instalar o cronômetro; os bytes e o veredito são do
mesmo run.

**Não houve divergência de veredito dentro de nenhum caso.** Os 3 runs de cada
caso concordaram. O achado em destaque que a Tarefa 1 pedia (três runs divergindo)
**não ocorreu** — a falha é determinística, não estocástica, o que é uma notícia
melhor: tem causa única.

Reproduzir a re-validação das 12 respostas capturadas:

```
cp docs/baseline-geracao/harness/measure-captured-irs.test.ts.txt src/measure-captured.test.ts
PROBE_OUT=/tmp/probe npx vitest run src/measure-captured.test.ts --retry=0
```
→ `/tmp/probe/captured.json`, `/tmp/probe/repaired.json`
(cópias em `measure-captured-irs.json` e `measure-repaired-tails.json`).

## 1.3 O que o usuário vê quando não renderiza

Canvas **completamente vazio**. A única sinalização é uma mensagem no chat:

> O modelo devolveu um diagrama fora do schema do IR:
> - A resposta não é um JSON válido.

Texto de `llmChat.ir.invalid` + `llmChat.ir.issue.invalidJson`
(`src/infrastructure/i18n/locales/pt-BR.json:656,662`). O usuário não recebe
nenhuma indicação de que o modelo produziu 33–41 nós corretos e que o corte foi
de orçamento de saída, não de modelagem.

## 1.4 Causa raiz da falha dos Casos A e B — MEDIDO

Cada uma das 6 respostas termina no meio de um token. A cauda de A-run1:

```
{ "id": "api-fraude-worker-fraude", "sourceId": "api-fraude", "targetId": "worker-fraude", "label
```

`JSON.parse` falha com `Unterminated string starting at: line 84 column 96 (char 9328)`.

Removendo a entrada incompleta e fechando o JSON, **as 6 respostas validam sem
nenhuma diagnostic**:

| Run | nós | arestas | diagnostics do validator |
|---|---:|---:|---|
| A-run1 | 33 | 30 | **nenhuma** |
| A-run2 | 34 | 28 | **nenhuma** |
| A-run3 | 34 | 31 | **nenhuma** |
| B-run1 | 40 | 16 | **nenhuma** |
| B-run2 | 40 | 19 | **nenhuma** |
| B-run3 | 41 | 17 | **nenhuma** |

O corte vem de `OPENAI_MAX_TOKENS = 3000` em
`src/features/llm/providers/openai.ts:5`, aplicado em `openai.ts:21`.
~9300 bytes de JSON denso corresponde à ordem de 3000 tokens. O mesmo teto está
em `src/features/llm/providers/anthropic.ts:22`.

Nada no pipeline detecta truncamento: `readOpenAICompatibleStream` não inspeciona
`finish_reason`, então `length` (cota estourada) e `stop` (fim natural) chegam
indistinguíveis em `parseAndValidateIR`, que só consegue dizer "não é JSON".

**Consequência para o épico:** nenhuma flexibilização do validator resolve os
Casos A e B. O JSON está fisicamente incompleto.

## 1.5 Qualidade visual dos casos que renderizaram — MEDIDO

Medido offline a partir dos IRs capturados, pelo **mesmo caminho de produção** que
o `apply-ir` usa (`irToLayoutGraph` → `layoutElkGraph` → `readElkHandleOrder` →
`measureRenderedReadability`).

| Run | nós | arestas | cruzamentos ELK | cruzamentos renderizados | sobreposições aresta-nó | filhos fora do pai |
|---|---:|---:|---:|---:|---:|---:|
| C-run1 | 10 | 10 | 1 | **7** | 1 | **0** |
| C-run2 | 10 | 10 | 2 | 1 | 2 | **0** |
| C-run3 | 9 | 10 | 1 | 1 | 3 | **0** |
| D-run1 | 8 | 3 | 0 | 0 | 1 | **0** |
| D-run2 | 9 | 4 | 0 | 1 | 0 | **0** |
| D-run3 | 9 | 4 | 0 | 0 | 0 | **0** |

Dois pontos:

- **Nenhum nó fora do painel pai, em nenhum run.** O aninhamento VPC → AZ →
  Subnet e o C4 system-boundary → containers ficam geometricamente contidos. Esse
  modo de falha não aparece nos tamanhos que renderizam.
- **C-run1 mede 7 cruzamentos renderizados contra 1 do ELK.** O ELK resolveu o
  layout quase sem cruzamento e o desenho por handles reintroduziu 6. É a mesma
  distância ELK-vs-renderizado que a §2 mostra nos fixtures, e é onde está a
  margem de qualidade — não na colocação dos nós.

Captura de tela do D-run3, o melhor resultado AWS obtido:
[`D-run3-render.jpg`](baseline-geracao/D-run3-render.jpg).

---

# 2. MEDIDO — Medição de cruzamentos reprodutível

## 2.1 A medição é estável. Nenhuma alteração de código foi necessária.

O prompt autorizava fixar os ids dos fixtures **se** a medição piscasse. Rodei os
5 diagramas de referência 10 vezes:

```
cp docs/baseline-geracao/harness/measure-stability-elk-ids.test.ts.txt src/measure-stability.test.ts
PROBE_OUT=/tmp/probe PROBE_RUNS=10 npx vitest run src/measure-stability.test.ts --retry=0
```
→ `/tmp/probe/A-repeat.json` (cópia em `measure-repeat-stability.json`).

**Variância zero em todas as métricas, nos 5 diagramas, nas 10 execuções.**
Desvio entre execuções: **0**.

O motivo é que os fixtures de `reference-diagrams.ts` **já têm ids fixos**, e o
`apply-ir` lê os ids do IR — não os ids aleatórios da store. A exceção prevista
não foi usada, e não há commit de fixture nesta sessão.

## 2.2 Número atual dos cinco diagramas de referência

| Diagrama | nós | arestas | cruzamentos ELK | **cruzamentos renderizados** | round-robin | sobreposições aresta-nó (renderizado) |
|---|---:|---:|---:|---:|---:|---:|
| C4 e-commerce | 16 | 16 | 0 | **2** | 10 | 2 |
| AWS ECS Fargate | 18 | 14 | 4 | **3** | 12 | 4 |
| C4 Context healthcare | 10 | 11 | 0 | **3** | 12 | 0 |
| AWS microservices | 17 | 17 | 5 | **7** | 14 | 7 |
| **Total (4 do ELK)** | | | 9 | **15** | **48** | **13** |
| Hand-placed (5º) | 8 | 9 | — | **7** | — | 5 |

**48 → 15 reproduz exatamente**, por diagrama e no total, com desvio 0 entre
execuções. A premissa desta sessão de que "esse número está morto porque o
`apply-ir` mudou" **não se confirma**: o `apply-ir` e a medição consomem o mesmo
`irToLayoutGraph` + `layoutElkGraph`, e a mudança do épico de layout não moveu
nenhum dos dois. Não há nada a re-medir aqui — o número vigente é o número.

**Número novo, que nenhum teste guarda hoje:** 13 sobreposições aresta-nó no
caminho renderizado (2+4+0+7), mais 5 no hand-placed. O
`layoutReadability.baseline.test.ts` só põe teto em `edgeNodeOverlaps` da rota do
**ELK** (0 nos quatro), não do caminho desenhado. É a métrica que descreve a tela
e está sem guarda.

## 2.3 O achado de instabilidade por id é real — mas não atinge o `/generate`

Relabelando os ids de forma estrutura-preservante (12 permutações por diagrama):

| Diagrama | mín | máx | **desvio** |
|---|---:|---:|---:|
| C4 e-commerce | 1 | 2 | 1 |
| AWS ECS Fargate | 3 | 3 | **0** |
| C4 Context healthcare | 4 | 10 | **6** |
| AWS microservices | 4 | 7 | 3 |

O desvio chega a **6 cruzamentos**, maior que os "até 4" que o prompt registrava.
Causa em `sortById` (`src/features/canvas/layout/layoutEngine.ts:65-67`): a ordem
de entrada do ELK é a ordem alfabética dos ids, e o ELK é sensível a ela.

**Mas isso não atinge o `/generate`**: o `apply-ir` lê os ids do IR, escolhidos
pelo modelo e estáveis dentro de um run. Atinge o auto-layout disparado sobre um
diagrama da store, onde os ids são `generateId("el")` aleatórios
(`src/features/diagram/store/slices/generated-graph.slice.ts:75`). Isso é um
achado para o épico de layout, não para o de geração.

## 2.4 Prova de que cada opção de ELK é lida

O modo de falha nº 1 ("o ELK ignora chave inválida em silêncio") exige prova. Para
cada uma das 8 opções em `ELK_OPTIONS` (`layoutEngine.ts:32-41`), perturbei o
valor e comparei a impressão digital das caixas:

| Chave | mudou o layout? |
|---|---|
| `elk.algorithm` | **sim** |
| `elk.direction` | **sim** |
| `elk.edgeRouting` | **sim** |
| `elk.layered.spacing.nodeNodeBetweenLayers` | **sim** |
| `elk.spacing.nodeNode` | **sim** |
| `elk.layered.nodePlacement.strategy` | **sim** |
| `elk.padding` | **sim** |
| `elk.hierarchyHandling` | **sim** |
| *controle* `elk.paddingg` | não |
| *controle* `elk.padding.WRONG` | não |
| *controle* `elk.spacing.nodeNodeTypo` | não |
| *controle* `elk.direction.LEFT_TO_RIGHT` | não |

As 8 são lidas; os 4 controles com chave inexistente não mudam nada, o que
confirma que o experimento distingue as duas coisas.

**Os dois comentários do `layoutEngine.ts` ficam confirmados por medição**, não
por leitura:

- *"`elk.padding` com `:` falha o parse e aplica o default de 12px em silêncio"* —
  **confirmado**. `[top:300,...]`, `[top:40,...]` e a string `"nonsense"` produzem
  geometria **byte a byte idêntica** a `[top=12,...]`, e diferente do
  `[top=40,...]` que está em produção. Evidência: `measure-elk-padding.json`.
- *"`elk.direction` não tem token `LEFT_TO_RIGHT`"* — **consistente**:
  `LEFT_TO_RIGHT` produz o mesmo resultado que o default e que `RIGHT`, enquanto
  `DOWN` difere. O experimento não separa "token inválido → default" de "alias
  válido de RIGHT", e isso não muda nada em produção, onde o valor é `RIGHT`.

## 2.5 Risco de honestidade da medição

`vitest.config.ts:14` tem `retry: 2`. Qualquer teste de medição que oscile é
re-executado até passar, e o relatório de suíte mostra verde. Todos os números
desta sessão foram colhidos com `--retry=0` explícito.

---

# 3. MEDIDO — Auditoria completa das regras do validator

## 3.1 O achado estrutural

`validateIR` termina com (`src/features/llm/ir/ir-validator.ts:322-324`):

```ts
if (issues.length > 0 || !isIRDiagramType(value.type)) {
  return { ok: false, issues };
}
```

**Não existe canal de aviso.** Toda diagnostic é fatal. Verificado por execução —
cada uma das 21 regras foi disparada isoladamente sobre um IR saudável de 4 nós, e
todas retornaram `ok: false`:

```
cp docs/baseline-geracao/harness/measure-validator-rules.test.ts.txt src/measure-rules.test.ts
PROBE_OUT=/tmp/probe npx vitest run src/measure-rules.test.ts --retry=0
```
→ `measure-validator-rules.json` (controle: o IR saudável passa, 4 nós / 2 arestas).

## 3.2 Tabela completa

| # | código | arquivo:linha | o que detecta | classe | o que o usuário vê | dá para inferir? |
|---|---|---|---|---|---|---|
| 1 | `invalidJson` | `ir-validator.ts:332` | resposta não parseia | **irrecuperável** | canvas vazio + "A resposta não é um JSON válido." | Não — mas ver §3.4: hoje esconde truncamento |
| 2 | `notAnObject` | `:287` | raiz não é objeto | **irrecuperável** | canvas vazio | Não |
| 3 | `invalidDiagramType` | `:303` | `type` fora do vocabulário | **inferível** | canvas vazio | Sim — derivar dos `semanticType`: qualquer `aws-*` ⇒ `aws-deployment`, senão `c4-container` |
| 4 | `nodesNotArray` | `:310` | `nodes` não é lista | **irrecuperável** | canvas vazio | Não |
| 5 | `edgesNotArray` | `:313` | `edges` não é lista | **inferível** | canvas vazio | Sim — tratar como `[]`; um diagrama sem aresta é válido |
| 6 | `emptyNodes` | `:320` | zero nós | **irrecuperável** | canvas vazio | Não |
| 7 | `nodeNotAnObject` | `:134` | item de `nodes` não é objeto | **cosmético¹** | canvas vazio | Sim — descartar o item, avisar |
| 8 | `nodeMissingId` | `:138` | nó sem `id` | **cosmético¹** | canvas vazio | Sim — sintetizar id a partir do índice/nome |
| 9 | `nodeDuplicateId` | `:143` | `id` repetido | **cosmético¹** | canvas vazio | Sim — sufixar `-2`; já descarta o duplicado |
| 10 | `nodeMissingName` | `:150` | nó sem `name` | **inferível** | canvas vazio | Sim — usar o `id` como nome |
| 11 | `nodeInvalidSemanticType` | `:154` | `semanticType` fora do vocabulário | **inferível** | canvas vazio | Sim — cair para `container` (C4) ou `aws-general` (AWS) |
| 12 | `nodeInvalidParentId` | `:162` | `parentId` não-string e não-nulo | **inferível** | canvas vazio | Sim — tratar como `null` (raiz) |
| 13 | `nodeInvalidBoundary` | `:167` | `isBoundary` não-booleano | **inferível** | canvas vazio | Sim — coagir por veracidade; já há inferência por filhos |
| 14 | `nodeParentNotFound` | `:220` | `parentId` aponta para nó inexistente | **inferível** | canvas vazio | Sim — promover a raiz |
| 15 | `nodeSelfParent` | `:216` | nó é pai de si mesmo | **inferível** | canvas vazio | Sim — promover a raiz |
| 16 | `containmentCycle` | `:227` | ciclo de containment | **inferível** | canvas vazio | Sim — quebrar o ciclo promovendo um dos nós a raiz |
| 17 | `edgeNotAnObject` | `:254` | item de `edges` não é objeto | **cosmético¹** | canvas vazio | Sim — descartar a aresta |
| 18 | `edgeMissingId` | `:258` | aresta sem `id` | **cosmético¹** | canvas vazio | Sim — sintetizar `e-<i>` |
| 19 | `edgeDuplicateId` | `:263` | `id` de aresta repetido | **cosmético¹** | canvas vazio | Sim — sufixar |
| 20 | `edgeSourceNotFound` | `:272` | `sourceId` inexistente | **cosmético¹** | canvas vazio | Sim — descartar a aresta, manter os nós |
| 21 | `edgeTargetNotFound` | `:276` | `targetId` inexistente | **cosmético¹** | canvas vazio | Sim — descartar a aresta, manter os nós |

¹ *cosmético* aqui no sentido da regra de produto vigente: **o defeito é local, o
resto do diagrama existe e renderiza, então a geração nunca deveria ser perdida
por causa dele.**

Uma 22ª regra existe no tipo `IRIssueCode` mas nunca dispara em `validateIR`
isolado — `invalidJson` só é emitida por `parseAndValidateIR` (`:332`).

## 3.3 Contagem

- **Irrecuperáveis (devem bloquear): 4** — `invalidJson`, `notAnObject`,
  `nodesNotArray`, `emptyNodes`.
- **Inferíveis (não deveriam bloquear): 9** — itens 3, 5, 10, 11, 12, 13, 14, 15, 16.
- **Cosméticos / defeito local (nunca deveriam bloquear): 8** — itens 7, 8, 9,
  17, 18, 19, 20, 21.

**Bloqueiam indevidamente hoje: 17 das 21.** Todas as 21 bloqueiam; só 4 deveriam.

## 3.4 O caso `isBoundary` **já está corrigido na `main`**

Verificado por execução (`measure-isboundary.json`): um IR onde o modelo omite
`isBoundary` num nó que tem filhos é **aceito**, e o nó sai do validator com
`isBoundary: true`. A normalização está em
`src/features/llm/ir/ir-validator.ts:229-236`, e o mesmo raciocínio já foi
aplicado ao `tier` (`:171-176`).

Isso significa que a falha histórica do Caso A ("o modelo aninhou nós sem marcar
`isBoundary`, o validator rejeitou, nada renderizou") **não é mais reproduzível**.
O Caso A ainda falha 3/3, mas por outra razão inteiramente — truncamento (§1.4).
A leitura vigente de que "o risco restante é validator estrito demais" está
**parcialmente errada**: o validator é de fato estrito demais em 17 regras, mas
isso não é o que quebra os casos que quebram hoje.

---

# 4. MEDIDO — Duas perguntas de comportamento

## 4.1 `insertGeneratedGraph` **já soma**. O que falta é onde colocar.

Experimento: canvas com o resultado do Caso C (10 nós) já aceito; então
`/generate` do prompt do Caso D por cima.

| medida | valor |
|---|---|
| nós antes | 10 |
| nós depois | **18** |
| nós antigos que sobreviveram | **10 (todos)** |
| nós novos | 8 |

Evidência: [`measure-additive-insert.json`](baseline-geracao/measure-additive-insert.json).

`insertGeneratedGraph` escreve em `diagram.snapshot.components` sem nunca limpar
(`generated-graph.slice.ts:94-140`), e `applyIRToDiagram` só toca nos nós que
acabou de criar. A decisão do dono do produto ("deve somar") **já é o
comportamento**.

**O que falta é posicionamento.** O novo grafo é ancorado no canto superior
esquerdo do viewport atual — `currentViewportOrigin()`,
`src/features/llm/ir/apply-ir.ts:27-38`, com `VIEWPORT_MARGIN = 80` — sem
consultar o que já está no canvas. Na tela, o painel "VPC Principal" nasceu **em
cima** do painel "Sistema Encurtador de URLs". Os nós antigos não se moveram (o
código não os toca), mas ficaram visualmente soterrados.

Lacuna para o comportamento decidido: **uma regra de colocação que leia o bounding
box do conteúdo existente e ancore a geração ao lado dele**, não no viewport.

### Uma geração **não** é um único Ctrl+Z — MEDIDO

| ação | nós |
|---|---|
| depois da geração (aceita) | 18 |
| **1º Cmd+Z** | **18 — nada aconteceu** |
| 2º Cmd+Z | 10 |
| Cmd+Shift+Z | 18 |
| Cmd+Shift+Z | 18 |
| **1º Cmd+Z (sem clique intermediário)** | **18 — nada aconteceu** |

Reproduzido duas vezes, a segunda sem nenhum clique no canvas entre o redo e o
undo, o que descarta "o clique consumiu o passo". **Existe um passo de histórico
espúrio depois da geração**: o primeiro Cmd+Z é engolido, o segundo é que reverte.
`insertGeneratedGraph` empurra um checkpoint (`generated-graph.slice.ts:92`) e
`setEdgeControlPoints` é chamado com `{ history: false }`
(`apply-ir.ts:161-166`), então o passo extra vem de outro lugar no fluxo de
aceitação — **não localizei qual, e não investiguei além**, porque isso já é
correção.

## 4.2 `semanticType: "database"` — inventário de esforço

### Onde a degradação acontece

**`src/features/llm/ir/ir-to-component.ts:41`**, na tabela `LEAF_COMPONENT_TYPE`:

```ts
database: "container",
```

com o comentário em `:27-29` explicando: *"Structura's C4 model has no database
type, so it degrades to a container — the technology field carries the engine
name."*

Confirmado em produção: em C-run1 os nós `db-encurtador` e `cache-urls` saem do
validator com `semanticType: "database"` e chegam ao canvas como caixas de
container idênticas às de serviço. Na captura de tela, "Banco de Dados
(PostgreSQL)" é visualmente indistinguível de "API de Encurtamento (Node.js)".

Note que o lado AWS **não** degrada: `aws-database` mapeia para si mesmo
(`ir-to-component.ts:44`) e o canvas resolve o ícone por `awsService`. A
degradação é exclusiva do C4.

### O que o sistema de tipos já oferece

O registry de descriptors (`src/features/canvas/nodes/node-types/`) é feito para
isto. `registry.ts` avalia descriptors em ordem, com `c4Descriptor` como
catch-all obrigatoriamente último, e `registerDescriptor()` insere antes dele.
Um tipo novo é um `NodeTypeDescriptor` com `rfType`, `component`, `matches`,
`buildData`, `buildStyle`, `defaultSize` (contrato em
`node-types/README.md` e `node-types/types.ts`).

### O que seria preciso — inventário, não implementação

| item | onde | esforço |
|---|---|---|
| Membro `"database"` na união `ComponentType` | `src/features/diagram/model/component.types.ts:13-31` | 1 linha; o `_exhaustive: never` em `to-export-model.ts:353` **aponta sozinho** todo switch que ficou incompleto |
| `type` do `C4Component` | `component.types.ts:69` | 1 linha |
| `BUILTIN_COMPONENT_TYPES` | `sanitize-component-type.ts:11-26` | 1 linha; sem isso o tipo é saneado de volta para `component` |
| `C4_TYPES` | `component-type-constants.ts:6` | 1 linha |
| Descritor + componente React | novo `database.descriptor.ts` em `node-types/` | o item real de trabalho: forma visual (cilindro), ícone, registro antes do catch-all |
| Mapeamento do IR | `ir-to-component.ts:41` | trocar `"container"` por `"database"` |
| **Medição de texto** | — | **nenhum ponto de medição de texto existe no repo** (`grep measureText\|textWidth` → 0 ocorrências). O canvas dimensiona por CSS (`min-w-[200px] max-w-[260px]`); o export tem caixas canônicas. Não há nada a implementar aqui |
| Export drawio — geometria | `src/lib/export-core/constants.ts:236+` (`C4_META`) | entrada nova; sem ela cai em `C4_META.system` por `?? C4_META.system` (`geometry.ts:44`, `cell-builders.ts:28`) — degrada, não quebra |
| Export drawio — rótulo | `src/lib/export-core/styles.ts:14-22` (`c4TypeLabel`) | entrada nova; sem ela o `c4Type` do XML sai como a string crua `"database"` |
| Export drawio — passagem | `to-export-model.ts:238` (`subtype: c.type`) | **nada a fazer**, é genérico |
| i18n | `en.json:774` / `pt-BR.json:1056` e pares `quickInsert.*` / `multiSelect.*` | 2 chaves × 2 locales; consumidores em `MultiSelectPanel.tsx:49`, `QuickInsertPopover.tsx:188`, `buildPickerOptions.ts:33`, `SaveTemplateModal.tsx:27` |
| Migração de persistência | `persist.config.ts` | **provavelmente não** — é tipo novo, não mudança de schema; diagramas antigos seguem com `container` |
| Import drawio (volta) | `import-drawio.ts:21,515` | opcional; sem isso, um round-trip rebaixa `database` de volta para `container` |

Resumo: ~8 edições de uma linha guiadas pelo compilador, mais **um** item de
trabalho real (descritor + forma visual), mais 2 entradas de export para não
degradar silenciosamente. A medição de texto, que o prompt listava, não existe
como preocupação neste repo.

---

# 5. Distância até o alvo visual (AWS Reference Architecture)

## Limitação declarada

A Tarefa 5 pede a **melhor saída do Caso B**. **O Caso B não produziu nenhuma
saída** — 3/3 falharam antes de chegar ao canvas (§1.2). Não existe artefato do
Caso B para comparar.

O que segue é derivado do **Caso D** (AWS, ~10 nós, 3/3 renderizados), a evidência
AWS mais próxima que a sessão conseguiu. É uma base menor do que a tarefa pedia, e
as lacunas de escala — que só apareceriam com 2 AZs e 40 nós — **não estão
cobertas**. Ver §7.

## O que já funciona

Aninhamento VPC → Availability Zone → Public/Private Subnet renderiza correto e
contido, com cores de painel distintas por tipo (`BOUNDARY_PANEL_KIND`,
`ir-to-component.ts:14-22`). O ator externo fica fora da VPC. Zero filhos fora do
pai nos 6 runs que renderizaram.

## Lacunas, em termos de regra de domínio

1. **Serviço regional dentro de subnet.** No D-run3 o "Bucket S3" foi colocado
   *dentro* da Private Subnet. S3 é regional — não vive em subnet. Falta uma regra
   que classifique cada serviço AWS por escopo (regional / VPC / AZ / subnet) e
   force o `parentId` para o nível certo, sobrepondo o que o modelo disse.

2. **Não há tier atribuído a coluna.** `tier` é validado, normalizado e carregado
   até o fim — e **nada o lê** (`ir.types.ts:61-64` diz isso explicitamente). A
   referência AWS lê em faixas: borda, ingress, compute, dados. Falta a regra que
   transforma `tier` na coordenada de camada do ELK.

3. **Não há grade.** Posições vêm direto do ELK, em pixels arbitrários. A
   referência alinha ícones em passo constante. Falta um passo de quantização
   pós-layout, e uma regra de tamanho uniforme por classe de nó — hoje a Public
   Subnet nasce visivelmente menor que a Private porque o ELK ajusta cada
   container ao conteúdo.

4. **Boundary obrigatória ausente não é sintetizada.** A referência sempre desenha
   Internet Gateway e NAT Gateway na fronteira. Se o modelo não os cita, ninguém
   os cria. Falta uma regra de completude por tipo de diagrama: uma VPC com subnet
   pública implica IGW.

5. **Rótulo de boundary trunca.** "Public Subnet - Subnet ..." é cortado. A
   `EMPTY_BOUNDARY_W = 360` (`ir-to-layout-graph.ts:20`) só se aplica a boundary
   **vazia**; uma boundary com filhos é dimensionada pelo ELK a partir dos filhos,
   sem piso vindo do texto do cabeçalho. Falta uma largura mínima derivada do
   rótulo.

6. **Não há CIDR nem metadado de rede.** O IR não tem onde guardar `10.0.1.0/24`.
   A referência sempre rotula. Falta um campo no IR e sua renderização.

---

# 6. INFERIDO — conclusões de leitura de código, marcadas como tais

Nada aqui foi executado. Cada item é uma leitura, não uma medição.

1. **`finish_reason` é descartado.** `readOpenAICompatibleStream`
   (`providers/openai-compatible.ts:47+`) acumula `choices[].delta.content` e não
   inspeciona `finish_reason`. Portanto o pipeline não tem como distinguir corte
   de fim natural. Isto é consistente com o observado em §1.4, mas eu não instrumentei
   o stream para ver o campo — inferência.

2. **`anthropic.ts` deve truncar igual.** `max_tokens: 3000` em `anthropic.ts:22`.
   Não rodei nenhum caso por esse provider — o usuário só tem conexão OpenAI
   configurada.

3. **A degradação de `database` não tem migração pendente.** Adicionar o tipo não
   muda nenhum schema persistido, então `PERSIST_SCHEMA_VERSION` provavelmente não
   precisa subir. Não testei uma migração.

4. **`insertGeneratedGraph` preserva as posições antigas por construção.** O laço
   só escreve `NodeLayout` dos nós novos (`generated-graph.slice.ts:123-131`).
   Medi que os 10 nós antigos **sobreviveram**; **não** medi as coordenadas antes
   e depois em espaço de flow — minha primeira tentativa comparou coordenadas de
   tela, que o pan/zoom invalidou. A preservação de posição é inferência de
   código, não medição.

---

# 7. NÃO VERIFICADO

Esta seção não está vazia.

1. **Caso B com qualquer saída renderizada.** Nenhum dos 3 runs passou do
   validator. Tudo em §5 sobre escala AWS (2 AZs, NAT por AZ, agrupamento em 40
   nós) está **não verificado** — inclusive se o aninhamento de 4 níveis se mantém
   contido nesse tamanho.

2. **Cruzamentos, sobreposições e nós fora do pai nos Casos A e B.** Sem render,
   não há geometria. As IRs reparadas de §1.4 validam, mas **não as passei pelo
   ELK** — o reparo é meu, não do modelo, e medir layout sobre um artefato que eu
   emendei produziria um número sem procedência.

3. **A causa do passo de histórico espúrio (§4.1).** Medi que existe e que é
   reprodutível. Não localizei a linha. Não investiguei além porque é correção.

4. **Se elevar `max_tokens` resolve os Casos A e B de ponta a ponta.** É a
   hipótese que os dados sustentam, mas mudar o valor é implementação, e a parada
   obrigatória vale. Não foi testado.

5. **Preservação exata das coordenadas dos nós antigos (§4.1).** Ver §6.4.

6. **Comportamento com `provider: anthropic` ou `proxy`.** Só existe conexão
   OpenAI configurada. Não testei.

7. **Fluidez, travamento e custo de paint.** Não medido, deliberadamente. O modo
   de falha nº 6 proíbe concluir isso fora de um compositor real, e eu não montei
   essa medição.

8. **Persistência do diagrama gerado entre recargas.** Um diagrama que criei no
   começo da sessão não apareceu na listagem do workspace depois de recarregar.
   Não reproduzi e não investiguei — pode ter sido efeito da minha própria
   instrumentação (ver §8). Registrado como observação solta, **não** como defeito.

---

# 8. Erros da própria sessão, declarados

Dois, ambos meus, ambos com consequência sobre o que dá para afirmar:

1. **Instrumentei o `fetch` com `response.body.tee()` no primeiro run do Caso A.**
   A aba parou de responder a screenshots e eu inicialmente li isso como "o app
   travou com 40 nós". **Era a minha instrumentação.** Uma aba nova, sem o wrapper,
   funcionou normalmente. Nenhuma afirmação sobre travamento sobreviveu a essa
   correção, e §7.7 registra que travamento não foi medido. O run 1 do Caso A foi
   refeito com um probe leve (só `console.info`).

2. **Subi um segundo servidor Vite** com `npm run dev` enquanto o do usuário já
   rodava na 8080. Ele re-otimizou o cache de dependências compartilhado
   (`node_modules/.vite`). Matei o processo; o app na 8080 seguiu servindo
   normalmente. Não observei impacto nos 12 runs, que rodaram todos depois disso,
   mas registro porque toquei em estado compartilhado sem precisar.

---

# 9. Achados históricos (registrados, não usados)

- **Não há resto de `architecture-gen` no repositório.** `grep -rl architecture-gen`
  não retorna nada fora de `node_modules`/`.git`.
- **Não há change do OpenSpec para o pipeline de geração**, nem em
  `openspec/changes/` nem em `openspec/archive/`. O pipeline de IR existe em código
  com referências a "spec §4" e "spec §8" (`ir.types.ts:1`, `:63`,
  `ir-validator.ts:281`) cujo documento não está no repositório. Nada foi
  construído em cima disso.
- `reference-diagrams.ts:5-12` declara que os 4 fixtures são **reconstruções**, não
  capturas: "the IR of the reviewed generations was not kept". Os números da §2.2
  medem os fixtures, não as gerações que o dono do produto revisou.

---

# 10. Recomendação para a sessão de implementação

Em ordem de razão-evidência, não de esforço:

1. **`max_tokens`.** É a única causa medida de falha total do produto hoje, atinge
   100% dos casos de ~40 nós, e as 6 respostas provam que o conteúdo estava certo.
   Junto: ler `finish_reason` e, num corte, dizer ao usuário "o diagrama foi
   truncado" em vez de "não é um JSON válido".
2. **Canal de aviso no validator.** 17 das 21 regras bloqueiam sem precisar. Isso
   não conserta A e B, mas é o que impede que o próximo defeito local custe o
   diagrama inteiro.
3. **Colocação do grafo gerado** relativa ao conteúdo existente (§4.1), e o passo
   de histórico espúrio.
4. Tipo próprio de `database` (§4.2).
5. Regras de domínio AWS (§5) — **depois** que o item 1 tornar o Caso B
   observável. Escrever regra de domínio contra um caso que nunca renderizou seria
   escrever contra nada.

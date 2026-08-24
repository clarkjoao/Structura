## Context

Material analisado antes de escrever este design:

- `/asl/*.yaml` — 13 schemas OpenAPI 3.1 (`manifest.schema.yaml` é o envelope).
- `/asl/example/solution.asl.yaml` — 8 manifests: `ApplicationService`,
  2 × `Application`, `Database`, `Queue`, `Topic`, `BusinessRule`, `Relationship`.
- `src/features/llm/ir/` — IR, validador, mapeamento, aplicação no canvas.
- `src/features/canvas/layout/` — `irLayoutEngine`, `layoutReadability`,
  `renderedEdgePath`, `elkHandleOrder`, `reference-diagrams`, baselines.
- `src/lib/export-service/` + `src/lib/export-core/` — draw.io / Mermaid / JSON.
- `src/features/diagram/model/`, `store/slices/generated-graph.slice.ts`,
  `store/slices/clipboard.slice.ts` (`importDrawioResult`).
- `src/features/plugins/run-plugin-import.ts` + `ImporterContribution`.
- `docs/adr/0006-interchange-strategy.md`, `docs/adr/0009-export-core-sharing.md`,
  `docs/concepts/import-export.md`, `docs/concepts/ai-integration.md`.
- Histórico do repo: `d4ba50a` (IR core slice 1) e os testes de opções de ELK.

> Nota de idioma: estes artefatos estão em pt-BR a pedido explícito para esta
> spec. A regra do `AGENTS.md` continua valendo para o que vier depois — código,
> comentários e commits em inglês, strings de UI via i18n em `en` + `pt-BR`.

## Goals / Non-Goals

**Goals**

- Responder Q1–Q7 com base no código e no exemplo reais, marcando explicitamente
  o que eles **não** respondem.
- Definir o contrato de mapeamento ASL → modelo do Structura.
- Escolher e justificar o motor de geometria, com a configuração de partida e as
  lições de ELK já pagas no repo.
- Definir containment, inclusive container vazio.
- Fixar o papel do validador existente e a regra "qualidade visual vira aviso".
- Recomendar (não decidir) sobre Structura → ASL.

**Non-Goals** — os da `proposal.md`; em especial: nada de código nesta rodada.

---

## Q1 — Mapeamento de schema

### O envelope

`manifest.schema.yaml` fixa `apiVersion` (`arquitetura.itau/v1`), `kind` (enum
fechado de 13), `metadata { name, labels?, annotations? }` e `spec` (livre, tipado
pelo schema do kind). `metadata.name` tem `pattern: ^[a-z][a-z0-9_-]*$` e é **a
chave de identidade** — é o que `Relationship.spec.edges[].from/to.id` referencia.

Isso mapeia limpo no `externalId` de `GeneratedNodeInput`: o store cunha o id real
(`generateId("el")`) e devolve `componentIdByExternalId`. É exatamente o mecanismo
que o pipeline do IR já usa.

### Tabela de kinds

| ASL kind             | Campos do spec                                                                                          | Alvo no Structura                                               | Observações                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| `Application`        | `provider` (ECS/EKS/Lambda/OpenShift/VM), `language`, `description`, `siglaApp?`                        | nó de nuvem ou C4 — ver tabela de providers abaixo              | `technology` = `language`; `description` = `spec.description` |
| `Database`           | `provider` (DynamoDB/AuroraMySQL/RDSMySQL/AuroraPostgres/RDSPostgres/Neptune/CosmosDB), `description?`  | `aws-database` + `awsService`, ou `azure-database` + `cosmosdb` | `db-table` **não** serve: exige `columns`, que o ASL não tem  |
| `Queue`              | `provider` (SQS / IBM MQ), `description?`                                                               | `aws-integration` + `sqs`; IBM MQ → `container` C4              | ver "providers fora da AWS"                                   |
| `Topic`              | `provider` (SNS/Kafka), `type` (Comando/Evento Interprocess/Evento Corporativo/Retorno), `description?` | `aws-integration` + `sns`; Kafka → `container` C4               | `spec.type` vira `tag`, não parte do nome                     |
| `APIGateway`         | `provider` (AWS API Gateway / Kong On-premise), `exposure`                                              | `aws-networking` + `api-gateway`; Kong → `container` C4         | `exposure` vira `tag` (`exposure:External`)                   |
| `ApplicationService` | `sigla`, `displayName?`                                                                                 | **`PanelComponent`** (`panelKind: default`)                     | é a fronteira da solução — âncora de containment              |
| `BusinessRule`       | `description`, `appliesTo[]`, `constraints[]`                                                           | `NoteComponent` com markdown                                    | `NoteNode` já renderiza markdown (`react-markdown`)           |
| `BusinessCapability` | `description`, `displayName?`                                                                           | **sem mapa direto**                                             | Decisão em aberto 3                                           |
| `BusinessService`    | `description`, `displayName?`                                                                           | **sem mapa direto**                                             | Decisão em aberto 3                                           |
| `ServiceOffer`       | `description`, `displayName?`                                                                           | **sem mapa direto**                                             | Decisão em aberto 3                                           |
| `Squad`              | `code`, `displayName?`                                                                                  | **não é nó** — candidato a `ServiceDefinition.owner`            | Decisão em aberto 4                                           |
| `Community`          | `code`, `displayName?`                                                                                  | **não é nó** — candidato a `ServiceDefinition.tags`             | Decisão em aberto 4                                           |
| `Relationship`       | `edges[]`                                                                                               | `Connection[]` (+ containment, ver Q3)                          | não é um nó: é o grafo                                        |

### Tabela de providers → tipo/ícone

O que decide o **ícone** é o par `(ComponentType, awsService|gcpService|azureService)`.
`buildComponentForType` (`components.slice.ts`) roteia o mesmo argumento
`awsService` para `gcpService`/`azureService` conforme o prefixo do tipo, então um
único campo no plano cobre os três provedores.

| `kind` + `provider`                    | `ComponentType`   | serviço       | id existe no catálogo?                                    |
| -------------------------------------- | ----------------- | ------------- | --------------------------------------------------------- |
| Application / Lambda                   | `aws-compute`     | `lambda`      | sim                                                       |
| Application / ECS                      | `aws-compute`     | `ecs`         | sim                                                       |
| Application / EKS                      | `aws-compute`     | `eks`         | sim                                                       |
| Application / OpenShift                | `container` (C4)  | —             | não há ícone; `technology: "OpenShift"`                   |
| Application / VM                       | `container` (C4)  | —             | `technology: "VM"`                                        |
| Database / DynamoDB                    | `aws-database`    | `dynamodb`    | sim                                                       |
| Database / AuroraMySQL, AuroraPostgres | `aws-database`    | `aurora`      | sim                                                       |
| Database / RDSMySQL, RDSPostgres       | `aws-database`    | `rds`         | sim                                                       |
| Database / Neptune                     | `aws-database`    | `neptune`     | sim                                                       |
| Database / CosmosDB                    | `azure-database`  | `cosmosdb`    | sim (catálogo Azure)                                      |
| Queue / SQS                            | `aws-integration` | `sqs`         | sim                                                       |
| Queue / IBM MQ                         | `container` (C4)  | —             | `mq` no catálogo é **Amazon** MQ; usar seria ícone errado |
| Topic / SNS                            | `aws-integration` | `sns`         | sim                                                       |
| Topic / Kafka                          | `container` (C4)  | —             | `msk` é Amazon MSK, não Kafka genérico                    |
| APIGateway / AWS API Gateway           | `aws-networking`  | `api-gateway` | sim                                                       |
| APIGateway / Kong On-premise           | `container` (C4)  | —             | `technology: "Kong"`                                      |

**Regra dos providers fora da AWS:** degradar para `container` (C4) com o provider
em `technology`, nunca forçar uma categoria de nuvem. Perder o ícone é neutro;
mostrar o ícone **errado** (Amazon MQ para IBM MQ) é uma afirmação falsa sobre a
arquitetura. Mesmo princípio do `ir-to-component.ts`, que degrada `database` para
`container` porque o C4 do Structura não tem tipo de banco.

**Provider desconhecido** (o enum cresce): degrada para `container` + `technology`
com o valor cru + aviso de import. Nunca falha o import inteiro — mesma postura de
`coerceTier` no validador do IR.

### Tabela de `Relationship.type`

`ConnectionIntent` = `dependency | call | event | data-flow | async-message`;
`transportPreset` = `sync | async | event | tcp | udp`.

| `type`                   | vira                                   | `intent`        | `transportPreset` |
| ------------------------ | -------------------------------------- | --------------- | ----------------- |
| `calls`                  | aresta                                 | `call`          | `sync`            |
| `reads`, `writes`        | aresta                                 | `data-flow`     | `sync`            |
| `produces`, `publishes`  | aresta                                 | `event`         | `event`           |
| `consumes`, `subscribes` | aresta                                 | `async-message` | `async`           |
| `triggers`               | aresta                                 | `event`         | `event`           |
| `relatedTo`              | aresta                                 | `dependency`    | —                 |
| `belongsTo`              | **containment** (`parentId`)           | —               | —                 |
| `appliesTo`              | **anexo de nota**, não aresta de fluxo | —               | —                 |

`belongsTo` e `appliesTo` não são fluxo. Desenhá-los como aresta normal cria
travessias que o ELK vai tentar minimizar contra arestas reais e polui a leitura.
`belongsTo` vira hierarquia; `appliesTo` posiciona a nota da `BusinessRule` junto
do alvo (ver Q3).

`EndpointRef` é chave composta `{kind, id}` e o schema diz que o `kind` é
"asserted against the resolved component" — então o validador **confere** o kind
contra o manifest resolvido, e um par inconsistente é issue (`edgeKindMismatch`),
não silêncio.

### Metadata

- `metadata.name` → `externalId` (chave estável) e nome de exibição de fallback.
- `spec.displayName` → `Component.name` quando presente; senão `metadata.name`.
- `spec.description` → `Component.description`.
- `metadata.labels` → `Component.tags` no formato `chave:valor`
  (`domain:consignado`, `tier:critical`).
- `metadata.annotations` → **Decisão em aberto 6**.

### Onde não há mapeamento direto

Três casos, tratados de forma diferente por razão diferente:

1. **Camada de negócio** (`BusinessCapability`, `BusinessService`, `ServiceOffer`):
   existe modelo, falta decisão de produto. Registrado como Decisão em aberto 3;
   a v1 recomendada **não desenha**, e o importer emite um aviso dizendo quantos
   manifests foram ignorados — o usuário nunca perde conteúdo em silêncio.
2. **Organização** (`Squad`, `Community`): não é topologia; o destino natural é
   `ServiceDefinition` (`owner`, `tags`), que é outro subsistema. Decisão em
   aberto 4.
3. **Provider fora dos catálogos**: resolvido por regra (degradar + `technology`),
   não é decisão em aberto.

Nunca usar o tipo `unknown` para nada disso: `unknown` é a escotilha para conteúdo
que não se consegue interpretar, e um `Application` com provider `VM` está
perfeitamente interpretado — só não tem ícone.

---

## Q2 — Geometria

### O ASL tem noção de posição?

**Não. Zero.** Verificado nos 14 arquivos de `/asl/`: nenhum campo de posição,
tamanho, ordem, camada, coluna ou layout, nem no envelope nem em nenhum `spec`.
O exemplo é uma lista plana de documentos separados por `---`. O ASL é puramente
estrutural — a mesma natureza do IR usado na geração por LLM, e o oposto do
draw.io (que traz `mxGeometry` literal) e do Mermaid (que ao menos traz ordem
textual, hoje aproveitada por `import-mermaid-flowchart.ts` num grid de 3 colunas).

Consequência direta: **a geometria é calculada, e o motor é o ELK** — é o que o
projeto já usa em dois lugares (`autoLayoutEngine.ts` para o auto-layout do canvas,
`irLayoutEngine.ts` para a geração por LLM), é o único que faz containment
hierárquico de verdade (`elk.hierarchyHandling: INCLUDE_CHILDREN`), e é o único
com instrumento de medição no repo.

O grid de 3 colunas do importer de Mermaid **não** serve: não tem containment e
não minimiza travessias — produziria exatamente a "sopa de nós" vetada.

### Configuração de partida

A de `IR_ELK_OPTIONS` (`irLayoutEngine.ts`), verbatim, porque é a única configuração
do repo que já foi medida contra um baseline:

```
elk.algorithm                              layered
elk.direction                              RIGHT
elk.edgeRouting                            ORTHOGONAL
elk.layered.spacing.nodeNodeBetweenLayers  150
elk.spacing.nodeNode                       80
elk.layered.nodePlacement.strategy         BRANDES_KOEPF
elk.padding                                [top=40,left=40,bottom=40,right=40]
elk.hierarchyHandling                      INCLUDE_CHILDREN
```

`direction: RIGHT` não é preferência estética: é o que faz a geometria concordar
com a regra dura do `AGENTS.md` — "diagrams read left to right, and handles
enforce it", handles esquerdos são entrada e direitos são saída.

### Lições de ELK já pagas neste repo (verificadas no código atual)

Todas conferidas em `HEAD`, não assumidas de memória:

1. **`elk.direction` tem que ser `"RIGHT"`.** `"LEFT_TO_RIGHT"` não é token do ELK:
   é silenciosamente ignorado e cai no default (que por acaso flui para a direita,
   o que escondeu o erro). — comentário de módulo em `irLayoutEngine.ts`.
2. **`elk.padding` usa `=`, não `:`.** Com `[top:40,...]` o ELK não parseia e
   aplica o default de 12px. — idem.
3. **`elk.resize` não existe.** A intenção (container dimensionado pelos filhos) já
   é o comportamento default para nós compostos. — idem.
4. **O ELK devolve a geometria da aresta relativa ao _lowest common ancestor_ dos
   extremos**, não ao nó cujo array `edges` a contém. `readLaidOutGraph`
   (`layoutReadability.ts`) é dono dessa correção e é testado lá; re-derivar isso
   à mão foi exatamente como o engine legado errou. **Reusar, não reescrever.**
5. **O "trio legado"** (`crossingMinimization=LAYER_SWEEP`,
   `separateConnectedComponents=true`, `aspectRatio=2.5`) **é o default do ELK** —
   medido em `layoutReadability.options.test.ts`, não moveu nenhum número. Não
   copiar do `autoLayoutEngine` achando que ajuda.
6. **A ordem de handles vinda do ELK vale muito.** `applyElkHandleOrder` está
   **ligado por default** e foi medido em **52 → 16** travessias renderizadas nos
   quatro diagramas de referência. — `ir-layout-flags.ts`. O ASL deve nascer com
   ele ligado.
7. **Os waypoints do ELK estão desligados por default** (experimento atrás de
   `localStorage`), porque o canvas re-roteia as arestas por conta própria. Logo,
   `edgeCrossings` do ELK é _proxy_; o número que descreve a tela é o de
   `renderedEdgePath.ts` / `measureRenderedReadability`. Medir os dois.
8. **Boundary vazio precisa de tamanho literal.** Sem filhos, o ELK não tem o que
   ajustar; `irLayoutEngine` usa `EMPTY_BOUNDARY_W/H = 360 × 200` para o rótulo do
   cabeçalho não truncar.
9. **Só painel recebe `width`/`height` do layout.** Folha mantém o tamanho
   intrínseco do DOM — `buildGeneratedGraphInputs` em `apply-ir.ts`. Forçar tamanho
   em folha briga com o auto-size do CSS.
10. **Raiz é absoluta, filho é relativo ao pai** — convenção do React Flow e o que
    o ELK devolve; `apply-ir.ts` só soma a origem do viewport nas raízes.

### O delta específico do ASL: rótulos longos

O ELK **nunca é informado sobre rótulos de aresta** (nem em `irLayoutEngine` nem em
`autoLayoutEngine`). `layoutReadability.ts` estima a caixa em `6.5px` por caractere

- 16 de padding. As `description` do `solution.asl.yaml` têm 40–60 caracteres
  ("SQS dispara o processamento das atualizações de tracking" = 55), ou seja caixas
  de **~370px** contra `nodeNodeBetweenLayers: 150`. Sobreposição de rótulo é quase
  certa — e "espaçamento que não sobrepõe rótulos" é critério de aceite.

Não resolver isso por palpite. A Fatia 4 mede `labelOverlaps` nas duas hipóteses:
(a) rótulo = `spec.description` completa; (b) rótulo = verbo do `type` traduzido,
com a descrição em `Connection.description` (que a UI já mostra no painel). A
recomendação é (b), mas quem decide é a tabela.

Se nenhuma das duas zerar, o próximo degrau — nesta ordem, medindo a cada passo —
é aumentar `nodeNodeBetweenLayers` e depois declarar `labels` como nós de rótulo
no grafo ELK. Aumentar espaçamento é barato; declarar labels muda a forma do grafo
e só se justifica com número na mão.

### Forma da extração

`irLayoutEngine.layoutIR(ir: DiagramIR)` está acoplado ao IR só na leitura de
`node.parentId` e `isBoundaryNode(node)`. A extração é pequena:

```ts
interface LayoutNode { id: string; parentId: string | null; isContainer: boolean;
                       width?: number; height?: number }
interface LayoutEdge { id: string; sourceId: string; targetId: string }
layoutGraph(nodes, edges, options?) -> { boxes, edgeRoutes, handleOrder }
```

`layoutIR` vira um adaptador de três linhas sobre isso, e o ASL é o segundo
cliente. É o mesmo movimento do ADR-0009 (core neutro + adaptadores finos), e o
baseline existente é a trava: se `layoutReadability.baseline.test.ts` continuar
verde, a extração é comportamento-idêntica por construção.

---

## Q3 — Containment e hierarquia

### O `solution.asl.yaml` tem aninhamento?

**Não explicitamente.** Os 8 manifests são irmãos; nenhum campo `parent` existe em
nenhum schema. A hierarquia precisa ser derivada, e é aqui que está o maior risco
do plano (R1).

Sinais disponíveis, em ordem de força:

1. **`Relationship.type: belongsTo`** — é o único termo do vocabulário de 11 tipos
   cujo significado é pertencimento. **Não aparece no exemplo**, mas está no
   schema, o que o torna a regra _de jure_.
2. **Convenção de sigla** — no exemplo, `ApplicationService.spec.sigla = "JX9"` e
   as duas `Application` têm `siglaApp = "JX9-X000"` / `"JX9-X001"`. Isto é um sinal
   real e observável de pertencimento no caso concreto: `siglaApp` começa com
   `sigla + "-"`. É a regra _de facto_ — mas lida de **um** arquivo e não escrita
   em schema nenhum.
3. **`metadata.labels.domain`** — agrupamento fraco; um label é tag, não fronteira.

### Regra proposta (sujeita à Decisão em aberto 1)

Aplicada em cascata, primeira que casar vence:

1. Existe aresta `belongsTo` de X para Y → `X.parentId = Y`.
2. X é `Application`, tem `siglaApp`, e existe um `ApplicationService` cujo `sigla`
   é prefixo de `siglaApp` seguido de `-` → esse serviço é o pai.
3. O arquivo tem **exatamente um** `ApplicationService` e X é `Application` → esse
   serviço é o pai. (Cobre o caso de referência sem inventar convenção.)
4. Caso contrário → raiz.

Infraestrutura (`Database`, `Queue`, `Topic`, `APIGateway`) fica **fora** do painel
por default, e só entra por `belongsTo` explícito — Decisão em aberto 2.

### Como isso vira containment real no canvas

Restrição dura, confirmada em `ir-to-component.ts` e `nodeVisibility.ts`: **o React
Flow só aninha visualmente quando o pai é um `panel`**. Então todo construto ASL que
vira container tem que virar `type: "panel"` — e painel não tem ícone de serviço.
Um `ApplicationService` como painel é natural (é uma fronteira). Se a Decisão em
aberto 2 mandar aninhar dentro de um `Application`, esse `Application` perde o
ícone Lambda — troca a ser feita conscientemente, não descoberta na implementação.

Mecanicamente:

- `ApplicationService` → `PanelComponent`, `panelKind: PanelKind.Default`,
  `name = spec.displayName ?? metadata.name`.
- Filhos entram com `parentExternalId` no `GeneratedNodeInput`; o store resolve para
  o `parentId` real em `insertGeneratedGraph`.
- Posição do filho é **relativa ao pai** (convenção React Flow = o que o ELK devolve).
- `width`/`height` do painel vêm do box do ELK; folhas não recebem tamanho.
- Ciclo de containment é issue de validação (algoritmo `collectContainmentCycles`
  do `ir-validator.ts`, reutilizável literalmente).
- "Quem tem filho é container, tenha declarado ou não" — normalização já provada no
  IR; vale igual aqui.

### Container vazio

Caso explicitamente coberto, não caso de borda: um `ApplicationService` sem nenhuma
`Application` **continua sendo desenhado como painel**, com o tamanho literal
`360 × 200` (o ELK não tem filhos para ajustar em volta). É exatamente a semântica
que o IR já tem — "an unpopulated VPC is still a VPC" — e o Structura já distingue
"container vazio" de "folha" via `isBoundary`.

Cuidado medido em `layoutReadability.options.test.ts`: um container vazio cria um
**componente conexo separado**, e é justamente aí que `separateConnectedComponents`
deixa de ser inócuo. O teste que prova isso já existe; o fixture ASL de container
vazio entra no mesmo harness.

### `BusinessRule` e a aresta `appliesTo`

`NoteComponent` é `connectable: true` mas `canBeParent: false`, e — importante —
**notas são excluídas do auto-layout** (`autoLayoutEngine.ts` filtra
`isNoteComponent`). Então a nota da `BusinessRule` **não entra no grafo do ELK**: é
posicionada depois, ancorada ao componente que `appliesTo` aponta (à direita ou
abaixo, fora do bbox do layout). Enfiá-la no grafo ELK como nó comum distorce as
camadas em troca de nada.

Conteúdo da nota: `spec.description` como título e as `constraints[]` como lista
markdown (`name` / `condition` / `error` / `action`) — `NoteNode` já renderiza
markdown via `react-markdown`.

---

## Q4 — Direção do export (Structura → ASL)

**Recomendação: fora de escopo nesta mudança. Entregar só import, e reservar a
costura.** Quatro razões, em ordem de peso:

1. **O ASL exige campos que o Structura não tem como saber.** Todo schema tem
   `required` com enum fechado: `Application` exige `provider` + `language` +
   `description`; `Database` exige `provider`; `Topic` exige `provider` + `type`;
   `APIGateway` exige `exposure`; `Squad`/`Community` exigem `code`; `BusinessRule`
   exige `constraints[]`. Um nó desenhado à mão tem `name`, `description`,
   `technology`, `awsService`. Não há como derivar `siglaApp: JX9-X000` ou
   `exposure: Internal` disso. O export ou emite ASL **inválido** (faltando
   required) ou **inventa** valor — as duas coisas são piores que não exportar.
2. **Não há onde guardar o `spec` original.** `BaseComponent` não tem saco de
   metadados genérico: só `tags`, `serviceId`, `externalLinks` e — apenas em
   `PluginTypedComponent` — `pluginData`. Usar `pluginData` obrigaria o tipo do
   componente a virar `asl/application`, o que faz o nó perder o ícone AWS e cair
   no descritor de plugin. Um round-trip fiel exige campo novo persistido → bump de
   `PERSIST_SCHEMA_VERSION` + migração em `persist.config.ts`. É uma decisão de
   modelo de dados, maior que este change.
3. **Já existe precedente exatamente com essa assimetria.** O pipeline de IR é
   import-only no mesmo sentido: `ir-export.ts` re-serializa o IR **que foi gerado**
   ("Saving one to disk turns any future generation into a fixture"), e não deriva
   IR a partir do canvas. Ninguém sentiu falta, e o motivo é o mesmo: o canvas tem
   menos informação que o formato de origem.
4. **O ADR-0006 já prevê isso.** Fidelidade é _política declarada por formato_, não
   acidente. Declarar "ASL é import-only na v1" é política legítima; declarar um
   export que produz manifests inválidos, não. Structurizr, aliás, já tem perda
   declarada (não preserva layout).

**O que reservar agora, de graça:** manter as tabelas de mapeamento (kind+provider
→ tipo, `Relationship.type` → intent) em um módulo único e escritas como tabela de
dados, não como `switch` espalhado, para que a inversão seja mecânica; e manter o
resultado do parse (os manifests validados) disponível como artefato, para que uma
mudança futura possa implementar primeiro o modo "re-serializar o que foi
importado" — o análogo de `ir-export.ts` — antes de tentar derivação de verdade.

**Quando reavaliar:** quando existir um lugar persistido para o `spec` do ASL, ou
quando o produto decidir que exportar ASL parcial (só `metadata` + `kind`, sem
`spec`) tem valor. Registrado como Decisão em aberto 9.

---

## Q5 — Papel do validador existente

São duas validações distintas, com regras opostas de bloqueio.

### 1. Validação do ASL de entrada — bloqueia erro estrutural

Reaproveita a **arquitetura** do `ir-validator.ts`, não o `validateIR`:

- Códigos de issue que servem de sufixo i18n (`aslImport.issue.<code>`), mantendo
  o módulo puro livre de string visível ao usuário.
- Coleta **todos** os problemas em vez de falhar no primeiro.
- **Normaliza em vez de rejeitar** sempre que o manifest continua renderizável.
  Esta é a lição mais valiosa do IR e está escrita no próprio código: rejeitar um
  diagrama por causa de um `tier` inválido "throws away something that renders
  perfectly" — "a validator refusing what it can render is the bug". No ASL isso
  vira: provider desconhecido → degrada + aviso; label estranho → vira tag; kind
  de negócio não suportado → ignorado com aviso.
- `collectContainmentCycles` é reutilizável **literalmente**: opera sobre
  `Map<string,string>` de filho→pai, sem nada de IR.
- A normalização "quem tem filho é container" vale igual.

`validateIR` em si **não** se aplica: o vocabulário dele (`semanticType`, `tier`,
`IRDiagramType`) é C4/AWS e não tem relação com kinds ASL. Reusar o arquivo
forçaria uma tradução ASL→IR antes da validação, o que perde a informação (o
`provider`, o `sigla`) de que o mapeamento precisa depois.

Checagens que só o ASL tem, e que precisam ser escritas:

- `apiVersion` na allow-list (`arquitetura.itau/v1`).
- `kind` na allow-list dos 13.
- `metadata.name` no padrão `^[a-z][a-z0-9_-]*$`.
- `metadata.name` duplicado entre documentos (é a chave de referência).
- campos `required` por kind, com os enums de cada schema.
- resolução de `EndpointRef`: `id` tem que existir **e** o `kind` tem que bater com
  o do manifest resolvido (o schema diz "asserted against the resolved component").
- YAML malformado / documento vazio / `spec` ausente.

### 2. Validação da geometria resultante — **nunca** bloqueia

Regra de produto: problema de qualidade visual vira aviso. O instrumento já existe
e é o mesmo do pipeline do LLM: `layoutReadability.ts` (`edgeCrossings`,
`placementCrossings`, `edgeNodeOverlaps`, `labelOverlaps`) e `renderedEdgePath.ts`
(o que de fato é desenhado). O comentário do baseline já formaliza a regra: "it is
a regression guard, not a gate on generation — nothing here can stop a diagram
being produced".

Aplicação no ASL:

- **Em teste**: fixtures ASL entram no harness com baseline registrada, no molde de
  `layoutReadability.baseline.test.ts`. Piorar o número quebra o CI.
- **Em runtime**: no máximo um toast de aviso ("o diagrama importado tem N rótulos
  sobrepostos — use o auto-layout"). Nunca impede o import, nunca desfaz.

`validate-diagram.ts` (export-service) é um gate estrutural trivial (snapshot
existe, `components`/`connections` existem) e se aplica só se o import passar a
produzir um `Diagram` inteiro (Decisão em aberto 7).

### 3. O que de `features/llm` **não** se aplica

- **Contrato de patch** (`patch-parser.ts`, `apply-diagram-patch.ts`,
  `PendingSuggestion`, `PendingNodeToolbar`): é UX de revisão para mudança
  _proposta por IA_. Import de ASL é conversão determinística de arquivo — vai pelo
  mesmo caminho de draw.io/Mermaid (um passo de undo), não por pending suggestions.
  Pedir "aceitar/rejeitar" para um arquivo que o usuário escolheu importar é
  fricção sem ganho.
- **`ir-prompt.ts`**: é um prompt que ensina um schema a um modelo. O ASL vem de
  arquivo, não de modelo. (Vira relevante no dia em que existir "gerar ASL por
  LLM" — outra mudança, e aí o `ir-prompt.ts` é o molde certo, inclusive a técnica
  de derivar o prompt do catálogo para não haver drift.)
- **`serializer.ts` / `component-catalog.ts`**: serializam o diagrama _para_ o
  prompt. Direção oposta.
- **Providers de LLM, threads, storage**: sem relação.

---

## Q6 — Reuso vs. construção nova

### Reusar literalmente (sem fork)

| O quê                                               | Onde                                           | Por quê                                                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `insertGeneratedGraph`                              | `generated-graph.slice.ts`                     | já recebe `externalId`/`parentExternalId`/`panelKind`/`awsService`/`technology`/x/y/w/h — exatamente a forma do plano ASL — e comita em **um** passo de undo |
| `readLaidOutGraph`                                  | `layoutReadability.ts`                         | dona da correção de LCA; re-derivar é o bug conhecido                                                                                                        |
| `readElkHandleOrder`                                | `elkHandleOrder.ts`                            | 52 → 16 travessias renderizadas, medido                                                                                                                      |
| `measureReadability` / `measureRenderedReadability` | `layoutReadability.ts`, `renderedEdgePath.ts`  | o instrumento de legibilidade do projeto                                                                                                                     |
| `interiorWaypoints`, origem do viewport             | `apply-ir.ts`                                  | idênticos; extrair para um `apply-generated-graph.ts` comum                                                                                                  |
| `getPanelKindForAwsService`, `PANEL_KINDS`          | `lib/catalogs/panels.ts`                       | painéis com semântica de nuvem                                                                                                                               |
| catálogos AWS / Azure                               | `lib/catalogs/aws.ts`, `cloud/providers/azure` | ids de serviço para ícone                                                                                                                                    |
| `collectContainmentCycles`                          | `ir-validator.ts`                              | puro, sem nada de IR                                                                                                                                         |
| `downloadFile`                                      | `export-service/download-file.ts`              | se houver export de relatório de import                                                                                                                      |

### Adaptar (mesma arquitetura, vocabulário novo)

| De                    | Para                               | O que muda                                                                                                                        |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ir-validator.ts`     | `asl-validator.ts`                 | mesma forma (issue codes = sufixo i18n, coleta tudo, normaliza); vocabulário ASL                                                  |
| `ir-to-component.ts`  | `asl-mapping.ts`                   | mesma assinatura de saída (`{ type, panelKind?, service? }`); tabela por kind+provider                                            |
| `apply-ir.ts`         | `import-asl.ts`                    | mesmo esqueleto (layout → inputs → store → seleção)                                                                               |
| `irLayoutEngine.ts`   | `graphLayoutEngine.ts` + adaptador | generalizar o nó de entrada; **comportamento idêntico**, travado pelo baseline                                                    |
| `FlowchartImportPlan` | `AslImportPlan`                    | mesma ideia (parser puro devolve plano, UI comita), mas o ASL tem etapa de layout **assíncrona**, então o tipo não serve verbatim |

### Construir do zero

- **Parse YAML multi-documento.** Não existe parser YAML no repo (conferido em
  `package.json`). Nova dependência (`yaml`), com `import()` dinâmico como
  `elkjs`/`monaco`.
- Tipos + guards dos 13 kinds e do envelope.
- Tabelas kind+provider → tipo/serviço (inclui Azure e os não-nuvem).
- Derivação de containment (`belongsTo` / sigla / fallback).
- Tabela `Relationship.type` → `intent`/`transportPreset`/rótulo.
- `BusinessRule` → nota markdown + ancoragem fora do grafo ELK.
- Extensão de `GeneratedNodeInput` com `description` e `tags` (hoje não existem, e
  o ASL carrega os dois).
- Fixtures ASL + baseline de legibilidade.
- Chaves i18n em `en` e `pt-BR`.

### Onde o código mora

**Recomendação: `src/lib/asl/`**, irmão de `export-core`, puro e sem
`@/features/*`; o adaptador que fala com o store fica em
`src/features/diagram/utils/import-asl.ts`. Razão: o ADR-0006 diz que conhecimento
de formato não vaza para dentro, e o ADR-0009 mostra que um core neutro é o que
permite reuso posterior (inclusive pelo build isolado de plugin).

**Alternativa considerada e recusada para a v1: entregar como plugin
(`ImporterContribution`).** Ganharia de graça o drop de arquivo no `ImportModal` e
o commit em um passo de undo (`run-plugin-import.ts`). Recusada porque
`buildComponentFromInput` só sabe tipos C4 e tipos de plugin — **todo o resto
degrada para `unknown`** — e o `ImportResult` não tem containment nem etapa de
layout. Um ASL importado por esse caminho seria literalmente a sopa de nós soltos
que o requisito veta. Vale registrar como trabalho futuro: se o contrato de plugin
ganhar painel + parentesco + layout, o ASL vira um bom primeiro cliente.

---

## Q7 — Riscos e incógnitas

Ordenados por risco. Para cada um, como validar **antes** de comprometer a
arquitetura.

### R1 — A regra de containment não está no schema (risco mais alto)

Todo o critério "hierarquia/containment correto" apoia-se numa regra que
`/asl/*.yaml` não enuncia. `belongsTo` existe no vocabulário mas não é usado no
exemplo; a relação por sigla foi lida de **um** arquivo. Se a regra real for outra
(um label `parent`, ou containment simplesmente não fazer parte do ASL), a
estrutura de painéis inteira está errada — e é a parte que mais custa refazer,
porque layout, sizing e testes dependem dela.

**Como validar antes:** Fatia 0. Escrever o resultado esperado do
`solution.asl.yaml` no canvas (quais nós dentro de qual painel, quais arestas),
confirmar em **uma** rodada com você, e congelar isso como o fixture contra o qual
todas as outras fatias são testadas. Custa minutos e não bloqueia nada mais.

### R2 — Rótulos longos em pt-BR estouram o espaçamento

Aritmética, não palpite: `6.5px`/caractere (a estimativa do próprio
`layoutReadability`) × 55 caracteres ≈ 370px de caixa contra
`nodeNodeBetweenLayers: 150`. Sobreposição de rótulo é quase certa, e é critério de
aceite explícito.

**Como validar antes:** Fatia 4 roda o harness existente sobre o exemplo nas duas
hipóteses (descrição completa vs. verbo) e lê `labelOverlaps`. A decisão vira dado.
Escalada, só se preciso e medindo a cada passo: subir `nodeNodeBetweenLayers`;
depois declarar labels como nós de rótulo no ELK.

### R3 — Providers fora da AWS não têm iconografia

`OpenShift`, `VM`, `Kong`, `IBM MQ`, `Kafka`, `CosmosDB`. Mapear para uma categoria
AWS dá ícone **errado** (Amazon MQ ≠ IBM MQ); degradar para `container` dá caixa
correta e sem ícone. Perder ícone não fere legibilidade; ícone errado é afirmação
falsa.

**Como validar antes:** barato — é tabela, decidida uma vez na Fatia 1 e revista
com o diagrama na tela.

### R4 — A camada de negócio não tem lugar no canvas

`BusinessCapability`/`BusinessService`/`ServiceOffer` desenhados como nós criam um
segundo grafo desconexo. O teste de opções do ELK já mostra que é justamente aí que
`separateConnectedComponents` passa a agir — o layout muda de forma.

**Como validar antes:** a v1 não desenha e avisa quantos manifests ignorou; se você
decidir desenhar (Decisão em aberto 3), o fixture "com camada de negócio" entra no
harness **antes** de a decisão virar código.

### R5 — Re-import duplica tudo

`metadata.name` é id estável, mas o store cunha id próprio e `insertGeneratedGraph`
não tem upsert. Reimportar um ASL atualizado duplica o conteúdo.

**Como validar antes:** nada a validar — é limitação conhecida, declarada na
política de fidelidade da v1. Fica registrada para não ser "descoberta" depois.

### R6 — Generalizar `irLayoutEngine` pode regredir a geração por LLM

Risco baixo e **explicitamente coberto**: `layoutReadability.baseline.test.ts` tem
números registrados por diagrama de referência e falha se piorarem. A extração só
é aceita com esse teste verde e sem alterar os valores do baseline.

### Incógnitas que não são risco, só falta de decisão

Decisões em aberto 2, 4, 6 e 7 da `proposal.md`. Todas têm default seguro no plano
e nenhuma bloqueia a Fatia 1.

---

## Decisions

### 1. ELK como motor de geometria, com a configuração do IR como ponto de partida

**Decisão:** reusar `IR_ELK_OPTIONS` verbatim como configuração inicial e ajustar
só com medição.
**Razão:** é a única configuração do repo com baseline medido; e três das suas
opções são correções de erros já pagos (direction, padding, resize).
**Alternativa recusada:** copiar `ELK_OPTIONS` do `autoLayoutEngine` — metade das
opções extras é default do ELK (medido) e as demais foram afinadas para diagramas
já posicionados à mão, não para grafo puro.

### 2. Extrair um engine de layout neutro em vez de duplicar

**Decisão:** `graphLayoutEngine.ts` genérico; `layoutIR` vira adaptador.
**Razão:** ADR-0009 — core neutro + adaptadores finos; e é o baseline existente que
prova a equivalência.
**Alternativa recusada:** copiar `irLayoutEngine` para o ASL. Foi exatamente o modo
de falha que o ADR-0009 documenta (duas cópias que divergem).

### 3. `ApplicationService` é painel; infraestrutura fica fora por default

**Decisão:** como em Q3.
**Razão:** é a única fronteira que o arquivo de referência declara sem ambiguidade;
e afirmar posse de infraestrutura compartilhada seria inventar semântica.
**Sujeita a:** Decisões em aberto 1 e 2.

### 4. `BusinessRule` é nota fora do grafo ELK

**Decisão:** nota markdown ancorada ao alvo de `appliesTo`, posicionada depois do
layout.
**Razão:** notas já são excluídas do auto-layout do canvas; incluí-la no ELK
distorce as camadas sem ganho.

### 5. Import-only na v1, com política de fidelidade declarada

**Decisão:** sem Structura → ASL (Q4).
**Razão:** os campos `required` do ASL não existem no modelo; exportar produziria
manifest inválido ou inventado.

### 6. Qualidade visual nunca bloqueia

**Decisão:** validação de entrada bloqueia erro estrutural; legibilidade só vira
baseline em teste e aviso em runtime.
**Razão:** regra de produto, e já é como o pipeline do IR se comporta — inclusive
com o texto do baseline dizendo isso.

## Risks / Trade-offs

- **Nova dependência de runtime (YAML)** no produto. Mitigado por `import()`
  dinâmico, como `elkjs` e `monaco`.
- **Container implica perder o ícone**: quem vira painel não mostra serviço. É
  restrição do React Flow tal como o canvas o usa, não escolha desta mudança.
- **`GeneratedNodeInput` cresce** (`description`, `tags`). Aditivo e opcional; o
  pipeline do IR não é afetado.
- **A extração do engine toca código do LLM** — o caminho mais quente do repo.
  Mitigado pelo baseline; se o número mudar, a extração está errada.
- **Fidelidade declaradamente parcial na v1** (camada de negócio, organização,
  re-import). Precisa aparecer na UI como aviso e em
  `docs/concepts/import-export.md` como política, não ser descoberta pelo usuário.

## Migration Plan

Nenhuma migração de dados. Sem mudança de `PERSIST_SCHEMA_VERSION` — nenhum campo
persistido novo é introduzido (a extensão de `GeneratedNodeInput` é de entrada, não
de estado). Se a Decisão em aberto 9 (round-trip) for aceita numa rodada futura, aí
sim haverá bump + migração em `persist.config.ts`, e é razão suficiente para ser
outra mudança.

## Open Questions

As nove listadas em `proposal.md` § Decisões em aberto. As bloqueantes para começar
são a **1** (containment — resolve-se na Fatia 0) e a **7** (diagrama novo vs.
diagrama ativo — resolve-se antes da Fatia 7). As demais têm default seguro.

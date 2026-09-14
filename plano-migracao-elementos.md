# Plano de migração — sistema de elementos

Documento de **planejamento**. Nenhum arquivo de produção foi criado ou alterado.
Base: `main` em `3a0f891`. Fecha a sequência iniciada em
[`mapeamento-sistema-elementos.md`](mapeamento-sistema-elementos.md) e continuada em
[`proposta-arquitetura-elementos.md`](proposta-arquitetura-elementos.md); §N.M referencia
seções daqueles documentos.

Decisões 1–12 tratadas como fechadas.

---

## Parte 1 — Os dois contratos que faltavam

### 1.1 `export.drawio.kind: "passthrough"` (decisão 9)

**O que existe hoje.** `ExportNodeKind` é uma união estreita de 9 kinds
(`export-core/model.ts:21-22`), cada um com um branch em `buildCell`
(`cell-builders.ts:27-225`), fechada por `const _exhaustive: never = node` (`:221`).
Dois padrões de emissão convivem:

- **`<mxCell>` simples** — usado por `aws` (`:82`), `note` (`:191`), `jsonViewer` (`:213`),
  `endpoint` (`:163`), `dbTable`, `panel`;
- **`<object placeholders="1" …>` com atributos customizados** envolvendo o `mxCell` —
  usado por `c4` (`:63-75`, atributos `c4Name`, `c4Type`, `c4Description`,
  `c4Technology`, `registryService`, `registryId`) e por `apiGroup` (`:110-117`).

O segundo padrão é o que interessa: **o repo já sabe carregar metadado próprio dentro do
XML do drawio**, e é isso que dá ao passthrough uma chance de round-trip.

**Contrato proposto:**

```ts
export interface PassthroughNode extends BaseNode {
  kind: "passthrough";
  /** Rótulo visível na caixa. */
  name: string;
  /** Segunda linha, opcional (itálico, menor). */
  description?: string;
  /** Id do elemento no registry — preservado no XML para round-trip. */
  originType: ElementTypeId;
  /** Rótulo legível do tipo de origem, i18n-resolvido no adapter. */
  originLabel: string;
  /** Preenchimento; default neutro de CONFIG.defaults. */
  fillColor?: string;
}
```

Emissão padrão (um branch novo em `buildCell`):

```xml
<object placeholders="1" structuraType="chart" structuraLabel="Chart"
        label="&lt;b&gt;Vendas por mês&lt;/b&gt;&lt;br/&gt;&lt;i&gt;Chart&lt;/i&gt;" id="el-42">
  <mxCell style="rounded=1;whiteSpace=wrap;html=1;dashed=1;fillColor=#f5f5f5;strokeColor=#9e9e9e;"
          vertex="1" parent="1">
    <mxGeometry x="…" y="…" width="…" height="…" as="geometry"/>
  </mxCell>
</object>
```

Decisões embutidas e por quê:

- **Borda tracejada (`dashed=1`) e fill neutro.** O passthrough é honesto: sinaliza
  visualmente "este elemento não tem shape nativo no drawio", em vez de se disfarçar de
  caixa comum. Consistente com o que `c4` faz ao carregar `c4Type` no XML — o formato já
  admite metadado que o drawio ignora e o Structura lê.
- **`structuraType` como atributo do `<object>`.** É o que permite a importação de volta
  recuperar o tipo exato, em vez de cair em `unknown`. Sem isso, exportar e reimportar é
  destrutivo, e a decisão 6 (export obrigatório) viraria uma perda de dados disfarçada de
  compatibilidade.
- **Tamanho:** honra `width`/`height` do `BaseNode`; `0` cai num default novo
  `CONFIG.defaults.passthrough` (proposta: 240×120, igual ao `minDimensions.c4` de
  `export-core/constants.ts:5`), seguindo a convenção já documentada em `model.ts:30`.
- **Sem cor semântica.** `fillColor` existe para o caso em que o elemento tem accent
  próprio, mas o default é neutro: passthrough não inventa significado.

**`svg` NÃO deve usar passthrough — proponho um `kind: "image"` próprio.**
Justificativa: `SvgComponent.svgContent` (`component.types.ts:160-164`) carrega a arte
inteira; exportá-la como caixa rotulada descarta o único conteúdo que o elemento tem.
O drawio suporta `shape=image;image=data:image/svg+xml;base64,…` nativamente, e o repo já
sanitiza SVG antes de aceitá-lo (`canvas/utils/svg.sanitizer.ts:67`, coberto por
`src/test/svg.sanitizer.test.ts`), então o conteúdo embutido não é arbitrário.

```ts
export interface ImageNode extends BaseNode {
  kind: "image";
  name: string;
  /** data: URI já sanitizado pelo adapter (nunca markup cru). */
  dataUri: string;
  preserveAspect?: boolean;
}
```

Hoje o repo **não emite nenhum `shape=image` nem `data:`** (grep em `export-core/` e
`export-service/`: zero ocorrências), então este é conteúdo genuinamente novo e merece
teste próprio — inclusive o caso de `svgContent` grande, que infla o XML.

Fronteira final: **`passthrough` fica reservado ao `unknown` e a qualquer elemento
futuro sem shape nativo** (é o caso provável do `chart` na primeira versão);
**`image` atende `svg`** e qualquer elemento cuja representação seja uma figura.

### 1.2 Tool call do catálogo hierárquico (decisão 10)

**O que existe hoje.** `ALL_TOOLS` (`llm/tools.ts:3-144`) é uma lista de `LLMTool`
(`llm/types.ts:153-157`: `name`, `description`, `parametersSchema`), injetada no prompt
por `buildToolsSection` (`prompt-builder.ts:207-226`) como blocos
`Tool:/Description:/Parameters:`. O modelo responde com `toolCalls`, e
`apply-diagram-patch.ts:58-154` despacha por `action.type`, devolvendo `toolResult`
(`:12-16`) para as tools de leitura — `INSERT_PATTERN` (`:115-118`) é o precedente mais
próximo de uma tool que devolve dados estruturados.

O catálogo hoje é plano e curado: `ALL_COMPONENT_TYPES = STRUCTURAL + C4 + AWS`
(`component-catalog.ts:158-162`), com os 145 serviços AWS despejados no prompt
(`:144-157`). A decisão 10 substitui isso por: **famílias e categorias no prompt;
serviços por tool call.**

**Contrato proposto — duas tools de leitura, nenhuma de escrita:**

```ts
{
  name: "list_element_families",
  description:
    "Returns the element families available in this workspace (C4, structural shapes, " +
    "and cloud/tech families such as AWS, GCP, Azure, Kubernetes, OSS) with their " +
    "categories. Call this first when you are not sure which family fits the request. " +
    "Services inside a category are NOT returned here — use search_elements for those.",
  parametersSchema: { type: "object", properties: {}, required: [] },
}
```

Retorno (`toolResult.data`):

```jsonc
{
  "families": [
    { "id": "c4",     "label": "C4 Model",  "elementCount": 4,
      "categories": [] },                                   // C4 não tem categoria
    { "id": "aws",    "label": "Amazon Web Services", "elementCount": 145,
      "categories": [ { "id": "aws-compute",  "label": "Compute",  "serviceCount": 12 },
                      { "id": "aws-database", "label": "Databases","serviceCount": 9  } ] },
    { "id": "oss",    "label": "Open Source", "elementCount": 2,
      "categories": [ { "id": "oss-general", "label": "General", "serviceCount": 2 } ] }
  ],
  "diagramFamilyMix": [ { "familyId": "aws", "nodes": 7 }, { "familyId": "c4", "nodes": 2 } ]
}
```

```ts
{
  name: "search_elements",
  description:
    "Searches the element catalog for services/shapes matching a query, optionally " +
    "restricted to one family or category. Returns the exact elementType and serviceId " +
    "strings required by add_node. Never invent these values — always obtain them here.",
  parametersSchema: {
    type: "object",
    properties: {
      query:      { type: "string", description: 'Free text, e.g. "cache", "kubernetes deployment", "postgres"' },
      familyId:   { type: "string", description: 'Optional: restrict to one family id from list_element_families' },
      categoryId: { type: "string", description: "Optional: restrict to one category id" },
      limit:      { type: "number", description: "Max results, default 15, max 50" },
    },
    required: ["query"],
  },
}
```

Retorno:

```jsonc
{
  "results": [
    { "elementType": "aws-database", "serviceId": "elasticache",
      "familyId": "aws", "label": "Amazon ElastiCache",
      "description": "Managed in-memory cache. Use for Redis/Memcached caching.",
      "requiredFields": [] },
    { "elementType": "oss-datastore", "serviceId": "redis",
      "familyId": "oss", "label": "Redis", "description": "…", "requiredFields": [] }
  ],
  "truncated": false
}
```

Justificativa de forma:

- **Dois campos de saída (`elementType` + `serviceId`) e não um**, porque é exatamente o
  par que `add_node` já consome hoje (`tools.ts:44-47` + `apply-diagram-patch.ts:63-67`).
  A tool devolve os valores no formato em que serão reusados — nenhuma transformação do
  lado do modelo, que é onde os erros aparecem.
- **`requiredFields` no resultado** porque `ComponentTypeDefinition.requiredFields`
  (`component-catalog.ts:9`) já existe e alimenta o prompt ("Required fields: …").
  Derivando de `model.requiredFields` do descriptor, a informação chega junto com o tipo,
  não numa seção separada do prompt.
- **`diagramFamilyMix` em `list_element_families`** é a materialização da regra de
  desambiguação proposta na §2.9 da proposta anterior: o modelo recebe como *fato* que o
  diagrama já tem 7 nós AWS, em vez de adivinhar provedor. É contável a partir do
  registry (cada nó sabe a família) e custa nada.
- **Somente leitura**, portanto **fora de `WRITE_TOOL_NAMES`** (`tools.ts:140-147`) —
  não passam pelo gate de confirmação de patch.
- **Sem paginação, com `truncated`**. Paginação obriga o modelo a manter estado entre
  chamadas; um booleano mais um `limit` cobre o caso real (refinar a query) sem isso.

Custo de prompt: o bloco estático cai de ~145 entradas (uma por serviço AWS, cada uma com
descrição e exemplo JSON — hoje o maior bloco do system prompt) para ~6 famílias e
~60 categorias. Não medi o delta de tokens; é mensurável com `buildSystemPrompt` antes
de implementar, e recomendo medir na fatia em que isso entrar.

---

## Parte 2.1 — Levantamento de custo da convivência

### 2.1.1 Persistência

**Onde `Component` é serializado.** Um único caminho: o middleware `persist` do zustand
sobre `IStoragePort` (`persist.config.ts:26-55`), com `partializeState` (`:37-45`)
gravando `diagrams` inteiro — e portanto `snapshot.components` — via
`createJSONStorage`. Não há serializador paralelo: `JSON.stringify` de diagrama aparece
só no export JSON (`export-service/export-json.ts`) e no arquivo de workspace
(`validateWorkspaceFile.ts`), ambos consumindo o mesmo objeto de domínio.

**`PERSIST_SCHEMA_VERSION` = 12** (`persist.config.ts:31`). O padrão do repo, lido em
`mergePersistedState` (`:447-493`), é revelador: **22 migrações rodam incondicionalmente
a cada rehydrate**, e apenas 2 são condicionadas a `fromVersion`
(`:673-678`, constantes `SCHEMA_VERSION_EDGE_LAYOUTS_RECORD = 5` e
`SCHEMA_VERSION_EDGE_CONTROL_POINTS = 6`). Ou seja: o repo trata migração como
**normalização idempotente**, não como cadeia versionada estrita.

E já existe o precedente exato da renomeação que a decisão 12 pede:

- `migrateUnifyRegistryServiceId` (`:333-354`, schema v11) — unifica
  `Component.registryServiceId` em `serviceId`, varrendo `snapshot.components` **e**
  `scenes[*].addedComponents`, com `delete` do campo legado;
- `migrateExternalElementLinkedDiagramId` (`:305-324`) — mesma forma.

**Conclusão:** `awsService`/`gcpService`/`azureService` → `serviceId` cabe no padrão
existente sem mecanismo novo — é copiar `migrateUnifyRegistryServiceId` com três campos
de origem em vez de um, bump para v13. **O registry novo em si não toca persistência**:
`ElementDescriptor` é código, não dado. A única exceção é
`BUILTIN_COMPONENT_TYPES`/`sanitizeComponentType`, que roda **na leitura**
(`migrations.ts:26`) — e é justamente onde o §4.2 mostrou o rebaixamento de tipos de
nuvem.

**Volume de dado no repo.** `awsService|gcpService|azureService`: **358 ocorrências em
48 arquivos**. Separando dado de código:

| Arquivo de dado | ocorrências |
| --- | --- |
| `canvas/layout/generated-diagrams/B-run1.ts` | 37 |
| `canvas/layout/generated-diagrams/B-run2.ts` | 40 |
| `canvas/layout/generated-diagrams/B-run3.ts` | 29 |
| `canvas/layout/reference-diagrams.ts` | 31 |
| `lib/catalogs/patterns.ts` | 21 |
| `fixtures/seeds/urlshort-example.ts` | 16 |

~174 ocorrências são **fixtures e dados de referência** (inclusive os diagramas usados
por testes de layout), e o restante é código. Os fixtures migram por script, mas
`reference-diagrams.ts` e os `B-run*.ts` são *baselines de layout* — mudá-los exige
reconferir os testes que os consomem, não só um find/replace.

### 2.1.2 Colaboração — o risco de maior peso

**Formato on-the-wire é o objeto de domínio cru.** `useCollabStoreSync.ts:115-118` e
`:232-237` montam o patch com `diagram.snapshot.components as Record<string, unknown>` —
sem serializador intermediário, sem versão de schema na mensagem. O `protocol: 2` que
aparece no handshake (`server/loadtest/worker.ts:131-138`) versiona o **transporte**, não
a forma do componente.

**E há um detector de divergência que transforma isso em falha ativa.**
`utils/snapshotChecksum.ts` hasheia a serialização canônica de todo o conjunto sincronizado,
**incluindo os nomes das chaves** (`:43-48`: `Object.entries(...).sort(...)`, emitindo
`"chave":valor`). O comentário do próprio arquivo (`:1-12`) explica a consequência: uma
divergência de checksum dispara "o reparo caro (um snapshot completo)". E o servidor
calcula o mesmo valor, com paridade travada por teste
(`snapshotChecksum.parity.test.ts`).

**Cenário concreto de falha (fatia de renomeação de campo, dois clientes em versões
diferentes na mesma sala):** cliente novo grava `serviceId: "ec2"`; cliente velho grava
`awsService: "ec2"`. Os dois componentes têm conteúdo equivalente e **canonicalizações
diferentes** → checksums diferentes → resync completo em loop, mais o ícone sumindo no
cliente que não reconhece o campo do outro.

Isso é o achado que mais condiciona o plano: **exatamente uma fatia muda a forma do
objeto que trafega** (a de schema). Todas as outras mudam só código. E essa fatia precisa
ser partida em duas, separadas por uma janela de release:

- **6a — tolerância:** ler `serviceId ?? awsService ?? gcpService ?? azureService`;
  continuar **gravando o campo legado**. Checksum idêntico ao do cliente velho → sala
  mista segura.
- **6b — corte:** passar a gravar `serviceId` e rodar a migração v13. Só depois de 6a
  estar em produção tempo suficiente para o parque de clientes ter girado.

Não verifiquei se existe mecanismo de forçar atualização de cliente ou de recusar sala
com versões divergentes — se existir, 6a e 6b podem colapsar em uma; se não existir, não
podem.

### 2.1.3 Hot path de render

`resolveNodeDescriptor` é chamado **uma vez por componente visível** a cada reconstrução
de nós (`useCanvasNodes.ts:403`, dentro do `.map()` em `:402`, sob o `useMemo` de `:320`).
A implementação atual (`registry.ts:42`) é
`NODE_TYPE_REGISTRY.find((d) => d.matches(type))` — varredura linear de 12 descriptors,
com **uma chamada de função por descriptor até casar**, mais o caso especial de swimlane
(`:56-61`).

O registry proposto resolve por `Map<ElementTypeId, ElementDescriptor>`: **O(1), sem
chamadas de função**. Ou seja, nesse ponto a arquitetura nova é *mais rápida* que a atual,
não mais lenta — a indireção que eu temia na §5 da proposta anterior não existe aqui.

Onde ainda pode custar: se `buildData` passar a compor slices em runtime (montar o objeto
a partir de vários pedaços do descriptor) em vez de ser uma função só. A mitigação é
contratual — `canvas.buildData` continua sendo **uma** função, como hoje.

**Dá para medir:** sim, e barato. `src/test/stress-canvas-pipeline.test.ts` já existe como
harness de pipeline, e há `cypress/e2e/stress-panels-performance.cy.ts` para o lado do
navegador. Recomendação: capturar baseline de `resolveNodeDescriptor` + montagem de nós
**na fatia F1**, com o registry ativo para um único tipo — é quando o custo de convivência
(duas consultas por nó) é máximo em proporção. Não recomendo benchmark antes disso:
mediria o sistema que vai mudar.

### 2.1.4 Resumo do levantamento

| Eixo | Custo de convivência | Nota |
| --- | --- | --- |
| Persistência | **nenhum** enquanto só código muda | registry não é dado |
| Schema de campo | 1 migração no padrão existente (v13) | precedente literal em `persist.config.ts:333` |
| Colaboração | **alto, mas concentrado em 1 fatia** | checksum torna sala mista uma falha ativa |
| Hot path | **negativo** (fica mais rápido) | `find` linear → `Map` |
| Fixtures | ~174 ocorrências em 6 arquivos | 4 deles são baselines de layout |

---

## Parte 2.2 — Sequência de fatias e a lógica do corte

### 2.2.1 O mecanismo de convivência (decisão 12)

Um único ponto decide quem responde por um tipo:

```ts
// resolução de propriedade — a única função que sabe que existe transição
function ownerOf(typeId: string): "registry" | "legacy" {
  return elementRegistry.has(typeId) ? "registry" : "legacy";
}
```

E **a invariante que segura o plano**: um tipo pertence a exatamente um caminho. Isso vira
um teste de contrato na fatia F0, executado a cada fatia seguinte:

> Para todo `id` em `elementRegistry`, nenhum descriptor de `NODE_TYPE_REGISTRY` casa
> `id`, nenhum ramo de `buildComponentForType` o constrói, nenhuma paleta o lista pelo
> caminho antigo, e `BUILTIN_COMPONENT_TYPES` não o contém.

Migrar um tipo é, então, **uma operação de transferência**: registrar no novo e remover do
antigo, na mesma fatia, com o teste provando que não há dono duplo. É o oposto de "escrever
o novo e limpar depois" — que é exatamente onde nascem bugs de transição.

Como cada consumidor decide, durante a transição:

| Consumidor | Caminho novo | Fallback legado | Fatia em que passa a consultar o registry |
| --- | --- | --- | --- |
| **Criação** (`addComponent`) | `descriptor.model.defaultData()` + `defaultSize` (decisão 3) | `buildComponentForType` / `buildLayoutForComponent` inalterados | F1 |
| **Render** (`resolveNodeDescriptor`) | `registry.get(type).canvas` | `NODE_TYPE_REGISTRY.find(...)`, catch-all `c4` intacto | F1 |
| **Paleta** | itens derivados de `registry.byCategory()` | listas de `buildPickerOptions` / `QuickInsertPopover` | F1 (as duas views concatenam as duas fontes; ordenação estável por categoria) |
| **Inspector** | `descriptor.inspector.panel` | cadeia de `if` de `ElementPanel/index.tsx:89-162` | F1 (um `if` novo no topo, antes da cadeia) |
| **Export** | `descriptor.export.drawio.toExportNode` | `mapNode` com guards (`to-export-model.ts:243-349`) | F1 (early return antes dos guards) |
| **LLM** | entradas derivadas do registry | `ALL_COMPONENT_TYPES` curado | F1 para o catálogo; tools hierárquicas só na F8 |
| **Validação de tipo** | `registry.has(id)` | `BUILTIN_COMPONENT_TYPES` | F1 — `sanitizeComponentType` passa a ser `registry.has(v) \|\| BUILTIN.has(v) \|\| plugin` |

O ponto mais delicado da tabela é o último: hoje `sanitizeComponentType` é a fonte da
verdade sobre "tipo válido" **na leitura de dado persistido** (`migrations.ts:26`). Ampliar
a condição com `registry.has()` é aditivo (só aceita mais coisa), portanto seguro em
qualquer ordem — mas exige que o registry esteja **populado antes da rehydrate**, ou seja,
registro em módulo, não em efeito de React. É um requisito de ordem de bootstrap que
merece um teste próprio.

### 2.2.2 A lógica do corte

1. **Mecanismo antes de conteúdo.** F0 introduz contratos e registry vazio; nada consome.
2. **Uma prova ponta a ponta antes de escala.** F1 migra **um** tipo pelos sete
   consumidores. Se o contrato estiver errado, o custo de descobrir é um tipo, não catorze.
3. **Kinds de export novos antes dos tipos que dependem deles.** `passthrough` e `image`
   (Parte 1) precedem a migração de `unknown` e `svg`.
4. **Shape próprio antes de família.** Os elementos de shape próprio são independentes
   entre si; famílias de nuvem são geradas em lote e compartilham contrato — errar o
   contrato de família custa mais.
5. **Família menor primeiro, AWS por último.** GCP (41 serviços, 12 categorias, 15
   arquivos acoplados) antes de Azure (58 / 13 / 15) e muito antes de AWS (145 / 16 / 58
   arquivos, mais IR, import, spotlight, panel kinds).
6. **Schema isolado.** A renomeação de campo não viaja com mudança de comportamento, e é a
   única fatia com risco de colaboração (§2.1.2).
7. **Conteúdo novo depois do contrato validado.** Kubernetes e `oss` só depois de pelo
   menos uma família migrada — confirmo a ordem sugerida no prompt, com uma ressalva: elas
   devem vir também **depois** da fatia de schema, para nascerem já com `serviceId` e não
   precisarem de migração própria.
8. **Limpeza no fim.** Matar o catch-all (decisão 4) só é possível quando todo tipo tem
   dono declarado.

### 2.2.3 Onde a paridade GCP/Azure (decisão 8) acontece

**Não é fatia própria — é consequência das fatias F5 e F6, desde que F2–F4 já tenham
tornado os consumidores registry-driven.** O raciocínio: hoje GCP/Azure não têm export com
ícone, import, catálogo LLM, preview, spotlight nem busca porque cada um desses
consumidores tem um caminho AWS escrito à mão (§4.1). Quando o consumidor lê do registry,
a família passa a ser atendida por existir no registry — não por alguém escrever o caso
dela.

A exceção honesta são os **dados** que a paridade exige e que nenhum registry inventa:
o de-para de ícone drawio por serviço (hoje `AWS_RESICON`, 52 entradas para 145 serviços —
§2.2 do mapeamento), os padrões de import (`import-drawio.ts:122-138` reconhece
`mxgraph.aws4`/`aws3`), e os equivalentes de `PANEL_KINDS` (VPC/Subnet do GCP, VNet do
Azure). Esses são **dados de catálogo por família** e entram junto com F5/F6 — por isso
essas fatias são maiores do que "só registrar".

---

## Parte 2.3 — As fatias

> "Pronto" em todas: `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`
> verdes, e o teste de invariante de dono único (F0) passando.

### F0 — Contratos e registry vazio

**Objetivo.** Introduzir `ElementDescriptor`, `elementRegistry` e as validações de
registro, sem nenhum consumidor.

**Áreas.** `src/features/elements/` (novo): `element.types.ts`, `element.registry.ts`,
`element.registry.test.ts`. Mais o teste de invariante de dono único.

**Pronto quando.** O registry recusa, com erro claro: id duplicado, `export.drawio`
ausente (decisão 6), `labelKey`/`descriptionKey` sem entrada nos dois locales, `handles`
ausente. Nada no app muda de comportamento — é código novo e inerte.

**Risco.** Projetar no vazio: o contrato pode não sobreviver ao primeiro tipo real.
**Mitigação:** F0 e F1 são aprovadas juntas como um par; se F1 exigir mudança no contrato,
ela muda F0 antes de merge, não depois.

**Depende de.** Nada.

### F1 — Prova ponta a ponta com um tipo

**Objetivo.** Migrar **um** tipo pelos sete consumidores, provando registro → criação →
render → paleta → inspector → export → catálogo LLM.

**Candidato: `json-viewer`** (o prompt sugeriu `note`; recomendo trocar, justificativa
abaixo).

| | `json-viewer` | `note` |
| --- | --- | --- |
| descriptor próprio | ✓ `jsonviewer.descriptor.ts` | ✓ `note.descriptor.ts` |
| renderer próprio | ✓ | ✓ |
| `defaultSize` no descriptor | ✓ (`:19`) | ✓ (`:22`) |
| **painel de inspector dedicado** | ✓ `JsonViewerPanel.tsx` | ✗ cai no `ComponentPanel` genérico |
| kind de export próprio | ✓ `jsonViewer` | ✓ `note` |
| no catálogo do LLM | ✓ (`component-catalog.ts:50-55`) | ✓ (`:21-27`) |
| **regra de comportamento** | ✓ não pode originar conexão (`connection-rules.ts:27-29`) | ✓ mesma regra |
| estado de colapso | ✗ | ✓ (mais superfície) |

`note` deixaria o slice de **inspector** — um dos sete — sem prova nenhuma, que é
exatamente o slice que substitui a cadeia de `if` de `ElementPanel/index.tsx:89-162`.
`json-viewer` exercita os sete, e ainda prova que o descriptor carrega regra de domínio
(`canBeConnectionSource`). `db-table` exercitaria mais ainda, mas traz `buildStyle` com
altura derivada de linhas e sizing de colapso — superfície demais para a primeira prova.

**Áreas.** `elements/custom/json-viewer/`; pontos de fallback em `components.slice.ts`,
`registry.ts` (node-types), `ElementPanel/index.tsx`, as duas paletas,
`to-export-model.ts`, `component-catalog.ts`, `sanitize-component-type.ts`.

**Pronto quando.** Criar, renderizar, editar, exportar e pedir um JSON viewer ao chat
funciona **sem passar por nenhum caminho legado**, e o teste de dono único prova isso.
Todos os outros 13 tipos continuam idênticos. Baseline de performance capturada
(§2.1.3).

**Risco.** A convivência duplica a consulta em 7 lugares — é o momento de pico de
complexidade acidental do plano. **Mitigação:** a tabela de §2.2.1 é o contrato dessa
duplicação, e todo fallback nasce com comentário apontando a fatia que o remove.

**Depende de.** F0.

### F2 — `passthrough` e `image` no export-core

**Objetivo.** Implementar os dois kinds da Parte 1.

**Áreas.** `export-core/model.ts` (união + interfaces), `cell-builders.ts` (dois branches
novos), `export-core/constants.ts` (defaults), testes; e o sync para o plugin LeanIX
(`plugins/.../scripts/sync-shared.mjs`, guardado por `npm run plugins:sync-check` —
ADR-0009).

**Pronto quando.** Um `ExportNode` de cada kind produz XML que o drawio abre, com
`structuraType` preservado; golden tests atualizados.

**Risco.** O `image` embute `svgContent` inteiro no XML — diagramas com SVGs grandes
podem gerar arquivos pesados. **Mitigação:** teste com SVG grande e um limite declarado
(acima dele, cai em `passthrough` com o nome).

**Depende de.** Nada (pode ir em paralelo a F1). Bloqueia F3 na parte de `svg`/`unknown`.

### F3 — Elementos de shape próprio restantes

**Objetivo.** Migrar os 13 tipos restantes de shape próprio para o registry.

Sub-fatias sugeridas, cada uma mergeável (tamanho crescente de superfície):

- **F3a** — `note`, `db-table` (têm colapso; `db-table` tem `buildStyle` derivado);
- **F3b** — `api-group` + `endpoint` (par acoplado: o tamanho do grupo deriva da
  contagem de filhos, `apigroup.descriptor.ts` + `handleEndpointInsertion`);
- **F3c** — `panel` + `swimlane` (contêineres; `canBeParent`, e o caso especial de
  resolução fora do `matches`, `registry.ts:56-61`) + o catálogo `PANEL_KINDS` virando
  containers de família (§2.10 da proposta), com as strings indo para i18n (§4.9);
- **F3d** — `process-node`, `external-element`, `svg`, `unknown` (os dois últimos
  estreiam `image`/`passthrough`).

**Pronto quando.** `NODE_TYPE_REGISTRY` contém apenas o catch-all `c4` e os descriptors de
plugin; `buildComponentForType` só tem os ramos de C4 e nuvem; o `throw` de
`to-export-model.ts:345` está morto (todos os 5 tipos exportam).

**Risco.** F3c toca contêineres, que mexem com drag-parenting e layout — a área com mais
histórico de regressão do repo. **Mitigação:** F3c sozinha numa fatia, com os testes de
`stress-panels*` e `panel-hit-geometry.cy.ts` como gate.

**Depende de.** F1 (contrato provado), F2 (para F3d).

### F4 — Contrato de família + migração do GCP

**Objetivo.** Introduzir `CloudFamilyDefinition` e migrar a menor família existente.

**Áreas.** `elements/families/` (contrato + fábrica que gera um descriptor por
categoria); `cloud/providers/gcp/*` vira uma `CloudFamilyDefinition`; `componentColor.ts`,
`CustomNode`, `ComponentPanel` e as paletas passam a tratar GCP pelo registry; tokens de
accent consolidados (§4.4); o `CloudIcon` único (§4.3) — como GCP é o provider que usa o
resolver por `import.meta.glob`, ele é justamente o caso que quebra um `CloudIcon`
mal generalizado.

**Pronto quando.** GCP ganha, por consequência do registro: export drawio com ícone,
import, entrada no catálogo do LLM, forma no preview SVG, spotlight e ícone na busca —
tudo o que hoje só AWS tem (§4.1). Os dados novos que isso exige (de-para de ícone drawio
GCP, padrão de import) entram nesta fatia.

**Risco.** É a fatia onde a decisão 8 (paridade) deixa de ser abstrata e vira trabalho de
catálogo: o de-para de ícone drawio para GCP pode simplesmente **não existir** no
mxgraph com boa cobertura. **Mitigação:** `passthrough` (F2) é o piso garantido — a
paridade nunca fica bloqueada por falta de ícone, no máximo degrada visualmente.

**Depende de.** F1, F2, F3 (para os consumidores já estarem registry-driven).

### F5 — Azure e AWS

**Objetivo.** Migrar as duas famílias restantes; extinguir os caminhos AWS-only.

**Áreas.** Azure é simétrica a GCP. AWS traz o resto: `AwsIcon` (8 importadores),
`AwsBrowseView`/`AwsCategoryBlock`, `AWS_SPOTLIGHT_IDS`, `AWS_PRIMARY_CATEGORY_IDS`,
`getPanelKindForAwsService`, `AWS_RESICON`, `aws-cache.ts`, `import-drawio.ts`,
`llm/ir/*` (hoje uma enumeração AWS, `ir.types.ts:36-56`), `CanvasSearch.tsx:212`,
`AwsIconPickerPanel`.

**Pronto quando.** As duas paletas leem de uma fonte só (§4.7); `AwsIcon` não existe;
nenhum consumidor cita um provedor pelo nome.

**Risco.** É a maior fatia do plano e toca o IR de geração, que tem histórico próprio.
**Mitigação:** partir em F5a (Azure, simétrica e barata) e F5b (AWS), e tratar o IR como
sub-fatia separada F5c — ele consome o catálogo, não o contrário.

**Depende de.** F4.

### F6 — Schema: `awsService`/`gcpService`/`azureService` → `serviceId`

**Objetivo.** Unificar o campo de serviço. **Só reforma de schema**, zero comportamento.

**F6a — tolerância (lê ambos, grava legado).** Todo leitor passa a
`serviceId ?? awsService ?? gcpService ?? azureService`. A gravação continua no campo
legado. Sala colaborativa mista permanece com checksum idêntico (§2.1.2).

**F6b — corte (grava `serviceId`, migração v13).** `migrateUnifyCloudServiceId` no molde
de `migrateUnifyRegistryServiceId` (`persist.config.ts:333-354`), varrendo
`snapshot.components` e `scenes[*].addedComponents`; `PERSIST_SCHEMA_VERSION` 12 → 13;
`addComponent` perde o 5º parâmetro posicional `awsService` (§4.5); fixtures e baselines
de layout atualizados (~174 ocorrências em 6 arquivos, §2.1.1).

**Pronto quando.** Fixtures antigos (com os três campos legados) carregam e resultam em
`serviceId`, provado por teste contra fixture congelado; golden tests do export
inalterados.

**Risco.** **O maior risco de produto do plano** (§2.1.2). **Mitigação:** a separação
6a/6b com janela de release entre elas; e verificar antes se existe algum gate de versão
de cliente na sala colaborativa — não verifiquei, e isso muda se 6a e 6b podem colapsar.

**Depende de.** F5 (todas as famílias no registry, para o leitor ser um só).

### F7 — Kubernetes como família própria (decisão 11)

**Objetivo.** Primeira família **nova** pelo contrato novo — a validação real de que
"adicionar família" virou operação localizada.

**Áreas.** `elements/families/k8s/k8s.family.ts` (categorias Workloads, Networking,
Storage, Config, …), tokens de accent nos dois temas, i18n, de-para de ícone drawio
(`mxgraph.kubernetes.*` existe no drawio).

**Pronto quando.** Kubernetes aparece em paleta, canvas, painel, export, import e catálogo
do LLM **sem que nenhum arquivo fora dos 4 pontos previstos tenha sido tocado**. Se algum
quinto arquivo precisar mudar, isso é um defeito do contrato, não da fatia — e é
exatamente a métrica que essa fatia existe para medir.

**Depende de.** F4 no mínimo; recomendo depois de F6b, para nascer com `serviceId`.

### F8 — Família `oss` + catálogo hierárquico do LLM

**Objetivo.** Redis e Kafka numa família plana e extensível, e a troca do catálogo do LLM
para o modelo hierárquico (decisão 10).

**Áreas.** `elements/families/oss/oss.family.ts` — a variante **plana** do contrato de
família (serviços sem hierarquia própria; proposta: uma categoria por natureza —
`datastore`, `messaging`, `search`, `runtime` — para que RabbitMQ, Elasticsearch e
outros entrem como entrada de catálogo, nunca como família nova). Mais
`llm/tools.ts` (as duas tools da Parte 1.2), `apply-diagram-patch.ts` (dispatch de
leitura), `component-catalog.ts` (passa a emitir famílias/categorias),
`prompt-builder.ts`.

**Pronto quando.** O modelo consegue adicionar um Redis partindo de "preciso de um cache"
usando `search_elements`; o bloco estático do system prompt encolhe (medir antes/depois).

**Risco.** As duas tools mudam o comportamento do assistente — é a fatia com regressão
menos determinística do plano. **Mitigação:** manter o catálogo plano atrás de flag por
uma release, e usar `cypress/e2e/ir-generation-smoke.cy.ts` como gate.

**Depende de.** F5 (catálogo derivado precisa de todas as famílias no registry).

### F9 — Fim do catch-all e da lista manual (decisões 4 e §4.2)

**Objetivo.** `c4Descriptor.matches: () => true` deixa de existir; C4 vira família
declarada; `BUILTIN_COMPONENT_TYPES` é apagado e `sanitizeComponentType` passa a consultar
só o registry.

**Pronto quando.** Um tipo desconhecido resolve para `unknown` explicitamente; um
componente `aws-compute` sobrevive a `migrateDiagram` (o comportamento medido no §4.2 do
mapeamento deixa de acontecer).

**Risco.** Muda comportamento visível para dados já salvos com tipo corrompido: o que hoje
renderiza como C4 passa a aparecer como desconhecido. **Mitigação:** nota de release e uma
migração que tente recuperar o tipo antes de desistir.

**Depende de.** F3, F5 (todo tipo com dono).

### F10 — Renomear `CustomComponentTemplate` → `ElementPreset` (decisão 5)

**Objetivo.** Rename de feature + store, e `CustomNode` → `CardNode`.

**Áreas.** `features/custom-components/` → `features/element-presets/`, a store
persistida (chave própria — migração de leitura do nome antigo), 9 importadores de
`CloudIcon`/`AwsIcon` afetados pelo rename de `CustomNode`.

**Risco.** Baixo tecnicamente, mas toca dado persistido do usuário (a biblioteca de
presets). **Mitigação:** ler a chave antiga e regravar na nova, uma vez.

**Depende de.** Nada tecnicamente. Independente — encaixa em qualquer janela. Recomendo
**depois** de F3, para não renomear arquivos que ainda vão mudar de forma.

### Grafo de dependências

```
F0 ──▶ F1 ──▶ F3a/b/c ──▶ F4 ──▶ F5a ──▶ F5b ──▶ F5c ──▶ F6a ─(janela)─▶ F6b ──▶ F7
       │        ▲                                   │                            └─▶ F8
F2 ────┴────────┘ (F3d)                             └─▶ F9 (após F3+F5)
F10 ── independente (recomendado após F3)
```

---

## Qual fatia aprovar primeiro

**F0 + F1 como um par único, com `json-viewer` como tipo de prova.**

Por quê:

1. **F0 sozinha não é aprovável com honestidade.** É contrato sem consumidor — o risco
   dela (§F0) é justamente projetar no vazio, e o único antídoto é o primeiro tipo real
   chegar antes do merge. Aprovar as duas juntas é o que torna o risco gerenciável.
2. **É a única fatia que responde uma pergunta que nenhum documento respondeu.** Os três
   documentos desta sequência descreveram o sistema atual e desenharam o alvo, mas nenhum
   provou que o contrato de sete slices sobrevive a um elemento real com painel próprio,
   regra de conexão e kind de export. F1 é o experimento que responde isso pelo custo de
   um tipo.
3. **É onde a duplicação de convivência é medível e reversível.** Com um único tipo no
   registry, reverter é apagar um diretório e sete `if`s. A partir de F3, não é mais.
4. **Ela captura a baseline de performance** (§2.1.3) no momento de pico proporcional de
   indireção — o número que vai justificar (ou desmentir) a afirmação de que o registry
   deixa o hot path mais rápido.

Em paralelo, **F2 pode ser aprovada junto** sem aumentar risco: ela não toca o registry,
só acrescenta dois kinds ao export-core, e é pré-requisito de F3d. Se você quiser uma
segunda frente de trabalho independente desde o começo, é essa.

O que eu **não** recomendo aprovar cedo, mesmo parecendo barato: **F10** (o rename). É
mecânico, dá sensação de progresso, e renomeia arquivos que F3 ainda vai reescrever —
pagando o custo de conflito duas vezes.

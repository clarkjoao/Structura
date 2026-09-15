# Correção dos achados da auditoria independente

**Branch:** `fix/element-registry-audit`, a partir de `feat/element-registry`
**Entrada:** [auditoria-independente-element-registry.md](auditoria-independente-element-registry.md)
**Escopo:** os 7 itens do pedido, um commit por item.

## Estado dos gates

Medido nesta branch, no fim da fatia:

| Gate | Resultado |
| --- | --- |
| `npm run typecheck` | verde |
| `npm test` | verde — 247 arquivos, 2534 testes (era 244 / 2506) |
| `npm run plugins:sync-check` | verde (types e export-core em sincronia) |
| `npm run build` | **falha por desenho** sem `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true`; verde com ela (Item 1) |
| `npm run format:check` | **vermelho — e já estava** |
| `npm run lint` | **2 erros — e já estavam** |

### Os dois gates herdados vermelhos

Verifiquei numa worktree limpa de `feat/element-registry` antes de atribuir culpa:

- **`format:check`** já falhava na base, em 10 arquivos. Nesta branch são 7. Um deles
  (`ComponentPanel.tsx`) era meu e foi corrigido; três outros
  (`element-picker/utils.ts`, `k8s/ICONS_LICENSE.md`, `SuggestionCard.tsx`) foram
  corrigidos de passagem por um `prettier --write` em diretórios que eu estava editando.
  Os 7 restantes são de `canvas/hooks/*` e `ElementPanel/*` e **não toquei**.
- **`lint`** tem 2 erros, ambos em arquivos que não estão no meu diff:
  `canvas/edges/EdgeLabelPortal.test.tsx:99` (*Cannot reassign variables declared outside
  of the component/hook*) e `ElementPanel/JsonViewerPanel.tsx:59` (*`activeDiagram` is
  assigned a value but never used*). Mais 33 warnings.

Não corrigi nenhum dos dois: estão fora dos 7 itens e misturá-los tornaria o diff desta
fatia difícil de revisar. **Mas eles são gates de CI vermelhos**, então esta branch não
passa num CI que os rode — independentemente do meu trabalho.

---

## Item 1 — Guard técnico para o corte de F6b ✅

### O que foi encontrado ao implementar

O pedido oferecia duas opções e pedia que eu escolhesse documentando. **A primeira
opção — flag que faz o sistema "se comportar como F6a", gravando os campos legados —
não é implementável aqui**, e entregá-la teria sido pior que não entregar nada, porque
pareceria proteção sem proteger:

1. `migrateUnifyCloudServiceId` (`store/persist.config.ts`) roda em **todo** rehydrate e
   faz `delete` incondicional de `awsService` / `gcpService` / `azureService` depois de
   copiá-los para `cloudServiceId`. Uma gravação legada sobreviveria até o próximo load
   e não mais.
2. `AwsComponent` / `GcpComponent` / `AzureComponent` não declaram mais os campos
   legados (`component.types.ts`), então o ramo "desligado" nem compilaria sem reabrir a
   união que F6b fechou.
3. `k8s` e `oss` nunca tiveram campo legado. Não existe comportamento F6a para eles.

O corte é o schema v13 inteiro — migração incluída — e não uma escolha de nome de campo
nos sites de escrita. Então o gate foi para onde o corte de fato acontece: **o build**.

### O que foi feito

- **Um único produtor.** `cloudServiceIdWrite()` e `cloudServiceIdClearingPatch()` em
  `features/diagram/model/cloud-service-id.ts`. Os 12 sites de escrita passam por eles.
- **`cloud-service-id.write-gate.test.ts`** varre `src/` e falha se qualquer arquivo fora
  do ponto de controle emitir o campo. Distingue escrita de declaração de tipo
  (`cloudServiceId: string`) e de leitura (`comp.cloudServiceId`).
- **`cloudServiceIdReleaseGate`** em `vite.config.ts` aborta `npm run build` a menos que
  `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true`. `dev` e `test` não são afetados.
- `.env.example`, ADR-0010 e `architecture/element-registry.md` atualizados.

### Verificado

```
npm run build                                      -> exit 1  (mensagem apontando o ADR)
VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true npm run build -> exit 0
```

O teste de bypass também foi provado útil: na primeira execução ele apontou sites que eu
não tinha enumerado (`lib/catalogs/patterns.ts`, fixtures e testes). Foram classificados
como **dados persistidos**, não caminhos de escrita — o código que os insere
(`patterns.slice.ts`) passa pelo ponto de controle — e estão allowlistados com essa
justificativa no próprio teste.

### Fora de escopo, para sua decisão

Ligar a flag continua sendo decisão sua. O mecanismo não opina sobre *quando*.

---

## Item 2 — Gate F8b que rejeitava nós válidos ✅

### Causa raiz

`validateAddNodeAgainstConfirmedHits` exigia que **todo** `add_node` cloud de um patch
fosse um par `(elementType, serviceId)` exato retornado pelas buscas **daquele mesmo
patch** — e o gate armava sempre que o patch continha qualquer `SEARCH_ELEMENTS`
(`sawSearch`). Consequência: buscar deixava o modelo *mais* restrito, então quanto melhor
ele se comportasse (procurar uma coisa, compor o resto do catálogo do prompt), mais
trabalho era descartado em silêncio com um `console.warn`.

### Por que não dava para estreitar o gate

O pedido preferia restringir "só os `add_node` que o modelo pretendia buscar". Avaliei e
**não é decidível**: o escopo de uma busca é uma query de texto, não um namespace.
`search_elements("redis", family "oss")` não cobre `(oss-messaging, kafka)` mais do que
cobre Lambda. Determinar se um par "estava no escopo" é a mesma computação que re-rodar a
busca — que é exatamente o que o gate rejeitado já fazia.

`validateAddNodeAgainstRegistry` é sólido e suficiente para a propriedade que importa: o
par existe. Um tipo ou serviço inventado é rejeitado com ou sem busca; um par registrado é
válido com ou sem busca. Então a rejeição saiu e a ordenação leitura-antes-de-escrita —
a metade útil de F8b — ficou.

### Testes de aceite

| Caso | Antes | Agora |
| --- | --- | --- |
| `search_elements("redis")` + `add_node(oss-datastore, redis)` | aplica | aplica |
| `search_elements("redis")` + `add_node(aws-compute, lambda)` | **descartado** | **aplica** |
| `add_node(aws-compute, "not-a-service")`, com ou sem busca | rejeita | rejeita |
| `add_node("aws-invented", lambda)` | rejeita | rejeita |
| `add_node(oss-datastore, lambda)` (serviço de outra categoria) | rejeita | rejeita |

O teste antigo chamava o caso do Lambda de *"hallucinated add_node"* e afirmava que devia
ser descartado. `lambda` está registrado sob `aws-compute` (`aws.catalog.ts:24`) — o teste
consagrava o falso positivo, então foi substituído, não ajustado.

O texto do prompt (`component-catalog.ts`) que prometia *"unmatched add_node calls are
skipped"* também foi corrigido, porque deixou de ser verdade.

### Ponto adjacente que **não** mexi — decisão sua

`validateAddNodeAgainstRegistry` exige `serviceId` para qualquer categoria cloud que tenha
serviços, então `add_node { nodeType: "aws-compute" }` sem serviço é rejeitado — apesar de
`aws-compute` ser um elemento registrado que a paleta permite criar e que
`attachService` trata explicitamente (`serviceId: string | undefined`). É a mesma classe
de over-rejection, mas é plausivelmente uma escolha de produto ("uma caixa 'compute'
genérica não serve num diagrama"), e mudá-la ia além do teste de aceite pedido. Fica
registrado aqui.

---

## Item 3 — Campos mortos e perda de dado em presets ✅

### 3.1 `patchableKeys` ganhou o leitor que sempre devia ter

`element-presets` mantinha `ALLOWED_COMPONENT_PATCH_KEYS`, uma lista manual que tinha
divergido dos descritores. A divergência era perda de dado silenciosa. Agora
`patchableKeysForType()` deriva a lista do registry: `BASE_PATCHABLE_KEYS` (campos do
`BaseComponent`, que nenhum descritor declara porque não são por tipo) ∪
`descriptor.model.patchableKeys`. Para um tipo não registrado (plugin, ou registry ainda
não bootstrapado) cai na união de todos os declarados — limitado como a lista antiga, mas
incapaz de divergir.

**Prova de que o bug era real:** as novas asserções foram rodadas contra a implementação
anterior — **6 de 8 falham**. Contra a nova, todas passam.

| Campo | Elemento | Antes |
| --- | --- | --- |
| `svgContent` | `svg` | descartado — preset perdia o SVG (campo obrigatório) |
| `flowShape`, `nodeColor` | `process-node` | descartados (`flowShape` é obrigatório) |
| `panelColorDark` | `note` | descartado |
| `customColor` | `external-element` + 5 famílias cloud | descartado |
| `linkedElementId` / `linkedElementName` / `linkedDiagramName` | `external-element` | descartados |
| `rawContent` | `unknown` | descartado |

Há também uma asserção genérica que não precisa de caso novo por elemento: para **todo**
elemento registrado, o round-trip do preset preserva tudo que ele declara patchable.

### 3.2 Decisão explícita sobre os outros quatro

| Campo | Decisão | Razão |
| --- | --- | --- |
| `ElementModelSlice.defaultNameKey` | **removido** | zero escritores (nenhuma família o define) e zero leitores; o caminho de criação nunca o consulta |
| `ElementExportSlice.drawio.minSize` | **removido** | zero escritores e zero leitores em todo o repo |
| `ElementInspectorSlice.sections` | **removido** | idem — a única ocorrência de `.sections` era `edge.sections` do ELK, sem relação |
| `CloudFamilyService.descriptionKey` | **ligado** | lido por `searchElements`, com fallback para a descrição da categoria |

`descriptionKey` foi o único que valeu manter: 257 serviços registrados eram todos
descritos ao modelo pela frase da própria categoria — Lambda e EC2 recebiam ambos *"AWS
compute services (EC2, Lambda, …)"*. Para não deixá-lo vivo só no papel (um leitor sem
escritor é o mesmo defeito girado), populei as duas entradas de `oss` em `en` e `pt-BR`.
As famílias hyperscaler continuam herdando a linha da categoria, e há teste cobrindo os
dois caminhos.

### 3.3 Item 3b — a fronteira não foi fechada por completo

Como o pedido previa, **não** migrei `element-presets` para consumir `features/elements`
inteiro. O que mudou é só o suficiente para `patchableKeys` ser a fonte real. O que
continua fora:

- `element-presets` ainda importa `@/features/cloud/providers/aws/aws.catalog` e
  `@/lib/catalogs/panels` direto, por baixo do registry.
- `ElementPresetPreviewCard` ainda tem um ramo `isAwsType(...)` com ícone AWS hardcoded.
- `buildComponentPatchFromPreset(preset, hasRegistryService)` ainda mistura o `serviceId`
  de catálogo de negócio com o caminho cloud.

**Recomendo que a migração completa vire uma fatia própria.** Não é grande, mas é de outra
natureza (reescrever o preview card e o caminho de serviço), e misturá-la aqui teria
inchado um commit que já corrige um bug de dado.

---

## Item 4 — F5c: revert sem limpar o rastro ✅

- `irAwsCategoryIdsFromRegistry()` → **`irAwsCategoryIdsFromCatalog()`**. O nome antigo
  afirmava ler o registry; ele lê `AWS_CATEGORIES`.
- O comentário que afirmava *"`ir.types.test.ts` locks this list to the registered AWS
  family so the two cannot drift"* era **falso** e foi removido: o teste comparava
  `getIrSemanticTypes()` filtrado contra `irAwsCategoryIdsFromRegistry()`, e as duas
  metades vinham do mesmo array — `x === x`.
- O teste "guarda" tautológico (*"getIrSemanticTypes is live"*) saiu. Ele afirmava que o
  resultado contém `aws-compute`, verdadeiro por construção a partir do array estático,
  e teria continuado passando se o bug de produção voltasse.
- O novo bloco compara o vocabulário estático contra o **registry vivo**.
- ADR-0010 e `architecture/element-registry.md` agora registram o revert como **decisão
  em vigor**, não como ressalva.

### Dois limites que documentei em vez de esconder

1. Enquanto `awsFamily.categories` for derivado de `AWS_CATEGORIES`, os dois lados
   compartilham a fonte e **não podem divergir**, então as asserções não falham hoje.
   Elas passam a ser falsificáveis no momento em que essa derivação parar — que é a
   mudança que vale pegar. **Verificado:** acrescentando uma categoria não listada a
   `awsFamily`, o bloco fica vermelho nomeando-a
   (`registered AWS categories missing from the IR: aws-fictional`).
2. Nenhum teste unitário consegue pegar a falha original — um snapshot vazio do registry
   dentro do chunk lazy do LLM — porque roda num único grafo de módulos onde o bootstrap
   sempre aconteceu. O guard real é `cypress/e2e/ir-generation-smoke.cy.ts`, que foi o que
   pegou da primeira vez. Isso está escrito no teste e no ADR.

---

## Item 5 — Enumerações de família hardcoded ✅

### Eram cinco, não três

A auditoria tinha encontrado três. Escrever o teste de aceite pedido — uma família
**estrutural**, não cloud — revelou mais duas:

| # | Local | Efeito |
| --- | --- | --- |
| 1 | `listElementFamilies` | família não-cloud invisível para `list_element_families` |
| 2 | `searchElements` | não pesquisável |
| 3 | `recoverCloudCategoryPrefix` | prefixos `aws-`/`gcp-`/`azure-` listados à mão |
| 4 | **`registeredElementTypes()` / `c4RegisteredTypes()`** | filtravam `family === "structural"` / `"c4"`, então `allComponentTypes()` não via a família |
| 5 | **`isValidNodeType`** (consequência de 4) | rejeitava a família como alvo de `add_node` |
| 6 | `buildCategoryNavItems` | nenhuma aba no picker |

(4) e (5) só apareceram porque o teste novo é mais forte que o da família fictícia: aquele
registra uma família **cloud**, que é a forma que já funcionava.

### O que foi feito

- `nonCatalogFamilyIds()` passou a viver em `elements/families/cloud-family.registry.ts` —
  uma casa só, consumida pelo catálogo do LLM, pela busca e pelo picker.
- `buildCategoryNavItems` emite uma aba para qualquer `palette.categoryId` registrado que
  não seja fixo nem de família cloud; `ElementPickerModal` ganhou um corpo genérico que
  renderiza `paletteEntriesForCategory(...)`, com `handleAddPaletteEntry` honrando o
  `createOptions` que a entrada declarar.
- `recoverCloudCategoryPrefix` deixou de listar prefixos: pergunta se
  `<prefixo>-general` está registrado. Isso também corrige `k8s`/`oss`, que a lista antiga
  nunca nomeou.
- Rótulos por convenção `elements.families.<id>.label`, com fallback para o id — nunca uma
  chave i18n crua na frente do modelo. Entradas adicionadas para `structural` e `c4`, que
  antes eram strings inglesas hardcoded (violando `AGENTS.md`).

### Teste de aceite

`src/features/elements/structural-family-contract.test.ts` registra uma família
estrutural fictícia e percorre: registro, sanitização, `list_element_families`,
`search_elements`, `isValidNodeType`, aba do picker, entradas na aba, e export pelo piso
`passthrough`. Mais três casos de recuperação por prefixo, incluindo os negativos
(`k8s-*`/`oss-*` → `unknown`, porque não têm bucket `-general`, e `db-table` não sendo
confundido com prefixo de família).

---

## Item 6 — Contrato assume categoria→serviço e "só cards" (avaliação, sem implementação)

### Confirmação do achado

Confirmado, e é mais estrutural do que o comentário sugere:

- `build-cloud-family-descriptors.ts` fixa `role: "card"`, `canBeParent: false` e
  `derivesSize: true` para **toda** categoria que uma família produz. Não há campo em
  `CloudFamilyDefinition` que diga o contrário.
- `k8s.catalog.ts` cortou Namespace e Cluster do catálogo por causa disso.
- A mesma necessidade já existe no AWS e é atendida **fora** do sistema de elementos:
  `AWS_SERVICE_TO_PANEL_KIND` (`lib/catalogs/panels.ts`), um mapa de 10 serviços que, ao
  serem inseridos, criam um `panel` em vez de um card — e é a única razão pela qual os
  dois pickers têm um fork `if (family.id === "aws")`.

### Minha avaliação técnica

**Isto não é "o AWS é especial". É uma propriedade geral de catálogos de nuvem que só o
AWS teve.** VPC, subnet, AZ, cluster EKS/ECS são escopos de contenção; Namespace e Cluster
do K8s são exatamente a mesma ideia; GCP tem projeto/VPC/zona; Azure tem resource
group/VNet. A terceira família que precisar disso vai criar o terceiro fork.

Há uma evidência forte de que o repo já concluiu isso em outro lugar: **o IR modela
fronteiras como conceito de primeira classe** — `IR_BOUNDARY_SEMANTIC_TYPES`,
`isBoundary`, `isBoundaryNode()`. O IR decidiu que boundary é um tipo de nó. O registry
de elementos não acompanhou.

Então, na minha opinião, **sim: o contrato deveria expressar isso**. Duas formas, e elas
não são equivalentes:

**(A) Remap no nível da paleta, generalizado.** Deixar `CloudFamilyService` declarar algo
como `creates: { type, options }`, para qualquer família dizer "esta entrada cria um
`panel` com `panelKind: X`". É estritamente uma generalização do que o AWS já faz.
Apaga os dois forks do picker e o `AWS_SERVICE_TO_PANEL_KIND`. **Não** exige migração de
dado, porque nada muda no que é gravado. Um Namespace de K8s seria um panel genérico —
do mesmo jeito que uma VPC da AWS é hoje.

**(B) Categorias-container de verdade na família.** Deixar a família declarar categorias
com `role: "container"`, `canBeParent: true`, virando tipos próprios (`k8s-namespace`),
com ícone e export próprios. É a modelagem correta a longo prazo, mas **muda o que uma
VPC da AWS é hoje** — logo, migração de persistência, e o `computeDiagramFamilyMix` passa
a contar diferente (hoje uma VPC conta como `structural`, porque virou panel).

**Recomendo (A) primeiro**, por ser redução de débito mensurável sem migração, e deixar
(B) para quando houver requisito real (alguém querendo de fato um Namespace tipado), com
spec própria. Mas **(A) e (B) não são etapas da mesma escada**: se (B) for o destino, (A)
cria um campo `creates` que (B) depois aposenta. Se você acha que (B) vai acontecer,
pular direto para (B) é mais barato do que fazer as duas.

**Não implementei nada disso.** O comentário em `k8s.catalog.ts` agora aponta para esta
seção em vez do relatório F7 deletado.

---

## Item 7 — `AGENTS.md` desatualizado ✅

Ver commit do item 7 para o diff completo. Além dos dois pontos que a auditoria achou,
reli o arquivo inteiro como pedido; o que estava desatualizado pela sequência de fatias
está listado no commit.

---

## Achados colaterais registrados, não corrigidos

Coisas que encontrei trabalhando nos 7 itens e que **não** estavam no escopo:

1. **`ComponentPanel.tsx` usa `as unknown as ComponentPatch`** em dois lugares (nos patches
   de `cloudServiceId`), violando `AGENTS.md` ("No `any` / no `as unknown as`"). Pré-existente.
2. **`k8s.family.ts` e `oss.family.ts` precisam de `as Component`** em `attachService`
   porque não existem `K8sComponent`/`OssComponent` na união — as duas famílias adicionadas
   *depois* do contrato ser "fechado" são as duas que precisam de cast. Consequência:
   `cloudServiceId` nessas famílias só é alcançável por cast, e o campo *tipado* disponível
   é `serviceId` (o do catálogo de negócio). Sem proteção de compilação entre os dois.
3. **`resolveCloudServiceId` cai em `serviceId`** como último recurso, contrariando o que
   ADR-0010 diz enfaticamente. Efeito observável em `llm/serializer.ts`: um `system` C4
   vinculado a um serviço de negócio é serializado ao modelo como `awsService="svc-pay"`.
4. **`features/cloud/providers/{aws,gcp,azure}.provider.ts` são código morto** (zero
   importadores) e `features/cloud/bootstrap.ts` é `export {}`.
5. **`FALLBACK_BY_FAMILY` em `CloudIcon.tsx`** é uma enumeração aws/gcp/azure residual,
   inalcançável para família registrada (`IconResolver.Fallback` já cobre).
6. **Dois componentes `CloudIcon`** com vocabulário diferente (`familyId` vs `providerId`).
7. **O seed `urlshort-example.ts` grava nomes de exibição em `cloudServiceId`**
   (`"AWS Lambda"` em vez de `"lambda"`). Pré-existente em `main`, migrado adiante.

(1)–(3) são os que eu trataria a seguir, e (2)+(3) juntos são a resposta ao "há proteção
em tempo de compilação entre `serviceId` e `cloudServiceId`?" — hoje não há.

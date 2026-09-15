# Auditoria independente — sistema de elementos do canvas

**Data:** 2026-09-15
**Alvo:** `feat/element-registry` (70 commits à frente de `main`, 0 atrás — confirmado,
é de fato a consolidação da sequência)
**Método:** leitura do código atual + docs de arquitetura. Os ~21 markdowns de processo
removidos em `fdaa15b` não foram consultados como fonte de verdade.
**Estado dos gates medido nesta sessão:** `npm run typecheck` verde; `npm test` verde
(244 arquivos, 2506 testes, exit 0, 56.8s).

---

## 0. Onde este documento deveria morar

Recomendo **`docs/audits/`** (onde está), não `docs/architecture/`.

`element-registry.md` e `extension-points.md` descrevem o sistema como ele deve ser lido
— são documentos vivos. Uma auditoria datada envelhece e, colada ao lado deles, um leitor
futuro não sabe qual dos dois está certo. `docs/audits/` deixa explícito que isto é um
retrato de um momento. O repo já tem esse hábito (`docs/investigation/`,
`docs/decisions/`, `docs/epico-*/`).

---

## 1. A pergunta central: `canvas/nodes` vs `elements` vs `element-presets`

### O que cada um realmente faz

**`src/features/canvas/nodes/*` — a camada de pintura React Flow.**
Componentes React (`CardNode/`, `PanelNode.tsx`, `DbTableNode/`, `UnknownNode.tsx`, …)
mais o *adaptador* para React Flow em `node-types/registry.ts`. Não decide o que existe;
recebe um `Component` e desenha. `NODE_TYPE_REGISTRY` vive aqui e hoje é literalmente
`[]` (`registry.ts:22`), preenchido só por plugins via `registerDescriptor`.

**`src/features/elements/*` — o domínio: o que existe e como se comporta.**
`ElementDescriptor` (`element.types.ts:344-359`), o mapa `elementRegistry`
(`element.registry.ts:50`), os descritores estruturais (`structural/*`), e o mecanismo de
famílias (`families/`). É um módulo folha deliberado — não importa componente de canvas
nem store (`element.registry.ts:18-21`) — o que permite `features/diagram` lê-lo sem
ciclo. Conteúdo real medido: **61 elementos registrados**, distribuídos em
`c4=4, structural=10, aws=16, gcp=12, azure=13, k8s=4, oss=2`.

**`src/features/element-presets/*` — dados do usuário, não vocabulário.**
Um preset é `{ baseType: ComponentType, data: Record<string, unknown> }`
(`types.ts:9-23`) persistido no Zustand/`IStoragePort`. É um *snapshot de instância*
salvo pelo usuário ("meu Lambda de pagamentos, já com nome e cor"), não um tipo novo.
Categoricamente diferente de um `ElementDescriptor`, que é contribuição de código.

### A fronteira `canvas/nodes` ↔ `elements` é a certa

É a separação domínio/render que o ADR-0003 já pedia, e desta vez foi implementada de
verdade. A prova é que `elements` não importa React Flow em lugar nenhum e a inversão de
dependência é explícita (`subscribeElements`, `element.registry.ts:60-65`, consumida por
`registry.ts:135`). O adaptador `adaptElement` (`registry.ts:35-65`) traduz
`ElementCanvasSlice` → `NodeTypeDescriptor` sem que o domínio saiba que React Flow
existe.

**Ressalva real:** `NodeTypeDescriptor` continua sendo a *interface efetiva* do canvas —
todos os leitores (`getDescriptor`, `handleSpecForType`, `buildNodeTypes`) falam nele, e
os elementos são adaptados para entrar. Ou seja, existem dois contratos descrevendo a
mesma coisa com um adaptador no meio. Está documentado e é honesto, mas é a costura que
deveria ser fechada na próxima rodada, não mais uma família.

### A fronteira `elements` ↔ `element-presets` **não é uma decisão de design — é um ponto não visitado**

Este é o achado mais importante da seção. O conceito ("preset = tipo existente + dados")
está correto e merece viver separado. **A implementação, porém, não foi migrada** e a
separação atual é acidental.

Evidência direta — `element-presets` tem **zero** import de `features/elements`:

```
5 "@/features/diagram"
1 "@/features/cloud/providers/aws/aws.catalog"     ← catálogo legado, direto
1 "@/lib/catalogs/panels"                           ← catálogo legado, direto
1 "@/features/canvas/nodes/CloudIcon"
1 "@/features/diagram/model/cloud-service-id"
```

Consequências concretas:

1. **`ALLOWED_COMPONENT_PATCH_KEYS`** (`element-presets/utils/element-preset.utils.ts:14-49`)
   é uma allowlist de campos mantida à mão — exatamente o anti-padrão
   `BUILTIN_COMPONENT_TYPES` que o ADR-0010 afirma ter eliminado, só que para *campos* em
   vez de *tipos*. Ela é herdada de `main`
   (`custom-components/utils/custom-component-template.utils.ts`, idêntica exceto
   `awsService`→`cloudServiceId`); a branch trocou uma entrada e não tocou no resto.
2. O campo do contrato que existe **precisamente** para ser o dono desta lista —
   `ElementModelSlice.patchableKeys` (`element.types.ts:213`) — nunca foi ligado (ver §2.2).
3. As duas listas **divergem**, e a divergência é visível ao usuário. Campos declarados em
   `patchableKeys` mas ausentes da allowlist, ou seja, **silenciosamente descartados ao
   salvar um preset**:

   | Campo | Declarado em | Impacto |
   | --- | --- | --- |
   | `svgContent` | `svg.element.ts:40` | um preset de nó SVG **perde o SVG** (campo obrigatório, `component.types.ts:175`) |
   | `flowShape` | `process-node.element.ts:33` | preset de process-node perde a forma (obrigatório, `component.types.ts:220`) |
   | `nodeColor` | `process-node.element.ts:33` | perde a cor |
   | `customColor` | `external-element.element.ts:35` + as 5 famílias cloud | preset cloud perde a cor custom |
   | `rawContent` | `unknown.element.ts:33` | — |
   | `panelColorDark` | `note.element.ts:31` | nota perde a cor dark-mode |
   | `linkedElementId` / `linkedElementName` / `linkedDiagramName` | `external-element.element.ts:35` | perde os vínculos |

   *(Débito herdado de `main`, não regressão desta branch — mas a branch criou o campo
   que o resolveria e não o usou.)*
4. Detalhe menor da mesma origem: `"serviceId"` aparece **duas vezes** no mesmo `Set`
   (linhas 20 e 48).

Ainda na mesma pasta, resíduo de rename mecânico: `types.ts:6` diz
*"Renamed from `ElementPreset`"* — circular. O rename real (`766f209`) foi
`CustomComponentTemplate` → `ElementPreset`; o `sed` passou por cima do próprio comentário.

### Veredito

> **A divisão em três é conceitualmente correta. A fronteira `canvas/nodes` ↔ `elements`
> está bem implementada e bem documentada. A fronteira `elements` ↔ `element-presets` está
> conceitualmente correta mas *não implementada*: `element-presets` nunca foi migrado, fala
> com os catálogos legados por baixo do registry, e carrega uma allowlist paralela que
> diverge do contrato e causa perda de dados real ao salvar presets de `svg` e
> `process-node`.**

Não é um caso de "devia ser outra fronteira". É um caso de "a fronteira certa existe no
diagrama e não existe no código".

---

## 2. Coerência arquitetural

### 2.1 O contrato `ElementDescriptor` é coeso, com exceções nomeadas

A estrutura em fatias (`model` / `canvas` / `palette` / `inspector` / `export`) é boa: cada
fatia tem um consumidor identificável, e a validação em registro é alta e barulhenta
(`element.registry.ts:80-110` — falta de `export.drawio`, de `handles`, ou de chave i18n em
**qualquer** locale derruba o boot). Essa escolha está certa: um elemento mal formado é
erro de programação, não degradação de runtime.

Campos que **fazem mais de uma coisa ou têm nome enganoso**:

- **`ElementCreateOptions.serviceId`** (`element.types.ts:151`) — é a entrada de criação
  que vira `cloudServiceId` na persistência, mas tem o mesmo nome do
  `BaseComponent.serviceId` (catálogo de negócio), que é outra coisa. Os dois convivem no
  mesmo arquivo de tipos sem nada que os distinga além de comentário. Ver §2.4.
- **`ElementCanvasSlice.derivesSize`** (`element.types.ts:253`) — 20 linhas de docblock
  descrevendo semântica de pintura, mas **nenhum leitor de produção**. Os dois únicos
  leitores são testes (`single-owner.invariant.test.ts:111`,
  `build-cloud-family-descriptors.test.ts:132`). Na prática é um *flag de opt-out de um
  teste*, não um campo de comportamento. Não é inútil (ele particiona uma invariante
  real), mas o docblock promete algo que o código não faz.
- **`ElementCanvasSlice.canBeConnectionSource`** (`element.types.ts:232`) — o único
  consumidor é `single-owner.invariant.test.ts:150`, que prova que ele é **sempre igual a
  `handles.outgoing > 0`**. É dado duplicado que o próprio teste demonstra ser derivável.
  O leitor de domínio de verdade continua sendo `connection-rules.ts` (o comentário admite).
- **`CloudFamilyId = string`** (`cloud-family.types.ts:24`) — sem *branding*. Qualquer
  string passa. Combinado com `paletteCategoryId: string` e `categoryId: string`, há três
  strings intercambiáveis pelo compilador que significam coisas diferentes.

### 2.2 Campos mortos: o padrão **se repetiu**, apesar do que os relatórios disseram

Verifiquei diretamente por leitor, não por relatório. **Cinco campos declarados no
contrato sem nenhum leitor de produção:**

| Campo | Declaração | Leitores |
| --- | --- | --- |
| `ElementModelSlice.patchableKeys` | `element.types.ts:213` | **nenhum.** 17 sites de *escrita*; o único "leitor" é `c4.family.test.ts:16-17`, que afirma a *ausência* de duas strings num campo que ninguém consome — passa trivialmente e não trava nada |
| `ElementModelSlice.defaultNameKey` | `element.types.ts:207` | **nenhum.** Só repassado em `build-cloud-family-descriptors.ts:83`. O caminho de criação (`components.slice.ts:201-241`) nunca o consulta |
| `ElementExportSlice.drawio.minSize` | `element.types.ts:324` | **nenhum.** Zero escritas e zero leituras no repo inteiro |
| `ElementInspectorSlice.sections` | `element.types.ts:308` | **nenhum** (a única ocorrência de `.sections` é `edge.sections` do ELK em `layoutReadability.ts:154`, não relacionado) |
| `CloudFamilyService.descriptionKey` | `cloud-family.types.ts:41` | **nenhum.** Nenhuma família o preenche e `searchElements` usa a descrição da *categoria* para todo serviço (`element-catalog-query.ts:174`) |

O caso de `descriptionKey` tem custo mensurável: **257 serviços registrados**
(`aws=144, azure=57, gcp=40, k8s=14, oss=2`) são todos descritos ao LLM pela descrição da
sua categoria. Lambda e EC2 recebem, os dois, *"AWS compute services (EC2, Lambda, …)"*.
O campo que resolveria isso existe e está morto.

`patchableKeys` é o mais grave dos cinco, porque não é só inerte: existe um consumidor
real (§1) que faz o trabalho à mão e erra.

### 2.3 `elementRegistry` vs `NODE_TYPE_REGISTRY`: limpo. `cloud/providers`: não.

A separação em si está boa. `NODE_TYPE_REGISTRY` é `[]`, travado por
`single-owner.invariant.test.ts:134-136` (`expect(...).toEqual([])`), e `getDescriptor`
tem ordem clara: registry → plugin → `unknown` (`registry.ts:77-90`). Sem catch-all.

O resíduo não eliminado está em outro lugar — **`src/features/cloud/providers/`**:

- `aws.provider.ts:20`, `gcp.provider.ts:20`, `azure.provider.ts:25` exportam
  `CloudProviderAdapter`s hardcoded. **Nenhum arquivo do repo os importa.** São 3 arquivos
  de código morto que descrevem exatamente a lista paralela de providers que
  `cloudFamilyToProviderAdapter` (`cloud-family.registry.ts:86-119`) substituiu.
- `src/features/cloud/bootstrap.ts` é hoje literalmente `export {}` com 12 linhas de
  comentário explicando por que está vazio. É um módulo mantido por nostalgia de ordem de
  boot.
- `CloudIcon.tsx:35-51` tem um `FALLBACK_BY_FAMILY` com entradas só para aws/gcp/azure —
  uma enumeração de família residual. Só dispara quando a família não tem resolver, o que
  não acontece para família registrada; e `IconResolver.Fallback` já cobre o caso.
- Dois componentes `CloudIcon` coexistem: `cloud/components/CloudIcon.tsx` (prop
  `familyId`) e `canvas/nodes/CloudIcon.tsx` (prop `providerId`, alias de 23 linhas). O
  vocabulário "family" do ADR e o vocabulário "provider" do canvas convivem sem ninguém
  ter decidido qual vence.

Os catálogos (`aws.catalog.ts`, `gcp.catalog.ts`, `azure.catalog.ts`) **continuam sendo
fonte legítima** — as famílias os consomem (`aws.family.ts:69-86`). Só os `*.provider.ts`
são mortos.

### 2.4 O esquema de nuvem: **não** há proteção de compilação, e a leitura tolerante conflita com o ADR

Duas coisas erradas aqui, e a segunda é a mais séria.

**(a) `resolveCloudServiceId` lê o campo que o ADR proíbe overloadar.**
O ADR-0010 (decisão 5) e `element-registry.md` dizem, enfaticamente: *"This is **not** the
business-catalog `BaseComponent.serviceId`"* / *"**do not** overload it for cloud"*. Mas a
função designada como *o* leitor faz exatamente isso como último recurso:

```ts
// cloud-service-id.ts:28-36
nonEmpty(component.cloudServiceId) ?? … ?? nonEmpty(component.serviceId)
```

Isso tem consequência observável em `llm/serializer.ts:54-58`: **qualquer** componente —
inclusive um `system` C4 vinculado a um serviço de negócio via `linkComponentToService` —
é serializado para o modelo como `awsService="svc-pay"`. O id do catálogo de negócio vaza
para o vocabulário de nuvem do LLM, sob uma chave literalmente chamada `awsService`. No
canvas o estrago é contido por acidente, não por design: `CardNode/index.tsx:121` filtra
por `cloudRegistry.forType(d.type)` antes de usar `d.cloudService`.

**(b) Não existe proteção de tipo — e ela é estruturalmente impossível para famílias novas.**

- `BaseComponent.serviceId?: string` está em **todo** componente (`component.types.ts:59`).
- `cloudServiceId?: string` está declarado em **exatamente três** variantes:
  `AwsComponent` (`:117`), `GcpComponent` (`:125`), `AzureComponent` (`:133`).
- **Não existe `K8sComponent` nem `OssComponent`.**

Por isso as duas famílias adicionadas *depois* do fechamento do contrato são as duas
únicas que precisam de cast:

```ts
// k8s.family.ts:105-109  e  oss.family.ts:105-109
return { ...base, type: …, cloudServiceId: serviceId } as Component;
```

O objeto não satisfaz nenhum membro da união `Component`. Para k8s/oss, o campo *tipado*
disponível é `serviceId` (herdado de `BaseComponent`) e `cloudServiceId` só é alcançável
por cast. Um desenvolvedor que escreva `comp.serviceId = "redis"` num nó k8s **compila**, e
`resolveCloudServiceId` até "funciona" pelo fallback — conflatando os dois campos em
silêncio. Ou seja: a resposta à pergunta "há proteção em tempo de compilação ou só
convenção?" é **só convenção, e a convenção é contrariada pelo próprio resolver**.

Vale notar a contradição interna: `element.types.ts:127-129` justifica o desenho de
`ElementInspectorProps` dizendo *"That keeps the contract free of casts, which the repo
forbids"*, e `AGENTS.md:85` proíbe `as unknown as`. O contrato não está livre de casts
justamente nas famílias para as quais ele foi aberto.

### 2.5 O mecanismo de família generaliza para *mais do mesmo*, não para *outra forma*

`registerCloudFamily` / `allCloudFamilies()` funcionam bem para as 5 famílias atuais, e a
derivação (`cloudFamilyToProviderAdapter`) elimina de verdade as listas curadas por
provider. Para uma sexta família com a **mesma forma** (categoria→serviço, tudo card),
funciona.

Para outra forma, **não** — e o contrato assume mesmo `categoria→serviço` de dois níveis:

- `CloudFamilyService.categoryId` aponta para uma categoria (`cloud-family.types.ts:39`), e
  `buildCloudFamilyDescriptors` valida que todo serviço aponta para uma categoria existente
  (`:52-60`) e agrupa por `filter(s => s.categoryId === category.id)` (`:15`). Não há
  terceiro nível possível: um catálogo hierárquico de 3 níveis teria que achatar ou
  inventar categorias sintéticas.
- **Todo membro de família é obrigatoriamente um card.** `role: "card"` é literal em
  `build-cloud-family-descriptors.ts:93`, junto com `canBeParent: false` (`:97`) e
  `derivesSize: true` (`:101`). Não há como uma família declarar que um de seus membros é
  container.

Isto **não é hipotético — Kubernetes já bateu nisso e a resposta foi cortar o catálogo**:

```ts
// k8s.catalog.ts:5-9
// Namespace and Cluster are intentionally omitted as categories: they are
// grouping containers (closer to `panel` / PANEL_KINDS) than card services
// — deferred, not forgotten (see F7 report).
```

E o "F7 report" citado é um dos markdowns deletados. A limitação de contrato mais
importante do sistema está registrada apenas num comentário de código que aponta para um
arquivo que não existe mais.

O mesmo buraco tem uma segunda manifestação, no AWS: `AWS_SERVICE_TO_PANEL_KIND`
(`lib/catalogs/panels.ts:96-107`) é um mapa hardcoded de 10 serviços AWS que, ao serem
inseridos, criam um `panel` em vez de um card (VPC, EKS, subnets, AZ). Ele vive **fora**
do sistema de elementos, e é a razão pela qual os dois pickers têm um fork por nome de
família (§3.1). É exatamente a expressividade que o K8s pediu e não teve.

O teste da família fictícia (`cloud-family-contract.test.ts`) é bom mas **prova menos do
que o nome sugere**: a família de teste usa `card: { component: CardNode }` (`:65-70`) e
duas camadas. Ele fecha o contrato *para famílias com a forma das que já existem*.

---

## 3. Débito técnico remanescente

### 3.1 Enumerações de família ainda hardcoded — **três sobreviveram**

Busca ativa, não confiança em relatório. As que restam:

**(a) O catálogo do LLM só conhece `structural` e `c4` por nome literal.**

```ts
// element-catalog-query.ts:70-83   (listElementFamilies)
{ id: "structural", label: "Structural & Canvas", … },
{ id: "c4",         label: "C4 Model",            … },
// …depois itera allCloudFamilies()

// element-catalog-query.ts:148-149 (searchElements)
pushStructuralLike("structural");
pushStructuralLike("c4");
```

Uma família **não-cloud** nova (BPMN, UML, ER — registrada via `registerElement` com
`family: "bpmn"`) fica **invisível** para `list_element_families` e **não-pesquisável**
por `search_elements`. Note também que esses dois rótulos são strings em inglês
hardcoded, violando `AGENTS.md:82` ("No hardcoded user-visible strings").

**(b) As abas do picker só se abrem para famílias cloud.**
`buildCategoryNavItems` (`buildCategoryNav.ts:27-32`) itera `allCloudFamilies()`; as
demais abas (All, C4, Canvas, Registry, NodeTemplate, Flowchart) são um `enum` fixo
(`canvas/enums.ts:7-14`). A mesma família BPMN não ganha aba.

**(c) A recuperação por prefixo enumera três providers.**

```ts
// sanitize-component-type.ts:24-34
value.startsWith("aws-") … : value.startsWith("gcp-") … : value.startsWith("azure-") …
```

Não itera `allCloudFamilies()`. Uma família nova com categoria `*-general` não ganha
recuperação sem editar este arquivo — contrariando a promessa de "nenhuma edição por
família". É generalizável em poucas linhas.

**(d) O fork AWS nos dois pickers** (não é enumeração de *todas* as famílias, mas é o
mesmo padrão): `ElementPickerModal.tsx:200` e `:359`; `QuickInsertPopover.tsx:256` e
`:431`. Ambos existem só por causa de `AWS_SERVICE_TO_PANEL_KIND`.

> **Conclusão:** o fechamento de contrato eliminou as enumerações no caminho
> **cloud→palette→export**. Não eliminou no caminho **LLM→famílias não-cloud**, nem na
> sanitização, nem no fork de panel-kind. O teste da família fictícia não as pegou porque
> registrou uma família *cloud*.

### 3.2 Campo morto: sim, de novo — ver §2.2 (cinco campos)

### 3.3 Nível de detalhe entre famílias: **harmonizado, e isso foi bom**

Verifiquei as descrições em `en.json`. As cinco famílias seguem hoje a mesma forma de uma
linha com exemplos:

```
aws-compute    → "AWS compute services (EC2, Lambda, …)."
gcp-compute    → "GCP compute services (VMs, containers, serverless)."
azure-compute  → "Azure compute services (VMs, App Service, Functions)."
k8s-workloads  → "Kubernetes workloads (Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod)."
oss-datastore  → "Open-source datastores (Redis, …)."
```

A compactação do AWS na F5b não perdeu informação que valesse a pena **no nível de
categoria** — ganhou consistência, e um prompt de LLM mais curto para 16 categorias.

A perda de informação real está **um nível abaixo** e é independente da F5b: os 257
serviços não têm descrição própria porque `CloudFamilyService.descriptionKey` está morto
(§2.2). Esse é o detalhe que valeria recuperar, não o texto longo do AWS.

### 3.4 `IconResolver`: sustenta os três padrões sem gambiarra

Este é o ponto mais limpo da auditoria. O contrato é minúsculo —
`{ resolve(name) => LazyComponent | null; Fallback }` (`cloud/model/cloud.types.ts:22-25`)
— e as três origens implementam-no sem que ninguém mais saiba a diferença:

- pacote npm: `aws.icon-resolver.ts`, `azure.icon-resolver.ts`
- `import.meta.glob` de SVG: `gcp.icon-resolver.ts`
- SVG vendorizado com licença: `k8s.icon-resolver.ts`, `oss.icon-resolver.ts`
  (+ `ICONS_LICENSE.md` ao lado dos assets, como o ADR manda)

`rememberFamilyIconResolver` / `iconResolverForFamily`
(`family-icon-resolvers.ts:15-22`) dão o lookup por família sem switch, e
`CloudIcon.tsx:60-62` resolve com um `??` em vez de um `if` por família.

**Não encontrei `if` de caso especial por família na resolução de ícones.** O único
resíduo é o `FALLBACK_BY_FAMILY` (§2.3), que é morto na prática.

Exportação segue o mesmo padrão bem: `kind: "aws"` (mxgraph nativo, `aws.family.ts:104`),
`kind: "image"` (data-URI, `k8s.family.ts:71-79`) e `kind: "passthrough"` (`:81-92`) —
o "piso" F2 documentado em `cloud-family.types.ts:76-84` é real e uma família nova não
precisa tocar `export-core`.

---

## 4. Risco de produção

### 4.1 O gate de deploy da F6b **não existe no código**. É o risco mais sério desta branch.

Procurei feature flag, variável de ambiente, chave de build, qualquer guarda técnica.
**Não há nenhuma.** As escritas de `cloudServiceId` são incondicionais, em 13+ sites:

```
elements/families/{aws,gcp,azure,k8s,oss}.family.ts   (attachService)
canvas/panels/ElementPanel/ComponentPanel.tsx:341,387
llm/ir/ir-to-component.ts:91 · llm/ir/apply-ir.ts:70
lib/export-service/import-drawio.ts:523,597
diagram/store/slices/patterns.slice.ts:95
```

A única coisa entre esta branch e uma divergência de checksum em salas de colaboração
mistas é **um parágrafo no ADR-0010 e um comentário em
`collaboration/__tests__/f6a-cloud-service-checksum.parity.test.ts:6-9`** — um teste que,
aliás, *afirma* a divergência como comportamento esperado (`:55
expect(...).not.toBe(...)`), sem impedir nada.

O que agrava: a branch se apresenta como pronta. 70 commits, working tree limpo, typecheck
e 2506 testes verdes, ADR "Accepted", docs de arquitetura escritas. A ação natural de
qualquer pessoa lendo esses documentos é **fazer merge** — e o merge embarca as escritas.
A regra está escrita exatamente onde alguém que não a conhece não vai procurar.

Isto vale um guard técnico. Não por desconfiança do autor, mas porque uma regra de
sequenciamento de deploy que só existe em prosa é indistinguível de nenhuma regra seis
meses depois.

### 4.2 O teste de mesmo turno da F8b: **testa o caso exato, e o gate tem um falso positivo real**

O mecanismo (`add-node-validation.ts`, `apply-diagram-patch.ts:239-267`, `store.ts:665-674`):
o gate só arma quando o patch contém pelo menos um `SEARCH_ELEMENTS`
(`runCatalogReadActions:245,265` — `sawSearch`). Uma vez armado, **todo** `ADD_NODE` cloud
daquele patch precisa ser um hit exato `(elementType, serviceId)` daquelas buscas
(`validateAddNodeAgainstConfirmedHits:107-116`).

Isso produz um incentivo invertido: **buscar deixa o modelo mais restrito**. Um patch sem
busca nenhuma enfrenta só a validação de registry; um patch que busca fica preso ao que
buscou.

O próprio teste enshrina o falso positivo. `add-node-validation.test.ts:114-136`, intitulado
*"does not apply hallucinated add_node when search_elements is in the same patch"*, busca
`"redis"` e depois adiciona `(aws-compute, "lambda")` — e afirma que deve ser rejeitado.
Mas `lambda` **está registrado** sob `aws-compute` (`aws.catalog.ts:24`, via
`aws.family.ts:80-86`). Não é alucinação: é um nó perfeitamente válido, descartado com um
`console.warn` (`apply-diagram-patch.ts:98`) porque o modelo, na mesma resposta, buscou
outra coisa. O cenário realista — "procure Redis e monte a arquitetura com Lambda e Redis"
— perde o Lambda silenciosamente.

Dois pontos secundários de robustez:

- Ambos os gates comparam id por igualdade exata e sensível a maiúsculas
  (`add-node-validation.ts:74` e a chave `catalogHitKey:10`). `"Redis"` ≠ `"redis"`.
- `validateAddNodeAgainstRegistry:67-72` agora **exige** `serviceId` para qualquer categoria
  cloud que tenha serviços. `ADD_NODE { nodeType: "aws-compute" }` sem serviço passou a ser
  rejeitado — um estreitamento de comportamento que o `attachService` das famílias trata
  explicitamente (`serviceId: string | undefined`) e que a paleta ainda permite.

Os 4 testes do bloco cobrem: hit válido, tipo desconhecido, serviceId errado, categoria sem
serviceId. Nenhum cobre *válido-mas-não-buscado-nesta-rodada*, que é o caso que quebra.

### 4.3 IR (F5c): a migração **não preservou comportamento — ela foi revertida**, e o teste que a "trava" é tautológico

Este merece ser dito sem rodeio, porque é o item que os relatórios de fatia não capturaram.

- `5f4fbe1` — *"derive AWS category semanticTypes from the element registry"*: trocou o
  catálogo estático por `allElements()`.
- O código quebrou **em produção** (chunk Vite separado do LLM; o snapshot do registry
  local ao chunk nascia vazio e rejeitava todo IR `aws-compute`). **Nenhum teste unitário
  pegou** — em vitest o bootstrap roda no mesmo grafo de módulos. Quem pegou foi o Cypress.
- `42ec226` — o "fix" **desfez a F5c**: `ir.types.ts` voltou a ler
  `AWS_CATEGORIES` (`ir.types.ts:21-25, 67`), exatamente a fonte estática de antes.

Resposta direta à pergunta do escopo: para a F5c, **a migração não preservou
comportamento; ela o quebrou, os testes existentes não viram, e a correção foi reverter a
premissa da fatia**. O ADR-0010 registra isso como um bullet de consequência
("(−) IR AWS category allowlist must not snapshot `allElements()`…"), não como "F5c foi
revertida". Alguém lendo só o ADR conclui que a F5c está de pé.

Pior, o código ficou com os nomes da versão revertida:

- `irAwsCategoryIdsFromRegistry()` (`ir.types.ts:67`) — **não lê o registry**, lê o catálogo.
- O comentário `ir.types.ts:64` afirma: *"`ir.types.test.ts` locks this list to the
  registered AWS family so the two cannot drift."* **Isso é falso.** O teste
  (`ir.types.test.ts:29-34`) compara `getIrSemanticTypes()` filtrado contra
  `irAwsCategoryIdsFromRegistry()` — **as duas metades derivam do mesmo array
  `AWS_CATEGORIES`**. É `x === x`. Nenhum drift catálogo↔registry é detectável.
- O teste que se apresenta como guarda da falha de produção
  (`ir.types.test.ts:80-87`, *"getIrSemanticTypes is live (not a load-time snapshot)"*) é
  **tautológico**: afirma que o resultado contém `aws-compute`, o que é verdade por
  construção a partir do array estático. Se alguém reverter para `allElements()`, em
  vitest o bootstrap já rodou e o teste **continua passando** — exatamente o modo de falha
  que ele alega guardar.

O risco hoje é baixo (`awsFamily.categories` é derivado de `AWS_CATEGORIES` em
`aws.family.ts:69`, então drift é estruturalmente impossível). O risco **futuro** é alto:
o nome da função e o comentário convidam a próxima pessoa a "consertar" de volta para o
registry, e nada no CI a impedirá.

---

## 5. Prontidão para evoluir

### 5.1 Adicionar uma família cloud nova amanhã: **quase**, mas a documentação tem buracos concretos

`element-registry.md` §"Adding a family or type" e `adding-a-node-type.md` cobrem o
esqueleto certo (descriptor → `registerCloudFamily` → bootstrap → i18n → licença de
ícones). O que **falta**, derivado dos 4 commits que o K8s realmente levou:

1. **Tokens de accent CSS.** `accentFor` gera `--${categoryId}` (`k8s.family.ts:23-25`), e
   esses vars precisam existir **à mão em `src/index.css`, em dois blocos** (claro
   `:122-128`, escuro `:266-…`), um por categoria. A doc diz "accent tokens as needed" sem
   dizer onde nem que são dois lugares. **Assimetria perigosa:** a chave i18n faltante
   *derruba o boot* (`element.registry.ts:102-105`); o accent token faltante falha em
   silêncio.
2. **Formato exato das chaves i18n.** `elements.<family>.categories.<id>.label` /
   `.description` — obrigatório em `en` **e** `pt-BR`, senão o app não sobe. Não está
   escrito em lugar nenhum.
3. **O padrão do cast de boundary.** `asK8sCategoryType` (`k8s.catalog.ts:27-30`) é o
   idioma que permite ids fora do `ComponentType` fechado. Sem ele a família não compila, e
   nenhuma doc o menciona.
4. **`getCategoryStyle` gera `border-l-${categoryId}`** (`cloud-family.registry.ts:117`) —
   classe Tailwind que precisa existir/ser safelisted.
5. **A limitação de "só cards"** (§2.5) — a coisa que mais provavelmente vai travar quem
   chegar — não está em nenhuma doc de arquitetura, só num comentário apontando para um
   relatório deletado.

Resposta honesta: **não precisaria de um prompt de investigação do tamanho dos desta
sequência, mas precisaria de uma rodada de tentativa-e-erro** para descobrir (1)–(4), e
bateria em (5) sem aviso.

### 5.2 Um shape estrutural novo: **o caminho está claro** — e a doc de entrada aponta para o lugar errado

O caminho em si é bom: copiar `note.element.ts` (31 linhas, legível), registrar em
`bootstrap.ts:24-36`, pronto. `structural/*` tem 10 exemplos de qualidade.

**Mas `AGENTS.md` — declarado por `CLAUDE.md` como "the single source of truth for AI
coding agents" — está desatualizado em três pontos que importam exatamente aqui:**

- `AGENTS.md:87-89`: *"Register new node types via a `NodeTypeDescriptor` in
  `features/canvas/nodes/node-types/`."* — **é o oposto** do que o ADR-0010 decidiu. É a
  primeira instrução que qualquer agente ou dev novo vai ler, e ela manda fazer a coisa
  proibida.
- O mapa de pastas (`AGENTS.md:44-66`) **não menciona `features/elements/`** — o diretório
  mais importante criado por esta branch, 61 elementos e 5 famílias, simplesmente não
  existe no mapa.
- O mapa ainda lista `custom-components/`, que foi renomeado para `element-presets/` em
  `766f209` **nesta mesma branch**.

Os 70 commits atualizaram `docs/` com cuidado e deixaram o documento de entrada descrevendo
o mundo pré-migração. Para a pergunta "está pronto para alguém sem contexto?", este é o
achado decisivo — mais do que qualquer buraco em `element-registry.md`.

### 5.3 O que já dá para prever que vai quebrar

Em ordem de probabilidade:

1. **Uma família com membros-container** (o caso K8s Namespace/Cluster, adiado; ou
   OpenStack, ou VMware, ou zonas GCP). Quebra igual à primeira tentativa da F7: o contrato
   obriga `role: "card"` e `canBeParent: false`. Hoje a única saída é o fork AWS
   (`AWS_SERVICE_TO_PANEL_KIND` + branch no picker) — ou seja, a terceira família a precisar
   disso vai criar o terceiro fork.
2. **Uma família não-cloud** (BPMN, UML, ER, C4 estendido). Registra bem, renderiza bem, e
   fica invisível para o LLM e para as abas da paleta (§3.1a/b). Vai parecer um bug
   fantasma: "o elemento existe, o modelo não o enxerga".
3. **Um catálogo de 3 níveis** (provider → categoria → subcategoria → serviço). Terá que
   achatar (§2.5).
4. **A sexta e sétima família cloud sem variante tipada em `Component`.** Cada uma
   acrescenta um `as Component` e mais superfície onde `serviceId`/`cloudServiceId` se
   confundem sem o compilador reclamar (§2.4b).
5. **Alguém "consertando" `irAwsCategoryIdsFromRegistry` para realmente ler o registry**
   (§4.3) — o nome convida, e nenhum teste impede.

---

## 6. Veredito, sem meio-termo

### Isto está sólido — siga em frente

- **A separação domínio/render (`elements` ↔ `canvas/nodes`).** Módulo folha de verdade,
  inversão de dependência por subscription, adaptador explícito. Bem feito.
- **`NODE_TYPE_REGISTRY` como plugins-only.** É `[]`, travado por teste, sem catch-all. A
  remoção do catch-all C4 é uma melhoria real e bem documentada.
- **Validação em registro.** Falhar o boot por chave i18n faltante ou `export.drawio`
  ausente é a escolha certa e está implementada nos dois locales.
- **O contrato `IconResolver` sobre três origens de ícone.** Zero gambiarra por família.
  O melhor pedaço do trabalho.
- **O piso de exportação (`image` / `passthrough`).** Uma família nova exporta sem tocar
  `export-core`. Verificado pelo teste da família fictícia.
- **A derivação `cloudRegistry` ← `registerCloudFamily`.** Matou as listas curadas por
  provider de verdade.
- **Harmonização das descrições de categoria.** Consistente nas 5 famílias; a F5b acertou.
- **Gates verdes e medidos:** typecheck limpo, 244/244 arquivos, 2506/2506 testes.

### Isto precisa de atenção antes de evoluir mais

- **O gate de deploy F6b não existe no código.** Só prosa. Risco de produção real,
  agravado por a branch parecer pronta para merge.
- **`element-presets` nunca foi migrado** e sua allowlist paralela **descarta campos
  obrigatórios** (`svgContent`, `flowShape`) ao salvar presets.
- **Cinco campos mortos no contrato** (`patchableKeys`, `defaultNameKey`, `minSize`,
  `sections`, `CloudFamilyService.descriptionKey`) — o padrão se repetiu, ao contrário do
  que os relatórios disseram.
- **A F5c foi revertida na prática**, e o código+testes mantêm nomes e comentários que
  afirmam o contrário, incluindo uma alegação de drift-lock que é factualmente falsa.
- **O gate F8b rejeita nós válidos**, e o teste consagra o falso positivo como esperado.
- **Três enumerações de família ainda hardcoded** (LLM catalog, abas do picker, prefix
  recovery) — o fechamento de contrato não foi completo.
- **`AGENTS.md` manda registrar tipos pelo caminho proibido** e não conhece
  `features/elements/`.
- **Famílias novas não têm variante tipada em `Component`** → cast obrigatório e nenhuma
  proteção compile-time entre `serviceId` e `cloudServiceId`.

### Resposta à pergunta que motivou a auditoria

**O sistema está sólido o suficiente para receber a próxima família cloud com a mesma
forma das atuais — e não está para receber uma família de forma diferente.** O trabalho
arqueológico não voltaria ao nível desta sequência, mas quem chegar amanhã vai (a) ser
mandado pelo `AGENTS.md` para o registry errado, (b) descobrir os tokens de CSS por
tentativa e erro, e (c) bater sem aviso no teto de "só cards" se a família tiver
containers. Os três são baratos de resolver agora e caros de descobrir depois.

---

## 7. Itens acionáveis (não implementados — decisão sua)

Ordenados por risco × custo. Nada aqui foi alterado no código.

### Bloqueadores antes de considerar a branch mergeável

1. **Guardar tecnicamente a escrita de `cloudServiceId` (F6b).** Opções, da mais forte
   para a mais fraca: (a) extrair as escritas para um único `writeCloudServiceId()` atrás
   de flag de build, de modo que a versão "legacy writes" seja o default até promoção
   explícita; (b) flag de runtime lida do ambiente; (c) no mínimo, um teste de guarda que
   falhe se o número de sites de escrita crescer, mais um `CODEOWNERS`/comentário em cada
   site. Hoje são 13+ sites incondicionais.
2. **Corrigir a perda de dados de presets.** Fazer
   `element-presets/utils/element-preset.utils.ts` derivar a allowlist da união de
   `descriptor.model.patchableKeys` + campos-base, em vez do `Set` literal. Isso resolve
   dois achados de uma vez: mata o campo morto `patchableKeys` dando-lhe o leitor que
   sempre devia ter, e para de descartar `svgContent` / `flowShape` / `customColor` /
   `panelColorDark` / vínculos de `external-element`. Adicionar um teste por elemento
   registrado: salvar preset → reconstruir → campos obrigatórios sobrevivem.

### Antes da próxima família

3. **Atualizar `AGENTS.md`**: trocar a regra de "registre via `NodeTypeDescriptor`" pelo
   caminho do element registry com link para ADR-0010; adicionar `features/elements/` ao
   mapa de pastas; renomear `custom-components/` → `element-presets/`.
4. **Completar o checklist de "adicionar uma família"** em `element-registry.md`: caminho
   exato dos accent tokens (`src/index.css`, bloco claro **e** escuro), formato das chaves
   i18n, o idioma `as<Family>CategoryType`, e a classe `border-l-*`. Considerar validar os
   accent tokens no registro, como já se faz com i18n — hoje um falha alto e o outro em
   silêncio.
5. **Documentar o teto "só cards"** em `element-registry.md` como limitação conhecida do
   `CloudFamilyDefinition`, com o caso K8s Namespace/Cluster nomeado. Hoje isso vive só em
   `k8s.catalog.ts:5-9` apontando para um relatório deletado.
6. **Generalizar as três enumerações**: `listElementFamilies`/`searchElements` devem
   derivar as famílias não-cloud de `allElements()` agrupado por `family` (e usar i18n nos
   rótulos); `buildCategoryNavItems` idem; `recoverCloudCategoryPrefix` deve iterar
   `allCloudFamilies()` em vez do trio literal.

### Higiene, quando der

7. **Decidir sobre os cinco campos mortos**: dar leitor ou remover. `patchableKeys`
   resolve-se pelo item 2. `CloudFamilyService.descriptionKey` vale ligar (257 serviços hoje
   descritos pela categoria) — ler em `element-catalog-query.ts:174` com fallback para a
   categoria. `minSize`, `sections` e `defaultNameKey` provavelmente devem sair.
8. **Consertar a nomenclatura e os testes do IR**: renomear
   `irAwsCategoryIdsFromRegistry` → `irAwsCategoryIdsFromCatalog`, remover o comentário
   falso de drift-lock (`ir.types.ts:64`), e substituir o teste tautológico
   (`ir.types.test.ts:80-87`) por um que compare o catálogo contra
   `allElements().filter(e => e.family === "aws")` — o único drift que vale travar.
   Registrar no ADR-0010 que a F5c foi revertida, não apenas ressalvada.
9. **Revisar o gate F8b**: armar por ação, não por patch — um `ADD_NODE` cloud só é
   obrigado a casar com uma busca se *ele* depender de uma; ou aceitar qualquer par válido
   no registry e usar os hits de busca apenas para *priorizar*. Comparar ids sem
   sensibilidade a maiúsculas. Reavaliar se categoria-sem-serviceId deve mesmo ser
   rejeitada (`add-node-validation.ts:67-72`), já que paleta e `attachService` permitem.
   Trocar o `console.warn` silencioso por um skip visível ao usuário.
10. **Remover o código morto de `features/cloud/`**: `aws.provider.ts`, `gcp.provider.ts`,
    `azure.provider.ts` (zero importadores), `bootstrap.ts` (é `export {}`), e
    `FALLBACK_BY_FAMILY` em `CloudIcon.tsx:35-51`. Decidir entre "family" e "provider" como
    vocabulário único e colapsar o alias `canvas/nodes/CloudIcon.tsx`.
11. **Endereçar a conflação `serviceId`/`cloudServiceId`**: remover o fallback
    `?? serviceId` de `resolveCloudServiceId` (ou restringi-lo a tipos cloud) para parar o
    vazamento em `llm/serializer.ts:54-58`; e/ou introduzir tipos marcados
    (`type CloudServiceId = string & { __cloud: true }`) para ganhar proteção de compilação.
    Considerar variantes `K8sComponent`/`OssComponent` para eliminar os `as Component` de
    `k8s.family.ts:109` e `oss.family.ts:109`.
12. **Limpezas pontuais**: quatro referências a docs deletados em código vivo
    (`element.types.ts:18,100,184` e `cloud-family.types.ts:76`); o comentário circular em
    `element-presets/types.ts:6`; o `"serviceId"` duplicado em
    `element-preset.utils.ts:20,48`.

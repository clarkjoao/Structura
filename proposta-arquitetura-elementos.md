# Proposta de arquitetura — unificação do sistema de elementos

Documento de **arquitetura**, não de implementação. Nenhum arquivo de produção foi
criado ou alterado. Base: `main` em `3a0f891`. Continua
[`mapeamento-sistema-elementos.md`](mapeamento-sistema-elementos.md); referências no
formato §N.M apontam para as seções daquele documento.

Decisões 1, 3–8 tratadas como fechadas. A Parte 1 responde a pergunta 2.

---

## Parte 1 — O `ComponentType` precisa continuar sendo uma união fechada?

### 1.1 O que a união fechada compra hoje — medido, não estimado

Criei um worktree descartável em `HEAD` (já removido), adicionei uma família nova
**só na união de tipos**, e rodei `npx tsc --noEmit -p tsconfig.json`. Três cenários:

**Cenário A — família de nuvem nova (`K8sCategoryId`) só em `ComponentType`:**

```
src/features/diagram/store/slices/components.slice.ts(226,11):
  error TS2322: Type '"k8s-workload" | "k8s-network" | "k8s-storage"'
  is not assignable to type 'never'.
```

**1 erro.**

**Cenário B — a mesma família, agora também com `K8sComponent` na união `Component`:**

```
src/features/diagram/store/slices/components.slice.ts(226,11): error TS2322 …
src/lib/export-service/to-export-model.ts(347,9):
  error TS2322: Type 'K8sComponent' is not assignable to type 'never'.
```

**2 erros.**

**Cenário C — tipo de shape próprio (`"chart"` + `ChartComponent`):** exatamente os
mesmos 2 erros, nos mesmos 2 arquivos.

### 1.2 Leitura do resultado

Os únicos dois pontos de exaustividade sobre o modelo de componente no repo são:

| Site | O que protege | Dispara quando |
| --- | --- | --- |
| `components.slice.ts:226` (`const _exhaustive: never = type`) | esquecer o **construtor** do tipo | você toca `ComponentType` |
| `to-export-model.ts:347` (`const _exhaustive: never = c`) | esquecer o **mapeamento de export** | você toca a união `Component` |

(Os outros dois `never` do repo são de outros domínios: `ProcessNode/index.tsx:155`
sobre `FlowNodeShape`, e `cell-builders.ts:221` sobre `ExportNode["kind"]` — volto a
esse segundo em §1.5, porque é o precedente que a proposta reaproveita.)

O §2.3 do mapeamento lista **~15 arquivos** para uma família nova e **~15** para um
componente de shape próprio. A união fechada cobre **2**. Os outros ~13 falham em
silêncio, em runtime:

| Site que a união **não** cobre | Sintoma da omissão |
| --- | --- |
| `buildLayoutForComponent` (`components.slice.ts:259+`) | nó nasce com tamanho errado/zero |
| roteamento de painel (`ElementPanel/index.tsx:89-162`) | cai no `ComponentPanel` genérico |
| duas paletas (`ElementPickerModal`, `QuickInsertPopover`) | elemento invisível ao usuário |
| `getDefaultNameForNewComponent` / `getUsageKeyForType` | nome "New undefined", telemetria errada |
| `BUILTIN_COMPONENT_TYPES` (`sanitize-component-type.ts:11-26`) | **tipo reescrito para `"component"`** (§4.2) |
| `ALLOWED_COMPONENT_PATCH_KEYS` | campos somem ao salvar como template (§4.6) |
| i18n (4 namespaces) | chave crua na UI |
| tokens Tailwind + `index.css` (2 temas) | borda sem cor |
| catálogo LLM (`component-catalog.ts`) | LLM não sabe que o tipo existe |
| `import-drawio.ts`, `generatePreviewSvg.ts`, `patterns.ts` | ausente de import/preview/patterns |
| `ComponentPatch` / `TypedComponentPatch` | *nem sequer causa erro* — nenhum dos 3 cenários acusou |

Ou seja: **a união fechada cobre ~13% dos pontos de extensão, e os 87% restantes são
exatamente os que degradam em silêncio.** Ela dá a sensação de exaustividade sem a
propriedade.

### 1.3 A união já não é fechada

`ComponentType` inclui `PluginComponentType = \`${string}/${string}\``
(`component.types.ts:11`, `:31`) — qualquer string com barra já é membro legal. E
`sanitizeComponentType` faz `value as ComponentType` sobre string arbitrária
(`sanitize-component-type.ts:55-56`). A fronteira, portanto, não é "fechada vs aberta":
é "fechada para famílias internas, aberta para plugins", e **a metade aberta é a que
tem menos garantias**.

### 1.4 O caminho de plugin é mais fraco — e isso não é por ser aberto

Registrando pelo plugin path (`plugin-api.ts:31-51`), um tipo perde:

- `buildStyle` — não existe em `PluginNodeTypeDescriptor` (`plugin.types.ts:259-278`);
- `handles` — **forçado** a `SPREAD_HANDLES` (`plugin-api.ts:38-41`), com o comentário
  admitindo que é "a única suposição segura";
- export por nó — `ExporterContribution` (`plugin.types.ts:170-178`) é por **formato de
  arquivo inteiro** (`export(diagram) => string`), não por elemento. Um plugin não
  consegue contribuir "o shape drawio do meu nó"; só reescrever o exportador inteiro.

Nada disso decorre da abertura da união. Decorre de o `PluginNodeTypeDescriptor` ser um
**subconjunto empobrecido** do `NodeTypeDescriptor` interno. A conclusão é a inversa da
sugerida na pergunta: o plugin path é fraco **por omissão de contrato**, não por ser
string aberta — e a decisão 6 (export obrigatório) só é exprimível se o contrato do
elemento crescer, para plugins e para famílias internas igualmente.

### 1.5 O precedente que já funciona no repo

`ExportNode` (`export-core/model.ts`) é uma união **estreita e fechada** de 9 `kind`s
(`c4`, `aws`, `panel`, `swimlane`, `apiGroup`, `endpoint`, `dbTable`, `note`,
`jsonViewer`), com exaustividade real em `cell-builders.ts:221`. Ela é **independente**
de `ComponentType`: 145 serviços AWS colapsam em `kind:"aws"`, 4 tipos C4 em `kind:"c4"`.

Isso é a demonstração, dentro do próprio repo, de que **exaustividade e vocabulário de
domínio não precisam ser a mesma união**. A exaustividade é barata e útil onde o
conjunto é pequeno e estrutural (como se desenha); é cara e enganosa onde o conjunto é
grande e cresce por catálogo (quais serviços existem).

### 1.6 Opções, trade-offs e recomendação

| | **A. Manter fechada** | **B. Abrir de vez (padrão plugin)** | **C. Híbrida (recomendada)** |
| --- | --- | --- | --- |
| Tipo é… | união literal | string qualquer | string validada contra registry em runtime |
| Exaustividade em compile-time | 2 sites | 0 | 0 no domínio; **mantida** nas uniões estreitas (`ExportNode["kind"]`, `FlowNodeShape`) e no conjunto core |
| Custo por família nova | ~15 arquivos | ~15 arquivos (menos 2 erros que avisam) | 1 arquivo de família + registro |
| Custo por serviço novo | 1–4 arquivos | idem | 1 entrada de catálogo |
| Risco de tipo inválido persistido | baixo | **alto** (nada valida) | baixo — registry valida na leitura e na criação |
| Compatível com decisão 7 (LLM derivado) | não (lista à parte) | sim | sim |
| Compatível com decisão 6 (export obrigatório) | não exprimível | não exprimível | sim (campo obrigatório do contrato) |

**Recomendação (é recomendação, não decisão): opção C, com a fronteira em dois níveis.**

1. **Núcleo fechado.** O conjunto *estrutural* — C4 (4 tipos, congelado pelo próprio
   C4 Model) e os elementos de shape próprio (`panel`, `note`, `api-group`, `endpoint`,
   `db-table`, `json-viewer`, `process-node`, `external-element`, `svg`, `unknown`,
   futuros `chart`/`step-functions`) — continua uma união literal. É pequeno, cresce por
   decisão de produto (não por catálogo), e é onde o `never` do construtor paga.

2. **Espaço de família aberto e validado.** Tipos gerados por família de nuvem
   (`aws-*`, `gcp-*`, `azure-*`, `k8s-*`, …) deixam de ser união literal e passam a ser
   uma string com forma declarada — `\`${FamilyId}-${CategoryId}\`` — **validada contra
   o registry de famílias em runtime**, no mesmo ponto onde hoje mora
   `sanitizeComponentType`. É exatamente o que o §4.2 pede: a lista de tipos válidos
   deixa de ser mantida à mão e passa a ser derivada.

3. **A exaustividade muda de lugar, não desaparece.** Migra para uniões estreitas e
   estáveis: `ExportNode["kind"]` (já existe), o conjunto core acima, e o conjunto de
   *papéis de render* (`card` / `container` / `custom-shape`). Adicionar um serviço ou
   uma família não mexe em nenhuma delas — que é precisamente o comportamento desejado.

**O que se perde, explicitamente:** o erro de compilação em `components.slice.ts:226`
ao adicionar uma família. Ele é substituído por um teste de contrato que varre o
registry (o repo já tem esse padrão: `handle-spec.test.ts` varre `NODE_TYPE_REGISTRY`
cobrando coerência entre spec declarado e handles renderizados). É uma troca de
*compile-time em 2 sites* por *runtime/test em todos os ~15*.

---

## Parte 2 — Arquitetura proposta

### 2.1 Visão geral

Um **registro único por elemento**, `ElementDescriptor`, composto de *slices* por
responsabilidade. Duas **fábricas** produzem descriptors em lote a partir de catálogos
(C4 e famílias de nuvem); componentes de shape próprio declaram o seu à mão. Todos
entram no mesmo `elementRegistry`, e **todos os consumidores derivam dele** — nenhum
mantém lista própria.

```
                      ┌──────────────────────────────┐
  c4.family.ts ──────▶│                              │
  aws.family.ts ─────▶│       elementRegistry        │◀── plugin.registerElement()
  gcp.family.ts ─────▶│   (id → ElementDescriptor)   │
  azure.family.ts ───▶│                              │
  k8s.family.ts ─────▶│  valida no registro:         │
                      │   • id único                 │
  chart.element.ts ──▶│   • export mapping presente  │
  dbtable.element.ts ▶│   • i18n keys presentes      │
  panel.element.ts ──▶│   • handles declarados       │
                      └───────────────┬──────────────┘
                                      │  (uma fonte, seis leitores)
        ┌────────────┬────────────┬───┴────────┬────────────┬─────────────┐
        ▼            ▼            ▼            ▼            ▼             ▼
    criação      render        paleta      inspector      export        LLM
  createElement  rfType+      1 paleta,   painel por    ExportNode    catálogo
  (model+size)   buildData    2 views     descriptor    kind + style   derivado
   §2.4          §2.5         §2.6        §2.7          §2.8          §2.9
                                      │
                                      ▼
                            isValidElementType(t)
                    (substitui BUILTIN_COMPONENT_TYPES — §4.2)
```

**Por que um registry e não vários:** os três de hoje
(`NODE_TYPE_REGISTRY`, `cloudRegistry`, `PANEL_KINDS`) não se dividem por
responsabilidade — dividem por *origem histórica*, e cada um conhece um pedaço do mesmo
elemento. `cloudRegistry` continua existindo internamente como **catálogo de família**
(é a única peça já generalizada do sistema, §1.1 do mapeamento), mas deixa de ser um
registry paralelo: vira a *entrada* da fábrica que produz descriptors. `PANEL_KINDS`
vira uma família como as outras (§2.10).

### 2.2 `ElementDescriptor` — o contrato

Ilustrativo, não definitivo. Nomes de arquivo/pasta são proposta e ficam abertos.

```ts
interface ElementDescriptor {
  // ── identidade ────────────────────────────────────────────────
  id: ElementTypeId;           // "person" | "aws-compute" | "chart" | "acme/gauge"
  family: FamilyId;            // "c4" | "aws" | "gcp" | "k8s" | "structural" | pluginId
  labelKey: string;            // chave i18n única — mata os 4 namespaces (§4.10)
  descriptionKey: string;      // idem; alimenta paleta E catálogo LLM (decisão 7)

  // ── modelo (governa a criação — decisão 3) ────────────────────
  model: {
    defaultData: () => Record<string, unknown>;  // substitui buildComponentForType
    defaultSize: { width: number; height: number }; // passa a ser LIDO (§3, decisão 3)
    defaultNameKey?: string;
    requiredFields?: string[];   // usado pela validação E pelo prompt do LLM
    patchableKeys: readonly string[];  // deriva ALLOWED_COMPONENT_PATCH_KEYS (§4.6)
  };

  // ── canvas (o NodeTypeDescriptor de hoje, preservado) ─────────
  canvas: {
    rfType: string;
    component: NodeTypes[string];
    handles: NodeHandleSpec;
    role: "card" | "container" | "custom-shape";  // união estreita, exaustiva
    zIndex: number | ((c: Component) => number);
    connectable: boolean;
    canHaveParent: boolean;
    canBeParent: boolean;
    buildData: (comp, ctx: NodeBuildContext) => Record<string, unknown>;
    buildStyle?: (comp, ctx) => CSSProperties | undefined;
  };

  // ── paleta (uma só — mata as duas de hoje, §4.7) ──────────────
  palette: {
    categoryId: string;        // nó da árvore de navegação
    icon: PaletteIcon;         // { kind: "lucide", … } | { kind: "family", iconName }
    accent: AccentToken;       // token de cor; deriva a borda (mata os 4 mapas, §4.4)
    searchKeys: string[];      // substitui quickInsert.searchHelp*
    spotlight?: number;        // ordenação de destaque; existe para TODA família
  };

  // ── inspector (mata a cadeia de if, §2.1 do mapeamento) ───────
  inspector: {
    panel?: ComponentType<InspectorProps>;  // ausente = painel genérico
    sections?: InspectorSectionId[];
  };

  // ── export (OBRIGATÓRIO — decisão 6) ──────────────────────────
  export: {
    drawio: {
      kind: ExportNodeKind;                       // união estreita, exaustiva
      toExportNode: (comp, base) => ExportNode;   // o de-para
      minSize?: { width: number; height: number };
    };
  };

  // ── import (opcional, mas declarado) ──────────────────────────
  import?: {
    drawio?: { matches: (style: string) => boolean; toComponent: (cell) => Component };
  };
}
```

**Por que cada bloco existe:**

- `labelKey`/`descriptionKey` num só lugar é o que permite a decisão 7 — o LLM lê a
  *mesma* descrição que o usuário vê na paleta, e não há como um tipo existir para um e
  não para o outro.
- `model.defaultSize` no descriptor **e lido pela criação** é a decisão 3. Hoje o campo
  existe e é ignorado (§3 do mapeamento).
- `export.drawio` **não opcional** é a decisão 6. O registry recusa o registro sem ele,
  e por construção deixa de existir o `throw` de §4.8.
- `canvas.role` é a união estreita onde a exaustividade sobrevive (§1.6, item 3).
- `palette.accent` como token único é o que mata os quatro mapas de borda duplicados.

### 2.3 As três formas de produzir um descriptor

**(a) Família de nuvem — `CloudFamilyDefinition` (decisão 1: nuvem é um conceito próprio)**

Generaliza o `CloudProviderAdapter` atual, que já é a peça mais sã do sistema:

```ts
interface CloudFamilyDefinition {
  id: FamilyId;                 // "aws" | "gcp" | "azure" | "k8s"
  labelKey: string;
  categories: { id: string; labelKey: string; accent: AccentToken }[];
  services:   { id: string; name: string; iconName: string; categoryId: string;
                descriptionKey?: string }[];
  icons: IconResolver;          // contrato atual, inalterado
  export: {                     // decisão 6, no nível da família
    kind: ExportNodeKind;                       // ex.: "cloudService"
    iconFor: (serviceId: string) => string;     // de-para → shape drawio
    fallbackIcon: string;
  };
  import?: { drawioStyleMatch: RegExp; serviceFromStyle: (s: string) => string };
}
```

Uma família gera **um descriptor por categoria** (é assim que o `ComponentType` de nuvem
já funciona hoje: o tipo é a categoria, o serviço é um campo). O campo de serviço passa
a ser **um só**, `serviceId` qualificado pela família — acabando com o trio
`awsService`/`gcpService`/`azureService` (§4.5) e com o 5º parâmetro posicional de
`addComponent`.

**(b) C4 — família própria, fechada, com renderer próprio.** Decisão 1 quer C4 e nuvem
separados; o corte natural é: C4 é um conjunto **fixo de 4 tipos semânticos** do C4
Model, sem catálogo, sem `serviceId`, com ícone por tipo. Vira uma
`StructuralFamilyDefinition` de 4 entradas, não uma `CloudFamilyDefinition` degenerada.
A consequência prática mais importante: **o catch-all morre** (decisão 4) — C4 deixa de
ser "o que sobra" e passa a ser declarado como os outros.

**(c) Elemento de shape próprio** — descriptor escrito à mão, um arquivo, obrigado a
declarar `export.drawio` e `handles`. É o caso de `chart` e `step-functions`.

### 2.4 Renomeação do "custom component" (decisão 5)

Hoje `CustomComponentTemplate` (`custom-components/types.ts:3-16`) é *um tipo existente
+ dados pré-preenchidos*. Proposta de nome: **`ElementPreset`** (feature
`element-presets/`, store `presets`, UI "Meus presets").

Justificativa: "preset" descreve exatamente o que é (valores pré-definidos sobre algo
que já existe), não colide com "shape próprio", não carrega a bagagem do React Flow, e
traduz bem para pt-BR ("preset"/"predefinição"). Alternativas consideradas e por que não:
*Template* (colide com `UserTemplate`, que já existe em `store/slices/userTemplates`),
*Blueprint* (sugere estrutura, não valores), *Snippet* (sugere texto/código).

E o renderer `CustomNode` (§4.5 — hoje renderiza justamente os nós **não** customizados)
passa a se chamar **`CardNode`**, que é o papel que ele exerce (`canvas.role: "card"`) —
o cartão com ícone, título, tecnologia e descrição, compartilhado por C4 e por todas as
famílias de nuvem. Nomes abertos a ajuste.

### 2.5–2.9 Como cada consumidor passa a ler do registry

| Consumidor | Hoje | Proposto |
| --- | --- | --- |
| **Criação** | `buildComponentForType` (if/else, 105 linhas) + `buildLayoutForComponent` (if/else) + `getDefaultNameForNewComponent` + `getUsageKeyForType` | `createElement(typeId, ctx)` lê `descriptor.model` — dados, tamanho, nome e chave de uso vêm do mesmo lugar (decisão 3) |
| **Render** | `resolveNodeDescriptor` com catch-all | mesmo mecanismo, sem catch-all: id desconhecido → `unknown` explícito (decisão 4) |
| **Paleta** | `ElementPickerModal` (563 l) + `QuickInsertPopover` (788 l), listas próprias | **uma** fonte (`registry.byCategory()`), duas *views* (modal e popover) sobre ela (§4.7) |
| **Inspector** | cadeia de `if` por guard (`ElementPanel/index.tsx:89-162`) | `descriptor.inspector.panel ?? GenericPanel` |
| **Export** | `mapNode` com guards + `throw` para 5 tipos | `descriptor.export.drawio.toExportNode`; exaustividade permanece em `ExportNode["kind"]` (§4.8) |
| **LLM** | `ALL_COMPONENT_TYPES` = estrutural + C4 + AWS, curado à mão | derivado: `registry.all().map(toCatalogEntry)` (decisão 7) |
| **Validação de tipo** | `BUILTIN_COMPONENT_TYPES` manual | `registry.has(id)` (§4.2 — causa raiz eliminada) |

**Decisão 7 — ambiguidade de provedor no LLM.** Com o catálogo derivado, o modelo passa
a ver EC2, Compute Engine, Azure VM e Kubernetes Deployment ao mesmo tempo. Proposta de
regra, em ordem: (1) provedor explícito no pedido vence; (2) senão, provedor **já
predominante no diagrama ativo** — o registry sabe a família de cada nó existente, então
isso é contável e entra no prompt como fato ("este diagrama tem 7 elementos AWS");
(3) se o diagrama estiver vazio e o pedido for agnóstico ("um cache", "uma fila"),
o modelo deve preferir o **tipo estrutural/C4 genérico** e não escolher provedor —
escolher AWS por default é justamente o viés acidental de hoje. Vale expor no
descriptor um campo `semantic?: "cache" | "queue" | "database" | …` para que
"preciso de um cache" tenha resposta agnóstica de provedor; isso fica como ponto em
aberto, porque não está nas decisões fechadas.

### 2.10 O que fazer com `PANEL_KINDS`

`PANEL_KINDS` (`lib/catalogs/panels.ts:18-80`) é hoje um catálogo AWS com nome genérico
(VPC, AZ, EKS, ECS, ASG, subnets) e strings cruas em português (§4.9). Proposta:
tratá-lo como **catálogo de containers de uma família** — `palette.role: "container"` —
de modo que cada família possa declarar os seus (VPC/Subnet na AWS, VPC/Subnet no GCP,
VNet no Azure, Namespace/Cluster no Kubernetes). Isso resolve a assimetria apontada em
§4.1 (só AWS tem serviço→grupo) sem um mecanismo novo, e as strings passam por i18n
como qualquer outro `labelKey`.

---

## 3. Mapeamento 1:1 — como cada débito do §4 morre

| Débito | Como morre |
| --- | --- |
| **§4.1** AWS privilegiado (58 vs 15 arquivos) | Integrações passam a ler do registry. Export, import, preview, LLM, spotlight e busca deixam de ter *caminho AWS*: têm **um** caminho, parametrizado pela família. Paridade GCP/Azure (decisão 8) vira consequência do registro, não um projeto. |
| **§4.2** `sanitizeComponentType` rebaixa tipos de nuvem | `BUILTIN_COMPONENT_TYPES` deixa de existir; a validação é `registry.has(id)`. A lista não pode desatualizar porque não é uma lista. |
| **§4.3** dois `CloudIcon` diferentes | Um só, dirigido por `palette.icon` (`{kind:"family", iconName}` resolve pelo `IconResolver` da família). `AwsIcon` some — é o wrapper que causou metade do viés AWS. |
| **§4.4** mapa de bordas duplicado 4× | `palette.accent` é um token por categoria, declarado uma vez na família. Os 3 mapas dos providers e o órfão `awsCategoryBorders` desaparecem. |
| **§4.5** nomes que não batem | `awsService`→`serviceId` único; `addComponent(7 args posicionais)`→`createElement(typeId, opts)`; `CustomNode`→`CardNode`; `CustomComponentTemplate`→`ElementPreset`; `rfType "flow-node"` vs tipo `"process-node"` reconciliados no registro (um id só). |
| **§4.6** duplicações/lacunas em tipos | `ComponentPatch`/`TypedComponentPatch` deixam de ser mantidos à mão (linha duplicada e lacuna de plugin somem); `ALLOWED_COMPONENT_PATCH_KEYS` é derivado de `model.patchableKeys`, então um campo novo nunca "some ao salvar". |
| **§4.7** duas paletas em paralelo | Uma fonte, duas views. `AwsBrowseView`/`AwsCategoryBlock` (dedicados) morrem em favor dos genéricos, que já existem. |
| **§4.8** export lança exceção para 5 tipos | `export.drawio` obrigatório no registro (decisão 6): um elemento sem de-para **não registra**, então não existe para ser exportado. O `throw` some por construção. |
| **§4.9** strings cruas em `panels.ts` | Containers viram elementos com `labelKey` (§2.10). |
| **§4.10** labels em 4 namespaces i18n | `labelKey`/`descriptionKey` por descriptor; um namespace derivado do id. Registry valida a existência das chaves nos dois locales no registro. |
| **§4.11** `extension-points.md` marca "Node types (domain) 🔴 top priority" | É exatamente este documento. `ElementDescriptor` é o "domain component descriptor" que o doc pede; "Element picker 🔴" e "Export cell builders 🔴" caem junto. |

---

## 4. Como ficam os dois casos que motivaram o trabalho

### 4.1 Adicionar Kubernetes como família

Hoje: ~15 arquivos (§2.3 do mapeamento). Proposto:

1. `src/features/elements/families/k8s/k8s.family.ts` — `CloudFamilyDefinition`:
   categorias (Workloads, Networking, Storage, Config, …), serviços (Deployment,
   StatefulSet, Service, Ingress, PVC, ConfigMap, …), `IconResolver` (pacote de ícones —
   **decidir qual**, ver riscos), `export.iconFor` (de-para para shapes
   `mxgraph.kubernetes.*`, que existem no drawio).
2. `families/index.ts` — uma linha de registro.
3. `src/index.css` + `tailwind.config.ts` — tokens de accent por categoria, nos dois temas.
4. i18n — bloco `elements.k8s.*` nos dois locales.

**4 pontos, sendo 2 deles dados.** Redis e Kafka: se forem "serviços open source" sem
provedor, cabem numa família `oss` com a mesma forma — ou como serviços de uma família
"infra" — e aí o custo é *uma entrada de catálogo cada*.

### 4.2 Adicionar `chart` e `step-functions` como elementos de shape próprio

1. `src/features/elements/custom/chart/ChartNode.tsx` — renderer.
2. `chart.element.ts` — `ElementDescriptor` com `canvas.role: "custom-shape"`,
   `handles`, `model.defaultData/defaultSize` (que **agora governam a criação**),
   `inspector.panel` (editor de séries), e **obrigatoriamente** `export.drawio`
   (para chart, provavelmente um shape de imagem/retângulo rotulado; para Step
   Functions, o de-para natural é o shape de fluxo do drawio, com cada estado ASL
   virando um nó — ponto a especificar quando chegar a hora).
3. `elements/index.ts` — registro.
4. i18n.

**4 pontos.** O painel de propriedades e a entrada de paleta deixam de ser arquivos
separados a editar: são campos do descriptor.

---

## 5. Riscos e trade-offs — honestamente

1. **Perda de 2 erros de compilação (§1.2).** É real. A mitigação (teste de contrato
   varrendo o registry) só vale se for escrita junto, não depois. Se a migração for
   parcial e o teste não existir, o sistema fica *pior* que hoje nesses 2 pontos.

2. **A migração é maior do que o mapeamento sugere.** O mapeamento contou arquivos a
   *tocar para adicionar um tipo*; migrar os **existentes** é outra conta: 14 tipos
   internos + 3 famílias × N categorias. E há consumidores que o mapeamento tocou de
   leve e vão doer: `useCanvasNodes` (hot path — o §canvas do repo tem histórico de
   regressão de performance em render churn), colaboração/Yjs (o formato de `Component`
   trafega na rede), e `persist.config.ts` (**qualquer** mudança na forma do componente
   persistido exige migração e bump de `PERSIST_SCHEMA_VERSION`, por regra do
   `AGENTS.md`). Renomear `awsService`→`serviceId` é migração de dados de usuário, não
   refactor.

3. **`ElementDescriptor` é grande e pode virar um god-object.** Sete slices num objeto
   é muita responsabilidade acoplada por co-localização. O contra-argumento é que hoje
   as sete já estão acopladas — só que *implicitamente e espalhadas*. Ainda assim, o
   risco de o contrato crescer sem freio é real; sugiro que qualquer slice nova exija
   spec (é a regra 5 de `extension-points.md:50`).

4. **Export obrigatório (decisão 6) pode travar elementos legítimos.** `unknown` e
   `svg` existem justamente para conteúdo que não tem semântica de diagrama. Forçar
   de-para para eles é artificial — provavelmente o contrato precisa de um
   `kind: "passthrough"` explícito (uma caixa rotulada) em vez de uma exceção. Isso é
   uma tensão dentro da decisão 6, não uma objeção a ela.

5. **Catálogo LLM derivado cresce o prompt.** Hoje são 145 serviços AWS; com paridade
   completa (decisão 8) seriam ~244 + Kubernetes. Isso é muito token por requisição, e
   o repo já tem histórico de truncamento em geração. Provavelmente o catálogo derivado
   precisa ser *hierárquico* (famílias e categorias no prompt; serviços buscáveis por
   tool call) em vez de plano — o que é uma decisão de design de prompt que esta
   proposta não resolve.

6. **Kubernetes/Redis/Kafka dependem de um pacote de ícones que ainda não está escolhido.**
   AWS e Azure usam pacotes npm de componentes React; GCP usa SVGs via `import.meta.glob`.
   Nenhum dos três padrões é obviamente o certo para ícones open source, e a escolha
   afeta o contrato do `IconResolver`. Não investiguei opções — é pré-requisito da
   implementação, não desta proposta.

7. **Decisão 4 (fim do catch-all) muda comportamento de dados existentes.** Hoje um tipo
   desconhecido vira C4 silenciosamente; amanhã vira `unknown` visível. Para diagramas
   já salvos com tipos corrompidos (o §4.2 mostra que existem — o comentário de
   `migrations.ts:19-25` documenta um caso real), isso troca "renderiza errado" por
   "aparece como desconhecido". É provavelmente o comportamento certo, mas é uma
   mudança visível ao usuário e merece nota de release.

---

## 6. O que fica em aberto para você decidir

- Nomes: `ElementPreset`, `CardNode`, `elements/families/*` — proposta, aberta a ajuste.
- `semantic` no descriptor (§2.9) para pedidos agnósticos de provedor: fora das decisões
  fechadas, precisa da sua chamada.
- Tratamento de `unknown`/`svg` frente à decisão 6 (risco 4).
- Formato do catálogo LLM: plano vs hierárquico (risco 5).
- Onde Redis/Kafka/Kubernetes caem: três famílias separadas, uma família "oss", ou
  serviços de uma família "infra" — muda a granularidade da paleta que o usuário vê.

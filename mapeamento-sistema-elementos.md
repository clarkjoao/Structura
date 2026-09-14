# Mapeamento do sistema de criação de elementos no canvas

Documento de **descoberta**. Nenhum código foi alterado. Base: `main` em `3a0f891`
(2026-09-14). Todas as afirmações abaixo citam `arquivo:linha`; onde não verifiquei,
está escrito explicitamente.

Trabalho anterior descartado (branches, openspec, ADRs, PRs de architecture-gen /
layout / IR / refatorações de node types) foi ignorado como ponto de partida. Quando
algo desse tipo aparece **em `main` como código vivo** (o caso de `src/features/llm/ir/`),
ele é listado apenas como ponto de acoplamento factual, sem reabrir decisão.

---

## 0. Vocabulário: o código não usa "default" e "custom" como você usa

Antes da tabela, o mapeamento mais importante — porque três coisas diferentes disputam
a palavra "custom" no repo:

| Termo seu | O que é no código | Onde |
| --- | --- | --- |
| **default** (título + ícone + descrição + shape; C4/AWS/GCP/Azure) | Tudo que cai no **catch-all** `c4Descriptor`, renderizado por um único componente `CustomNode` | `node-types/c4.descriptor.ts:30-130`, `nodes/CustomNode/index.tsx` |
| **custom** (shape e experiência próprios) | Um **descriptor próprio** no registry + componente React próprio (`db-table`, `json-viewer`, `api-group`, `endpoint`, `svg`, `note`, `panel`/`swimlane`, `process-node`, `external-element`, `unknown`) | `node-types/registry.ts:19-32` |
| — | **"Custom component"** no código = *template salvo pelo usuário*: um tipo já existente + dados pré-preenchidos. Não cria shape nem renderer novo. | `src/features/custom-components/types.ts:3-16` |
| — | `CustomNode` = o renderer **do catch-all** (C4 + nuvem). Nome engana: é o nó "padrão", não o customizado. | `nodes/CustomNode/index.tsx:109` |

Ou seja: **não existe hoje nenhum conceito de "família default" no código.** C4, AWS,
GCP e Azure não formam um grupo declarado em lugar nenhum — eles apenas compartilham o
mesmo destino por *ausência de descriptor específico* (`c4Descriptor.matches: () => true`,
`c4.descriptor.ts:34`). E o mecanismo reutilizável de "componente custom" que existe
(`CustomComponentTemplate`) é de **dados**, não de shape.

---

## 1. Tabela-resumo por tipo de elemento

### 1.1 Famílias "default" (todas passam pelo `c4Descriptor` + `CustomNode`)

| Tipo | Campos próprios | Onde o tipo é definido | Como o shape/ícone resolve | Acoplamentos que exige |
| --- | --- | --- | --- | --- |
| **C4** (`person`, `system`, `container`, `component`) | `technology?`, `panelColor?` (`component.types.ts:68-72`) | `C4_TYPES` em `component-type-constants.ts:6-7`; guard `isC4Type:61` | `TypeConfig[type]` → ícone lucide + classe de borda (`CustomNode/TypeConfig.ts:3-27`); fallback `TypeConfig.system` (`CustomNode/index.tsx:156`) | picker C4, painel, export drawio (`kind:"c4"`), preview SVG, catálogo LLM, cores `--node-*` |
| **AWS** (`aws-*`, 16 categorias / 145 serviços) | `awsService?`, `technology?`, `customColor?` (`component.types.ts:105-110`) | `AwsCategoryId` em `aws.catalog.ts:40-56`; guard por **prefixo** `isAwsType:60` | `cloudRegistry.forType` → `awsIconResolver` → `import("aws-react-icons")[iconName]` (`aws.icon-resolver.ts:15-20`) | **tudo** (58 arquivos) — ver §4.1 |
| **GCP** (`gcp-*`, 12 categorias / 41 serviços) | `gcpService?`, `technology?`, `customColor?` (`component.types.ts:112-117`) | `GcpCategoryId` em `gcp.catalog.ts:1-13`; guard `isGcpType:180` | `gcpIconResolver` → `import.meta.glob` de SVGs de `gcp-icons` renderizados como `<img>` (`gcp.icon-resolver.ts:8-37`) | 15 arquivos — ausente de LLM, import drawio, preview, patterns, QuickInsert-spotlight |
| **Azure** (`azure-*`, 13 categorias / 58 serviços) | `azureService?`, `technology?`, `customColor?` (`component.types.ts:119-124`) | `AzureCategoryId` em `azure.catalog.ts:1-14`; guard `isAzureType` | `azureIconResolver` → `import("azure-react-icons")[iconName]` (`azure.icon-resolver.ts:15-20`) | 15 arquivos — mesmas ausências do GCP |

Os três provedores de nuvem **têm** um registry próprio e uniforme:
`CloudProviderAdapter` (`cloud/model/cloud.types.ts:27-39`), registrados em
`cloud/bootstrap.ts:6`. Esse é o único ponto do sistema que já está generalizado.
C4 **não** participa dele.

### 1.2 Elementos com descriptor próprio ("custom" no seu vocabulário)

| Tipo | Campos próprios | Descriptor | Renderer | Painel de propriedades dedicado |
| --- | --- | --- | --- | --- |
| `panel` (+ `PanelKind`) | `panelKind?`, `panelColor?`, `panelOpacity?`, `borderStyle?`, `collapsed?`, `swimlane?` (`component.types.ts:84-94`) | `panel.descriptor.ts` | `PanelNode.tsx` | via `ComponentPanel` + `PanelStyleSection` |
| `panel` com `panelKind=swimlane` | `swimlane: SwimlaneStyle` (`:76-82`) | `swimlane.descriptor.ts` — **resolvido por exceção**, fora do `matches` (`registry.ts:56-61`) | `SwimlaneNode.tsx` | idem |
| `note` | `panelColor?`, `panelColorDark?`, `collapsed?` (`:96-103`) | `note.descriptor.ts` | `NoteNode.tsx` | via `ComponentPanel` |
| `api-group` | `serviceName`, `basePath`, `protocol`, `sla?` (`:137-143`) | `apigroup.descriptor.ts` | `ApiGroupNode/index.tsx` | `ApiGroupPanel.tsx` |
| `endpoint` | `method`, `path`, `handlers[]` (`:145-152`) | `endpoint.descriptor.ts` | `EndpointNode.tsx` | `EndpointPanel.tsx` |
| `db-table` | `tableName`, `columns[]`, `collapsed?` (`:178-185`) | `dbtable.descriptor.ts` | `DbTableNode.tsx` | `DbTablePanel.tsx` |
| `json-viewer` | `jsonContent`, `schemaRef?` (`:187-193`) | `jsonviewer.descriptor.ts` | `JsonViewerNode.tsx` | `JsonViewerPanel.tsx` |
| `process-node` | `flowShape` (9 shapes Mermaid), `nodeColor?` (`:195-210`) | `flownode.descriptor.ts` (rfType `"flow-node"`) | `ProcessNode/index.tsx` | via `ComponentPanel` + `FlowchartFieldsSection` |
| `external-element` | `referenceDiagramId`, `linkedElementId?`, … (`:212-222`) | `external-element.descriptor.ts` | `ExternalElementNode.tsx` | `ExternalElementPanel.tsx` |
| `svg` | `svgContent` (`:160-164`) | `svg.descriptor.ts` | `SvgNode.tsx` | nenhum (cai no `ComponentPanel`) |
| `unknown` | `rawContent?` (`:154-158`) | `unknown.descriptor.ts` | `UnknownNode.tsx` | nenhum |
| `<plugin>/<nome>` | `pluginData?` (`:224-229`) | registrado em runtime via `registerDescriptor` (`plugin-api.ts:63-69`) | do plugin | slot `element-inspector` |

O contrato do descriptor está em `node-types/types.ts:84-124`: `rfType`, `component`,
`matches`, `zIndex`, `connectable`, `handles`, `canHaveParent`, `canBeParent`,
`buildData`, `buildStyle?`, `defaultSize?`, `defaultData?` e overrides do React Flow.

### 1.3 O que cada família "desbloqueia" de diferente (verificado no código)

| Funcionalidade | C4 | AWS | GCP | Azure |
| --- | --- | --- | --- | --- |
| Ícone por serviço no nó | ✗ (ícone fixo por tipo) | ✓ | ✓ | ✓ |
| Borda colorida por categoria | ✓ (`--node-*`) | ✓ (`--aws-*`) | ✓ (`--gcp-*`) | ✓ (`--azure-*`) |
| Campo `technology` | ✓ | ✓ | ✓ | ✓ (`c4.descriptor.ts:71-77`) |
| Drill-down (diagrama filho) | ✓ | ✓ | ✓ | ✓ (`ComponentPanel.tsx:138-142`) |
| **Export drawio com ícone real** | n/a | ✓ `kind:"aws"` (`to-export-model.ts:295-301`) | ✗ cai em `c4Node` (`:335-337`) | ✗ cai em `c4Node` |
| **Import drawio** | ✓ | ✓ (`import-drawio.ts:122-138`) | ✗ | ✗ |
| **Catálogo visível ao LLM** | ✓ (`component-catalog.ts:58-86`) | ✓ 145 serviços (`:144-157`) | ✗ | ✗ |
| **IR de geração** (`llm/ir`) | parcial | ✓ (`ir.types.ts:36-56`) | ✗ | ✗ |
| Preview SVG do diagrama | ✓ | ✓ (`generatePreviewSvg.ts:221`) | ✗ (cai no retângulo genérico `:228`) | ✗ |
| Patterns prontos (`lib/catalogs/patterns.ts`) | ✓ | ✓ | ✗ | ✗ |
| Spotlight na aba "Todos" do picker | ✓ | ✓ (`ElementPickerAllView.tsx:108-114`) | ✗ | ✗ |
| Ícone na busca do canvas | ✗ | ✓ (`CanvasSearch.tsx:212`) | ✗ | ✗ |
| Icon picker próprio | — | ✓ (`AwsIconPickerPanel.tsx`) | ✗ | ✗ |
| Mapeamento serviço→`PanelKind` (grupo) | — | ✓ (`panels.ts`, `getPanelKindForAwsService`) | ✗ | ✗ |

**Resposta direta à pergunta "o que o subtipo desbloqueia":** nada no *modelo*. A
diferença entre AWS e GCP hoje não é uma capacidade declarada em lugar nenhum — é
**cobertura de integrações**. AWS foi cabeado em ~58 arquivos; GCP e Azure em 15.

**Paridade GCP/Azure vs AWS — estado atual:** a camada de *provider* está completa e
simétrica (catálogo, ícones, cores, adapter, picker via `CloudBrowseView`). A camada de
*integrações* não: export com ícone, import, LLM, preview e patterns são AWS-only.
Nenhum trabalho de paridade em andamento aparece na árvore de `main`.

---

## 2. Ponto de registro e extensão

### 2.1 Existe registry único?

**Não.** Existem três registries parciais e nenhum deles é o ponto único:

1. `NODE_TYPE_REGISTRY` (`node-types/registry.ts:19-32`) — **só decide renderização**.
   Ordenado; `c4Descriptor` tem de ser o último porque `matches` retorna sempre `true`
   (`registry.ts:42`, `:87-88`). Aceita registro em runtime (`registerDescriptor:80`).
2. `cloudRegistry` (`cloud/registry/cloud.registry.ts:31`) — **só catálogo/ícone/cor**
   de provedores de nuvem. Resolve por prefixo de string (`matchesType`).
3. `PANEL_KINDS` (`lib/catalogs/panels.ts:18`) — variantes de painel.

Fora deles, o tipo precisa aparecer em (todos verificados):

- União `ComponentType` (`component.types.ts:13-31`) e interface do componente (`:68-229`)
- `ComponentPatch` / `TypedComponentPatch` (`:248-280`)
- Guards e `is*Type` (`component.guards.ts`, `component-type-constants.ts`)
- `BUILTIN_COMPONENT_TYPES` do sanitizador (`sanitize-component-type.ts:11-26`)
- Construtor `buildComponentForType` (`components.slice.ts:126-231`, cadeia `if/else`
  fechada por `const _exhaustive: never`, `:224`)
- Tamanho inicial `buildLayoutForComponent` (`components.slice.ts:259+`)
- Nome default `getDefaultNameForNewComponent` (`component-type-constants.ts:172-191`)
- Chave de telemetria `getUsageKeyForType` (`:150-170`)
- Roteamento do painel (`ElementPanel/index.tsx:89-162`, cadeia de `if` por guard)
- Paleta: `ElementPickerModal.tsx` + `QuickInsertPopover.tsx` (dois pickers independentes)
- i18n (namespaces `quickInsert.*`, `nodeTypes.*`, `canvasToolbar.*`, `flowchart.shapes.*`)
- Export (`to-export-model.ts:243-349` — `switch` por guard, com `throw` no default)
- Import drawio (`import-drawio.ts:94-138`)
- Catálogo do LLM (`llm/component-catalog.ts`) e tool `add_node` (`llm/tools.ts:38-60`)
- Cores: `tailwind.config.ts:88-134` + variáveis em `src/index.css` (tema claro **e** escuro)

### 2.2 Adicionar UM serviço novo de um tipo já existente (ex.: novo serviço AWS)

Caminho mais curto do sistema. Arquivos:

1. `src/features/cloud/providers/aws/aws.catalog.ts` — entrada `{id, name, iconName}`
   na categoria. **Só isso** já faz aparecer no picker, no nó e no painel.
2. `src/lib/export-core/constants.ts` — `AWS_RESICON[serviceId]`, senão o export drawio
   sai com o ícone `"general"` silenciosamente (`export-service/aws-cache.ts:15`).
   Hoje `AWS_RESICON` tem **52 entradas para 145 serviços** — 93 serviços já exportam genérico.
3. *(opcional)* `src/features/llm/component-catalog.ts:88-141` — descrição dedicada, senão
   o LLM recebe `"AWS <Categoria> service."` genérico (`:140`).
4. *(opcional)* `element-picker/constants.ts:3-16` — spotlight.

Para GCP/Azure: passos 1 e 4 não existem (não há spotlight), e 2 e 3 são inalcançáveis —
nem export com ícone nem catálogo LLM existem para eles.

### 2.3 Adicionar uma **família default nova** (ex.: "Kubernetes", ícones próprios)

Não há um caminho declarado. Reconstruindo do que AWS/GCP/Azure fazem hoje:

1. `src/features/cloud/providers/<novo>/<novo>.catalog.ts` — categorias, serviços,
   `type XCategoryId`, `isXType` por prefixo.
2. `.../<novo>.icon-resolver.ts` — `IconResolver` (`cloud.types.ts:22-25`).
3. `.../<novo>.provider.ts` — `CloudProviderAdapter`, incluindo o mapa
   `<X>_CATEGORY_BORDERS` (hoje duplicado literalmente nos três providers).
4. `src/features/cloud/bootstrap.ts:6` — registrar.
5. `component.types.ts:13-31` — somar `XCategoryId` à união; `:105-124` — nova interface
   `XComponent` com o campo `xService?`; `:248-280` — `ComponentPatch` e `TypedComponentPatch`.
6. `component.guards.ts:44-51` — `isXComponent`, e incluir em `isCloudComponent`.
7. `components.slice.ts:194-200` — novo ramo `else if (isXType(type))` (senão o
   `never` quebra o typecheck).
8. `c4.descriptor.ts:71-87` — somar aos ternários de `technology` e `cloudService`.
9. `componentColor.ts:26-30` e `:44-49` — somar aos dois `||`.
10. `ComponentPanel.tsx:120-124`, `:340-342`, `:388-390` — somar `xService` aos três lugares.
11. `tailwind.config.ts` + `src/index.css` (dois blocos de tema) — tokens `--x-*` por categoria.
12. `canvas/enums.ts:1-11` (`ElementCategory`) + `buildCategoryNav.ts:12-24` +
    `ElementPickerModal.tsx:56-61, 84-88, 203-225` + `QuickInsertPopover.tsx:321-343` — paleta.
13. i18n `canvasToolbar.xServices` em `en.json` e `pt-BR.json`.
14. `custom-component-template.utils.ts:14-49` — `xService` em `ALLOWED_COMPONENT_PATCH_KEYS`.
15. Para paridade real com AWS: `to-export-model.ts`, `export-core/styles.ts`,
    `import-drawio.ts`, `generatePreviewSvg.ts`, `llm/component-catalog.ts`.

**~15 arquivos para o mínimo; ~20 para paridade com AWS.** Nenhum deles é um registry.

### 2.4 Adicionar um **componente custom novo** (shape e experiência próprios)

1. Componente React em `src/features/canvas/nodes/<Nome>/` — tipado
   `NodeProps<Node<MyNodeData>>` com `type` alias (regra em `AGENTS.md`).
2. `node-types/<nome>.descriptor.ts` implementando `NodeTypeDescriptor`
   (`types.ts:84-124`), incluindo `handles` (`handle-spec.ts`).
3. `node-types/registry.ts:19-32` — inserir **antes** de `c4Descriptor`.
4. `component.types.ts` — interface + união + os dois patches.
5. `component-type-constants.ts` — `COMPONENT_TYPE_X` e `isXType`.
6. `component.guards.ts` — `isXComponent`.
7. `sanitize-component-type.ts:11-26` — `BUILTIN_COMPONENT_TYPES`, senão qualquer
   diagrama salvo com esse tipo é reescrito para `"component"` na migração (§4.2).
8. `components.slice.ts:126-231` — ramo de construção; `:259+` — tamanho inicial.
9. `component-type-constants.ts:150-191` — nome default e chave de uso.
10. `ElementPanel/index.tsx:89-162` — painel próprio (se precisar).
11. `buildPickerOptions.ts:38-78` + `QuickInsertPopover.tsx` — paleta (dois lugares).
12. i18n nos dois locales.
13. `connection-rules.ts:27-29` — se o tipo não pode originar conexão.
14. `to-export-model.ts:243-349` — senão exportar o diagrama **lança exceção** (`:345`).
15. Testes: `handle-spec.test.ts` e `handle-spec.render.test.tsx` varrem
    `NODE_TYPE_REGISTRY` e cobram coerência entre spec declarado e handles renderizados.

**Existe mecanismo reutilizável?** Dois, nenhum deles cobrindo "shape novo":

- `CustomComponentTemplate` (`custom-components/types.ts:3-16`) — salva um nó existente
  como template de **dados**. `baseType` é um `ComponentType` já existente; instanciar é
  `addComponent(baseType, …)` + `updateComponent(patch)`
  (`useCustomComponentLibrary.ts:25-38`). Não cria tipo nem renderer.
- **API de plugin** — `api.registerNodeType(PluginNodeTypeDescriptor)`
  (`plugin-api.ts:63-69`, `plugin.types.ts:259-278`). Este **é** o caminho genérico de
  verdade: registra descriptor em runtime, tipo namespaced `<pluginId>/<nome>`, degrada
  para `unknown` se o plugin sumir (`registry.ts:35-41`). Mas tem menos poder que um
  descriptor interno (sem `buildStyle`, sem `handles` — assume `SPREAD_HANDLES`,
  `plugin-api.ts:38-41`) e nenhum tipo interno usa esse caminho.

---

## 3. Fluxos, passo a passo

### 3.1 Fluxo de renderização (o que existe e funciona bem)

```
Component (domínio)
  └─ resolveNodeDescriptor(comp)            registry.ts:56-61
       ├─ exceção: panel+swimlane → swimlaneDescriptor
       ├─ plugin type → primeiro match ≠ c4, senão unknown   registry.ts:35-41
       └─ primeiro descriptor cujo matches(type) → senão c4Descriptor
  └─ descriptor.buildData(comp, NodeBuildContext)   types.ts:20-82
  └─ descriptor.buildStyle?(comp, ctx)
  └─ nó React Flow { type: rfType, data, style }   useCanvasNodes.ts
```

### 3.2 "Criar um tipo default novo" hoje — resumo

Não existe fluxo. O que existe é o §2.3: 15–20 arquivos, três deles registries
distintos, e o restante `if/else` e uniões de tipo. O único passo com validação real é
o `const _exhaustive: never` em `components.slice.ts:226`, que falha o typecheck se você
esquecer o construtor — mas **não** cobre painel, paleta, export, i18n nem cores.

### 3.3 "Criar um componente custom novo" hoje — resumo

Ver §2.4: ~15 arquivos. O registry de descriptors cobre bem o passo 1-3 (renderização);
todo o resto é acoplamento espalhado. O contrato `NodeTypeDescriptor` já tem
`defaultSize` e `defaultData` (`types.ts:113-115`), mas **a criação não os lê** — quem
decide tamanho inicial é `buildLayoutForComponent` em `components.slice.ts`, com uma
cadeia de `if` paralela. Os dois campos só são consumidos pela ponte de plugins
(`plugin-api.ts:47-48`), que os repassa e também não os usa na criação.

---

## 4. Inconsistências e débito técnico

### 4.1 AWS é o caminho privilegiado por acidente histórico

Contagem de arquivos que referenciam cada família (`grep` por guards/catálogos/campos):
**AWS 58 · GCP 15 · Azure 15**. Consequências concretas:

- `to-export-model.ts:295-301` vs `:335-337` — AWS exporta `kind:"aws"` com ícone
  mxgraph; GCP e Azure são despachados para `c4Node`, ou seja, saem do draw.io como
  caixa C4 "system". O comentário em `:222-224` documenta isso como decisão implícita.
- `llm/component-catalog.ts:144-163` — `ALL_COMPONENT_TYPES = estrutural + C4 + AWS`.
  Um usuário não consegue pedir ao chat um elemento GCP/Azure/`process-node`/
  `external-element`: a tool `add_node` (`llm/tools.ts:46`) lista só esses.
- `llm/ir/ir.types.ts:36-56` — `IR_SEMANTIC_TYPES` é uma enumeração AWS.
- `generatePreviewSvg.ts:221` — só AWS tem forma própria no preview.
- `CanvasSearch.tsx:212` — só `isAwsType` ganha ícone na busca.
- `panels.ts:18-80` — `PANEL_KINDS` (AZ, VPC, EKS, ECS, ASG, subnets) é um catálogo
  AWS com nome genérico "panel kind", e `getPanelKindForAwsService` faz um serviço AWS
  virar painel em vez de nó (`ElementPickerModal.tsx:202-207`). GCP/Azure não têm
  equivalente: um "GKE cluster" ou um "VNet" só pode ser nó.

**Por que importa:** "adicionar um elemento default" hoje significa coisas diferentes
conforme a família, e a diferença não está escrita em lugar nenhum. Kubernetes/Redis/Kafka
como "mais uma família de nuvem" herdariam a cobertura do GCP (nó + picker), não a do AWS.

### 4.2 `sanitizeComponentType` rebaixa tipos de nuvem para `"component"` — reproduzido

`sanitize-component-type.ts:11-26` lista só os tipos built-in **não-nuvem**; `:53-57`
devolve `"component"` para qualquer outra string sem `/`. Portanto
`sanitizeComponentType("aws-compute") === "component"`.

Isso é chamado sempre, sem gate de versão, em `migrations.ts:26` →
`sanitizeCorruptedComponentTypes` → `:52-53`, que reescreve `comp.type`. O caminho de
entrada é `validateWorkspaceFile.ts:64` (abrir arquivo de workspace).

Reproduzido nesta sessão com um teste vitest descartável (fora do repo, contra
`src/` real), ambas as asserções falharam:

```
sanitizeComponentType("aws-compute")               → "component"   (esperado "aws-compute")
migrateDiagram(diagrama com um aws-compute).type   → "component"   (esperado "aws-compute")
```

**Por que importa:** qualquer generalização que passe a rotear tipos pelo sanitizador
(ou qualquer família nova) precisa que a lista deixe de ser uma constante manual. Hoje
ela já não cobre 244 tipos de categoria de nuvem. *Não classifiquei isso como bug de
produto* — não verifiquei se há outro caminho que reponha o tipo depois do import; o que
está verificado é o comportamento das duas funções.

### 4.3 Dois `CloudIcon` diferentes, com contratos diferentes

- `canvas/nodes/CloudIcon.tsx:85-107` — props `{providerId, iconName}`, com um mapa
  `FALLBACK_ICONS` que desenha "AWS"/"AZ" em SVG inline (`:15-31`).
- `cloud/components/CloudIcon.tsx` — props `{componentType, serviceIconName}`, resolve
  o provider por tipo.

Ambos vivos: 9 arquivos importam `AwsIcon`/`CloudIcon` de `canvas/nodes/CloudIcon`,
3 importam `CloudIcon` de `@/features/cloud`. `QuickInsertPopover.tsx:33-34` e
`ElementPickerSearchResults.tsx:7-8` importam **os dois** no mesmo arquivo.
`AwsIcon` (`canvas/nodes/CloudIcon.tsx:120-124`) é um wrapper AWS-only usado em 8 lugares.

**Por que importa:** o wrapper AWS-only é o motivo mecânico de vários lugares "só
funcionarem para AWS" — quem escreveu o componente pegou `AwsIcon` porque estava à mão.

### 4.4 Mapa de bordas de categoria duplicado quatro vezes

`AWS_CATEGORY_BORDERS` (`aws.provider.ts:5-22`), `GCP_CATEGORY_BORDERS`
(`gcp.provider.ts:5-18`), `AZURE_CATEGORY_BORDERS` (`azure.provider.ts:10-24`) — todos
com a forma mecânica `"<cat>": "border-l-<cat>"` — **mais** uma quarta cópia do mapa AWS
em `CustomNode/TypeConfig.ts:29-46` (`awsCategoryBorders`), que aparentemente ficou órfã
quando `CustomNode` passou a usar `cloudProvider.getCategoryStyle`
(`CustomNode/index.tsx:150`). Verificado: `awsCategoryBorders` não tem nenhum leitor no repo — é código morto.

### 4.5 Nomes que não batem com o conceito

- `flowNodeDescriptor.rfType === "flow-node"` mas o `ComponentType` é `"process-node"`
  (`flownode.descriptor.ts:7`). Há ainda dois legados migrados (`"flow-node"`,
  `"processos"`, `component-type-constants.ts:29-38`) e a chave i18n é `nodeTypes.processos`
  (em português, dentro do `en.json`).
- `CustomNode` renderiza os tipos **não** customizados (§0).
- `addComponent(type, name, parentId, position, awsService, panelKind, flowShape)` —
  o 5º parâmetro chama-se `awsService` (`actions.types.ts:51`, `components.slice.ts:410`)
  e é usado também para `gcpService` e `azureService`
  (`components.slice.ts:195-200`). Assinatura posicional de 7 argumentos, onde os três
  últimos são específicos de três tipos distintos.
- `COMPONENT_TYPE_FLOW_NODE` e `COMPONENT_TYPE_PROCESS_NODE` são a mesma string
  (`component-type-constants.ts:23-25`).

### 4.6 Duplicações e lacunas em tipos

- `TypedComponentPatch` repete `ProcessNodeComponent` duas vezes
  (`component.types.ts:276` e `:277`) — linhas idênticas.
- `ComponentPatch` (`:248-261`) omite `PluginTypedComponent`, enquanto
  `TypedComponentPatch` o inclui (`:279`). Consequência: `pluginData` não é patchável
  pelo caminho comum.
- `ALLOWED_COMPONENT_PATCH_KEYS` (`custom-component-template.utils.ts:14-49`) inclui
  `awsService` mas **não** `gcpService`, `azureService`, `customColor`, `flowShape`,
  `nodeColor`, `svgContent`, `externalLinks`, `referenceDiagramId` (esse está na lista,
  `:22`). Salvar um nó GCP/Azure ou um `process-node` como template perde o serviço /
  o shape. Também tem `"serviceId"` duplicado (`:21` e `:48`).

### 4.7 Duas paletas independentes, mantidas em paralelo

`ElementPickerModal.tsx` (563 linhas) e `QuickInsertPopover.tsx` (788 linhas) constroem
listas próprias, com filtros próprios (`pickerFilters.ts` é compartilhado, o resto não).
AWS tem view dedicada (`AwsBrowseView`, `AwsCategoryBlock`); GCP/Azure usam a genérica
(`CloudBrowseView`, `CloudCategoryBlock`) — e as duas existem lado a lado fazendo o mesmo
trabalho (`element-picker/`). Categorias primárias GCP estão hardcoded inline no JSX
(`ElementPickerModal.tsx:207-213`), enquanto as de AWS estão em constante
(`element-picker/constants.ts:20-27`).

### 4.8 Export lança exceção para 5 tipos

`to-export-model.ts:340-346`: `unknown`, `svg`, `process-node`, `external-element` e
tipos de plugin fazem `throw new Error("Unsupported component for draw.io export")`.
`validate-diagram.ts:3-14` só valida a estrutura do snapshot — não previne isso.
Não verifiquei o tratamento do erro na UI.

### 4.9 Strings de UI fora do i18n no catálogo de painéis

`lib/catalogs/panels.ts:18-80` traz `label` e `defaultName` literais, em português
("Painel", "Novo Painel") e em inglês ("Availability Zone", "EKS Cluster"), consumidos
direto pela paleta (`buildPickerOptions.ts:54, 72`) e pelo nome default
(`component-type-constants.ts:189`). Contraria a regra "no hardcoded user-visible
strings" de `AGENTS.md`.

### 4.10 Labels de tipo espalhados por quatro namespaces i18n

`nodeTypes.*` tem **3 chaves** (`db-table`, `json-viewer`, `processos`); o resto dos
rótulos mora em `quickInsert.type*`, `canvasToolbar.*`, `flowchart.shapes.*`,
`externalElement.*`. Não existe "nome legível do tipo X" como função única.

### 4.11 O próprio repo já registra o diagnóstico

`docs/architecture/extension-points.md:13-14` marca **"Node types (canvas) 🟢"** e
**"Node types (domain) 🔴 — top priority"**, e `:27` marca a paleta 🔴 e `:20` o export 🔴.
O mapeamento acima é consistente com essa leitura e a detalha por arquivo.

---

## 5. Observações para a próxima etapa (perguntas em aberto)

Sem propor arquitetura — só o que o mapeamento deixou em aberto:

1. **C4 e nuvem são o mesmo conceito ou dois?** Hoje compartilham renderer e descriptor,
   mas C4 resolve ícone por `TypeConfig` e nuvem por `cloudRegistry`. Kubernetes/Redis/Kafka
   se parecem muito mais com "nuvem sem provedor de nuvem". Vale um registry de *famílias
   de ícone/catálogo* desacoplado de "cloud provider"?
2. **O `ComponentType` precisa continuar sendo uma união fechada?** Hoje cada família nova
   exige editar a união, dois patches, os guards e o `never` do construtor. Os tipos de
   plugin já escapam disso via padrão `<id>/<nome>`; famílias internas não.
3. **`defaultSize`/`defaultData` do descriptor devem passar a governar a criação?** Estão
   declarados e ignorados; a criação tem a sua própria cadeia de `if`. Unificar elimina
   um dos dois lugares por tipo novo.
4. **Um "elemento default" é declarado ou é o resto?** O catch-all `matches: () => true`
   significa que qualquer tipo desconhecido vira C4 silenciosamente. É o comportamento
   desejado quando existirem 6 famílias?
5. **"Custom component" (template de dados) e "componente custom" (shape próprio) devem
   continuar com o mesmo nome?** Hoje compartilham a palavra e nada mais. Isso vai piorar
   quando entrarem chart e Step Functions, que são shape próprio, não template.
6. **Export: tipo novo deve poder não exportar?** Hoje 5 tipos lançam exceção, e não há
   contrato dizendo se exportar é obrigatório. Chart e Step Functions cairiam nesse buraco.
7. **O LLM deve conhecer todo tipo, ou só um subconjunto curado?** Hoje é acidente (AWS
   sim, GCP não). Se virar derivado do registry, a decisão precisa ser explícita.
8. **Paridade GCP/Azure entra antes ou depois da generalização?** Fazer a paridade no
   modelo atual significa repetir mais três vezes o mesmo trabalho AWS-shaped.

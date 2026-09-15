# Relatório — Fechamento do contrato de família (pré-F7)

Branch: `feat/element-registry-contract-close-families`  
Base: ponta de `feat/element-registry-f7-kubernetes-family` (zero commits de
implementação K8s). A branch F7 vazia foi **renomeada/reaproveitada** sob o
nome acima para deixar claro que esta fatia fecha o contrato, não entrega
Kubernetes.

Motivação: `relatorio-f7-parada-contrato.md` — o critério “família nova em ~4
pontos” falhava porque paleta, LLM, types e `cloudRegistry` ainda enumeravam
aws/gcp/azure.

## Decisões de contrato

### 1. `CloudFamilyId` — aberto + validação em runtime

`CloudFamilyId = string` (não união fechada de 3 nem de 4). Unicidade e
existência vêm de `registerCloudFamily` / `isRegisteredCloudFamily`, no mesmo
espírito de `isRegisteredElementType`.

**Trade-off (não reaberto sem contexto):** abrir o *discriminante*
`Component.type` com `string` colapsa a união `Component` (já observado na
Parte 1 da arquitetura). Por isso:

- `CloudFamilyId` / `ElementFamilyId` (parte catalog) ficam abertos.
- `ComponentType` permanece fechado para structural + C4 + aws/gcp/azure +
  plugins; uma família nova faz *cast* do category id **no arquivo da
  família** (`as ElementTypeId`), não edita consumidores.
- `RegisteredElementTypeId` continua listando as categorias das três famílias
  atuais (espelho para `Extract` / exhaustiveness de export). Categorias de
  famílias novas **não** entram nessa lista — o registry em runtime é a fonte
  de verdade (`cloud-family-contract.test.ts`).

### 2. `cloudRegistry` — view derivada, não registry paralelo

Sobrevive como fachada (`forId` / `allProviders` / `isCloudType`) porque
CardNode, CloudIcon e ComponentPanel já dependem dela. Deixa de ser curada em
`cloud/bootstrap.ts`: `registerCloudFamily` empurra um
`CloudProviderAdapter` derivado. Providers hardcoded em
`cloud/providers/*/ *.provider.ts` deixam de ser registrados no boot (catálogos
e icon resolvers continuam como dados das family defs).

### 3. Paleta — tabs / busca / QuickInsert

`buildCategoryNavItems` itera `allCloudFamilies()`. `ElementCategory` perdeu
Aws/Gcp/Azure; tabs de família usam `paletteCategoryId`. Browse/search usam
`cloudRegistry` / `allCloudFamilies()`.

**Exceção documentada:** AWS mantém `AwsBrowseView` + caminho de busca
próprio por causa do remapeamento panel-kind (VPC → swimlane, etc.). Isso é
comportamento AWS, não enumeração de “quais famílias existem”.

### 4. LLM — `allComponentTypes` / catálogo

Loops em `allCloudFamilies()`. Wrappers `awsRegisteredTypes` /
`buildAwsCatalogCompact` etc. ficam `@deprecated` por estabilidade de
call-sites.

### 5. Export — piso explícito

Documentado em `CloudFamilyExport`: família nova que devolve
`kind: "image" | "passthrough"` **não** precisa editar
`export-core/model.ts` / `cell-builders.ts`. Kind nativo (`aws`) é upgrade
opcional.

## Prova de aceite

`cloud-family-contract.test.ts` registra `__test-family__` em `beforeEach`,
remove em `afterEach`, e verifica:

- registry + `cloudRegistry` derivados
- tab na paleta via `buildCategoryNavItems`
- presença no catálogo LLM
- export `passthrough`

Sem editar enums, LLM lists ou export-core — só a definição +
`registerCloudFamily`.

## Performance (baseline)

`cloud-family-perf.baseline.test.ts`: `cloudRegistry.allProviders()` (cached
no register) vs rebuild de adapters a cada chamada. Cached é estritamente
mais barato; adapters não são recriados no hot path do inspector/picker.

## Grep final (`"aws"` / `"gcp"` / `"azure"` fora de family defs)

Legítimos:

| Local | Por quê |
| --- | --- |
| `families/{aws,gcp,azure}/*`, `cloud/providers/*` | definição / catálogo da família |
| `AwsBrowseView` / panel-kind / `family.id === "aws"` na paleta | UX AWS (swimlane), não lista de famílias |
| `export-core` kind `"aws"`, import draw.io | kind nativo AWS |
| `IconPickerModal` tab aws, `PanelNode` aws icons | seletor de ícone AWS / painéis |
| `RegisteredElementTypeId` literais aws-/gcp-/azure- | espelho tipado das três famílias atuais |
| golden snapshots / migration tests | fixtures |
| wrappers LLM `@deprecated` | compat de call-site |
| IR LLM filtrado a `family === "aws"` | IR ainda AWS-only (fora desta fatia) |

Não restam arrays `["aws","gcp","azure"]` montando nav/LLM/bootstrap.

## Gates

- `npm run typecheck` — ok
- `npm run test` (elements + contract) — ok
- `npm run plugins:sync-check` / `sync-shared.mjs --check` — ok
- Lint: erros pré-existentes em persistence/collaboration; nenhum novo bloqueante nesta fatia

## Fora de escopo (próxima sessão)

- Kubernetes (F7 de conteúdo)
- Abrir `ComponentType` por completo / unificar `Aws|Gcp|AzureComponent`
- Deploy F6b, oss/Redis/Kafka, tools LLM
- PR (empilhar fatias)

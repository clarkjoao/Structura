# Mapeamento — store do diagrama, JSON serializado e exporters

**Data:** 2026-09-15
**Base:** `feat/element-registry-complete` @ `0c18981`
**Escopo:** descoberta. Nenhum código de produto alterado; dois probes de teste
reversíveis foram executados e removidos (working tree limpa ao final).

## Confirmação da base

A branch da sequência de elementos **não está mergeada** em `main`, mas é um
fast-forward puro: 85 commits à frente, zero commits de `main` ausentes
(`git merge-base main HEAD` = `3a0f891`, o próprio tip de `main`).

Mapear a partir de `main` produziria um documento que descreve um estado que já
não existe — sem `cloudServiceId`, sem `ElementDescriptor.export`. Como a
instrução era documentar a forma **atual** depois da migração, e a branch é um
superset estrito de `main`, o mapeamento é feito sobre ela. Nada aqui depende de
trabalho descartado.

Estado de outros trabalhos relacionados, confirmado e **não mapeado**:

| Trabalho              | Estado real                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unify-drawio-export` | **Landed**. `src/lib/export-core/` existe, ADR-0009 aceito, guarda de CI ativa (`plugins:sync-check` passa). Reconferido abaixo — divergiu do que o ADR documenta.                                                                        |
| ASL                   | Existe em `origin/feat/asl` (1 commit, `8c83bc3`, 2026-08-24), **não mergeada**, base `0dcb9df` — 26 commits atrás de `main`. 19 arquivos (`src/lib/asl/*`, `asl/*.schema.yaml`, `openspec/changes/import-export-asl/`). Ausente do HEAD. |
| CALM                  | Nenhuma ocorrência no repo.                                                                                                                                                                                                               |
| Structurizr           | Nenhuma ocorrência no código. Documentado como se existisse — ver §4.4.                                                                                                                                                                   |

---

## 1. A store do diagrama

### 1.1 Onde o estado vive

Uma store zustand única (`useDiagramStore`), com `AppState` em
`src/features/diagram/store/store.types.ts:39-77`. O estado é de **workspace**,
não de diagrama: um diagrama é uma entrada em `state.diagrams`.

| Campo de `AppState`                                                        | Persistido | Conteúdo                                                      |
| -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `diagrams: Record<string, Diagram>`                                        | ✅         | Todos os diagramas do workspace                               |
| `folders: Record<string, Folder>`                                          | ✅         | Árvore de pastas                                              |
| `userTemplates: Record<string, UserTemplate>`                              | ✅         | Templates do usuário                                          |
| `serviceCatalog: Record<string, ServiceDefinition>`                        | ✅         | Catálogo de serviços de **negócio**                           |
| `activeDiagramId`                                                          | ✅         | —                                                             |
| `past` / `future: DiagramSnapshot[]`                                       | ❌         | Undo/redo; zerados no rehydrate (`persist.config.ts:502-503`) |
| `clipboard`                                                                | ❌         | —                                                             |
| `_lastUndoRedoAt`, `_lastLayoutWriteAt`, `_flowSession`, `_flowSewNotices` | ❌         | Sinais efêmeros para o canvas                                 |

O recorte persistido é `partializeState` (`persist.config.ts:37-45`).

Duas stores **fora** desse recorte guardam dados que um diagrama referencia:

- `useIconStore` (`store/icon-store.ts:70`, chave `structura:icon-library`) —
  ícones SVG/lucide customizados. `Component.customIconId` aponta para cá.
- `elementPresetStore` (`infrastructure/persistence/elementPresetStore.ts:6`,
  chave `element_presets`) — presets de elemento.

### 1.2 Fatias reais

`store/slices/index.ts` exporta 15 fatias. Nenhuma delas é "uma parte do modelo
do diagrama" no sentido de dado: são **grupos de ações** sobre o mesmo objeto
`Diagram`. O modelo de dados está inteiro em `Diagram`.

| Fatia                          | Linhas | Responsabilidade                                                              |
| ------------------------------ | ------ | ----------------------------------------------------------------------------- |
| `components.slice.ts`          | 515    | CRUD de componentes; `buildComponentForType` (fábrica por tipo, via registry) |
| `component-parenting.slice.ts` | 258    | Reparentagem em painéis/api-groups                                            |
| `component-links.slice.ts`     | 82     | `externalLinks`, `linkedDiagramId`                                            |
| `connections.slice.ts`         | 105    | CRUD de conexões e regras de origem                                           |
| `flows.slice.ts`               | 502    | Flows (scripts de leitura); mantém `flow.mermaid`                             |
| `layout.slice.ts`              | 343    | `nodeLayouts` / `edgeLayouts`, auto-layout (ELK)                              |
| `scenes.slice.ts`              | 290    | `SceneDiff` (diffs nomeados sobre o snapshot base)                            |
| `clipboard.slice.ts`           | 251    | Copy/paste **e** os três primitivos de ingestão (§3.5)                        |
| `history.slice.ts`             | 158    | Checkpoints undo/redo (`DiagramSnapshot`)                                     |
| `services.slice.ts`            | 211    | Catálogo de serviços de negócio                                               |
| `patterns.slice.ts`            | 176    | Inserção de padrões                                                           |
| `generated-graph.slice.ts`     | 165    | `insertGeneratedGraph` — ingestão de grafo externo (LLM hoje)                 |
| `diagram.slice.ts`             | 146    | CRUD de diagramas, `importDiagram`                                            |
| `folders.slice.ts`             | 55     | Pastas                                                                        |
| `icons.slice.ts`               | 40     | Só limpeza de referências; o CRUD está no `icon-store`                        |
| `userTemplates.slice.ts`       | 34     | Templates                                                                     |

### 1.3 Forma de um `Diagram`

`src/features/diagram/model/diagram.types.ts:146-163`:

```ts
interface Diagram {
  id;
  name;
  description?;
  level;
  domain?;
  createdAt;
  updatedAt;
  snapshot: ModelDraft; // o modelo de domínio
  nodeLayouts: Record<string, NodeLayout>; // geometria
  edgeLayouts: Record<string, EdgeLayout>; // waypoints / labelOffset
  viewport: { x; y; zoom }; // câmera
  folderId?;
  scenes?;
  activeSceneId?;
  compareSceneId?;
}
```

`ModelDraft` (`diagram.types.ts:92-97`) é o núcleo semântico:
`components`, `connections`, `flows`, `iconLibrary` — todos `Record<id, T>`.

> `snapshot.iconLibrary` é **legado vazio** no fluxo normal: a migração
> `migrateIconLibraryToGlobalStore` (`persist.config.ts:463-487`) esvaziou o
> campo e moveu tudo para `useIconStore`. Ele é repovoado apenas no export
> (§2.2) e zerado de novo no import (`normalize-imported-diagram.ts:69`).

### 1.4 `Component` — forma pós-migração de elementos

`model/component.types.ts`. União discriminada por `type` (linha 265-282), 17
membros. `BaseComponent` (55-81) carrega os campos comuns.

| Campo de `BaseComponent`                                      | Observação                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`, `name`, `description`, `parentId`                       | Núcleo                                                             |
| `serviceId?`                                                  | **Catálogo de serviços de negócio** (v11). Não é serviço de nuvem. |
| `customIconId?`, `tags?`, `locked?`, `hidden?`, `templateId?` | —                                                                  |
| `linkedDiagramId?`                                            | Drill-down C4                                                      |
| `handleOrder?`                                                | Ordem de handles — dado de renderização dentro do domínio          |
| `externalLinks?`                                              | —                                                                  |
| `x?`, `y?`                                                    | **Vestigial.** Ver §1.6                                            |

Os cinco tipos de família de nuvem (`AwsComponent`, `GcpComponent`,
`AzureComponent`, `K8sComponent`, `OssComponent`, linhas 120-158) são
estruturalmente idênticos: `type: <Família>CategoryId` +
`cloudServiceId?` + `technology?` + `customColor?`.

`cloudServiceId` é o resultado do F6b: unificou `awsService` / `gcpService` /
`azureService` em um só campo (migração v13,
`persist.config.ts:365-390`). A leitura tolerante é
`resolveCloudServiceId` (`model/cloud-service-id.ts:39-46`), que lê
`cloudServiceId ?? awsService ?? gcpService ?? azureService` e
**nunca** cai em `serviceId`. A escrita é gated no build
(`CLOUD_SERVICE_ID_WRITE_FLAG`, `cloud-service-id.ts:56`).

`PluginTypedComponent` (258-263) é o degrau aberto: `type: "<pluginId>/<name>"`
com `pluginData?: Record<string, unknown>` preservado verbatim.

**Dívida:**

- `TypedComponentPatch` repete `ProcessNodeComponent` duas vezes
  (`component.types.ts:316` e `:317`) — a segunda linha é morta.
- `ComponentPatch` (284-299) omite `PluginTypedComponent`, que está presente em
  `TypedComponentPatch` (318). Um patch tipado de plugin não é expressável no
  tipo largo.
- `FlowNodeShape` (229-238) documenta sintaxe Mermaid em comentário dentro do
  modelo de domínio (`// Mermaid: [text]`). Contraria ADR-0006
  ("o modelo nunca referencia nenhum formato externo"), embora seja só comentário.

### 1.5 `Connection`, `NodeLayout`, `EdgeLayout`, `Flow`

| Entidade     | Arquivo                     | Forma                                                                                                                                          |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Connection` | `connection.types.ts:20-32` | `id, sourceId, targetId, label`, + `technology?`, `intent?`, `direction?`, `communicationType?`, `transportPreset?`, `style?: ConnectionStyle` |
| `NodeLayout` | `layout.types.ts:25-32`     | `elementId, x, y, zIndex?, width?, height?`                                                                                                    |
| `EdgeLayout` | `layout.types.ts:16-23`     | `points?: EdgeControlPoint[]`, `pathType?`, `labelOffset?`                                                                                     |
| `Flow`       | `flow.types.ts:96-105`      | `id, name, mermaid, diagramId, steps: Record<id, FlowStep>, entryStepId?`                                                                      |
| `SceneDiff`  | `diagram.types.ts:133-144`  | `addedComponents`, `addedConnections`, `removedComponentIds`, `removedConnectionIds`, `nodeLayouts`, `viewport?`                               |

**`Flow.mermaid: string` é obrigatório** (`flow.types.ts:99`). O comentário em
`flows.slice.ts:58-63` chama o campo de _cache_ recomputado por
`stepsToMermaid`, mas ele é persistido dentro de `snapshot.flows` **e** é
gravável: `updateFlow` com `patch.mermaid` e sem `patch.steps` re-deriva os
steps a partir do texto (`flows.slice.ts:183-186`). Ou seja, um formato externo
é campo de primeira classe do modelo, nos dois sentidos.

### 1.6 React Flow vs. modelo de domínio

A separação é real e explícita, com uma exceção vestigial.

| Renderização                                                    | Domínio                |
| --------------------------------------------------------------- | ---------------------- |
| `nodeLayouts` (x/y/w/h/zIndex)                                  | `snapshot.components`  |
| `edgeLayouts` (waypoints, labelOffset)                          | `snapshot.connections` |
| `viewport`                                                      | —                      |
| `ElementCanvasSlice` no descriptor (`element.types.ts:217-263`) | `ElementModelSlice`    |

A projeção acontece em `canvas/nodes/useCanvasNodes.ts:463-490`: monta
`{ id: comp.id, type: descriptor.rfType, position: stablePosition, parentId, data }`.
Posição vem **sempre** de `nodeLayouts` (`useCanvasNodes.ts:451`,
`canvas/core/projectReadDiagram.ts:46`), nunca de `Component.x/y`.

Durante o drag a store fica um frame atrás do ponteiro, então o canvas mantém
uma cópia local autoritativa (`hooks/useLocalNodes.ts`), invalidada por
`_lastLayoutWriteAt` / `_lastUndoRedoAt` (`store.types.ts:49-62`).

**`Component.x` / `Component.y` são vestigiais.** Nada no caminho de criação os
escreve; o único leitor real é
`features/plugins/snapshots.ts:28-29`, como fallback quando não há layout.
`UserTemplateComponent` já os exclui por construção
(`diagram.types.ts:106`). São dois campos de geometria dentro do modelo de
domínio que sobrevivem por inércia.

Vazamento na direção oposta: `BaseComponent.handleOrder` (`component.types.ts:70-73`)
é ordenação de handles do React Flow, persistida no domínio — e lida pelo
exporter drawio (`to-export-model.ts:181-185`) para reproduzir a mesma
distribuição de âncoras.

### 1.7 `PERSIST_SCHEMA_VERSION` e a cadeia de migrações

`PERSIST_SCHEMA_VERSION = 13` (`persist.config.ts:31`).
`CURRENT_SCHEMA_VERSION` é um alias (`:33`).

O padrão tem **duas camadas, e a maior parte do trabalho não é versionada**:

1. **`migrate` do middleware persist** (`persist.config.ts:712-724`) — o único
   ponto que despacha por versão. Trata exatamente dois casos:
   `fromVersion < 5` (edgeLayouts de array para record) e `fromVersion < 6`
   (waypoints para points).

2. **`mergePersistedState`** (`persist.config.ts:490-536`) — roda **todas** as
   21 migrações a cada rehydrate, em ordem fixa (uma, `migrateIconLibraryToGlobalStore`,
   é condicionada a `hasEmbeddedIconLibraryInDiagrams`; as outras 20 são incondicionais). Não
   consulta `fromVersion`. A corretude depende de cada migração ser idempotente
   por construção (ex.: `migrateUnifyCloudServiceId` deleta os campos legados
   depois de copiar, então a segunda passada é no-op). Há teste de idempotência
   (`persist.migrations.test.ts:305-306`).

Consequência prática: o número 13 é quase decorativo. Ele não seleciona
migrações, só marca o payload gravado (`buildPersistStoragePayload`,
`persist.config.ts:47-55`). Duas migrações são exportadas para os testes
(`migrateEdgeWaypointsToPoints`, `migrateUnifyCloudServiceId`); as demais são
privadas.

---

## 2. O JSON gerado por diagrama

### 2.1 Existe camada própria de serialização

Sim: `src/lib/export-service/export-json.ts` (49 linhas). O nome do arquivo
confere.

```
exportJSON(diagram, serviceCatalog)
  → validateDiagram              (validate-diagram.ts — 3 checagens)
  → diagramWithResolvedScene     (achata a cena ativa)
  → resolveUsedIconLibrary       (lê useIconStore)
  → resolveUsedServices          (manifesto de serviços de negócio)
  → createVersionedDiagram       (envelope)
  → JSON.stringify(_, null, 2)
```

Envelope (`infrastructure/persistence/versions.ts:12-23`), verificado por probe:

```json
{
  "$schema": "structura://diagrams/v1",
  "schemaVersion": 1,
  "data": {/* Diagram */},
  "exportedAt": "...",
  "services": [/* opcional */]
}
```

**`data` é o objeto `Diagram` interno, sem tradução.** A camada de serialização
é um envelope + dois enriquecimentos, não um formato próprio.

`exportJSONUnversioned` (`export-json.ts:37-48`) **não tem nenhum chamador** —
código morto.

### 2.2 Auto-suficiência

Parcial, e assimétrica por facet. Medido por probe sobre `exportJSON`:

| Facet                           | Viaja no JSON?     | Evidência                                                                                        |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| Componentes, conexões           | ✅                 | `data.snapshot`                                                                                  |
| Flows                           | ✅ sempre          | probe: `flows: ["f1"]` nos dois cenários                                                         |
| Layouts, viewport               | ✅                 | `data.nodeLayouts` / `edgeLayouts` / `viewport`                                                  |
| Ícones customizados             | ✅                 | `resolveUsedIconLibrary` repovoa `snapshot.iconLibrary` (`export-json.ts:14,20`)                 |
| Serviços de negócio             | ✅ como manifesto  | `services[]` com `repositoryUrl`/`github.repoId` para rematch (`service-manifest.types.ts:3-10`) |
| **Cenas**                       | ⚠️ **condicional** | Ver abaixo                                                                                       |
| Definição dos tipos de elemento | ❌                 | Só o id de `type`                                                                                |
| `cloudServiceId` → ícone/label  | ❌                 | Depende do registry em runtime                                                                   |

**Cenas: perda condicional.** `exportJSON` chama `diagramWithResolvedScene`
(`export-json.ts:13`), que quando há cena ativa achata o diagrama e devolve
`scenes: undefined` (`scene.utils.ts:69-84`). Probe:

| Cenário                     | `data.scenes`                     | `data.snapshot.flows` |
| --------------------------- | --------------------------------- | --------------------- |
| Diagrama com cena **ativa** | `DROPPED` (todas, não só a ativa) | preservados           |
| Diagrama sem cena ativa     | `["sc1"]`                         | preservados           |

Exportar o mesmo diagrama com uma cena aberta ou fechada produz arquivos com
conteúdo semântico diferente, sem nada no envelope dizendo qual foi.

Sobre dependência de estado externo: o JSON **não** é auto-descritivo para um
consumidor externo. Um componente `{ type: "aws-compute", cloudServiceId: "lambda" }`
só vira "AWS Lambda, categoria Compute, ícone X" quando resolvido contra o
registry carregado em runtime (`elements/bootstrap.ts`) — 61 descriptors em 7
famílias (aws 16, azure 13, gcp 12, structural 10, c4 4, k8s 4, oss 2). Nada
disso viaja no arquivo. Para o Structura relendo o próprio arquivo, isso é
indiferente; para qualquer outro sistema, `"aws-compute"` é uma string opaca.

### 2.3 Versionamento do formato exportado

Existe e é separado do interno — mas está parado.

| Versão                     | Valor  | Onde                   | O que versiona                     |
| -------------------------- | ------ | ---------------------- | ---------------------------------- |
| `PERSIST_SCHEMA_VERSION`   | **13** | `persist.config.ts:31` | Forma da store no localStorage     |
| `DIAGRAM_SCHEMA_VERSION`   | **1**  | `versions.ts:5`        | Envelope `structura://diagrams/v1` |
| `WORKSPACE_SCHEMA_VERSION` | **2**  | `versions.ts:9`        | Manifesto de workspace             |

O envelope está em v1 desde sempre, enquanto o payload que ele embrulha
atravessou 13 versões internas. A cadeia de migração do formato de arquivo
(`infrastructure/persistence/migrations.ts`) tem **exatamente uma** migração, e
ela é vazia: `migrateV0toV1` (`migrations.ts:92-98`) retorna o diagrama sem
transformação. O único trabalho real ali é `sanitizeCorruptedComponentTypes`
(`:44-86`), que roda sempre e é independente de versão.

**Probe executado** (arquivo v1 carregando um componente com o campo legado
`awsService`, como qualquer export anterior ao F6b):

```
validateDiagramFile(...) →
  { awsService: "lambda", cloudServiceId: undefined, type: "aws-compute" }
```

A migração v13 não roda no caminho de import de arquivo. O diagrama funciona
mesmo assim porque `resolveCloudServiceId` ainda lê `awsService`
(`cloud-service-id.ts:42`) e porque, ao ser gravado na store e reidratado na
próxima carga, `mergePersistedState` normaliza. Ou seja: o formato de arquivo
não tem migração própria; ele se cura de carona no ciclo de persistência
interna. Um consumidor externo do arquivo não tem essa carona.

`VersionedWorkspace` (`versions.ts:26-32`) e `unwrapDiagram` (`:57-73`) não têm
chamador de produção — código morto. Nota adicional: o tipo declara
`$schema: "structura://workspace/v1"` enquanto `WORKSPACE_SCHEMA_VERSION = 2`,
e `fileSystemBoot.ts:107` faz `as 1 | 2` para contornar.

### 2.4 Outras serializações de diagrama no repo

Além do JSON exportado, o mesmo `Diagram` é serializado por **cinco** caminhos
com envelopes e políticas diferentes:

| Caminho               | Envelope                                                             | Versionado   | Arquivo                                     |
| --------------------- | -------------------------------------------------------------------- | ------------ | ------------------------------------------- |
| Persistência          | `{ state, version: 13 }`                                             | ✅           | `persist.config.ts:47-55`                   |
| Export JSON           | `{ $schema, schemaVersion: 1, data, exportedAt, services? }`         | ✅ (parado)  | `export-json.ts:16-30`                      |
| Share link `#share=`  | LZString de `Diagram` com `activeSceneId` e `hidden:false` removidos | ❌           | `share-url/encode.ts:56-79`                 |
| Viewer/embed `#data=` | LZString de `Diagram` **cru**                                        | ❌           | `share-url/viewer.ts:17`, `encode.ts:18-20` |
| Template de usuário   | `{ _magic: "structura-template-v1", exportedAt, template }`          | ✅ (próprio) | `utils/template-sharing.ts:4-20`            |

Os dois payloads de URL divergem em forma. O comportamento acaba igual porque o
viewer resolve a base independentemente do que chegue — provado em
`viewer/viewer-opens-on-base.test.ts:102-137`, que renderiza via
`useReadDiagramFlow` — mas o teste só exercita `generateShareUrl`; o caminho
`#data=` não tem cobertura equivalente.

---

## 3. Os exporters existentes

### 3.1 Inventário completo

Busca ativa por toda superfície de export/import, não só a lista do briefing:

| Formato                 | Direção         | Entrada                                    | Registro                                                          |
| ----------------------- | --------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| JSON nativo             | export + import | `export-json.ts` / `useWorkspaceImport.ts` | `DiagramExportFormat`                                             |
| draw.io (mxGraph)       | export + import | `export-drawio.ts` / `import-drawio.ts`    | `DiagramExportFormat` / colar no canvas                           |
| Mermaid (flows)         | export          | `export-mermaid.ts`                        | `DiagramExportFormat`, só quando há flows (`ExportModal.tsx:107`) |
| Mermaid flowchart       | import          | `utils/import-mermaid-flowchart.ts`        | `FlowPanel` / `MermaidImportDialog`                               |
| Mermaid sequence        | import          | `utils/import-mermaid-sequence.ts`         | idem                                                              |
| LeanIX (drawio via API) | export          | `plugins/structura-plugin-leanix`          | Botão próprio na toolbar                                          |
| Template de usuário     | export + import | `utils/template-sharing.ts`                | Biblioteca de templates                                           |
| IR do LLM               | export          | `features/llm/ir/ir-export.ts`             | Debug/fixtures                                                    |
| Share link / embed      | export          | `lib/share-url/`                           | Modais de share/embed                                             |
| Plugin exporters        | export          | `ExporterContribution`                     | `io-registry.ts`                                                  |
| Plugin importers        | import          | `ImporterContribution`                     | `io-registry.ts`                                                  |

Nenhum plugin no repo registra `registerExporter`/`registerImporter` hoje: o
LeanIX chama seu próprio `exportDrawio` direto do botão
(`LeanixToolbarButton.tsx:330`).

Uma **segunda IR** existe e não é do sistema de export: `DiagramIR`
(`features/llm/ir/ir.types.ts:142-146`), com validador, prompt e aplicador
próprios. É o caminho de _entrada_ de um formato abstrato. Mantém o nome de
fio `awsService` (`ir.types.ts:118`), mapeado para `cloudServiceId` só no
apply (`ir-to-component.ts:92`), e não tem campo de serviço para gcp/azure/k8s/oss.

### 3.2 drawio / mxGraph — `src/lib/export-core/`

16 arquivos, 2278 linhas. Estado atual reconferido:

| Arquivo                                                        | Linhas | Papel                                                               |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| `model.ts`                                                     | 243    | A IR: `ExportModel`, `ExportNode` (união de 12 kinds), `ExportEdge` |
| `cell-builders.ts`                                             | 322    | `buildCell` — switch em `node.kind`                                 |
| `constants.ts`                                                 | 350    | `C4_META`, `AWS_RESICON`, `FLOW_SHAPE_STYLES`, `THEME`, `CONFIG`    |
| `styles.ts`                                                    | 236    | Strings de estilo mxGraph por kind                                  |
| `geometry.ts`                                                  | 169    | Bounding box, compensação A1, containers                            |
| `build.ts`                                                     | 144    | `buildMxGraphXml(model, { wrapper })`                               |
| `edge-builder.ts`                                              | 83     | Célula de aresta                                                    |
| `color-utils.ts`, `note-format.ts`, `xml-utils.ts`, `types.ts` | 143    | Utilidades                                                          |

A guarda de pureza existe e é real: `build.test.ts:55-62` falha se qualquer
arquivo de `export-core` importar de `@/features` ou `@/plugins`.

**Kinds atuais (`model.ts:21-33`):** `c4`, `aws`, `panel`, `swimlane`,
`apiGroup`, `endpoint`, `dbTable`, `note`, `jsonViewer`, `image`,
`passthrough`, `flowNode`. O ADR-0009 documenta **oito** — `swimlane`, `image`,
`passthrough` e `flowNode` entraram depois e o ADR não foi atualizado.

### 3.3 Como um `ExportNode` se liga a um elemento registrado

Pelo descriptor, não por switch. `ElementExportSlice`
(`elements/element.types.ts:314-324`):

```ts
export interface ElementExportSlice {
  drawio: { toExportNode: (comp: Component, base: ExportGeometry) => ExportNode };
}
```

O adapter consulta o registry (`to-export-model.ts:226-237`):

```ts
if (isRegisteredElementComponent(c)) {
  const node = getElement(c.type)!.export.drawio.toExportNode(c, base);
  if (node.kind === "c4" && node.serviceId) {
    /* preenche serviceName do catálogo */
  }
  return node;
}
if (isPluginTypedComponent(c))
  throw new Error(`Unsupported component for draw.io export: ${c.type}`);
const _exhaustive: never = c; // exaustividade em tempo de compilação
```

**O registry exige `export.drawio` para registrar**
(`element.registry.ts:86-91`): _"export.drawio is required — every element must
declare how it maps to a draw.io shape."_ Um elemento sem mapeamento draw.io
não pode existir. É o acoplamento mais forte do sistema.

Mapeamento por família — apenas 16 sítios de declaração para os 61 elementos,
porque as famílias geram descriptors a partir de catálogos:

| Família         | Sítio                               | `kind` emitido                                                                |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| c4 (4)          | `families/c4/c4.family.ts:120`      | `c4`                                                                          |
| aws (16)        | `families/aws/aws.family.ts:101`    | `aws` (ícone mxgraph aws4 pré-resolvido)                                      |
| gcp (12)        | `families/gcp/gcp.family.ts:75`     | `image` (data URI) ou `passthrough`                                           |
| azure (13)      | `families/azure/azure.family.ts:73` | **sempre** `passthrough`                                                      |
| k8s (4)         | `families/k8s/k8s.family.ts:69`     | `image` ou `passthrough`                                                      |
| oss (2)         | `families/oss/oss.family.ts:73`     | `image` ou `passthrough`                                                      |
| structural (10) | `structural/*.element.ts`           | um cada; `panel` emite `panel` **ou** `swimlane` (`panel.element.ts:230-241`) |

`build-cloud-family-descriptors.ts:117` apenas repassa `family.export.toExportNode`
para cada descriptor da família.

**`cloudServiceId` não entra na IR.** Nenhum dos 12 `ExportNode` tem campo para
ele — grep por `cloudServiceId` em `src/lib/export-core/` e
`src/lib/export-service/` retorna zero ocorrências em código de produção (só
fixtures de teste e o lado de _import_). O que sobrevive:

| Família                             | O que carrega a identidade do serviço no XML                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| aws                                 | `awsIcon` — o id do ícone mxgraph, não o `cloudServiceId`                                                        |
| gcp / k8s / oss (com ícone)         | um data URI base64 em `ImageNode.dataUri`; `ImageNode` (`model.ts:138-144`) não tem `originType` nem `serviceId` |
| gcp / k8s / oss / azure (sem ícone) | `PassthroughNode.originType` = o **tipo**, nunca o serviço                                                       |

O campo central do modelo depois da migração de elementos é descartado na
fronteira de export, em todas as famílias.

### 3.4 Plugin LeanIX — o padrão "core sincronizado"

`plugins/structura-plugin-leanix/`. Mecanismo (ADR-0009, opção A):
`scripts/sync-shared.mjs:19-20` copia `src/lib/export-core/*.ts` (exceto testes)
para `src/generated/export-core/` com banner DO-NOT-EDIT; `--check` falha se
estiver stale. **Verificado nesta sessão: `sync-shared --check` passa** — o core
está em sincronia.

Mas o que é sincronizado é só o **core**. O adapter não é:

|                  | App                                           | Plugin                                                                                                                                  |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada          | `Diagram` + layouts + `serviceCatalog`        | `DiagramSnapshot` (achatado, `plugin.types.ts:97-103`)                                                                                  |
| Dispatch         | Registry (`getElement(c.type).export.drawio`) | Heurística de string, 9 branches (`to-export-model.ts:62-101`)                                                                          |
| Kinds emitidos   | 12                                            | 8 — `panel`, `apiGroup`, `aws`, `c4`, `endpoint`, `dbTable`, `jsonViewer`, `note`; nunca `swimlane`, `image`, `passthrough`, `flowNode` |
| Estilo de aresta | `getEffectiveConnectionStyle` + roteamento    | constantes fixas (`to-export-model.ts:118-131`)                                                                                         |
| `intent`         | Campo do modelo                               | Inferido de substrings de label/description (`inferIntent`, `:105-116`)                                                                 |
| Testes           | `export-drawio.test.ts` (765 l.) + golden     | **nenhum**                                                                                                                              |

Um componente gcp/azure/k8s/oss no plugin cai no fallback final e vira `note`
(`to-export-model.ts:101`). O spec `openspec/specs/drawio-export-core/spec.md:83-94`
exige que _"the app adapter and the plugin adapter SHALL produce the same node
kinds"_ — não há teste de paridade cruzada, e a paridade não se sustenta.

**Sobre o padrão ser generalizável:** a resposta que o código dá é que ele
resolve o problema de _bundle isolado_ (IIFE sem alias `@`, sem workspaces) e
não o problema de _multi-formato_. O ADR-0009 diz isso explicitamente
("a relocation + import-path change, not a rewrite", opção B em aberto). O que
o mapeamento acrescenta é que a parte que realmente diverge não é o core
sincronizado — é o adapter, que ninguém sincroniza e que já divergiu.

### 3.5 Import — o que existe e como se relaciona

Três primitivos de ingestão na store, com capacidades diferentes:

| Primitivo              | Assinatura                                                                             | Usado por                                                    |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `importDiagram`        | `(Diagram) => Diagram` (`diagram.slice.ts:60-77`)                                      | Import de arquivo JSON                                       |
| `importDrawioResult`   | `(Component[], Connection[], NodeLayout[]) => string[]` (`clipboard.slice.ts:175-198`) | Colar drawio, import mermaid flowchart, **import de plugin** |
| `insertGeneratedGraph` | `(GeneratedNodeInput[], GeneratedEdgeInput[])` (`generated-graph.slice.ts:66`)         | Gerador LLM                                                  |

`GeneratedNodeInput` (`generated-graph.slice.ts:22-36`) é a superfície de
entrada mais neutra de formato do repo: `type`, `name`, `parentExternalId`,
`panelKind`, `technology`, `cloudServiceId`, `x/y/w/h`, e devolve o mapa
`externalId → id` real. É a única ingestão que carrega `cloudServiceId`
explicitamente no contrato.

Caminhos de entrada e o que cada um valida:

| Caminho                                        | Validação                                                               | Sanitiza `type`?        | Migra?        |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- | ------------- |
| Arquivo JSON (`useWorkspaceImport.ts:76-111`)  | `validateDiagramFile` + `normalizeImportedDiagram` + relink de serviços | ✅ (`migrations.ts:26`) | v0→v1 (no-op) |
| Colar drawio (`useCopyPasteShortcuts.ts:137`)  | nenhuma além do parser                                                  | ❌                      | ❌            |
| Import mermaid (`FlowPanel.tsx:226`)           | parser                                                                  | ❌                      | ❌            |
| Import de plugin (`run-plugin-import.ts:104`)  | tipo default `"unknown"` (`:30`)                                        | ❌                      | ❌            |
| Patch de colaboração (`useCollabStoreSync.ts`) | merge por entidade                                                      | ❌                      | ❌            |

ADR-0006 estabelece: _"Review rule: imported data that hasn't passed
normalization/validation may not enter the store."_ Quatro dos cinco caminhos
escrevem componentes direto em `d.snapshot.components` sem passar por
`normalizeImportedDiagram` nem `sanitizeComponentType`
(`clipboard.slice.ts:186-190`).

**`import-drawio.ts` (665 linhas) não tem nenhum teste.** `parseDrawioXml` não
aparece em nenhum `*.test.ts` nem em specs Cypress. Do outro lado,
`export-drawio.test.ts` tem 765 linhas mais um golden snapshot.

O importer reconhece 5 formas (`PendingVertex.kind`, `import-drawio.ts:275`):
`c4`, `panel`, `aws`, `panel-mxcell`, `unknown`. O exporter emite 12.

**`structuraType` é escrito e nunca lido.** `PassthroughNode` documenta
(`model.ts:149-152`) que o atributo existe _"so a future import can recover the
exact type"_; `cell-builders.ts:314` o escreve. Grep por `structuraType` em
`import-drawio.ts`: zero. A informação que tornaria o round-trip recuperável
está no arquivo e é ignorada na volta.

---

## 4. Pontos de atrito para multi-formato e bilateralidade

### 4.1 O que é neutro e o que é drawio

`export-core/index.ts:1-8` e `model.ts:1-8` descrevem a IR como _"neutral export
IR"_. Ela é neutra de `@/features` — isso é verdade e está testado
(`build.test.ts:55`). Ela **não** é neutra de formato:

| Evidência                                                                                                                | Local                               |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `AwsNode.awsIcon`: _"Pre-resolved mxgraph aws4 icon id"_                                                                 | `model.ts:60-61`                    |
| `exitX/exitY/entryX/entryY` documentados em semântica draw.io (_"0 = left edge, 0.5 = center… null = top, -1 = bottom"_) | `model.ts:223-236`                  |
| `ImageNode.dataUri` existe porque _"draw.io renders `shape=image` from a data: URI"_                                     | `model.ts:130-143`                  |
| `PassthroughNode` existe porque _"draw.io has no shape for"_ o nó                                                        | `model.ts:146-164`                  |
| `FlowNode` justificado por _"draw.io has a native style for every one of the nine"_                                      | `model.ts:178-185`                  |
| `getContainerIds` = `kind === "panel" \|\| "apiGroup"`                                                                   | `geometry.ts:22-28`                 |
| Compensação A1 (`computeCompensationOffsets`) resolve sobreposição **no draw.io**                                        | `build.ts:82-83`, ADR-0009 addendum |
| `C4_META`, `AWS_RESICON`, `METHOD_COLORS`, `PROTOCOL_COLORS`                                                             | `constants.ts:105-350`              |
| `buildMxGraphXml` é o único ponto de saída                                                                               | `index.ts:10`                       |

O que **é** genuinamente reutilizável por outro formato:

- A forma `ExportModel { name, nodes, edges }` e o fato de nós carregarem
  `parentId` — hierarquia explícita.
- Enums de aresta como string literals neutros (`smoothstep`, `dashed`,
  `arrow-closed`) e o mapeamento exaustivo dos enums do domínio
  (`to-export-model.ts:51-88`, `switch` sem default — um valor novo quebra a
  compilação).
- O adapter `diagramToExportModel` (`to-export-model.ts:333-396`) até a linha
  388: resolução de cena, validação, filtro por `componentIds` com expansão de
  ancestrais container, caminhada de posição absoluta. Nada disso é draw.io.
- `export-service/edge-routing.ts` (414 linhas): roteamento em coordenadas
  absolutas espelhando o canvas — útil para qualquer formato com geometria.

O corte real não é "core neutro / adapter específico". É: **a estrutura do
pipeline é reutilizável; a IR é um modelo de célula mxGraph com nomes neutros**.

### 4.2 Custo de adicionar um formato novo hoje

Depende de o formato precisar ou não de mapeamento por elemento.

**Caso A — serializador de diagrama inteiro** (como mermaid ou JSON: lê
`Diagram` e escreve texto). **6 arquivos**, 1 novo:

| #   | Arquivo                                        | Mudança                                                                                                        |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/export-service/export-<fmt>.ts`       | novo                                                                                                           |
| 2   | `src/lib/export-service/build-export-files.ts` | union `DiagramExportFormat` (:7) + `FORMAT_EXTENSION` (:22) + `FORMAT_MIME` (:28) + `switch` (:61) — 4 edições |
| 3   | `src/lib/export-service/index.ts`              | barrel                                                                                                         |
| 4   | `src/pages/workspace/ExportModal.tsx`          | card em `formatOptions` (:93-117)                                                                              |
| 5   | `src/infrastructure/i18n/locales/en.json`      | `export.options.<fmt>.*`                                                                                       |
| 6   | `src/infrastructure/i18n/locales/pt-BR.json`   | idem (`locales.parity.test.ts` exige)                                                                          |

**Caso B — formato com mapeamento por elemento** (como drawio). Soma ao caso A:

| #     | Arquivo                                                   | Mudança                                                       |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------- |
| 7     | `src/lib/<fmt>-core/`                                     | novo (o equivalente de `export-core`)                         |
| 8     | `elements/element.types.ts:314-324`                       | `ElementExportSlice` ganha a chave `<fmt>`                    |
| 9     | `elements/element.registry.ts:86-91`                      | decidir se o novo formato também é obrigatório para registrar |
| 10    | `elements/families/cloud-family.types.ts:92-94`           | `CloudFamilyExport`                                           |
| 11    | `elements/families/build-cloud-family-descriptors.ts:117` | repasse                                                       |
| 12-16 | `families/{aws,gcp,azure,k8s,oss}/*.family.ts`            | 5 `toXNode`                                                   |
| 17    | `families/c4/c4.family.ts:118-137`                        | 1                                                             |
| 18-27 | `structural/*.element.ts` (10 arquivos)                   | 1 cada                                                        |
| +1    | `plugins/.../scripts/sync-shared.mjs:19`                  | se o plugin também precisar do formato                        |

**≈ 27 arquivos**, dos quais 16 são sítios de `toExportNode`. A boa notícia: são
16 e não 61, porque as famílias geram descriptors a partir de catálogo. A má: o
número cresce a cada família nova, e não há default — `ElementExportSlice.drawio`
é obrigatório, não opcional.

Comparação com o eixo de tipos: adicionar uma _família_ nova é uma chamada a
`registerCloudFamily` sem editar enums, listas do LLM nem `export-core` — é o
que `families/cloud-family-contract.test.ts:101` prova. (Com uma ressalva:
k8s e oss estão listados no union `ComponentType` (`component.types.ts:33-34`)
para que `cloudServiceId` seja alcançável sem `as Component`; o comentário em
`:37-46` trata isso como exceção, não como regra.) Adicionar um _formato_ custa
6 ou 27 arquivos. A extensibilidade foi resolvida em um eixo e não no outro.

Há um terceiro caminho já pronto e mais barato: `ExporterContribution`
(`plugins/plugin.types.ts:170-178`) — `{ id, label, extension, mime, export(DiagramSnapshot) }`,
registrado em runtime por `registerExporterContribution` (`io-registry.ts:31`) e
já integrado ao fluxo de download (`pages/workspace/index.tsx:127-137`).
**0 arquivos do core.** O preço está em §4.3.

### 4.3 Unidirecional por design vs. estrutura reaproveitável

| Superfície             | Direção             | Resistência a bilateralidade                                                                                                                                                                                        |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export-core`          | saída               | **Alta.** Gera string XML. Nada nele lê. `buildCell` é `ExportNode → string`, sem inverso.                                                                                                                          |
| `ExportModel`          | saída               | **Alta.** Perde `cloudServiceId`, `intent` em kinds não-c4, `description` em `AwsNode`/`ImageNode`, flows, cenas, tags, `externalLinks`, `serviceId` fora de c4. Não é um modelo do qual se reconstrói um diagrama. |
| `import-drawio.ts`     | entrada             | **Média.** Existe e produz `Component[]`, mas é um segundo mapeamento independente: reconhece 5 formas contra 12 emitidas, ignora `structuraType`, e não tem teste.                                                 |
| `insertGeneratedGraph` | entrada             | **Baixa.** Contrato neutro com ids externos, hierarquia e `cloudServiceId`, um único checkpoint de undo. É o ponto de entrada que menos resiste.                                                                    |
| `DiagramIR` (LLM)      | entrada             | **Baixa-média.** Pipeline completo formato→validador→componentes (`ir-validator.ts`, `apply-ir.ts`). Mas é AWS-only e usa `awsService` como nome de fio.                                                            |
| `ExporterContribution` | saída               | **Baixa de implementar, alta de fidelidade.** Ver abaixo.                                                                                                                                                           |
| `ImporterContribution` | entrada             | **Baixa de implementar, alta de fidelidade.** `PluginComponentInput` (`plugin.types.ts:126-136`) só tem `key, name, type?, description?, x, y, w?, h?` — sem `cloudServiceId`, sem `panelKind`, sem tags.           |
| Colaboração            | **bidirecional já** | Ver abaixo.                                                                                                                                                                                                         |

**O gargalo do ponto de extensão de plugin.** `DiagramSnapshot`
(`plugin.types.ts:97-103`) é a única entrada de um `ExporterContribution`:

```ts
interface DiagramSnapshot {
  id;
  name;
  description;
  components;
  connections;
}
interface PluginComponentSnapshot {
  id;
  type;
  label;
  description;
  parentId;
  position;
  size;
  tags;
  serviceId;
}
```

Não há `cloudServiceId`, `panelKind`, `technology`, `customColor`, `handleOrder`,
`externalLinks`, `linkedDiagramId`, `flowShape`, `columns`, `method`/`path`,
`svgContent`, `pluginData`. Nem `flows`, `scenes`, `edgeLayouts`, `viewport`,
`iconLibrary`. `PluginConnectionSnapshot` (`:77-84`) não tem `intent`,
`direction` nem `style`.

O único ponto de extensão registrável em runtime vê estritamente menos do que o
caminho built-in — o que explica por que o LeanIX, que precisa de fidelidade,
não o usa e chama seu próprio `exportDrawio` direto.

**O que já é bidirecional.** A colaboração
(`collaboration/hooks/useCollabStoreSync.ts`) sincroniza deltas por entidade
sobre o modelo interno: `CollabSnapshot` (`useCollab.ts:7-22`) é a forma da
store com valores `Record<string, unknown>`, e `CollabPatch` é
`Partial<Omit<CollabSnapshot, "diagramId">>` — merge de um nível, `null` remove
a entidade (`useCollabStoreSync.ts:41-60`), last-write-wins, com checksum de
drift (`utils/snapshotChecksum.ts`). Structura↔Structura, sem formato
intermediário, sem CRDT.

Isso é relevante porque é a única prova no repo de que o modelo suporta
aplicação incremental de mudanças externas — mas ela opera sobre a forma
interna, não sobre uma IR. Um sync bilateral com formato externo não tem hoje
onde se apoiar: nem a IR de export nem `DiagramSnapshot` conseguem expressar uma
mudança parcial identificável.

**A assimetria de identidade.** Para qualquer sync bidirecional é preciso saber
que o nó X do formato externo é o componente Y do Structura. O repo já resolveu
esse problema duas vezes, de formas diferentes, e não reutilizou nenhuma:

- `ServiceManifestEntry` (`service-manifest.types.ts:11-24`) — identidade de
  serviço por sinais independentes (`repositoryUrl`, `github.repoId`, `name`),
  com plano de relink revisado pelo usuário (`useWorkspaceImport.ts:91-100`).
- `GeneratedNodeInput.externalId` → `componentIdByExternalId`
  (`generated-graph.slice.ts:22, 45`) — mapa de ids externos devolvido ao produtor.
- `PassthroughNode.originType` no XML — escrito, nunca lido.

Nenhum dos três está no caminho do export drawio.

### 4.4 Inconsistências e dívida — com arquivo:linha

**Documentação que descreve código que não existe**

| Local                                                 | Afirma                                                                                                             | Realidade                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `docs/concepts/import-export.md:15`                   | Structurizr DSL, export+import, em `export-structurizr.ts` e `import-structurizr.ts`                               | `grep -rni structurizr src plugins server` → zero. `ROADMAP.md:59` corretamente lista como não feito.            |
| `AGENTS.md:65`                                        | `lib/ # export-service (drawio/mermaid/structurizr)`                                                               | idem                                                                                                             |
| `docs/concepts/import-export.md:47`                   | _"Scenes and flows export only via native JSON"_                                                                   | Flows sim; cenas são descartadas quando há cena ativa (§2.2, probe)                                              |
| `docs/concepts/import-export.md:12`                   | JSON import entra por `shared-import.ts`                                                                           | O caminho real é `useWorkspaceImport.ts:76` → `validateWorkspaceFile.ts`; `shared-import.ts` só faz dedupe de id |
| `docs/concepts/import-export.md:36-38`                | _"Imports normalize before entering the store… Nothing raw from a foreign file touches the model"_                 | Só o caminho JSON normaliza (§3.5)                                                                               |
| `docs/adr/0006-interchange-strategy.md`               | _"native JSON is the only lossless format"_                                                                        | Perde cenas condicionalmente                                                                                     |
| `docs/adr/0009-export-core-sharing.md`                | IR com 8 kinds                                                                                                     | São 12 (`model.ts:21-33`)                                                                                        |
| `docs/adr/0009-export-core-sharing.md` (Consequences) | _"Node dispatch is still a `kind` switch, not a registry — per-node-type export contributions remain future work"_ | Feito: `element.types.ts:314-324` + `to-export-model.ts:226`                                                     |
| `docs/architecture/extension-points.md:20`            | _"Still a `kind` switch; should become per-node-type contributions paired with element descriptors"_               | idem                                                                                                             |

**Código**

| Item                                                                                                                                                 | Local                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `exportJSONUnversioned` sem chamador                                                                                                                 | `export-json.ts:37-48`                                                                  |
| `VersionedWorkspace`, `unwrapDiagram` sem chamador                                                                                                   | `versions.ts:26-32, 57-73`                                                              |
| `$schema: "structura://workspace/v1"` com `WORKSPACE_SCHEMA_VERSION = 2`; contornado por `as 1 \| 2`                                                 | `versions.ts:9,27`; `fileSystemBoot.ts:107,349`                                         |
| `TypedComponentPatch` repete `ProcessNodeComponent`                                                                                                  | `component.types.ts:316` e `:317`                                                       |
| `ComponentPatch` omite `PluginTypedComponent` (presente em `TypedComponentPatch:318`)                                                                | `component.types.ts:284-299`                                                            |
| `Component.x` / `Component.y` vestigiais; único leitor é um fallback                                                                                 | `component.types.ts:75-76`; `plugins/snapshots.ts:28-29`                                |
| `structuraType` escrito e nunca lido                                                                                                                 | `cell-builders.ts:314` vs. `import-drawio.ts`                                           |
| `import-drawio.ts` (665 l.) sem nenhum teste                                                                                                         | —                                                                                       |
| Adapter do plugin sem teste; paridade exigida por spec e não verificada                                                                              | `openspec/specs/drawio-export-core/spec.md:83-94`                                       |
| `C4Node.subtype` documentado como _"person, system, container, component, or a gcp/azure service type"_ — gcp/azure nunca emitem `c4` hoje           | `model.ts:48-49`                                                                        |
| `exportJSON` lê `useIconStore` global dentro de um "pure boundary converter"                                                                         | `resolve-used-icons.ts:7`                                                               |
| `normalizeImportedDiagram` **escreve** no `useIconStore` durante validação de import                                                                 | `normalize-imported-diagram.ts:101-103`                                                 |
| `Flow.mermaid: string` obrigatório e persistido; formato externo no modelo                                                                           | `flow.types.ts:99`                                                                      |
| 20 das 21 migrações rodam incondicionalmente; `version: 13` não seleciona nada                                                                       | `persist.config.ts:490-536` vs. `:712-724`                                              |
| `DIAGRAM_SCHEMA_VERSION` parado em 1 com a única migração vazia                                                                                      | `versions.ts:5`; `migrations.ts:92-98`                                                  |
| `importDrawioResult` é o primitivo genérico de ingestão (drawio, mermaid, plugins) mas tem nome de um formato e mora na fatia de clipboard           | `clipboard.slice.ts:175`; chamadores em `run-plugin-import.ts:104`, `FlowPanel.tsx:229` |
| `IRNode.awsService` mantém o nome pré-F6b e não tem equivalente para gcp/azure/k8s/oss                                                               | `llm/ir/ir.types.ts:118`                                                                |
| `#share=` strippa `activeSceneId`/`hidden:false`; `#data=` não. Comportamento equalizado no viewer, payloads divergentes, `#data=` sem teste de base | `share-url/encode.ts:56-79` vs. `viewer.ts:17`                                          |

---

## 5. Observações para a próxima etapa

Perguntas que o mapeamento abriu. Nenhuma tem resposta aqui.

**Sobre a IR**

1. `ExportModel` é uma IR de multi-formato ou um modelo de célula mxGraph com
   nomes neutros? Os 12 kinds e as âncoras `exitX/entryX` sugerem o segundo. Se
   um segundo formato for adicionado, ele reusa essa IR, ganha a sua, ou existe
   uma camada acima das duas?
2. `cloudServiceId` não chega a nenhum `ExportNode`. Isso é uma decisão (o
   drawio não tem onde colocar) ou uma omissão que qualquer formato novo vai
   herdar por copiar o contrato existente?
3. `PassthroughNode.originType` é escrito para um leitor que não existe. Vale
   como precedente de "campo de identidade no formato externo", ou é a prova de
   que campos assim apodrecem sem um round-trip testado?

**Sobre o contrato do descriptor**

4. `export.drawio` é obrigatório para registrar um elemento
   (`element.registry.ts:86`). Com dois formatos, ambos viram obrigatórios,
   ou existe um default/fallback — e qual seria o fallback honesto (o
   equivalente de `passthrough` em cada formato)?
5. Os 16 sítios de `toExportNode` ficam com um método por formato, ou o
   descriptor passa a declarar uma projeção semântica única da qual cada formato
   deriva a sua? A segunda opção exigiria decidir qual é essa semântica — e é
   exatamente a decisão que a sessão de CALM/ASL adiou.

**Sobre o formato JSON como contrato externo**

6. `DIAGRAM_SCHEMA_VERSION` está em 1 com uma migração vazia enquanto o payload
   atravessou 13 versões internas. Se o JSON exportado passar a ser lido por
   outro sistema, ele precisa de cadeia própria de migração — ou o envelope
   passa a carregar também o `PERSIST_SCHEMA_VERSION` do payload?
7. Exportar com uma cena aberta produz um arquivo diferente de exportar com ela
   fechada, e nada no envelope registra isso. Cena é estado de visualização
   (achatar está certo) ou é conteúdo (deveria viajar)?
8. O JSON hoje não descreve os tipos que usa. Um consumidor externo precisaria
   de um catálogo de elementos junto — ele viaja no arquivo, fica num endpoint,
   ou o formato externo é que define o vocabulário e o Structura mapeia?

**Sobre bilateralidade**

9. O único mecanismo bidirecional que existe (colaboração) opera sobre a forma
   interna, com merge por entidade e last-write-wins. Um sync com formato
   externo reusaria esse transporte sobre uma IR, ou é outro problema?
10. Identidade externa foi resolvida três vezes e de três formas
    (`ServiceManifestEntry`, `externalId`, `structuraType`), nenhuma no caminho
    de export. Qual delas é o precedente?
11. `ImporterContribution`/`ExporterContribution` são o ponto de extensão
    registrável — e veem menos do que o caminho built-in, tanto que o único
    plugin real os ignora. Formatos futuros entram por aí (e então
    `DiagramSnapshot` precisa crescer), ou por dentro do core (e então o ponto
    de extensão de plugin fica permanentemente de segunda classe)?

**Sobre o padrão de sync do plugin**

12. O que `sync-shared.mjs` resolve é isolamento de bundle, não multi-formato — e
    o que de fato divergiu foi o adapter, que não é sincronizado. Antes de
    generalizar o padrão: o adapter do plugin deve convergir para o registry, ou
    a existência de dois adapters é aceitável desde que a paridade exigida pelo
    spec seja testada?

**Sobre a fronteira de import**

13. Quatro dos cinco caminhos de entrada escrevem na store sem normalização,
    contra a regra explícita da ADR-0006. Isso vira uma porta única antes de
    haver mais formatos entrando, ou cada importer continua responsável pela
    própria sanitização?
14. `import-drawio.ts` é o único importer de formato externo sem teste, e é o
    que teria de crescer para suportar round-trip. Ele é base ou é reescrita?

---

### Probes executados nesta sessão

Dois arquivos de teste temporários, ambos removidos; working tree limpa.

| Probe                                                   | Pergunta                                  | Resultado                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `validateDiagramFile` com componente v12 (`awsService`) | A migração v13 roda no import de arquivo? | Não: `{ awsService: "lambda", cloudServiceId: undefined }`                                                                   |
| `exportJSON` com e sem cena ativa                       | Cenas e flows sobrevivem ao JSON?         | Flows sempre; cenas só sem cena ativa (`DROPPED` caso contrário). Envelope: `$schema`, `schemaVersion`, `data`, `exportedAt` |

Verificações não destrutivas: `node plugins/structura-plugin-leanix/scripts/sync-shared.mjs --check` → em sincronia.

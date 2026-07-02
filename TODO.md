# Structura — TODO / Feature Backlog

> Consolidado em maio/2026. Ordenado por tier (esforço + risco arquitetural).

---

## Tier 1 — Quick Wins

### ✅ F-05 · Reset de estado ao trocar de diagrama

**Problema**
Ao fazer drilldown com um elemento selecionado, `selectedNodeIds` ainda contém o ID do nó anterior. Como `computeNodeVisibility` usa `hasFocusedNodes = selectedNodeIds.size > 0` para calcular `dimmed`, o novo canvas renderiza com todos os nós opacos no primeiro frame.

**Causa raiz**
`clearCanvasSelectionImpl` já é chamado no `useEffect([activeDiagramId])`, mas o efeito é assíncrono — o React renderiza um frame antes do cleanup. O drilldown muda `activeDiagramId` na store antes do efeito limpar o estado local.

**Solução**
Chamar `clearCanvasSelection()` de forma **síncrona** no handler de drilldown, antes de `openDiagram()`. Adicionar também reset de `flowHighlight` e parar playback ativo antes de navegar.

**Arquivos**

- `features/canvas/hooks/useCanvasDrillHandlers.ts` — chamar clear antes do openDiagram
- `features/canvas/hooks/useCanvasVisualState.ts` — garantir reset completo
- `features/canvas/hooks/useCanvasFlowState.ts` — parar playback no switch

**Risco:** zero. Mudança cirúrgica em handlers de UI, nenhuma API pública muda.

---

## Tier 2 — Mid Complexity

### ⬜ F-04 · Import Mermaid → Flow / Canvas

**Comportamento especificado**

- `sequenceDiagram` → criar novo Flow com steps mapeando as mensagens
- Participant já existe no canvas (match por nome) → reutilizar o componente existente
- Participant não existe → criar automaticamente como C4 Component
- Outros tipos (flowchart, class) → criar como nodes do canvas diretamente

**Decisões em aberto**

- Matching por nome: case-sensitive? exato ou fuzzy?
- Onde posicionar novos componentes: usar `computeGridLayout` existente
- Loops/`alt`/`opt` blocks → mapear para `FlowBranch`
- Escopo inicial: apenas `sequenceDiagram`
- Lib vs parser manual: `@mermaid-js/parser` (~100kb) vs parser manual lightweight (recomendado para seq diagram)

**Arquivos**

- `src/lib/export-service/parse-mermaid-sequence.ts` — novo, parser puro
- `src/lib/export-service/import-mermaid.ts` — novo, análogo ao `import-drawio.ts`
- `src/pages/ImportModal.tsx` — adicionar opção Mermaid
- `src/lib/export-service/index.ts` — re-exportar

**Contexto útil existente:** `flow-mermaid.ts` (export), `MermaidPreview.tsx`, `import-drawio.ts` (padrão a seguir).

---

### ⬜ F-06 · Cross-Diagram Reference Node

**O que é**
Um nó que representa explicitamente um componente de outro diagrama. Diferente do drilldown (detalhe do mesmo sistema), o Ref Node é uma referência cruzada — ex: "Payment API" no Context referenciando o container "Payment API" no Container diagram.

**Modelo de dados**

- `BaseComponent` já tem `linkedDiagramId?: string` — base útil
- Adicionar `linkedComponentId?: string` em `BaseComponent`
- Decisão em aberto: tipo distinto `"diagram-ref"` em `ComponentType` OR propriedade de qualquer nó C4? A segunda opção é mais flexível.
- Visual: badge de link + nome do diagrama alvo + seta de navegação
- Hover: tooltip com preview do diagrama destino (usar `previewCache` existente)

**Comportamento**

- Click → navega para o diagrama destino E seleciona o componente referenciado
- Componente destino deletado → badge "broken reference"
- Impact Analysis deve cruzar refs entre diagramas
- Export DrawIO/Structurizr → exportar como hyperlink

**Arquivos**

- `src/features/canvas/nodes/DiagramRefNode.tsx` — novo
- `src/features/canvas/nodes/node-types/diagram-ref.descriptor.ts` — novo
- `src/features/diagram/model/component.types.ts` — adicionar `linkedComponentId`
- `src/features/canvas/nodes/node-types/registry.ts` — registrar descriptor
- `src/features/canvas/panels/ElementPanel/sections/LinkedDiagramSection.tsx` — estender UI
- `src/lib/export-service/export-drawio.ts` — suporte a hyperlink

---

### ⬜ F-07 · Novos Elementos

#### Grupo A — Panels semânticos (menor risco, implementar primeiro)

| Elemento     | PanelKind      | Visual                                      |
| ------------ | -------------- | ------------------------------------------- |
| AWS Account  | `AwsAccount`   | borda laranja AWS, ícone de nuvem no header |
| ControlPlane | `ControlPlane` | borda tracejada roxa, label "Control Plane" |
| Service Mesh | `ServiceMesh`  | borda pontilhada semi-transparente          |

Todos implementados como novo valor de `PanelKind` + estilo em `PanelNode.tsx`.

**Sidecar badge**: cada container filho dentro de ServiceMesh pode ter um badge Envoy/Istio — decisão em aberto: badge no node C4 ou node filho dedicado?

#### Grupo B — Elementos especializados

**StepFunctions**

- Decisão em aberto: extensão do `ApiGroupNode` OR node próprio com estados (Task, Choice, Parallel, Wait, Succeed, Fail)?
- Visual: diagrama de estado inline com setas internas

**S3**

- Verificar se já está mapeado no `aws.ts` catalog antes de criar

**Contrato (Request/Response)**

- Extensão do `EndpointNode`: adicionar aba "Schema" no `EndpointPanel.tsx`
- Linkar a um `JsonViewerNode` existente para mostrar payload inline

**Perguntas antes de implementar**

- StepFunctions: visão de orquestração de containers existentes ou elemento standalone?
- ControlPlane: K8s puro ou genérico?

**Arquivos**

- `src/features/diagram/enums.ts` — novos valores de `PanelKind`
- `src/features/canvas/nodes/PanelNode.tsx` — estilos por PanelKind
- `src/features/canvas/nodes/StepFunctionNode.tsx` — novo (se for node próprio)
- `src/features/canvas/nodes/node-types/stepfunction.descriptor.ts` — novo
- `src/features/canvas/panels/ElementPanel/EndpointPanel.tsx` — aba Schema
- `src/lib/catalogs/panels.ts` — registrar novos panels

---

## Tier 3 — Deep Features

### ⬜ F-01 · ADR — Architecture Decision Records

**Visão**
ADRs vivem dentro do workspace, vinculados a diagramas e/ou componentes específicos. Arquiteto pode ver quais decisões afetam um container, exportar como Markdown/PDF, e navegar o histórico de trade-offs na ferramenta.

**Modelo de dados**

```ts
interface AdrRecord {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "deprecated" | "superseded";
  context: string;
  decision: string;
  consequences: string;
  date: string;
  tags: string[];
  linkedDiagramIds: string[];
  linkedComponentIds: string[];
  supersededBy?: string; // chain de decisões
}
```

**Arquitetura de persistência**

- Nova store: `features/adr/store/adr.store.ts` (Zustand + Immer + `defaultStorage`)
- ADRs não têm undo/redo — são registros históricos imutáveis por natureza
- **Decisão crítica em aberto:** ADRs ficam no `workspace.json` OR arquivo separado `adrs.json`?
  - Arquivo separado: mais limpo para versionamento (cada ADR = 1 commit legível no Git), mas complexifica `FileSystemAdapter`
  - Embutido: mais simples, mas polui o workspace principal

**UI**

- Nova página `/adrs` — lista com filtros por status/tag (formato MADR)
- Editor inline com campos estruturados
- Badge `📋` nos nodes do canvas quando existe ADR vinculado (`CustomNode/Badges.tsx`)
- Aba "Decisions" no `ElementPanel` para componentes com ADRs vinculados
- Export: Markdown (MADR format), PDF, ou bundle junto com diagrama

**Arquivos**

- `src/features/adr/store/adr.store.ts` — novo
- `src/features/adr/types.ts` — novo
- `src/features/adr/components/AdrEditor.tsx` — novo
- `src/features/adr/components/AdrList.tsx` — novo
- `src/pages/adr/index.tsx` — novo
- `src/infrastructure/persistence/FileSystemAdapter.ts` — novo arquivo ou embed
- `src/features/canvas/panels/ElementPanel/index.tsx` — aba Decisions
- `src/features/canvas/nodes/CustomNode/Badges.tsx` — badge ADR
- `src/lib/export-service/build-export-files.ts` — include ADRs no bundle

---

### ⬜ F-03 · Export GIF — Canvas + Flow Animado

**Dois modos**

- **Snapshot GIF**: captura estática — valor baixo, trivial
- **Flow GIF**: reproduz Flow step-by-step, captura um frame por step, gera animação — este é o caso de uso valioso

**Stack técnica**

- `html-to-image` ou `dom-to-image-more` — captura DOM como PNG por frame
- `gif.js` (Web Workers) — encoding GIF no browser sem servidor
- Alternativa moderna: `CanvasCapture` API (Chrome only) + WebM → converter para GIF
- GIF tem paleta 256 cores — diagramas com gradientes perdem qualidade; considerar **WebP animado** como alternativa superior

**Fluxo de implementação**

1. `useCaptureFrames.ts` orquestra: avança step do flow → aguarda re-render → captura frame
2. Pós-captura: passa frames para `gif.js` worker → encoding
3. Modal com preview + botão download

**Problemas conhecidos**

- React Flow usa SVG + foreignObject — `html-to-image` tem quirks conhecidos com isso
- Ícones AWS são Base64 SVG — devem funcionar, mas precisam de teste
- Dependência externa obrigatória: validar licença para open-source

**Arquivos**

- `src/lib/export-service/export-gif.ts` — novo
- `src/features/canvas/hooks/useCaptureFrames.ts` — novo
- `src/features/canvas/components/GifExportModal.tsx` — novo
- `src/features/canvas/toolbar/CanvasToolbar.tsx` — botão de export
- `src/pages/modelExplorer/ExportModal.tsx` — opção GIF

---

## Tier 4 — Architecture Shift

### ⬜ F-02 · Sistema de Plugins — Canvas + Platform

**Fundação existente**

- `registerDescriptor()` em `registry.ts` já é uma proto-API de extensão de nodes
- `NodeTypeDescriptor` é um contrato limpo e estável
- `src/integrations/` já existe como feature isolada (padrão para platform plugins)
- Arquitetura de slices Zustand permite adicionar stores externas

**O que falta para ser um sistema de plugins completo**

- Plugin manifest (name, version, author, permissions declaradas)
- Plugin lifecycle: register → activate → deactivate → uninstall
- **Stable public API versionada** — contrato semver com a comunidade open-source
- Sandbox: plugins não devem acessar a store diretamente
- Plugin Registry UI: gerenciar plugins instalados

**Dois tipos de plugin**

| Tipo                | Extensões possíveis                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Canvas Plugin**   | novos node types, edge types, context menu items, toolbar buttons, painéis de propriedade                           |
| **Platform Plugin** | novas rotas/páginas, formatos de import/export, integrações externas (Confluence, Jira), campos no Service Registry |

**API Pública mínima proposta**

```ts
StructuraPlugin.registerNodeType(descriptor: NodeTypeDescriptor): void
StructuraPlugin.registerExporter(handler: ExportHandler): void
StructuraPlugin.registerImporter(handler: ImportHandler): void
StructuraPlugin.registerPanel(section: PanelSection): void
StructuraPlugin.onDiagramChange(callback: (diagramId: string) => void): () => void
```

**Modelo de distribuição**

- MVP: plugins como arquivos JS locais carregados via File API
- Plugins oficiais: NPM packages prefixados `structura-plugin-*`

**Processo recomendado**

> ⚠️ A API pública é um contrato. Uma vez exposta para a comunidade open-source, mudá-la é custoso.
> Fazer design da API como RFC primeiro, validar com pelo menos 2–3 casos de uso reais (ex: plugin DefectDojo, plugin Mermaid import) antes de qualquer código.

**Arquivos**

- `src/features/plugins/plugin.types.ts` — novo
- `src/features/plugins/plugin-registry.ts` — novo
- `src/features/plugins/plugin-api.ts` — novo (surface pública)
- `src/features/plugins/store/plugins.store.ts` — novo
- `src/pages/settings/PluginsPage.tsx` — novo
- `src/features/canvas/nodes/node-types/registry.ts` — expor via plugin-api
- `src/lib/export-service/index.ts` — expor handlers via plugin-api
- `src/pages/ImportModal.tsx` — suporte a importers registrados por plugins

---

## Tier 2 (adicionado) — Export

### ⬜ F-08 · DrawIO Export — Correção de Arrows & Edge Styles

**4 bugs identificados na análise do código**

#### Bug 1 — `EdgeStyle.Smoothstep` mapeado errado 🔴

O canvas renderiza `Smoothstep` com `buildOrthogonalPath()` — roteamento ortogonal automático com cantos arredondados. O export gera `elbowEdgeStyle` (cotovelo com ponto de dobra manual), que é completamente diferente.

```ts
// styles.ts — ANTES
case EdgeStyle.Smoothstep:
default:
  return `edgeStyle=elbowEdgeStyle;elbow=orthogonal;curved=1;rounded=1;...`

// DEPOIS
case EdgeStyle.Smoothstep:
default:
  return `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;`;
```

#### Bug 2 — `EdgeStyle.Bezier` mapeado para ER-style 🔴

DrawIO `entityRelationEdgeStyle` é notação ER (cardinalidade), não uma curva Bezier.

```ts
// styles.ts — ANTES
case EdgeStyle.Bezier:
  return `edgeStyle=entityRelationEdgeStyle;html=1;`

// DEPOIS
case EdgeStyle.Bezier:
  return `edgeStyle=none;curved=1;html=1;`;
```

#### Bug 3 — `animated: true` ignorado no export 🟡

Intents `event`, `data-flow` e `async-message` têm `animated: true` por default. DrawIO suporta `flow=1` para animação de fluxo. O export não passa o `animated` de `EffectiveConnectionStyle`.

Fix: adicionar parâmetro `animated?: boolean` em `buildEdgeStyle()` e propagar `flow: 1` no style string quando verdadeiro.

**Arquivos:** `styles.ts` (assinatura), `edge-builder.ts` (chamar com `eff.animated`)

#### Bug 4 — `conn.style?.color` ignorado no export 🟡

O canvas usa `conn.style?.color` como override de cor. O export usa apenas `getStrokeColor(conn.intent)` — cor customizada é descartada silenciosamente.

```ts
// edge-builder.ts — ANTES
const strokeColor = getStrokeColor(conn.intent);

// DEPOIS
const strokeColor = conn.style?.color ?? getStrokeColor(conn.intent);
```

**Tabela de estado após os fixes**

| Canvas EdgeStyle       | DrawIO atual                 | DrawIO corrigido                   |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `Smoothstep` (default) | `elbowEdgeStyle` ❌          | `orthogonalEdgeStyle;rounded=1` ✅ |
| `Bezier`               | `entityRelationEdgeStyle` ❌ | `edgeStyle=none;curved=1` ✅       |
| `Step`                 | `orthogonalEdgeStyle` ✅     | sem mudança                        |
| `Straight`             | `edgeStyle=none` ✅          | sem mudança                        |
| `animated=true`        | ignorado ❌                  | `flow=1` ✅                        |
| `conn.style?.color`    | ignorado ❌                  | priority override ✅               |

**Arquivos**

- `src/lib/export-service/styles.ts` — bugs 1, 2, 3
- `src/lib/export-service/edge-builder.ts` — bugs 3, 4

**Risco:** zero. Nenhuma mudança de modelo de dados, nenhuma mudança na store.

---

## Visão consolidada

| ID   | Feature                       | Tier | Esforço       | Depende de      |
| ---- | ----------------------------- | ---- | ------------- | --------------- |
| F-05 | Reset estado no drilldown     | T1   | 1–2 dias      | —               |
| F-04 | Import Mermaid                | T2   | 5–8 dias      | —               |
| F-06 | Cross-Diagram Ref Node        | T2   | 4–6 dias      | —               |
| F-08 | DrawIO Export — arrows/styles | T2   | 1–2 dias      | —               |
| F-07 | Novos Elementos               | T2   | 2–3d/elemento | F-06 (ref node) |
| F-01 | ADR                           | T3   | 2–3 semanas   | F-06 (links)    |
| F-03 | Export GIF                    | T3   | 2–3 semanas   | —               |
| F-02 | Plugin System                 | T4   | ongoing       | todos           |

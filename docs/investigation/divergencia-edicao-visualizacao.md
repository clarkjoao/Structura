# Divergência de renderização: modo edição × modo visualização

Sessão de análise, sem mudança de código. Base: `main` em `f5d56a3` (Fix/viewer #231).

Toda afirmação vem marcada como **MEDIDO** (medido no browser nesta sessão), **LIDO NO CÓDIGO**
(com `arquivo:linha` aberto nesta sessão) ou **HIPÓTESE** (não verificada).

---

> **Atualização (2026-09-22, branch `feat/viewer-render-parity`).** O plano do §5.2 foi executado
> inteiro (fatias 1–7). Decisões do §6: **6.1** — nenhuma rota re-arranja mais; o
> `layoutForVisualization` e o perfil ELK `visualization` foram removidos, e existe um só layout, o do
> autor. **6.2** — o link mostra a **cena que o autor tem aberta** (opção A): `activeVersionId` vai no
> payload e o leitor o resolve como o editor; o aviso "sempre a base" saiu do `ShareModal`. Walkthroughs
> continuam na base (`WalkthroughSceneCanvas`). A paridade agora é medida no que foi renderizado, em
> todos os seeds e nas três formas de ler (`cypress/e2e/editor-viewer-render-parity-seeds.cy.ts`); ver
> também [`paridade-editor-viewer-caixa-do-no.md`](./paridade-editor-viewer-caixa-do-no.md) §6.

## 0. Resumo

1. **Já existe um core compartilhado, e ele funciona.** Desde o trabalho de `canvas/core`
   (`DiagramSurface`, `readPolicy`/`writePolicy`, `diagramEdgeTypes`, `projectReadDiagram`), os
   dois modos usam o **mesmo** `EditableEdge`, os **mesmos** componentes de nó, o **mesmo**
   `descriptor.buildData`/`buildStyle` e o **mesmo** `buildEdge`. **MEDIDO:** num diagrama
   semente sem nada de especial (`d-pl-dp-hub`, 15 nós, 4 painéis), o link `#data=` renderiza
   as 8 edges com o mesmo `d` do editor (diferença < 0,0001 px, ruído de float) e **nenhum**
   painel difere em cor, borda, opacidade ou z-index.
2. **A divergência não está no render, está na projeção.** O editor monta nós e edges por
   `useCanvasNodes` + `useCanvasEdges` + `computeNodeVisibility`; o leitor monta por
   `projectReadDiagram`. São **duas projeções paralelas** sobre o mesmo modelo, e elas discordam
   em regras que só existem de um lado. Encontrei quatro, todas medidas ou lidas no código:
   - **painel colapsado**: o leitor não esconde os filhos (**MEDIDO** — é a causa mais visível
     de "cor de painel diferente": o painel some debaixo dos filhos);
   - **`zIndex` do usuário** (trazer para frente / enviar para trás): o editor honra, o leitor
     ignora (**MEDIDO**);
   - **componente sem `nodeLayout`**: o editor esconde, o leitor desenha em (0,0) e conta as
     conexões dele (**LIDO NO CÓDIGO**);
   - **cena ativa**: o editor mostra a cena ativa, o leitor sempre a base (**LIDO NO CÓDIGO**,
     deliberado).
3. **Para as edges há uma segunda causa, que é produto e não bug:** `/viewer?diagramId=` e
   `/viewer?source=file` rodam ELK e **substituem** `nodeLayouts` e `edgeLayouts` inteiros
   (**MEDIDO**: todos os 15 nós mudam de posição, 4 painéis mudam de tamanho, 8/8 edges têm
   rota diferente). Waypoints desenhados à mão são descartados nessas entradas.
4. **E há um vazamento real:** o `EditableEdge` lê pontos de controle, offset de label e a
   `Connection` do **diagrama ativo do store local** (`state.diagrams[activeDiagramId]`). No
   viewer, quando o payload não tem waypoint para uma edge, ele usa o waypoint do diagrama que o
   leitor tem aberto localmente. **MEDIDO**: gerei um link sem `edgeLayouts['pl-dph-c4']`, e o
   viewer desenhou `c4` passando pelos waypoints `(1250,120)`/`(1250,600)` que só existiam no
   store local. Pelo mesmo caminho, as labels do viewer ficam arrastáveis (**MEDIDO**: 8 labels
   com `cursor-grab` e `pointer-events: auto`), e o gesto grava no diagrama ativo local
   (**LIDO NO CÓDIGO**; não executei a gravação).

A direção da unificação sai direto disso: **uma projeção só** (dado → nós/edges RF), pura e
parametrizada por política, no lugar de `useCanvasNodes`/`useCanvasEdges` × `projectReadDiagram`;
e **edges sem store**: geometria e label vindas do dado da edge, com o store entrando apenas como
fonte de escrita no modo edição. Detalhes e ordem de migração no §5.

---

## 1. Contexto e trabalho anterior (não repetido aqui)

- `docs/epico-layout-visualization/relatorio.md` §3.2 e §4.4 registraram que "o `ViewerCanvas`
  descarta o roteamento do ELK" porque o `EditableEdge` lia os pontos da store. **Isso já foi
  corrigido** no #229/#231: `buildEdge` carimba `layoutPoints`/`layoutLabelOffset` quando recebe
  `edgeLayouts` (`edges/data/buildEdges.ts:125-154`), e o `EditableEdge` os prefere
  (`edges/resolveEditableEdgeGeometry.ts:25`). `layoutForVisualization` passou a devolver
  `edgeLayouts` (`viewer/layoutForVisualization.ts:76`). Esse item está fechado.
- `docs/epico-layout-visualization/validacao-e-unificacao.md` fechou a unificação de **rota**
  (`/view` → `/viewer`). Esta sessão trata da unificação de **renderização**, que é outra coisa.
- `canvas/core/README.md` já declara a intenção: "Shared diagram surface for Write Host
  (`Canvas.tsx`), Reader Host (`ViewerCanvas.tsx`)". O que falta é a camada abaixo da superfície.
- Branches remotas abertas (`bug/filesystem`, `feat/asl`) não tocam essa área.

---

## 2. Cadeia de renderização, lado a lado

```
                 EDITOR (Canvas.tsx)                         LEITOR (ViewerCanvas.tsx)
dado       store: state.diagrams[activeDiagramId]       prop `diagram` (payload / arquivo / store)
           getCachedCanvasSnapshot → cena ATIVA         resolveVersionSnapshot(diagram, null) → BASE
           ↓                                            ↓ (?diagramId / ?source=file: ELK antes)
filtro     useVisibleComponents: tem nodeLayout         filter(!component.hidden)
           useVisibleConnections: pontas com layout     todas as conexões
           ↓                                            ↓
derivação  useCanvasConnectionDerivations  ─── mesmas funções puras ───  buildReadNodeContext
           (buildConnectionCountPerNode, buildEdgeHandleAssignments, buildEffectiveHandleOrder)
           ↓                                            ↓
nós        useCanvasNodes                               buildReadNode
           ├ descriptor.buildData/buildStyle  ═══ IGUAL ═══  descriptor.buildData/buildStyle
           ├ computeNodeVisibility (z do layout,        ├ z do descriptor
           │   hidden por colapso, dim de seleção)      ├ hidden: nunca
           ├ ordem: grupos primeiro, depois profund.    ├ ordem: topológica
           ├ cache de identidade + useLocalNodes        └ lockForReading
           ↓                                            ↓
edges      useCanvasEdges → buildEdge  ═══ IGUAL ═══  buildEdge (+ edgeLayouts carimbados)
           + tag-filter, pending LLM, compare, cache
           ↓                                            ↓
shell      DiagramSurface(writePolicy)  ═══ IGUAL ═══  DiagramSurface(readPolicy)
           + <style>{CANVAS_STYLES}</style>             + ViewerCanvas.css
           ↓                                            ↓
render     EditableEdge — lê store do diagrama ATIVO nos DOIS modos (useControlPoints,
           useSegmentDrag, useEdgeLabelOffset, useConnection, useActiveDiagramId)
           PanelNode / CardNode / …  ═══ IGUAL ═══
```

---

## 3. Diagnóstico com evidência

### 3.1 Painel colapsado: o leitor desenha os filhos — **MEDIDO**

**Código.** O editor esconde qualquer nó com ancestral colapsado ou oculto:
`nodes/nodeVisibility.ts:57` (`comp.hidden === true || hasCollapsedOrHiddenAncestor(...)`), aplicado
em `nodes/useCanvasNodes.ts:488` (`hidden: vis.isHidden`). O leitor só filtra `component.hidden`
(`core/projectReadDiagram.ts:93`) e nunca preenche `hidden` no nó RF. O painel em si é
colapsado igual nos dois (o `buildStyle` do painel devolve 200×60,
`elements/structural/panel.element.ts:183`), então sobra uma caixa pequena com os filhos em
volta dela.

**Medição** (diagrama `d-pl-dp-hub`, `pl-dph-private` colapsado via store, depois link `#data=`):

| | editor | viewer |
|---|---|---|
| `pl-dph-private` | 200×60 | 200×60 |
| filhos `pl-dph-ecs`, `pl-dph-worker` | **ausentes do DOM** | **visíveis**, em `translate(950px, 68px)` / `(938px, 68px)`, **por cima** da caixa colapsada |
| edges no DOM | 4 | **8** (`c-proxy`, `c4`, `c5`, `c6` a mais) |

No print do viewer (`evidence/viewer-collapsed.png`), o painel "Private subnet", de tom rosado,
**desaparece** debaixo dos dois cards, e quatro edges saem de nós que o editor não mostra. É a
forma mais visível da queixa "as cores dos painéis não batem".

### 3.2 `zIndex` escolhido pelo usuário: o leitor ignora — **MEDIDO**

**Código.** `bringToFront`/`sendToBack` gravam `nodeLayouts[id].zIndex`
(`diagram/store/slices/layout.slice.ts:202,222`). O editor usa `layout?.zIndex ?? descriptor.zIndex`
(`nodes/nodeVisibility.ts:54`, aplicado em `useCanvasNodes.ts:472`). O leitor usa só o
descriptor (`core/projectReadDiagram.ts:47`).

**Medição** (`bringToFront('pl-dph-data')`, depois link `#data=`):

| nó | z no editor | z no viewer |
|---|---|---|
| `pl-dph-data` (painel) | 1 | 0 |
| filhos (`ddb`, `redis`, `sqs`, `cw`) | 2 | 1 |

Neste seed os painéis afetados não se sobrepõem, então a imagem não muda. Com painéis
translúcidos sobrepostos (opacidade padrão 10%, `panel.constants.ts`, e `backdrop-blur-sm`), a
ordem de empilhamento muda a cor composta, e um painel que o autor trouxe para frente fica atrás
no viewer. **HIPÓTESE** sobre o efeito visual em diagramas reais com sobreposição; o mecanismo está
medido.

### 3.3 Componente sem `nodeLayout` — **LIDO NO CÓDIGO**

O editor só renderiza componentes que têm `nodeLayout`
(`diagram/store/selectors/connection.selectors.ts:45`), e só conta conexões cujas duas pontas têm
layout (mesmo arquivo, `useVisibleConnections`). O leitor renderiza qualquer componente não
oculto, com `position: { x: layout?.x ?? 0, y: layout?.y ?? 0 }`
(`projectReadDiagram.ts:46`), e conta **todas** as conexões em `buildConnectionCountPerNode`.

Consequência nas edges: a contagem de conexões define quantos handles cada nó renderiza e em que
slot cada edge ancora (slot `i` de `n` fica em `(i+1)/(n+1)` da altura; ver
`epico-layout-visualization/relatorio.md`). Uma conexão a mais numa ponta desloca verticalmente
todas as outras edges daquele lado. Ocorre em dado importado ou gerado que chegou sem layout.
**Não medido** (os seeds têm layout para todo componente).

### 3.4 Cena ativa — **LIDO NO CÓDIGO**, deliberado

O editor resolve a cena ativa (`getCachedCanvasSnapshot` → `resolveCanvasSnapshot`). O leitor
força a base: `resolveVersionSnapshot(diagram, null)` (`projectReadDiagram.ts:91`), e o link remove
`activeVersionId` do payload (`lib/share-url/encode.ts:47-59`). As duas escolhas estão documentadas
e fazem sentido para compartilhamento. Mas um autor que compara o editor (com cena aberta) ao
link vê componentes, conexões e layouts diferentes (`scene.nodeLayouts` sobrescreve posições).
Classifico como **divergência esperada**. Vale expor ao autor ("este link mostra a base"), não
"corrigir".

### 3.5 Edges: ELK nas entradas `?diagramId` e `?source=file` — **MEDIDO**

`ViewerPage` chama `layoutForVisualization` para essas duas fontes (`pages/ViewerPage.tsx:104`),
que devolve `nodeLayouts` e `edgeLayouts` **novos**, substituindo os do autor
(`viewer/layoutForVisualization.ts:42-53,76-82`).

**Medição**, `d-pl-dp-hub` em `/model/…` × `/viewer?diagramId=…`: 15/15 nós em outra posição; os
4 painéis com outro tamanho (VPC 1680×725 → 2005×931, Public 710×428 → 802×252, …); 8/8 edges com
outro `d`. Isso foi decidido e testado no épico anterior (`ViewerPage.unified.test.tsx`, "arranja
o diagrama nomeado por id sem clique"). Mesmo assim, para quem abre o próprio diagrama por id, a
experiência é "o viewer desenha outra coisa", e é quase certamente parte do que motivou este
relatório. **Decisão de produto em aberto, §6.1.**

### 3.6 Edges: vazamento do diagrama ativo local — **MEDIDO**

**Código.** O `EditableEdge` chama `useControlPoints(connectionId)`, `useSegmentDrag(...)`,
`useEdgeLabelOffset(connectionId)`, `useConnection(connectionId)` e `useActiveDiagramId()`
(`edges/EditableEdge.tsx:80-82,106-107,169`). Todos leem `state.diagrams[state.activeDiagramId]`
(`diagram/store/selectors/layout.selectors.ts:10,17`). O carimbo do leitor só vence **quando a
chave existe**: `if (params.layoutPoints === undefined) return params.storeCorners;`
(`edges/resolveEditableEdgeGeometry.ts:25`). Sem entrada em `diagram.edgeLayouts`, a edge do
viewer cai na store, que é o workspace local de quem está lendo.

O viewer roda no mesmo bundle e hidrata o store do `localStorage`. **MEDIDO:** no viewer,
`useDiagramStore.getState().activeDiagramId === "d-pl-dp-hub"`.

**Medição.** Com waypoints `(1250,120)`/`(1250,600)` gravados em `c4` no store local, gerei um
link **sem** `edgeLayouts['pl-dph-c4']`. O viewer desenhou
`M 1154 127.33 H 1250 V 120 H 1250 V 600 H 1408 V 489.75`, ou seja, os waypoints que só existiam
localmente. O caso real é "o autor compartilhou, depois editou as dobras, e abre o link antigo no
mesmo browser": o link mostra as dobras novas. Os ids de conexão sobrevivem à importação, então
um diagrama importado (ou uma cópia) também pode pegar as dobras de outro.

**O mesmo caminho vaza escrita.** `canDragLabel = Boolean(edgeData.label && activeDiagramId)`
(`EditableEdge.tsx:157`) não olha `elementsSelectable`. **MEDIDO:** 8 labels no viewer com
`cursor-grab` e `pointer-events: auto`. O fim do arraste chama `setEdgeLabelOffset(activeDiagramId, …)`
(`edges/interaction/useEdgeLabelDrag.ts`), que escreveria no diagrama local do leitor.
**Não executei a gravação.**

### 3.7 O que foi descartado como causa

| hipótese | veredito |
|---|---|
| Tipo de edge ou config do RF diferentes | **Não.** Uma chave só, `DIAGRAM_EDGE_RF_TYPE`, e o mesmo `diagramEdgeTypes` (`core/edgeTypes.ts`). O `buildReactFlowShellProps` difere só em input (pan/zoom/snap/seleção), nada de geometria. |
| `snapToGrid` desloca edges | **Não.** Snap afeta só o arraste. As posições renderizadas vêm do layout, e as medições bateram. |
| Tema / dark mode | **Não.** A classe `dark` é aplicada globalmente em `index.html`, antes do React, para as duas rotas. |
| CSS só do editor | **Não afeta cor.** `CANVAS_STYLES` (`Canvas.tsx:280`) cobre cursor, retângulo de seleção e contornos do modo comparação. `ViewerCanvas.css` cobre só os Controls. |
| `buildData` do painel diferente | **Não.** É a mesma função (`panel.element.ts:151`). `lockForReading` só remove callbacks. **MEDIDO:** `backgroundColor` e `borderColor` computados idênticos em todos os painéis. |
| Esmaecimento por seleção | **Exclusivo do editor, legítimo.** `selectionDimOpacity` (`useCanvasNodes.ts:417`) esmaece os não selecionados. Não aparece no viewer porque ele não tem seleção RF, e está certo que seja assim. |

**HIPÓTESE, não verificada:** o editor usa o lookup global de ícones; o viewer usa
`iconLookupForDiagram(diagram)` (`ViewerCanvas.tsx:107`). Um ícone customizado da biblioteca
local, e não do diagrama, pode aparecer só no editor.

---

## 4. Compartilhado × duplicado × exclusivo

### 4.1 Já compartilhado (não mexer)

| camada | módulo |
|---|---|
| Shell RF | `core/DiagramSurface.tsx`, `core/reactFlowBaseConfig.ts`, `core/canvasInteractionPolicy.ts` |
| Tipo de edge | `core/edgeTypes.ts` → `EditableEdge` |
| Portal de labels | `EdgeLabelPortalProvider`/`Host`, montado dentro do `DiagramSurface` |
| Componentes de nó | `useNodeTypes()` (element registry) |
| Dados/estilo de nó | `descriptor.buildData` / `buildStyle` |
| Dados de edge | `edges/data/buildEdges.ts` (`buildEdge`) |
| Derivações de handle | `edges/connectionDerivations.ts` (funções puras) |
| Destaque | `HandleHighlightProvider` + `useCanvasHighlight` |
| Leitura de flow | `useFlowModePlayback`, `FlowReadingRail`, `useFrameReadStep`, `useFlowReadingKeys` |

### 4.2 Duplicado: duas projeções paralelas

| responsabilidade | editor | leitor |
|---|---|---|
| resolver cena | `getCachedCanvasSnapshot` (ativa) | `resolveVersionSnapshot(…, null)` (base) |
| visibilidade de componente | `useVisibleComponents` (tem layout) + `computeNodeVisibility` (hidden, colapso) | `!component.hidden` |
| visibilidade de conexão | `useVisibleConnections` + `filterVisibleConnections` | nenhuma |
| z-index | `layout.zIndex ?? descriptor` | `descriptor` |
| ordem dos nós | grupos, depois profundidade | topológica |
| montar `NodeBuildContext` | `useCanvasNodes` (`dataCtx` + callbacks) | `buildReadNodeContext` |
| montar nó RF | `useCanvasNodes` (+ cache de identidade) | `buildReadNode` |
| montar edges RF | `useCanvasEdges` (+ cache de identidade) | laço em `projectReadDiagram` |
| geometria da edge | store do diagrama ativo | carimbo `layoutPoints`, com fallback para a store (§3.6) |

Cada linha dessa tabela é um lugar onde uma regra nova entra de um lado só. As quatro divergências
do §3 são exatamente isso.

### 4.3 Exclusivo do editor: lista do que não pode quebrar

- Arrastar nó com `useLocalNodes` (cópia local durante o gesto, `publishDragFrame`, um `set()` por
  gesto). Frágil, tem testes, `AGENTS.md` pede cuidado.
- Reparentar no arraste (`useNodeDragParenting`: `dragTargetPanelId`, `unparentCandidatePanelId`).
- Seleção: marquee, multi-seleção com Meta/Ctrl/Shift, `selectionDimOpacity`, `NodeQuickActionsBar`.
- Funil de ponteiro: pan com botão direito sobre nós, menu de contexto, `panel-body` que repassa o
  clique ao pane (`PanelNode.tsx`).
- Edição de edge: pontos de controle, arraste de segmento e de canto, guias de snap, `EdgeToolbar`,
  reconectar, arrastar label, reset com duplo clique.
- Conectar (`onConnect`/`onConnectEnd`), `QuickInsertPopover`, reordenar handles (`onReorderHandle`).
- Redimensionar (`NodeResizer`), colapsar/expandir painel (`onToggleCollapse`), edição inline de
  nota e JSON viewer, drill-down, adicionar endpoint.
- Modo comparação (`compareVisual`, badges, opacidade de conexão), filtro de tags, previews
  pendentes do LLM (`node-pending`/`edge-pending`), cobertura, gravação de flow.
- Presença colaborativa (`useCollabHighlight`, `usePeerOnNode`, `CollabEdgeHighlight`).
- Travas: `locked`, ancestral travado, endpoint preso em ApiGroup, travas de cena.
- Chrome: MiniMap, `CanvasViewOptions`, `NothingInViewCard`, sidebar, busca, command palette, chat.
- Input: roda do mouse customizada, `panOnDrag=[1,2]`, `selectionOnDrag`, snap-to-grid, drag threshold.
- Viewport persistido (`defaultViewport`/`onMoveEnd`).

### 4.4 Exclusivo do leitor: lista do que não pode quebrar

- Pan e zoom nativos (`panOnScroll`, `zoomOnScroll`, `zoomOnPinch`), zoom máximo de leitura e
  padding de fit (`FIT_VIEW_OPTIONS_READ`).
- Clique para focar (`focusedNodeId` expande a descrição do card) e clique em edge para destacar as
  pontas, sem seleção RF.
- Nós travados (`draggable/selectable/connectable=false`, `lockForReading`), com
  `.flow-play-control` reabilitando `pointer-events` (`ViewerCanvas.css`).
- Base sempre, sem cena ativa; `activeVersionId` removido no encode.
- ELK automático em `?diagramId`/`?source=file` e **nunca** em `#data=`/`postMessage`
  (`ViewerPage.unified.test.tsx`).
- Estado de flow local (sem store), `FlowInvite`, `initialFlowId` respeitado uma vez.
- Lookup de ícones por diagrama (`iconLookup`).
- Protocolo de embed (`STRUCTURA_READY/LOAD/LOADED`), `OpenInStructuraButton`, banner de
  importação do `#share=`.
- Rota fora de `MainPages` (sem toaster, modal de plugin, preview sync), e o viewer é chunk lazy
  próprio.
- `/viewer` e `#data=` são URLs públicas já distribuídas (links e iframes de terceiros), então o
  contrato do payload (`Diagram` inteiro em JSON) não pode quebrar.

---

## 5. Proposta: um core de projeção, dois consumidores

### 5.1 Forma

```
                ┌──────────────────────────────────────────────┐
  Diagram  ───▶ │ resolveViewSnapshot(diagram, view)           │  puro, features/canvas/core
                │   cena · visibilidade · colapso · z · ordem  │
                └──────────────┬───────────────────────────────┘
                               ▼
                ┌──────────────────────────────────────────────┐
                │ projectDiagram(snapshot, ctx, policy)        │  puro
                │   → { nodes: Node[], edges: Edge[] }         │
                │   nós: descriptor + visibility + lock        │
                │   edges: buildEdge + geometria carimbada     │
                └──────────────┬───────────────────────────────┘
               ┌───────────────┴────────────────┐
               ▼                                ▼
   useWriteDiagramFlow (editor)       useReadDiagramFlow (leitor)
   + cache de identidade              useMemo simples
   + useLocalNodes (drag)
   + overlays: seleção, compare,
     tags, pending LLM, coverage
```

Princípios:

1. **Um `resolveViewSnapshot` só** decide quem aparece, com que z e em que ordem, e recebe
   `{ versionId, respectUserZ: true, hideCollapsedDescendants: true, requireLayout: true }`. O
   leitor passa `versionId: null`, e **só isso** deve diferir. As quatro regras do §3.1-3.4 passam a
   existir uma vez. `computeNodeVisibility` vira parte dele (a parte de seleção fica como overlay
   do editor).
2. **Um `projectDiagram` puro.** `projectReadDiagram` já é quase isso. O trabalho é o editor passar
   a chamá-lo e empilhar por cima, como **overlays**, o que é dele: seleção, dim, compare, tags,
   pending, classes de trava. Um overlay só pode *acrescentar* estilo e flags de interação; nunca
   muda posição, tamanho, z ou geometria. Assim, "mesmo dado → mesma figura" vira propriedade da
   arquitetura, e não uma disciplina a manter.
3. **Edge sem store.** Toda geometria (pontos, cantos, label offset) chega pelo `data` da edge,
   carimbada a partir de `diagram.edgeLayouts` pelos **dois** modos. O `EditableEdge` só lê a
   store para *escrever*, e só quando a política é de escrita. Os hooks de gesto
   (`useControlPoints`, `useSegmentDrag`, `useEdgeLabelDrag`) recebem os pontos de entrada em vez
   de buscá-los, e o `diagramId` de escrita vem de contexto (`null` no leitor). Isso fecha o §3.6
   por construção. Sem store em `EditableEdge` no leitor, `useConnection` também sai: `EdgeToolbar`
   só monta com `elementsSelectable`, e pode receber a conexão por `data`.
4. **A política é a única chave.** `DiagramSurfacePolicy` (já existe) passa a ser lida pela
   projeção também: `kind: "read"` → nós travados (hoje `lockForReading`), labels não
   arrastáveis, sem affordances. Nada de `if (viewer)` espalhado.
5. **ELK é pré-processamento, não renderização.** `layoutForVisualization` continua fora do core:
   ele produz um `Diagram` que entra na mesma projeção. A decisão de rodá-lo (§6.1) fica na rota.

### 5.2 Ordem de migração (fatias pequenas, cada uma entregável sozinha)

Cada fatia leva um teste de **paridade**: o mesmo `Diagram` passa pela projeção de escrita
(`policy=write`, sem seleção) e pela de leitura, e os `nodes`/`edges` têm de bater em posição,
tamanho, z, `hidden` e dados de geometria. O teste falha antes e passa depois.

| # | fatia | risco | observação |
|---|---|---|---|
| 1 | **Fechar o vazamento da store no `EditableEdge`.** O leitor carimba `layoutPoints: []`/`layoutLabelOffset` para **toda** edge, não só para as que têm entrada; e `canDragLabel` passa a exigir `elementsSelectable`. | baixo | Corrige §3.6 sem refatorar. `resolveStepCorners([])` já dá o Z padrão, o mesmo que o editor usa quando não há pontos. |
| 2 | **Paridade de visibilidade no leitor**: esconder descendentes de painel colapsado/oculto, exigir layout, filtrar edges com ponta oculta. Reusar `computeNodeVisibility`/`buildCollapsedPanelIds` dentro de `projectReadDiagram`. | baixo | Corrige §3.1 e §3.3. Atenção à contagem de conexões: tem de ser a mesma que o editor usa (hoje o editor conta as de nós colapsados; manter). |
| 3 | **z-index do layout no leitor** (`layout?.zIndex ?? descriptor.zIndex`). | baixo | Corrige §3.2. |
| 4 | **Extrair `resolveViewSnapshot`** e fazer as **duas** projeções o usarem. O editor passa a consumir a versão pura em `useVisibleComponents`/`computeNodeVisibility`. | médio | É aqui que as regras deixam de ser duplicadas. Seletores do store no caminho quente: medir com `canvas-hot-path.md` na mão. |
| 5 | **`useCanvasNodes`/`useCanvasEdges` passam a chamar `projectDiagram` + overlays.** Os caches de identidade ficam **fora** da função pura, como hoje. | **alto** | Hot path. Não tocar em `useLocalNodes`. Critério de aceite: stress Cypress (`cypress/e2e/stress-*`) sem regressão, e as mesmas contagens de render que o `docs/concepts/canvas-hot-path.md` registra. |
| 6 | **Edge sem store no editor também**: geometria sempre via `data` (carimbo a partir de `edgeLayouts`), com os hooks de gesto recebendo os pontos de entrada. | **alto** | Toca a camada que `37b43e6` investigou (remount no commit do drag). O rascunho de gesto (`draftPoints`/`draftCorners`) continua local. Só o valor "em repouso" muda de fonte. Medir identidade de `data` para não recriar a edge a cada store write. |
| 7 | Remover `lockForReading` a favor da política; apagar `buildReadNode`/laço duplicado. | baixo | Limpeza, depois que 5 e 6 estabilizarem. |

As fatias 1-3 resolvem **todas** as divergências medidas sem encostar no hot path do editor.
Da 4 em diante, o trabalho é garantir que elas não voltem.

### 5.3 Riscos

- **Hot path do editor** (fatias 5-6). A pureza tem custo se recriar objetos: o cache de
  identidade por nó e por edge precisa sobreviver, e `data` de edge não pode ganhar campo com
  identidade nova a cada render (é por isso que `useCanvasEdges` faz `shallowEqualRecord`).
- **Contagem de handles** tem de ser idêntica entre `buildEdgeHandleAssignments` e o que o nó
  renderiza. Uma divergência aí é o erro #008 do React Flow e uma edge perdida sem aviso
  (`PanelNode.tsx:35-41`). Qualquer mudança de visibilidade (fatia 2) tem de manter as duas
  pontas lendo a **mesma** lista de conexões.
- **Contrato do payload.** O leitor recebe `Diagram` cru de links antigos. Os campos opcionais
  (`edgeLayouts` ausente, `hidden` removido pelo `stripForShare`, `collapsed` ausente) precisam de
  default, e os testes de `ViewerPage.unified.test.tsx` continuam valendo.
- **ELK × waypoints à mão** (§6.1): se o viewer passar a respeitar os waypoints do autor, o perfil
  `visualization` foi afinado contra outra coisa (`relatorio.md` §3.8).
- **Barrels e chunk.** O viewer é chunk lazy. Puxar `useCanvasNodes` (que importa
  `@/features/llm`) para o core arrastaria o LLM para o chunk do viewer. O core puro não pode
  importar LLM, collab nem store; overlays ficam no editor.

---

## 6. Decisões do dono

1. **`?diagramId` deve continuar re-arranjando com ELK?** Hoje ele descarta posições e dobras do
   autor (§3.5). Opções: (a) manter; (b) respeitar o layout salvo e oferecer "arranjar" como botão;
   (c) rodar ELK só quando o diagrama não tem layout. A fatia 1 **não** depende disso.
2. **Cena ativa no link.** Manter "sempre base" (atual) e avisar no `ShareModal`, ou deixar o autor
   escolher a cena que o link mostra.
3. **O leitor deve respeitar colapso?** A recomendação é sim (a figura do autor), com o botão de
   expandir liberado como `.flow-play-control` para quem lê. Não mudar é a alternativa, mas aí o
   editor devia *mostrar* a mesma coisa, e hoje não mostra.

---

## 7. Não verificado

- §3.3 (componente sem layout) e §3.4 (cena) foram lidos no código, não medidos.
- O **efeito visual** do §3.2 com painéis sobrepostos: medi o z divergente, não a cor composta
  resultante.
- Gravação pelo arraste de label no viewer (§3.6): medi a affordance, não executei o gesto.
- `postMessage` e `?source=file`: seguem o mesmo `ViewerCanvas`/`projectReadDiagram` e não foram
  abertos no browser.
- O ícone customizado (hipótese no fim do §3.7).
- Diagramas que já trazem `edgeLayouts` de fábrica: os seeds têm 0 entradas, então os casos de
  waypoint foram criados na sessão.

---

## 8. Como foi medido

- Dependências instaladas com `npm ci` (não altera o lockfile). `git status --porcelain` ficou
  vazio no início e no fim.
- `vite --port 8097 --strictPort`, iniciado em sessão própria (`os.setsid` via Python, porque o
  macOS não tem `setsid`), PID salvo em arquivo e derrubado com `kill <PID>`. Sem `pkill`,
  `killpg` ou `kill -- -PID`. A porta 8097 estava livre antes e depois.
- Uma instância Playwright, uma aba, fechada no fim. As mutações (colapso, `bringToFront`,
  waypoints) foram feitas no perfil isolado do Playwright, nunca no browser do usuário.
- Por cenário, o mesmo script coleta de cada `.react-flow__edge` o atributo `d` e, de cada
  `.react-flow__node`, `transform`, `zIndex`, tamanho e `backgroundColor`/`borderColor`
  computados. Os pares editor × viewer são comparados por script.
- Links gerados pelo próprio `generateViewerUrl` a partir do diagrama da store.
- Evidências (PNGs e JSONs) ficaram no scratchpad da sessão, fora do repo.

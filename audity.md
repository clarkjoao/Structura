---

# Structura — Audit Consolidado + Plano de Ação

## TL;DR

Projeto **bem arquitetado** na camada de domínio (slices Zustand scene-aware, discriminated unions, guards manuais, persist versionada v11 com migrações idempotentes). Os problemas estão concentrados em **(a) bundles (barrel files arrastando tudo)**, **(b) perda silenciosa de undo/persistência em mutations de services/scenes**, **(c) hooks gigantes no canvas** que precisam ser decompostos, e **(d) duplicação de aliases deprecated que nunca foram removidos**.

A evolução para SaaS/Stateful é viável sem reescrever o domínio: o `IStoragePort` já é o ponto de injeção natural, e o Zustand store é trivialmente particionável em "remote-first" vs "local-first". O maior risco é o bundle do viewer ser rompido pelo barrel de `@/features/canvas` — corrigir isso **antes** de partir para SaaS.

---

## 1. Inventário e modelo mental (resumo)

**Domínio (`features/diagram/`)** — modelagem forte: `Component` é discriminated union de 14 membros, persistido em `PERSIST_SCHEMA_VERSION = 11` com migrações idempotentes. Store Zustand + Immer com 14 slices + 1 selector de scene state. Persistência via `IStoragePort` (Hexagonal, 4 adapters: LocalStorage, FileSystem, InMemory, Sync). Sem Zod; guards manuais.

**Canvas (`features/canvas/`)** — adapter React Flow + 12 descriptors registrados em registry mutável (plugin-friendly). Hooks orquestrais: `useCanvasController → useCanvasGraphState → {useCanvasNodes, useCanvasEdges}` + `useCanvasInteraction → useCanvasKeyboard`. Separação exemplar em `edges/{geometry, interaction, components, overlays, data}`. **Ponto crítico:** `useLocalNodes.ts` (259L) é explicitamente marcado como "sharp edge" no AGENTS.md — toca em drag/resize de nodes.

**Features satélite** — llm (824L em `store.ts`), walkthroughs (com aliases `Journey*` ainda vivos em `pages/walkthroughs/`), plugins (sem `index.ts` quebrando convenção), collaboration (WebSocket via `server/`), integrations (GitHub/DefectDojo), persistence infra.

**Tooling** — Vite + plugin virtual `virtual:structura-bundled-plugins` para embedar IIFEs de plugins. `tools/build-with-plugins.mjs` orquestra. CI em 4 jobs (lint/typecheck/test/build) com release em tag. `dependabot.yml` agrupando `@radix-ui/*` e dev-deps.

**Pontos de acoplamento** — fluxos respeitam unidirecionalidade `diagram ← canvas ← {collab, llm, walkthroughs, custom-components}`. `diagram → {cloud, icons, integrations}` (cloud types e useIconStore). Canvas é o "núcleo de composição" e o **único** consumidor maciço do barrel de diagram.

---

## 2. Bugs latentes (causa → impacto → correção)

### 🔴 ALTA — Persistência e undo silenciosamente quebrados

| #   | Onde                                                                                                                             | Causa                                                                                                                                                                  | Impacto                                                                                                                                    | Correção                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | `features/diagram/store/slices/services.slice.ts:128-142` (`removeService`)                                                      | Não chama `pushHistory` nem `touchDiagram`; limpa `serviceId` em todos os componentes                                                                                  | Undo não restaura service; `updatedAt` não muda → flush debounced não dispara; em FS sync, próximo commit não detecta a mudança            | Adicionar `pushHistory(state, STRUCTURAL_MUTATION_MARKER)` e `touchDiagram(diagram)` antes/depois da mutação; mover o loop de limpeza de `serviceId` para depois do push |
| B2  | `services.slice.ts:144-161` (`linkComponentToService`)                                                                           | Mesma família — sem `pushHistory`/`touchDiagram`. Quando `serviceId` muda de A→B, campos de A não são limpos                                                           | Vinculação não entra no undo; tags/technology de A vazam em B; mesmo problema de B1                                                        | Idem; quando `serviceId` muda para um novo, limpar `comp.tags`/`technology`/`externalLinks` herdados do anterior                                                         |
| B3  | `services.slice.ts:163-177` (`linkComponentToDiagram`)                                                                           | Mesma família                                                                                                                                                          | Mesma quebra de undo + persist                                                                                                             | Idem                                                                                                                                                                     |
| B4  | `features/diagram/store/slices/scenes.slice.ts:78-94` (`removeScene`), `:217-245` (`addComponentToScene`/`addConnectionToScene`) | Só `touchDiagram`, sem `pushHistory`                                                                                                                                   | Undo coalesce pode restaurar cena anterior mas não o delete; drag imediato após add a cena coalesce com o add — perde histórico            | Adicionar `pushHistory(state, STRUCTURAL_MUTATION_MARKER)`                                                                                                               |
| B5  | `features/diagram/store/slices/diagram.slice.ts:118-126` (`deleteDiagram`)                                                       | Zera `activeDiagramId = null` em vez de escolher outro diagrama                                                                                                        | UI cai em "sem diagrama ativo" (tela em branco); UX ruim; também sem undo (correto para delete, mas não há feedback "fallback to another") | Após `delete`, se `activeDiagramId === id`, escolher outro diagrama do store (`Object.keys(state.diagrams)[0] ?? null`); mostrar toast "Switched to <name>"              |
| B6  | `features/diagram/store/slices/flows.slice.ts:55-57` (`addFlow`)                                                                 | `state.diagrams[diagramId].snapshot.flows[flow.id] = flow` sem re-check após `set()` — race se diagrama foi deletado entre `get()` e `set()`. Não chama `touchDiagram` | Crash raro (race); persistência atrasada                                                                                                   | Re-checar `state.diagrams[diagramId]` dentro do `set`; chamar `touchDiagram(d)`                                                                                          |

### 🟠 MÉDIA — Stale state, memory leaks, listeners

| #   | Onde                                                                            | Causa                                                                                                                                                                                           | Impacto                                                                                                                                                                                                        | Correção                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B7  | `features/diagram/store/persist.config.ts:479-594` + `diagram.store.ts:87-111`  | `flushDiagramStoreToLocalStorageNow` bypassa o wrapper, escreve direto; `wrapIStoragePortWithDiagramPersistTracking.schedulePersist` mantém `pendingPersist`. Duas ordens de write concorrentes | Backup pré-merge pode ser sobrescrito por write debounced posterior (escritas fora de ordem); estado inconsistente em caso de quota cheia                                                                      | Tornar `flushDiagramStoreToLocalStorageNow` a única API de write; fazer `wrapIStoragePortWithDiagramPersistTracking.setItem` chamar diretamente a função `flush` quando `force=true` |
| B8  | `features/canvas/hooks/useLocalNodes.ts:48-55`                                  | Mutação de refs **durante render** (`prevActiveDiagramIdRef.current = activeDiagramId`, etc.)                                                                                                   | Em StrictMode dev, segunda renderização vê refs em estado "reset" e pode perder estado de drag/resize durante transição de diagram; warning React                                                              | Mover para `useLayoutEffect` com dep `[activeDiagramId]`, ou guardar a mutação atrás de flag "firstRender"                                                                           |
| B9  | `features/canvas/hooks/useCanvasEffects.ts:113-151` (wheel listener)            | `useEffect` captura `el = document.querySelector(".react-flow__renderer")`; cleanup usa essa referência. Se React Flow remonta o node, `el` é stale, `removeEventListener` falha                | Memory leak: N listeners wheel acumulados após N trocas de diagram/modo; zoom/pan dispara múltiplas vezes                                                                                                      | Usar ref para o el, ou escutar no wrapper (`reactFlowWrapperRef`) que é estável. Ideal: `useReactFlow().getWrapper()`                                                                |
| B10 | `features/canvas/hooks/useCanvasInputProfile.ts:86-114`                         | Listener wheel em `window` sem debounce; ciclo toggle de `prefersTouchCanvasUi` pode acumular                                                                                                   | Acúmulo de listeners em devices híbridos                                                                                                                                                                       | Debounce o `setProfile` com 200ms; ou usar ref para o listener atual                                                                                                                 |
| B11 | `features/diagram/store/diagram.store.ts:136-140` + `persist.config.ts:516-552` | Dois `beforeunload` listeners adicionados em module-load, sem cleanup                                                                                                                           | Em HMR dev ou testes, múltiplos flushes concorrentes no refresh; possíveis escritas corrompidas                                                                                                                | Consolidar em um único handler exposto por `infrastructure/persistence/`; remover o do `diagram.store.ts`; em `persist.config.ts` devolver o `unsubscribe`                           |
| B12 | `features/diagram/store/persist.config.ts:516-552`                              | Não escuta `visibilitychange` (recomendado pelo WHATWG para mobile)                                                                                                                             | Mobile (iOS Safari) não dispara `beforeunload` no fechamento de tab — perda silenciosa de até 1s de trabalho                                                                                                   | Adicionar listener `visibilitychange` → `document.visibilityState === "hidden"` → flush                                                                                              |
| B13 | `features/llm/llm-storage.ts:416-444` + `features/llm/store.ts:508-510`         | `saveThreadsForDiagram` reescreve `localStorage.setItem(CHAT_HISTORY_KEY, ...)` a partir de cache possivelmente vazio durante hidratação                                                        | Se usuário enviar mensagem antes de `hydrateChatThreadsCacheFromIdb()` terminar, snapshot localStorage é reescrito com dados parciais — **apagando threads de outros diagrams que estavam no fallback legado** | Bloquear `save` durante hidratação (`if (!isChatThreadsHydrated()) return;`); ou fazer migração legacy→IDB ser síncrona no boot antes de montar o app                                |
| B14 | `features/llm/apply-diagram-patch.ts:112-127`                                   | `void computeAutoLayout(...).then(...)` sem `.catch`                                                                                                                                            | Unhandled rejection mascara erros de ELK em produção                                                                                                                                                           | Adicionar `.catch(err => console.error("[llm] auto-layout failed:", err))`                                                                                                           |
| B15 | `infrastructure/persistence/useFileSystemStorage.ts:96-154`                     | `useEffect(..., [])` chama `bootFileSystem().then(...)` sem cleanup; em StrictMode monta duas vezes; `setStatus("connected")` pode ser setado duas vezes com fontes diferentes                  | Estado inconsistente de status durante boot                                                                                                                                                                    | Adicionar flag `bootStartedRef` para evitar boot duplicado; usar `useRef` para o controller ativo                                                                                    |

### 🟢 BAIXA — cosmetic / semantic drift

| #   | Onde                                                                              | Causa                                                                                                               | Impacto                                                                | Correção                                                                                                                          |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| B16 | `features/canvas/hooks/useCanvasInteraction.ts:186-188`                           | `setFocusTitleTrigger(0)` no effect (reseta) vs `setFocusTitleTrigger(value => value + 1)` no callback (incrementa) | Comportamento ambíguo: incrementa no trigger manual, reseta em seleção | Escolher um: ou rename `resetFocusTitle` para `0` e `requestFocusTitle` para increment; ou apenas passar um id para o filho focar |
| B17 | `features/diagram/store/slices/icons.slice.ts:20-37`                              | `pushHistory` antes do null-check do diagram                                                                        | Em race delete+removeIcon, snapshot de undo corrompido                 | Mover `pushHistory` para depois do null-check                                                                                     |
| B18 | `features/diagram/store/slices/flows.slice.ts:170-196` (`convertStepToCondition`) | Substitui `step.branches` sem limpar steps antigos se chamado duas vezes no mesmo step                              | Steps órfãos no flow; undo pode ficar inconsistente                    | Antes de criar novas branches, deletar as anteriores (`delete flow.steps[oldStep.id]`)                                            |

> **Verificação importante:** o bug documentado no CHANGELOG v0.1.0 ("Latent bug in `migrateServiceRegistryToServiceCatalog`: the v7 → v8 migration had `delete record.serviceCatalog` instead of `delete record.serviceRegistry`") foi confirmado **já corrigido** em `persist.config.ts:296` (`delete state.serviceRegistry`). Sem ação.

---

## 3. Performance (impacto esperado)

### 🔴 ALTA

| #   | Onde                                                                                                | Problema                                                                                                                                                                                                                                                                                             | Impacto                                                                                                   | Correção                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `features/canvas/components/ViewerCanvas.tsx:38` + `features/viewer/components/embedNodeTypes.ts:2` | `import { NODE_TYPE_REGISTRY, EditableEdge } from "@/features/canvas"` puxa **todos os 12 descriptors** (PanelNode 9.2K, SwimlaneNode 7.3K, NoteNode 14.2K, ApiGroupNode, DbTableNode, JsonViewerNode, SvgNode, CustomNode, etc.) no chunk do viewer — exatamente a rota que deveria ser a mais leve | ~80-120 KB no bundle do viewer; quebra lazy loading documentado em AGENTS.md                              | Trocar para `import { NODE_TYPE_REGISTRY, EditableEdge } from "@/features/canvas/nodes/node-types"`; idem `walkthroughs/editor/RightPanel.tsx` para `sanitizeSvg` → import direto de `canvas/utils/svg.sanitizer` |
| P2  | `features/diagram/store/slices/history.slice.ts:14-37, 64-69, 96-102`                               | `deepClone` faz 3 `structuredClone` por checkpoint no hot path; chamado em **toda mutação estrutural** (20+ call sites)                                                                                                                                                                              | Em diagramas grandes, jank visível durante paste/drag-resize (50-200ms); CHANGELOG/ROADMAP já flagam isso | Trocar por Immer: `const snap = current(state.diagrams[id].snapshot)` é O(1) ref. Para undo/redo (linhas 64-69, 96-102), basta um clone do estado atual antes de sobrescrever                                     |
| P3  | `features/diagram/store/persist.config.ts:28` + `diagram.store.ts:136-140`                          | `PERSIST_DEBOUNCE_MS = 1000` + dois `beforeunload` listeners competindo                                                                                                                                                                                                                              | Mobile: perda silenciosa de até 1s de trabalho; flush race em desktop                                     | Adicionar `visibilitychange`; consolidar em **um** handler que lê o store vivo e escreve uma vez                                                                                                                  |
| P4  | `features/canvas/nodes/useCanvasNodes.ts:248-292`                                                   | `dataCtx` tem 17 deps; `panelIds`/`selectedNodeIds`/`highlightedNodeIds` são Sets criados a cada render em hooks ancestrais                                                                                                                                                                          | Em multi-select, cada toggle reconstrói **todos os nodes** (500 nodes × 5-10k operações de diff)          | `useStableSetByContent` (análogo ao `useStableListByRefEquality` existente, mas por membership). Redução estimada: 60-80% em diagramas &gt;200 nodes                                                              |
| P5  | `App.tsx:94-100` + `features/walkthroughs/components/WalkthroughPlayerBar`                          | `<WalkthroughPlayerBar />` montado eagerly fora do `<Suspense>` em todas as rotas                                                                                                                                                                                                                    | ~30-50 KB no chunk inicial; infla TTI                                                                     | Wrap em `lazy()` + Suspense com `null` fallback                                                                                                                                                                   |

### 🟠 MÉDIA

| #   | Onde                                                      | Problema                                                                                                                                                                                | Correção                                                                                                                                                               |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6  | `features/canvas/hooks/useCanvasController.ts:62-150`     | 5 `useMemo` de wrappers triviais (`flowContext`, `compareContext`, `nodeSelectionState`, `visualContext`, `selectionCallbacks`) entram em deps de hooks filhos → cascade de invalidação | Mover montagem para dentro de `useCanvasGraphState` e usar `useShallow`; cortar intermediários (`useCanvasNodes` recebe `flowState.isPlaying` em vez de `flowContext`) |
| P7  | `features/canvas/hooks/useCanvasVisualState.ts:148-204`   | Hook retorna objeto com 22 deps memoizadas; consumers usam subsets                                                                                                                      | Dividir em `useCanvasSelection`, `useCanvasHighlight`, `useCanvasContextMenus`                                                                                         |
| P8  | `features/canvas/hooks/useStableListByRefEquality.ts`     | Wrapper redundante com `useShallow` que já roda nos selectors upstream                                                                                                                  | Remover; consertar upstream com seletores mais granulares                                                                                                              |
| P9  | `features/canvas/hooks/useCanvasEventHandlers.ts:372-405` | `useMemo` final de 12 callbacks que nunca batem em shallow-equal                                                                                                                        | Retornar literal — React Flow diffa por nome                                                                                                                           |
| P10 | `features/canvas/flow/useFlowModeRecording.ts` (660L)     | 25 `useCallback` num único hook; cada `mode` change invalida tudo                                                                                                                       | Decompor em `useRecordingLifecycle`, `useRecordingStepActions`, `useRecordingBranchActions`, `useRecordingContext`                                                     |
| P11 | `features/canvas/layout/autoLayoutEngine.ts:2`            | `import ELK from "elkjs/lib/elk.bundled.js"` eagerly puxa ~250 KB minified                                                                                                              | Tornar lazy: `let elkPromise; async function getElk() { ... }`                                                                                                         |
| P12 | `features/canvas/nodes/useCanvasNodes.ts:291`             | `flows` array como dep do `dataCtx` (identity muda a cada render)                                                                                                                       | Trocar para `flowIds` derivada                                                                                                                                         |
| P13 | `features/canvas/edges/useCanvasEdges.ts:48`              | `pendingEdgeIds = useMemo(...)` recalcula tudo a cada `pendingPreviews` change                                                                                                          | Calcular inline por edge                                                                                                                                               |

### 🟢 BAIXA

| #   | Onde                                                                                        | Correção                                                                                  |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P14 | `features/canvas/hooks/useCanvasGraphState.ts:109-114` — `journeyPlayer.mode.kind` como dep | Usar `mode` completo via `useShallow` (já é objeto imutável identity-stable)              |
| P15 | `features/diagram/store/diagram.store.ts:161-240` (`useDiagramActions` retorna 75 actions)  | Adotar `useComponentActions`/`useLayoutActions`/etc nos 20+ call sites que só usam subset |
| P16 | `src/features/canvas/canvas.constants.ts` re-exporta constants de `@/features/diagram`      | Consumir direto do `@/features/diagram`; remover re-exports                               |

---

## 4. Code smells / duplicação / complexidade

### 🔴 ALTA

| #   | Onde                                                                                  | Smell                                                                                              | Refatoração                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `features/diagram/store/slices/components.slice.ts:118-223` (`buildComponentForType`) | 14 `else if` em vez de table-driven; cada novo tipo vira 1 branch + risco de cair no `_exhaustive` | Substituir por `Record<ComponentType, (ctx) => Component>` ou reduzir a default "passthrough" para tipos simples (C4, Aws, Gcp, Azure, plugin)                                        |
| S2  | `features/diagram/index.ts` (327L) e `features/canvas/index.ts`                       | Barrels com 60+/20+ re-exports; 284 arquivos importam o barrel inteiro                             | Quebrar em sub-barrels: `@/features/diagram/types`, `/store`, `/utils`. Migrar "always-mounted" consumers (`App.tsx`, `Navbar`, `viewer`, `walkthroughs/editor`) para imports diretos |

### 🟠 MÉDIA

| #   | Onde                                                                                                                     | Smell                                                                                                                                              | Refatoração                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| S3  | `features/walkthroughs/index.ts`                                                                                         | Aliases `Journey*` deprecated ainda consumidos por `pages/walkthroughs/WalkthroughsPage.tsx:9` (`JourneyCard`) e `WalkthroughEditorPage.tsx:12-23` | Migrar pages para nomes canônicos; remover aliases do barrel — CHANGELOG já marcou "uma release"; está atrasado        |
| S4  | `features/diagram/store/slices/clipboard.slice.ts`                                                                       | `importDrawioResult`/`importMermaidSequenceResult` moram aqui mas são mutators estruturais (não clipboard)                                         | Mover para `import.slice.ts` ou `slices/drawio-import.slice.ts`                                                        |
| S5  | `features/canvas/navigation/DiagramSidebar.tsx` (523L)                                                                   | God component com 3 sub-componentes locais + 4 helpers                                                                                             | Extrair `SidebarFolderTree` para arquivo próprio; reduzir a ≤150L                                                      |
| S6  | `features/canvas/toolbar/QuickInsertPopover.tsx:334-450`                                                                 | `switch(activeCategory)` com 8 cases repetindo `if (!q) return []`                                                                                 | Table de builders + helper `filterByQuery(opts, q)`                                                                    |
| S7  | `features/canvas/hooks/useCanvasInteraction.ts` (304L)                                                                   | Agrega drill + keyboard + events + save + search + sidebar                                                                                         | Já parcialmente decomposto em sub-hooks; mover state de sidebar/search para `useCanvasDiagramNavigation` que já existe |
| S8  | `features/canvas/hooks/useNodeDragParenting.ts` (458L)                                                                   | Lógica de drag-parenting + grid + unparenting                                                                                                      | Decompor em `useDragParenting` + `useDragParentingGrid`                                                                |
| S9  | `features/canvas/hooks/useCanvasController.ts:62-150`                                                                    | 5 `useMemo` wrappers                                                                                                                               | Cortar intermediários (ver P6)                                                                                         |
| S10 | `lib/export-core/`                                                                                                       | Zero consumidores em `src/` (verificado via grep)                                                                                                  | Mover para `plugins/structura-plugin-leanix/src/lib` ou marcar como export-only de plugin                              |
| S11 | `features/diagram/model/component.types.ts:241-256`                                                                      | Union `Component` com 14 membros                                                                                                                   | Introduzir `type CloudComponent = AwsComponent \| GcpComponent \| AzureComponent` para narrow mais limpo               |
| S12 | `features/canvas/panels/NodeContextMenu.tsx` (396L) + `features/canvas/selection-actions/NodeQuickActionsBar.tsx` (393L) | Compartilham `useDiagramActions` mas cada um tem seus handlers de copy/delete/group/ungroup                                                        | Extrair `useSelectionNodeActions` hook compartilhado                                                                   |
| S13 | `features/canvas/canvas.constants.ts:60-78`                                                                              | `CANVAS_STYLES` (CSS string) + re-exports duplicados de `@/features/diagram`                                                                       | Mover CSS para `index.css`; remover re-exports                                                                         |
| S14 | `features/canvas/nodes/useCanvasNodes.ts:345-355`                                                                        | `getParentDepth` recursivo O(n) — mesmo arquivo já tem `depthCache` mas só no nível superior                                                       | Usar `WeakMap` keyed por componente                                                                                    |
| S15 | `pages/Index.tsx` + `components/LandingPage.tsx`                                                                         | `App.tsx` redireciona `/` para `/workspace` — page morta                                                                                           | Remover (ver DC4)                                                                                                      |

### 🟢 BAIXA

| #   | Onde                                                                                   | Refatoração                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S16 | `src/lib/keyboard-utils.ts` (28 consumidores) re-exporta `keyboard-keys.ts`            | Mover `KEY` para `keyboard-utils.ts`; deletar `keyboard-keys.ts`                                                                                                                                                                        |
| S17 | `lib/utils.ts` mistura `cn` (universal) com `colorWithOpacity` (1 consumidor)          | Mover `colorWithOpacity` para `canvas/nodes/ExternalElementNode.tsx` (único consumer)                                                                                                                                                   |
| S18 | `features/canvas/toolbar/DiagramDescriptionField.tsx`                                  | Prop `editLocked` ignorada; virar `useActiveDiagramModel` direto                                                                                                                                                                        |
| S19 | `features/canvas/toolbar/SceneDrawer.tsx:397` (`ConnectedSceneDrawer`)                 | Fundir com `SceneDrawer` puro; mover versão pura para `__tests__/`                                                                                                                                                                      |
| S20 | `components.slice.ts:238,246` — magic numbers `{ x: 300, y: 300 }`, `{ x: 40, y: 40 }` | Extrair para `layout.constants.ts`                                                                                                                                                                                                      |
| S21 | `useCanvasNodes.ts:405` — `style.transition = "opacity 0.2s ease"` inline              | Mover para constant                                                                                                                                                                                                                     |
| S22 | `features/diagram/utils/` (vários utils só re-exportados sem consumidor real)          | Limpar barrel: `flow-mermaid`, `flow-repair`, `flow-traversal`, `flow-duplicate`, `flow-migration`, `recording-to-flow`, `scene.utils`, `fit-group-to-children`, `api-group-size`, `component-lock`, `handle-order`, `template-sharing` |
| S23 | `lib/catalogs/patterns.ts:3` — único `TODO(i18n)` no projeto                           | Documentar em `ROADMAP.md` ou traduzir                                                                                                                                                                                                  |

---

## 5. Dead code confirmado

> **Regra do usuário:** nada será removido automaticamente — listado aqui para revisão.

### ALTA — arquivos / lógica sem uso

| #    | Onde                                                                                                                                                                                                                                                                                                                          | Achado                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| DC1  | `src/features/diagram-template/`                                                                                                                                                                                                                                                                                              | 4 subpastas vazias, zero refs — `git rm -r` recomendado                                                              |
| DC2  | `src/pages/Index.tsx` + `src/components/LandingPage.tsx`                                                                                                                                                                                                                                                                      | `App.tsx` redireciona `/` → `/workspace`; páginas mortas                                                             |
| DC3  | `src/components/ui/separator.tsx`                                                                                                                                                                                                                                                                                             | Zero imports no `src/`                                                                                               |
| DC4  | `src/features/canvas/canvas.constants.ts:11` — `EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY`                                                                                                                                                                                                                                        | Zero consumidores                                                                                                    |
| DC5  | `src/features/diagram/hooks/useLastEdgeStyle.ts`                                                                                                                                                                                                                                                                              | Tem nome `use*` mas não é hook; zero consumidores externos (README avisa). Considerar mover para `utils/` ou remover |
| DC6  | `src/features/walkthroughs/hooks/useWalkthroughGlobalPlayer.ts`                                                                                                                                                                                                                                                               | Zero consumidores                                                                                                    |
| DC7  | `src/features/walkthroughs/store/selectors/walkthroughs.selectors.ts` — `useWalkthroughGlobalPlayer`, `useAllWalkthroughs`, `useWalkthroughById`, e aliases `useAllJourneys`/`useJourneyActions`/`useJourney`/`useJourneyById`/`useJourneySteps`/`useJourneys`/`useJourneysByDiagramId`/`useJourneysStore`/`useJourneyPlayer` | Hooks `useJourney*` sem consumidores reais                                                                           |
| DC8  | `src/features/diagram/utils/{flow-traversal,scene.utils,flow-mermaid,recording-to-flow,flow-migration,flow-repair,flow-duplicate,fit-group-to-children,api-group-size,handle-order,template-sharing}`                                                                                                                         | Funções re-exportadas via barrel, mas zero consumidores externos — usadas só internamente                            |
| DC9  | `src/features/llm/{tools,errors,patch-parser,apply-diagram-patch,prompt-builder,model-presets,suggestions}`                                                                                                                                                                                                                   | Re-exportados via barrel mas zero consumidores externos                                                              |
| DC10 | `src/features/diagram/utils/import-mermaid-sequence.ts` (`MermaidImportPlan`, `parseMermaidSequence`) e `import-mermaid-flowchart.ts` (`FlowchartImportPlan`, `parseMermaidFlowchart`)                                                                                                                                        | Re-exportados, zero consumidores externos                                                                            |
| DC11 | `src/features/diagram/utils/component-lock.ts` (`isAncestorLocked`)                                                                                                                                                                                                                                                           | Re-exportado, usado só dentro do módulo                                                                              |
| DC12 | `src/features/diagram/utils/shared-import.ts`                                                                                                                                                                                                                                                                                 | Já coberto: utils de import estão em vários arquivos; unificar em `import-utils.ts`                                  |
| DC13 | `src/features/diagram/model/connection-defaults.ts` — `getIntentDefault`, `DIRECTION_MARKERS`, `EffectiveConnectionStyle`                                                                                                                                                                                                     | Re-exportados mas zero consumidores externos                                                                         |
| DC14 | `src/features/diagram/store/persist.config.ts` — `PERSIST_SCHEMA_VERSION`, `CURRENT_SCHEMA_VERSION`, `partializeState`, `PersistedDiagramStoreSlice`                                                                                                                                                                          | Re-exportados via barrel, zero externos                                                                              |
| DC15 | `src/features/diagram/model/component.guards.ts:52` — `isCloudComponent`                                                                                                                                                                                                                                                      | Zero consumidores em `src/` (mas é candidato a ser usado após S11)                                                   |
| DC16 | `src/lib/keyboard-keys.ts`                                                                                                                                                                                                                                                                                                    | Re-exportado por `keyboard-utils.ts`; zero imports diretos — fundir                                                  |
| DC17 | `src/features/diagram/utils/scene.utils.ts` — `resolveCanvasSnapshot`, `resolveCompareSnapshot`                                                                                                                                                                                                                               | Re-exportados, zero externos (uso interno apenas)                                                                    |
| DC18 | `src/features/diagram/utils/flow-traversal.ts` — `getNextSteps`, `walkFlow`                                                                                                                                                                                                                                                   | Re-exportados, zero externos                                                                                         |

### MÉDIA — flags mortas / drift / versões

| #    | Onde                                                                                                                                                  | Achado                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DC19 | `.env.example` — `VITE_DISABLE_SEEDS=false` é default mas a checagem é `import.meta.env.VITE_DISABLE_SEEDS === "true"` (string); tudo bem             | OK — só nota                                                                                                                                               |
| DC20 | `server/dist/config.js` tem constantes `DEFECTDOJO_URL`, `GITHUB_URL`, `LEANIX_URL`, `LEANIX_API_TOKEN` que **não** existem em `server/src/config.ts` | **dist/ contém código não-fonte** — deve ter vindo de uma versão antiga; `dist/` está no `.gitignore` mas há um commit residual ou o agente viu dist local |
| DC21 | `useRegistryActions = useCatalogActions` alias deprecated (`diagram.store.ts:361`)                                                                    | Manter 1 release (CHANGELOG); depois remover                                                                                                               |
| DC22 | `index.css` — `--font-serif` declarado mas sem uso claro                                                                                              | Confirmar se algum componente usa; remover se não                                                                                                          |
| DC23 | `walkthroughEditorCanvas.utils.ts` reconstrói `NodeBuildContext` manualmente                                                                          | Extrair factory em `canvas/nodes/node-types/types.ts`                                                                                                      |

### BAIXA — organização

| #    | Onde                                                                                                              | Achado                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| DC24 | `pages/walkthroughs/` contém só `WalkthroughsPage.tsx` + `WalkthroughEditorPage.tsx`; "pages/" como pseudo-camada | Mover para `features/walkthroughs/pages/`                   |
| DC25 | `canvas/selection-actions/index.ts` tem 4+ testes espalhados                                                      | Agrupar testes                                              |
| DC26 | `canvas/panels/ElementPanel/{components,sections}` duas pastas                                                    | Padronizar (sections dentro de components)                  |
| DC27 | `canvas/viewport-utils.ts` no root enquanto existe `canvas/utils/`                                                | Mover para `canvas/utils/`                                  |
| DC28 | `canvas/enums.ts` mistura `ElementCategory` + `HandleSide` + `SwimlaneOrientation`                                | Separar                                                     |
| DC29 | `canvas.constants.ts` re-exporta constants do `@/features/diagram`                                                | Consumir direto, remover re-exports                         |
| DC30 | `test/stress-{canvas-pipeline,panels}.test.ts` com `testTimeout: 90000`                                           | Verificar se rodam no CI; mover para `tests/manual/` se não |

---

## 6. Inconsistências de nomenclatura e arquitetura

| #   | Onde                                                                                                                                                               | Inconsistência                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| I1  | `features/walkthroughs/components/WalkthroughEditorCanvas.tsx` (PascalCase) vs `walkthroughEditorCanvas.utils.ts` (kebab-case)                                     | Padronizar tudo em kebab-case para utils                           |
| I2  | `features/walkthroughs/components/WalkthroughPlayerContext.shared.ts`                                                                                              | Sufixo `.shared.ts` único; convenção não documentada               |
| I3  | `features/plugins/` sem `index.ts` (quebra padrão)                                                                                                                 | Criar barrel mínimo com re-exports estáveis                        |
| I4  | `features/icons/` e `features/cloud/` têm `index.ts` enxutos; `plugins/` não                                                                                       | Idem                                                               |
| I5  | `infrastructure/persistence/useFileSystemStorage.ts` (20.6K) e `useFileSystemSync.ts` (189B) são hooks mas vivem em `infrastructure/`                              | Mover para `src/hooks/` ou `features/persistence/hooks/`           |
| I6  | `src/hooks/useLastFolderSync.ts` (908B) e `useLastLocalStorageSync.ts` (981B)                                                                                      | Quase duplicados — fundir em `useLastSync(key)`                    |
| I7  | `features/diagram/enums.ts` mistura `PanelKind` (domínio) com `ServiceSource`/`ImportPanel` (integrações)                                                          | Separar                                                            |
| I8  | `enums.ts` em `features/diagram/` vs `enums.ts` em `features/canvas/`                                                                                              | Sem coesão temática (canvas tem 3 enums misturados)                |
| I9  | `useStableListByRefEquality.ts` e `shallowEqualIgnoringFunctions`/`shallowEqualStyle` em `useCanvasNodes.ts`                                                       | Três helpers de equality; consolidar em `canvas/utils/equality.ts` |
| I10 | `canvas/panels/ElementPanel/index.tsx` vs `panels/ElementPanel/components/index.ts` vs `panels/ElementPanel/sections/index.ts`                                     | Três barrels para uma feature — fundir                             |
| I11 | Aliases deprecated `useJourney*` consumidos por `pages/walkthroughs/*`                                                                                             | Migrar; CHANGELOG está atrasado                                    |
| I12 | `diagram/store/slices/scene-helpers.ts` e `get-active-diagram.ts` estão em `slices/` mas não são slices                                                            | Mover para `store/helpers/`                                        |
| I13 | `diagram/hooks/useLastEdgeStyle.ts` viola naming (não é hook)                                                                                                      | Mover para `utils/` ou renomear                                    |
| I14 | `COMPONENT_TYPE_PROCESSOS` (typo conceitual: valor é `"process-node"`)                                                                                             | Renomear para `COMPONENT_TYPE_PROCESS_NODE`                        |
| I15 | `features/canvas/panels/NodeContextMenu.tsx` (396L) vs `selection-actions/NodeQuickActionsBar.tsx` (393L)                                                          | Hook compartilhado `useSelectionNodeActions`                       |
| I16 | `canvas/utils/svg.utils.ts` vs `canvas/utils/svg.sanitizer.ts`                                                                                                     | Coesos; OK — só nota                                               |
| I17 | `tools/build-with-plugins.mjs` vs `tools/...` (sem mais scripts)                                                                                                   | OK — único                                                         |
| I18 | `.env.example` na raiz mas também `server/.env.example`                                                                                                            | OK — separar client vs server                                      |
| I19 | `plugins/examples/console-log/` e `plugins/examples/mermaid-import/` são JS puro enquanto `structura-plugin-example-ui/` e `structura-plugin-leanix/` são React/TS | Convenção distinta por tipo — documentar no README                 |

---

## 7. Dependências e tooling

### Packages não usados (auditória parcial)
- **Todas as `@radix-ui/*`**: usadas em `src/components/ui/*` (shadcn). Mantém.
- `aws-react-icons`, `azure-react-icons`, `gcp-icons`: usados em `features/cloud/`, `canvas/nodes/`. Mantém.
- `lodash.debounce`: usado (verificar se vale substituir por `use-debounce` ou hook próprio).
- `next-themes`: usado em `useTheme.ts`. Mantém.
- `react-router-dom`: usado.
- `immer`: central ao Zustand. Mantém.

### Lockfile / versões
- `vite ^8.0.2`, `vitest ^4.1.1`, `tailwindcss ^3.4.17`, `@vitejs/plugin-react ^6.0.1` — versões majors recentes, **verificar compatibilidade** entre si e com `cypress ^15`.
- `react 18.3.1` — OK.
- `typescript ^5.8.3` — OK.
- `eslint ^9.32.0` — OK (flat config).
- `@types/node ^22.16.5` vs Node 20 usado no CI (`actions/setup-node@v6` com `node-version: 20`) — desalinhado mas não crítico.
- `server/` usa `typescript ^6.0.3` (dev) + `node:22-alpine` — OK.

### `.dockerignore` 36 B (suspeito)
- Provavelmente falta `node_modules`, `dist`, `.env`, `tests`. **Confirmar.**

### `release.yml` pula `typecheck` e `plugins:sync-check`
- CI em `lint` job roda esses; release só roda lint+test+build. **Adicionar `npm run typecheck`** como gate antes do `release`.

### `tools/build-with-plugins.mjs`
- Documentação clara; só nota: `--legacy-peer-deps` é aceito mas mascara conflitos reais entre React peer deps de plugins.

---

## 8. Documentação

| #     | Onde                                                                                                                                                                               | Achado                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doc1  | `README.md`                                                                                                                                                                        | Bom; já menciona stack, scripts, arquitetura                                                                                                                                            |
| Doc2  | `AGENTS.md`                                                                                                                                                                        | Excelente — hard rules claras; menciona o sharp edge do `useLocalNodes`                                                                                                                 |
| Doc3  | `CONTRIBUTING.md`                                                                                                                                                                  | Bom; pull request checklist útil                                                                                                                                                        |
| Doc4  | `CHANGELOG.md`                                                                                                                                                                     | Detalhado; v0.1.0 documenta 5 renames + 2 bugs corrigidos. **Faltou**: `pages/walkthroughs/` ainda importa aliases deprecated — release da rename está atrasada                         |
| Doc5  | `ROADMAP.md`                                                                                                                                                                       | Bom; phases 0-4; **menciona "TODO.md before its removal in July 2026"** sem deixar link; vale referenciar o conteúdo migrado                                                            |
| Doc6  | `FEATURES_MAP.md`                                                                                                                                                                  | **Está em português** mas `AGENTS.md` diz "UI strings through i18n; seed/demo content may stay Portuguese". Lista de features é conteúdo de produto, não seed — **deveria estar em en** |
| Doc7  | `SECURITY.md`                                                                                                                                                                      | Bom; escopo explícito: client-side, sem backend                                                                                                                                         |
| Doc8  | `docs/architecture/vision.md` (15.7K), `overview.md` (4.7K), `roadmap-analysis.md` (6.8K), `plugin-system-preparation.md` (6.2K)                                                   | Bom; revisão anual                                                                                                                                                                      |
| Doc9  | `docs/adr/` (8 ADRs)                                                                                                                                                               | Bom; manter hábito                                                                                                                                                                      |
| Doc10 | `docs/concepts/{core-concepts,canvas-engine,diagram-engine,edge-system,node-system,state-management,rendering-pipeline,persistence,ai-integration,collaboration,import-export}.md` | Bom; alguns podem estar stale — vale auditar                                                                                                                                            |
| Doc11 | `docs/grammar/glossary.md` (22.1K)                                                                                                                                                 | Excelente; glossário canônico                                                                                                                                                           |
| Doc12 | `docs/guides/adding-a-node-type.md`                                                                                                                                                | Bom                                                                                                                                                                                     |
| Doc13 | `openspec/`                                                                                                                                                                        | Bom; usa OpenSpec workflow                                                                                                                                                              |
| Doc14 | `plugins/README.md`                                                                                                                                                                | OK; documenta exemplos JS + React/TS                                                                                                                                                    |

**Recomendações:**
- Migrar `FEATURES_MAP.md` para inglês (ou documentar a decisão de manter PT).
- Adicionar ADR para a decisão "manter client-side only" — não tem ADR explícito sobre isso; está implícito no vision.md.
- Documentar o "sharp edge" do `useLocalNodes` em `docs/canvas-engine.md` (atualmente só em `AGENTS.md`).

---

## 9. CI/CD e testes

| # | Onde | Achado |
|---|---|---|
| CI1 | `.github/workflows/ci.yml` | Bom: lint (com format:check e plugins:sync-check) + typecheck + test + build |
| CI2 | `.github/workflows/release.yml` | **Não roda typecheck nem plugins:sync-check** — release pode quebrar com type errors silenciosos | Adicionar `npm run typecheck` antes de `npm run lint && npm run test && npm run build` |
| CI3 | `cypress.config.ts` | `baseUrl: http://localhost:8080` enquanto `vite preview` defaults 4173 e dev 5173. **8080 está documentado como dev port** — confirmar que o CI roda dev server (não preview) |
| CI4 | `cypress/support/e2e.ts` | 21 bytes — stub vazio; pode estar faltando `import "./commands"` |
| CI5 | Testes de stress em `src/test/` com `testTimeout: 90000` | Pesados; verificar se rodam no CI default (`npm run test`) |
| CI6 | Vitest: `retry: 2` | OK para flakiness, mas mascara bugs reais |
| CI7 | `dependabot.yml` | Bom — agrupa `@radix-ui/*` e dev-deps; monitora GH Actions |

**Cobertura de testes** (heurística):
- ✅ Diagram store: coberto (slices têm testes)
- ✅ LLm: store, serializer, patch-parser, model-presets, llm-storage, llm-threads-idb, openai-compatible, custom, store.new-connection — bem coberto
- ✅ Plugins: plugin-registry, semver, snapshots, manifest-validation, plugin-storage, io-registry, diagram-api + 2 e2e — bem coberto
- ✅ Export: golden test + drawio, mermaid, build, geometry, note-format, edge-routing — excelente
- ✅ Persistence: migrations, versions, validateWorkspaceFile — bom
- ⚠️ Canvas: **falta testes para `useCanvasNodes`, `useCanvasController`, `useCanvasInteraction`, `useCanvasEventHandlers`** — os hooks mais complexos. Há `useLocalNodes.test.ts`, `useCanvasDiagramNavigation.test.ts`, `useCanvasDrillHandlers.test.ts`, `useStableListByRefEquality.test.ts`. Cobertura fragmentada.
- ⚠️ Walkthroughs: store coberto, mas hooks `useWalkthroughPlayer`, `useWalkthroughGlobalPlayer`, `useWalkthroughRecordingFinalize` sem teste
- ⚠️ Collab: `collab.utils.test.ts` mas sem testes dos componentes e do fluxo end-to-end do WebSocket

---

## 10. Segurança

| #    | Onde                                                     | Achado                                                                                                                                                                                                           | Severidade                                      |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Sec1 | `server/src/proxy.ts:79-169`                             | `/proxy` aceita qualquer URL em dev (`origin: true`); método arbitrário; body arbitrário. Comentário diz "dev only" e `IS_PRODUCTION` bloqueia, mas vale auditar `cors.origin: true` (em produção não monta, OK) | OK em produção; documentar claramente           |
| Sec2 | `server/src/proxy.ts:74-100`                             | `validateStatus: () => true` repassa qualquer status — combinado com `cors.origin: true` em dev, permite SSRF se um atacante conseguir executar JS no app                                                        | OK em dev; documentar                           |
| Sec3 | `server/src/collab.ts` (host:patch / guest:patch)        | `applyPatch` é shallow merge — não há validação de schema. Guest pode tentar injetar campos arbitrários no snapshot do host                                                                                      | Média — validar schema do patch                 |
| Sec4 | `server/src/proxy.ts:38-48`                              | `maskSensitiveHeaders` mascara tokens mas loga URL completa + query string                                                                                                                                       | Baixa — log pode conter dados sensíveis em URLs |
| Sec5 | `SECURITY.md`                                            | Bom — avisa que plugins não são sandboxed                                                                                                                                                                        | OK                                              |
| Sec6 | `src/features/llm/store.ts` — API keys em `localStorage` | OK se `SECURITY.md` (linhas 18-19) já documenta; `LLMSettings.tsx` deve avisar                                                                                                                                   | OK                                              |
| Sec7 | `src/features/canvas/utils/svg.sanitizer.ts`             | `sanitizeSvg` deve estar robusto — `svg.sanitizer.test.ts` cobre                                                                                                                                                 | OK                                              |
| Sec8 | `plugins/plugin-api.ts`                                  | `apiVersion: "1.1.0"`; plugins rodam com mesma origin                                                                                                                                                            | Documentar                                      |

---

## 11. Plano arquitetural: evolução Stateless → Stateful (SaaS com API)

**Premissa:** o domínio já é estruturalmente correto para suportar remote-first. O ponto de injeção é `IStoragePort` (Hexagonal). O plano abaixo **não implementa** — apenas define as fronteiras, os contratos, e a sequência de migração.

### 11.1 Princípios da evolução

1. **Preservar o domínio local-first como modo "offline".** O `IStoragePort` continua sendo o único ponto de I/O. Um `RemoteAdapter` é adicionado como **espelho** que sincroniza com a API.
2. **A store Zustand vira "local-first cache", não fonte de verdade.** Em SaaS, a API é a fonte de verdade; o store é cache local que aplica patches recebidos via WebSocket/SSE.
3. **Yjs como CRDT para colaboração em tempo real.** Já existe o experimento de collab via WebSocket — promover para `yjs` + `y-websocket` resolve conflitos offline naturalmente.
4. **Auth + tenancy entram na camada `infrastructure/auth/`**, não no domínio. O domínio recebe `currentUser`/`currentWorkspace` via context.
5. **Migração progressiva por feature flag.** `VITE_SAAS_ENABLED=true` ativa o backend; em modo "local-only" o app se comporta exatamente como hoje.

### 11.2 Camadas e contratos novos

```
┌─────────────────────────────────────────────────────────┐
│                  src/features/                           │
│  (domínio inalterado — recebe currentUser/currentWs)    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│          src/infrastructure/                             │
│  persistence/  ← IStoragePort + 4 adapters (já existe)   │
│       + RemoteStorageAdapter (novo)                      │
│  auth/        ← AuthProvider, useAuth, jwtStore (novo)  │
│  sync/        ← SyncEngine, ConflictResolver (novo)     │
│  api/         ← RestClient, endpoints tipados (novo)    │
│  i18n/        ← (existente)                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   server/                                 │
│  (Express + WS já existe)                                │
│  + /api/v1/diagrams, /api/v1/folders, /api/v1/users    │
│  + /api/v1/workspaces (multi-tenant)                     │
│  + /api/v1/sync (WebSocket / SSE)                        │
│  + /api/v1/auth (JWT / OIDC)                             │
└──────────────────────────────────────────────────────────┘
```

### 11.3 Mudanças mínimas no domínio

**Não tocar:**
- `features/diagram/model/*` — modelo é cloud-agnostic.
- `features/diagram/store/slices/*` — slices não conhecem backend.
- `features/diagram/store/selectors/*` — selectors são puros.
- `features/canvas/*` — UI é data-source-agnostic.

**Tocar (cirúrgico):**
- `diagram.store.ts:33-83` (`createDiagramStore`) — adicionar `iconStoreOverride` já é a porta para injeção de dependência; replicar padrão para `syncEngineOverride`.
- `persist.config.ts:596-620` (`createPersistConfig`) — quando storage é `RemoteAdapter`, mudar `partialize` para incluir `lastSyncedAt`/`version` por diagrama.
- `actions.types.ts` — adicionar `markRemotePatch`, `applyServerSnapshot`, `setSyncStatus`.

### 11.4 Componentes novos

| Componente                                           | Responsabilidade                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `infrastructure/api/RestClient.ts`                   | fetch wrapper com auth headers, retry exponencial, tipos por endpoint (OpenAPI-generated ou hand-written)                |
| `infrastructure/api/endpoints/*.ts`                  | `GET /workspaces/:id/diagrams`, `POST /diagrams/:id`, `PATCH /diagrams/:id`, etc. — tipados                              |
| `infrastructure/persistence/RemoteStorageAdapter.ts` | Implementa `IStoragePort`; cada `setItem` é um `PATCH` no backend; cache local em IndexedDB para offline-first           |
| `infrastructure/sync/SyncEngine.ts`                  | Coordena WebSocket subscription + RemoteStorageAdapter; emite `onDiagramChange`, `onPresence`, `onConflict`              |
| `infrastructure/sync/ConflictResolver.ts`            | LWW (last-write-wins) para campos escalares; 3-way merge para `components`/`connections` (via `SceneDiff` que já existe) |
| `infrastructure/auth/AuthProvider.tsx`               | Context que expõe `currentUser`, `currentWorkspace`, `token`, `signIn`, `signOut`                                        |
| `infrastructure/auth/useAuth.ts`                     | Hook consumidor                                                                                                          |
| `infrastructure/auth/jwtStore.ts`                    | Persiste JWT em httpOnly cookie (server) + lê via `/api/v1/auth/me`                                                      |
| `pages/AuthPage.tsx`                                 | Login/signup                                                                                                             |
| `pages/WorkspaceSwitcher.tsx`                        | Lista workspaces; switch entre eles                                                                                      |

### 11.5 Schema de API (esboço — para discussão, não implementação)

```
GET  /api/v1/me                                   → { user, workspaces: Workspace[] }
POST /api/v1/auth/login                           → { token, user }
POST /api/v1/auth/logout                          → 204
POST /api/v1/auth/signup                          → { token, user }

GET  /api/v1/workspaces/:wsId                     → Workspace
GET  /api/v1/workspaces/:wsId/diagrams            → Diagram[] (light — sem snapshot completo)
GET  /api/v1/diagrams/:id                         → Diagram (full)
POST /api/v1/diagrams                             → Diagram (id gerado pelo server)
PATCH /api/v1/diagrams/:id                        → Diagram (LWW; retorna 409 se version mismatch)
DELETE /api/v1/diagrams/:id                       → 204
POST /api/v1/diagrams/:id/snapshot                → Snapshot (versão imutável para versionamento)

WS   /api/v1/sync?diagramId=...&token=...          → DiagramPatch | Presence | Conflict
```

### 11.6 Migração de dados local → cloud

- **Modo dual-write durante transição:** quando o usuário loga pela primeira vez, o app pergunta "migrate local workspace to cloud?". Se sim:
  - Para cada diagrama local, `POST /api/v1/diagrams` com snapshot completo.
  - Substitui `IStoragePort` por `RemoteStorageAdapter`.
  - **Não apaga localStorage** — fica como cache offline.
- **Modo fallback offline:** se a API está fora, o `RemoteStorageAdapter` continua escrevendo localmente e enfileira patches (`outbox` em IndexedDB). Reconecta e aplica via `SyncEngine`.

### 11.7 Real-time collaboration

- Promover `features/collaboration/` (atualmente experimental, com relay em `server/src/collab.ts`) para usar **Yjs** com `y-websocket` server.
- Yjs dá CRDT nativo: merge offline-first é grátis; conflito é matematicamente impossível.
- `server/src/collab.ts` (660L hoje) pode ser substituído por `y-websocket` (~50 linhas de wiring) + custom auth no `connectionParams`.

### 11.8 Autenticação e multi-tenancy

- JWT com refresh tokens em httpOnly cookie (server).
- `currentWorkspace` é parte do JWT payload; **diagram scoping** via `WHERE workspace_id = ?` em todas as queries.
- RBAC simples: `viewer`, `editor`, `admin` por workspace. Aplicado no middleware Express.
- Plano free vs paid: feature flag `workspace.plan` server-side; UI checa `useAuth().workspace.plan`.

### 11.9 Billing (futuro)

- Stripe webhook → atualiza `workspace.plan` no DB.
- App consulta `/api/v1/billing/status` no boot.

### 11.10 Roadmap de execução (fases)

| Fase                      | Duração     | Entregas                                                                                                                    |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0: Foundations**  | 2-3 sprints | `IStoragePort` com `RemoteStorageAdapter` + IndexedDB outbox; `AuthProvider` + login page; CI com Postgres + testcontainers |
| **Phase 1: Read path**    | 1-2 sprints | Dashboard lê de `/api/v1/workspaces/:id/diagrams`; cache local; "offline-first" read                                        |
| **Phase 2: Write path**   | 2-3 sprints | `PATCH /api/v1/diagrams/:id` com LWW; SyncEngine para sincronizar; testes E2E                                               |
| **Phase 3: Real-time**    | 2 sprints   | Migrar `collab/` para Yjs; presence com cursors; OT desnecessário (CRDT resolve)                                            |
| **Phase 4: Multi-tenant** | 2 sprints   | Workspaces; RBAC; billing Stripe                                                                                            |
| **Phase 5: Hardening**    | ongoing     | Audit logs; rate limiting; Sentry; SOC2 prep                                                                                |

### 11.11 Riscos arquiteturais e mitigações

| Risco                                                       | Mitigação                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bundle size cresce com `yjs` (~50KB), `y-websocket` (~30KB) | Lazy import em `features/collaboration/` (já é chunk separado)                         |
| Latência de patch em PATCH síncrono → UX ruim               | Yjs CRDT local-first; PATCH em background; optimistic UI                               |
| Custo de banda: 1 diagrama C4 médio = 50-200 KB JSON        | Compressão LZ-string (já existe em `lib/diagram-url.ts`); gzip no transporte           |
| Versioning: schema v11 local ≠ schema server                | Manter migrações no server também; server pode ser mais conservador                    |
| Auth: secret management                                     | AWS Secrets Manager / Doppler; nunca commitar `.env`                                   |
| GDPR: dados pessoais no diagrama                            | "Delete account" apaga workspace; export via `/api/v1/workspaces/:id/export`           |
| Multi-region: latência cross-continent                      | Edge function para reads; DB primário em 1 região, replicas                            |
| Plugin security: plugins rodam no browser com mesma origin  | Manter sandbox via iframe + postMessage (já documentado em `SECURITY.md`)              |
| Custos de storage de snapshots                              | Política de retenção (ex: 90 dias); snapshots são imutáveis, cold storage após 30 dias |

### 11.12 O que **não** muda no curto prazo

- **Modelo de domínio** (`features/diagram/model/*`) — é a fortaleza.
- **Componentes UI principais** — eles já são data-source-agnostic.
- **`IStoragePort`** — é o contrato que torna tudo possível.
- **Discriminated unions** — base da segurança de tipos.

### 11.13 Pré-requisitos antes de começar a fase 0

Antes de qualquer trabalho de SaaS, **executar** os itens P1, P5, S3 (do plano de qualidade) e corrigir os bugs B1-B6, B11-B13. Isso porque:

- P1 reduz o bundle do viewer (rota usada pelo embed/SaaS).
- P5 evita inflar TTI do chunk inicial (primeira impressão em SaaS conta).
- S3 fecha a janela de rename `Journey* → Walkthrough*` que está atrasada — entrar em SaaS com código legacy aberto é mau sinal.
- B1-B6+B11-B13 são pré-requisitos para confiar que mudanças locais persistem corretamente — em SaaS, persistência local é cache; se o cache está furado, a sincronia vai propagar lixo.

---

## 12. Resumo executivo

**Estado:** código maduro, bem estruturado no domínio; debt concentrado em (a) barrels/bundle, (b) perda de history em mutators de services/scenes, (c) hooks gigantes no canvas, (d) duplicação de aliases deprecated.

**Esforço estimado para saneamento (fases 0-1 do ROADMAP.md):** 4-6 sprints para fechar os bugs Alta + smells Média + dead code confirmado.

**Para SaaS:** o `IStoragePort` é o ponto de injeção natural. Yjs + WebSocket resolvem real-time. Multi-tenancy via `currentWorkspace` no JWT. Roadmap de 5 fases proposto.

**Decisões a tomar antes de implementar:**
- Manter `FEATURES_MAP.md` em PT ou migrar para en?
- Remover `pages/Index.tsx` + `LandingPage.tsx` ou arquivar?
- Aplicar S11 (`CloudComponent` union) ou aceitar o union inchado?
- Em SaaS, auth próprio vs OIDC (Auth0/Clerk/WorkOS)?

Sem input do usuário. Audit concluído; plano aguardando revisão.
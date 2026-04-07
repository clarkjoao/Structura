# Structura — Análise Completa do Código-Fonte

> Análise realizada em abril de 2026 sobre todo o repositório.
> Perspectiva: engenheiro sênior especialista em React, TypeScript, Zustand/Immer e React Flow.

---

## 1. Resumo Executivo

### Visão Geral da Saúde do Código

O Structura é um projeto impressionantemente bem arquitetado para uma SPA client-side de diagramação. A separação entre domínio (`features/diagram`) e camada visual (`features/canvas`) é real e rigorosa. O uso de Zustand + Immer com slices, o sistema de `NodeTypeDescriptor`, o snapshot caching com `WeakMap`, e o modelo de cenas/compare são decisões arquiteturais maduras que demonstram profundo entendimento das ferramentas.

O código não é perfeito — há hooks e componentes que cresceram além do saudável, imports cruzados entre features que contornam o barrel, e selectors que podem causar re-renders desnecessários. Mas a base é sólida, coerente e evoluível.

### Principais Forças

1. **Separação domínio/UI bem executada** — `features/diagram` não importa React, JSX nem React Flow. Tipos, regras de negócio e transformações de estado são puros.
2. **Sistema de `NodeTypeDescriptor`** — extensível, desacoplado, com registry ordenado e catch-all. Novos tipos de nó não exigem modificação de `Canvas.tsx` nem `useCanvasNodes.ts`.
3. **Snapshot caching via `WeakMap`** — `getCachedCanvasSnapshot` evita recomputação desnecessária em selectors que compartilham a mesma referência de `Diagram`. Design elegante.
4. **Modelo de cenas (SceneDiff)** — diffs declarativos sobre o snapshot base, com merge preview, compare overlay e isolamento de mutações. Escalável para versioning.
5. **Undo/redo com `pushHistory` + coalesce** — cooldown e coalesce evitam spam no histórico; `commitNodeDrag` unifica parent + position em transação atômica.
6. **Type guards centralizados** — `component-type-constants.ts` e `component.guards.ts` eliminam comparações de string cruas no domínio.
7. **i18n abrangente** — cobertura excelente com chaves organizadas por feature em dois locales.

### Principais Fragilidades

1. **Hooks e componentes acima do tamanho saudável** — 15+ hooks acima de 100 linhas; 30+ componentes acima de 150 linhas.
2. **Imports cruzados entre features** — ~60 imports que contornam barrels, acoplando features via internals.
3. **Selectors sem `useShallow` retornando objetos/arrays** — `useDiagrams`, `useFolders`, `useConnectionIds`, `useFlowIds`, `useServiceIds`, `useNodeLayouts` retornam referências novas a cada render.
4. **`resolveCanvasSnapshot` chamado diretamente em hooks de canvas** — ~10 call sites que não usam `getCachedCanvasSnapshot`, recomputando snapshot em cada render.
5. **Componente `ComponentPatch` com tipagem frágil** — interseção de `Partial<Omit<...>>` de todos os tipos permite patches inválidos cross-type.

### Top 5 Riscos Técnicos

| # | Risco | Impacto |
|---|-------|---------|
| 1 | Selectors instáveis causam re-renders em cascata em diagramas grandes | Performance degrada exponencialmente com nós |
| 2 | `useCanvasNodes` recebe 30+ params e depende de 5 contextos — qualquer mudança rebuild all nodes | Gargalo central de render |
| 3 | Imports cross-feature tornam refatorações arriscadas | Acopla features que deveriam ser independentes |
| 4 | `ComponentPatch` permite patches semântica e estruturalmente inválidos | Bugs silenciosos em updates |
| 5 | Hooks como `useFlowModeRecording` (698 linhas) são intestáveis | Regressões em flows/recording sem cobertura |

### Nota Geral: **7.5 / 10**

**Justificativa:** Arquitetura fundamentalmente correta, separação de camadas real (não cosmética), padrões consistentes. Perde pontos por tamanho excessivo de alguns módulos, selectors instáveis, tipagem permissiva em patches, e cross-feature coupling. A maioria dos problemas é incremental — nenhum exige rewrite.

---

## 2. Problemas Priorizados

### P01 — Selectors retornando referências instáveis sem `useShallow`

- **Severidade:** Alta
- **Área:** Zustand / Performance
- **Onde ocorre:**
  - `diagram.selectors.ts`: `useDiagrams()` retorna `s.diagrams` (objeto mutável por Immer a cada operação)
  - `folder.selectors.ts`: `useFolders()` retorna `s.folders`
  - `connection.selectors.ts`: `useConnectionIds()` retorna `Object.keys(...)` — **novo array a cada render**
  - `flows.selectors.ts`: `useFlowIds()` — mesmo padrão
  - `registry.selectors.ts`: `useServiceIds()` — mesmo padrão
  - `layout.selectors.ts`: `useNodeLayouts()` retorna `d.nodeLayouts` sem shallow; quando `!activeDiagramId` retorna `{}` — **referência nova**
- **Regra afetada:** "Selectors que retornam arrays/objetos devem usar `useShallow`"
- **Sintoma:** Componentes que consomem esses selectors re-renderizam a cada mutação de qualquer slice, mesmo que os dados que usam não tenham mudado.
- **Causa:** `Object.keys()` e retornos de objetos criam nova referência em cada avaliação do selector.
- **Risco:** Em diagramas com 50+ nós, performance degradada; em 100+, janking perceptível.
- **Sugestão:**

```typescript
// Antes
export const useConnectionIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(getCachedCanvasSnapshot(d).connections);
  });

// Depois
export const useConnectionIds = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.keys(getCachedCanvasSnapshot(d).connections);
    }),
  );
```

- **Refatoração incremental:** Um PR por selector file, sem mudança funcional.

---

### P02 — `resolveCanvasSnapshot` chamado diretamente em hooks de canvas

- **Severidade:** Alta
- **Área:** Performance / Arquitetura
- **Onde ocorre:**
  - `useCanvasEdges.ts` (linha 43)
  - `Canvas.tsx` (linha 84)
  - `useNodeDragParenting.ts` (linhas 69, 141, 183)
  - `useCanvasController.ts` (linha 27, dentro de `useMemo`)
  - `useCanvasKeyboard.ts` (linha 175, dentro de `useMemo`)
  - `useCopyPasteShortcuts.ts` (linha 192)
  - `keyboard/helpers.ts` (linhas 54, 95, 139)
- **Regra afetada:** "Seletores não devem chamar `resolveCanvasSnapshot` diretamente se houver cache disponível"
- **Sintoma:** Recomputação O(n) de snapshot merge (base + cena) múltiplas vezes no mesmo render cycle, duplicando trabalho já feito pelo `getCachedCanvasSnapshot`.
- **Causa:** `getCachedCanvasSnapshot` usa `WeakMap` keyed por `Diagram` reference — funciona em selectors onde `diagram` é Immer-proxied. Em hooks que recebem `diagram` como prop, a mesma referência produz cache hit. Mas em `useMemo(..., [diagram])` ou callbacks, `resolveCanvasSnapshot` é chamado fora do cache path.
- **Risco:** Gargalo em diagramas com muitos nós/cenas.
- **Sugestão:** Expor `getCachedCanvasSnapshot` do barrel da feature diagram e usar em todos os call sites que recebem uma referência `Diagram`. Para callbacks em event handlers (drag stop, keyboard), aceitar o snapshot como parâmetro calculado uma vez.
- **Refatoração incremental:** Migrar cada call site em PRs separados; sem mudança de comportamento.

---

### P03 — `useCanvasNodes` recebe 30+ parâmetros

- **Severidade:** Alta
- **Área:** React / Clean Code
- **Onde ocorre:** `src/features/canvas/nodes/useCanvasNodes.ts`
- **Regra afetada:** "Hooks over 100 lines should be decomposed", "Each hook has a single responsibility"
- **Sintoma:** O hook aceita ~30 props via `UseCanvasNodesParams`, construindo um `NodeBuildContext` de 25+ campos. Qualquer mudança em qualquer campo invalida o `useMemo` inteiro que produz todos os nodes.
- **Causa:** Crescimento orgânico — cada feature (flow, recording, coverage, compare, tags, inline editing) adicionou campos.
- **Risco:** Performance (memo inteiro é invalido por qualquer prop change); dificuldade de manutenção; impossível testar isoladamente.
- **Sugestão:**
  1. Separar `nodeCtxBase` (estável: diagram, components, layouts, serviceRegistry) de `nodeCtxDynamic` (frequente: selection, highlight, playback, recording).
  2. Usar `useRef` para dados que não afetam o shape dos nodes (callbacks, onDrillDown, etc.).
  3. Considerar particionamento: panels/groups primeiro pass, child nodes segundo pass.
- **Refatoração incremental:** Extrair `useNodeBuildContext` em hook separado; dividir memo em tiers de estabilidade.

---

### P04 — Imports cruzados entre features

- **Severidade:** Alta
- **Área:** Arquitetura
- **Onde ocorre:** ~60 imports que contornam barrels:
  - `canvas` → `diagram/hooks/useLastEdgeStyle`, `diagram/model/component-type-constants`, `diagram/model/layout.constants`, `diagram/store/store.constants`, `diagram/utils/api-group-size`
  - `canvas` → `collaboration/useCollabHighlight` (14 node components)
  - `canvas` → `custom-components/hooks/useCustomComponentLibrary`, `custom-components/utils/...`
  - `pages/serviceRegistry/DetailPanel.tsx` → `canvas/panels/ElementPanel/sections`
  - `lib/export-service/styles.ts` → `canvas/nodes/ApiGroupNode/constants`
  - `infrastructure/persistence/*` → `icons/store`, `diagram/store/persist.config`, `custom-components/store`
  - `integrations/merge-utils.ts` → `diagram/model/service.types`
- **Regra afetada:** "Nunca importar internals de outra feature — apenas pelo index.ts"
- **Sintoma:** Refatoração interna de uma feature quebra consumidores em features irmãs.
- **Causa:** Alguns items não foram adicionados ao barrel público; conveniência durante desenvolvimento.
- **Risco:** Acoplamento rígido; impossibilidade de mover/renomear módulos internos sem cascade.
- **Sugestão:** Expandir os barrels `index.ts` de cada feature para exportar o necessário; redirecionar imports existentes.
- **Refatoração incremental:** Um PR por feature corrigindo seus imports + expandindo barrel da feature importada.

---

### P05 — Componentes e hooks acima do tamanho saudável

- **Severidade:** Média
- **Área:** React / Clean Code
- **Onde ocorre:** (amostras mais críticas)
  - **Componentes 300+:** `dashboard/index.tsx` (663), `serviceRegistry/DetailPanel.tsx` (636), `FolderTree.tsx` (560), `QuickInsertPopover.tsx` (597), `SceneDrawer.tsx` (541), `ComponentPanel.tsx` (541), `DiagramSidebar.tsx` (531)
  - **Hooks 200+:** `useCollab.ts` (708), `useFlowModeRecording.ts` (698), `useFileSystemStorage.ts` (435), `useCanvasKeyboard.ts` (416), `useCanvasEventHandlers.ts` (346), `useNodeDragParenting.ts` (310)
- **Regra afetada:** "Componentes sobre 150 linhas devem ser decompostos", "Hooks sobre 100 linhas devem ser decompostos"
- **Sintoma:** Múltiplas responsabilidades num único arquivo; difícil navegar, testar e manter.
- **Sugestão:** Decompor em sub-hooks e sub-componentes, mantendo o módulo externo como orchestrator.
- **Refatoração incremental:** Começar pelos mais críticos (`useFlowModeRecording`, `dashboard/index.tsx`, `useCollab`). Cada decomposição é um PR independente.

---

### P06 — `ComponentPatch` com tipagem frágil

- **Severidade:** Média
- **Área:** TypeScript
- **Onde ocorre:** `src/features/diagram/model/component.types.ts` (linhas 179-187)
- **Regra afetada:** "Estados inválidos não devem ser permitidos pelos tipos"
- **Sintoma:** `ComponentPatch` é interseção de `Partial<Omit<>>` de todos os tipos de componente. Um patch pode conter `tableName` + `protocol` + `method` simultaneamente, misturando campos de `DbTableComponent`, `ApiGroupComponent` e `EndpointComponent`.
- **Causa:** Necessidade de uma interface de patch única para `updateComponent`.
- **Risco:** Bugs silenciosos onde um patch aplica campos irrelevantes ao tipo do componente.
- **Sugestão:** Criar patches discriminados por tipo:

```typescript
type ComponentPatch =
  | (Partial<Omit<C4Component, "id">> & { type: C4Component["type"] })
  | (Partial<Omit<PanelComponent, "id">> & { type: "panel" })
  | (Partial<Omit<EndpointComponent, "id">> & { type: "endpoint" })
  // ...
  | { width?: number; height?: number }; // dimension-only patch
```

- **Refatoração incremental:** Criar tipo `DiscriminatedComponentPatch`, migrar consumidores gradualmente.

---

### P07 — `UnknownComponent` duplicado na union `Component`

- **Severidade:** Baixa
- **Área:** TypeScript
- **Onde ocorre:** `component.types.ts`, linhas 175-180

```typescript
export type Component =
  | C4Component
  | PanelComponent
  // ...
  | UnknownComponent  // primeira ocorrência
  | DbTableComponent
  | JsonViewerComponent
  | UnknownComponent  // DUPLICADA
  | SvgComponent;
```

- **Sintoma:** Inofensivo em runtime (TypeScript deduplica), mas indica descuido.
- **Sugestão:** Remover a duplicata.

---

### P08 — `useCanvasVisualState` — excesso de `useState` para estado que poderia ser derivado

- **Severidade:** Média
- **Área:** React
- **Onde ocorre:** `useCanvasVisualState.ts` — 10 `useState` calls, retornando interface com 20+ campos.
- **Regra afetada:** "Estado derivado deve ser computado via `useMemo`, nunca armazenado em `useState`"
- **Sintoma:** `visibleTags` poderia ser derivado do diagram quando null (sem filtro ativo). O hook acumula responsabilidades de seleção, highlight, context menu, quick insert, inline editing, e tag filter.
- **Sugestão:** Separar em sub-hooks: `useSelectionState`, `useHighlightState`, `useContextMenuState`, `useTagFilterState`, `useInlineEditState`.

---

### P09 — `useDiagramActions` retorna objeto com 50+ actions — re-render em qualquer subscriber

- **Severidade:** Média
- **Área:** Zustand / Performance
- **Onde ocorre:** `diagram.store.ts`, `useDiagramActions()`
- **Sintoma:** `useDiagramActions` usa `useShallow` para extrair ~50 actions do store. Embora `useShallow` previna re-render por identity (funções são estáveis em Zustand), o objeto resultante ainda é recriado a cada chamada de `useShallow` se qualquer action reference mudar.
- **Risco:** Baixo para actions (estáveis), mas o padrão incentiva consumers a desestruturarem todas as 50+ actions quando precisam apenas de 2-3.
- **Sugestão:** Criar hooks de ação por domínio: `useComponentActions()`, `useConnectionActions()`, `useFlowActions()`, `useSceneActions()`.

---

### P10 — `addScene` tem string hardcoded em português

- **Severidade:** Média
- **Área:** i18n
- **Onde ocorre:** `scenes.slice.ts`, linha 62:

```typescript
created = {
  // ...
  name: name.trim() || `Cena ${index + 1}`,
```

- **Regra afetada:** "Strings visíveis ao usuário nunca devem ser hardcoded"
- **Sintoma:** Quando o usuário não fornece nome, o default é sempre em português, mesmo com locale em inglês.
- **Sugestão:** Mover o default para o chamador (UI layer) usando `t("scenes.defaultName", { index })`, ou aceitar o name como required no slice.

---

### P11 — `groupNodes` tem string hardcoded "Grupo"

- **Severidade:** Média
- **Área:** i18n
- **Onde ocorre:** `components.slice.ts`, linha 622:

```typescript
const panel: PanelComponent = {
  id: generateId("el"),
  name: "Grupo",
```

- **Regra afetada:** "Strings visíveis nunca hardcoded"
- **Sugestão:** Receber `name` como parâmetro do caller na UI layer, usando `t("canvas.defaultGroupName")`.

---

### P12 — `deleteDiagram` faz I/O (side effects) dentro do slice

- **Severidade:** Média
- **Área:** Zustand / Arquitetura
- **Onde ocorre:** `diagram.slice.ts`, linhas 104-105:

```typescript
deleteDiagram: (id: string) => {
  deletePreview(id);  // side effect: deletes from cache
  set((s) => {
    // ...
  });
  removeRecentRef(id);  // side effect: writes to localStorage
},
```

- **Regra afetada:** "Slices devem ser transformações puras de estado — sem side effects, sem I/O"
- **Sintoma:** Side effects (`deletePreview`, `removeRecentRef`) executam antes/depois de `set()`, violando pureza.
- **Sugestão:** Mover side effects para um service/adapter chamado pelo componente que invoca `deleteDiagram`, ou criar middleware/subscriber.

---

### P13 — `addIcon`/`removeIcon`/etc. delegam para outro store dentro do slice

- **Severidade:** Média
- **Área:** Zustand / Arquitetura
- **Onde ocorre:** `diagram.store.ts`, linhas 53-68:

```typescript
addIcon: (_diagramId, icon) => {
  useIconStore.getState().addIcon(icon);
},
```

- **Regra afetada:** "Slices sem side effects, sem I/O"
- **Sintoma:** Actions que não são transformações do próprio store, mas chamadas imperativas a outro store.
- **Sugestão:** Estas são adapter actions por design (migração de icons para store global). Aceitar como exceção documentada ou extrair para um hook/service intermediário.

---

### P14 — `useCanvasStore` retorna objeto novo a cada render

- **Severidade:** Média
- **Área:** Performance
- **Onde ocorre:** `useCanvasStore.ts`
- **Sintoma:** O hook retorna `{ diagram, allDiagrams, visibleComponents, ... }` como literal — nova referência a cada render.
- **Risco:** Qualquer consumer que dependa de `useCanvasStore()` como dep de `useEffect`/`useMemo` invalida a cada render.
- **Sugestão:** Usar `useMemo` no retorno, ou desestruturar diretamente nos consumers.

---

### P15 — Strings hardcoded em recorder/flow UI

- **Severidade:** Média
- **Área:** i18n
- **Onde ocorre:**
  - `StepItem.tsx` linha 86: badge `"async"`
  - `recorder/*.tsx`: múltiplas `t(key, "English fallback")` com fallbacks em inglês inline
  - `src/components/ui/*.tsx`: strings `sr-only` em inglês (sidebar, dialog, sheet, pagination)
- **Risco:** Experiência inconsistente para usuários pt-BR quando fallbacks são atingidos.
- **Sugestão:** Garantir que todos os fallbacks existam nos JSONs de locale; remover fallbacks inline.

---

### P16 — `pushHistory` em `groupNodes` não está no início da mutação

- **Severidade:** Média
- **Área:** Zustand / Undo-Redo
- **Onde ocorre:** `components.slice.ts`, `groupNodes()`: `pushHistory` é chamado na linha 633, após 40 linhas de leitura/validação/geometria (linhas 594-632) dentro do `set()`.
- **Regra afetada:** "`pushHistory` deve ser chamado no início de toda mutação undoable"
- **Sintoma:** Se o estado for alterado por outra operação concurrent entre as leituras e o push, o snapshot salvo pode não refletir o estado real pré-mutação.
- **Risco:** Baixo em prática (single-threaded), mas viola o contrato documentado.
- **Sugestão:** Mover `pushHistory(state)` para imediatamente após o guard `if (!d) return`.

---

### P17 — `useCanvasEdges` chama `resolveCanvasSnapshot` e `useFlowMode` dentro de `useMemo`

- **Severidade:** Média
- **Área:** React / Performance
- **Onde ocorre:** `useCanvasEdges.ts`
- **Sintoma:** Chama `resolveCanvasSnapshot(diagram)` dentro do `useMemo`, recomputando snapshot a cada invalidação do memo. Também usa `useFlowMode().isRecording` como dep.
- **Sugestão:** Receber snapshot como parâmetro pré-calculado.

---

### P18 — `component-type-constants.ts` importa `i18n` — acopla domínio à infraestrutura

- **Severidade:** Baixa
- **Área:** Arquitetura
- **Onde ocorre:** `src/features/diagram/model/component-type-constants.ts`, linha 8
- **Regra afetada:** "`features/diagram` é domínio puro — sem side effects, sem I/O"
- **Sintoma:** `getDefaultNameForNewComponent` usa `i18n.t()` para retornar nomes traduzidos. Tecnicamente, `i18n` é infraestrutura com estado global.
- **Causa:** Conveniência — é útil ter nomes default centralizados.
- **Risco:** Baixo (i18n é síncrono e não causa side effects visíveis), mas viola a pureza conceitual.
- **Sugestão:** Mover `getDefaultNameForNewComponent` para canvas ou para um util fora do model.

---

### P19 — Selectors do domínio usam `useShallow` de `zustand/react/shallow` — acopla a React

- **Severidade:** Baixa
- **Área:** Arquitetura
- **Onde ocorre:** Todos os arquivos em `features/diagram/store/selectors/`
- **Regra afetada:** "`features/diagram` não importa React"
- **Análise:** Tecnicamente, `useShallow` vem de `zustand/react/shallow` — é o React binding de Zustand. Os selectors são hooks React (começam com `use`). Isso é um acoplamento **necessário** e **aceito** pela arquitetura (selectors são a ponte). Não é uma violação prática, mas vale documentar que `features/diagram/store/selectors/` é a camada de bridge, não domínio puro.

---

### P20 — `useEffect` para derivar estado em `ComponentPanel.tsx` e `JsonViewerPanel.tsx`

- **Severidade:** Baixa
- **Área:** React
- **Onde ocorre:**
  - `ComponentPanel.tsx`: 5 `useEffect`s para sincronizar form state com component props
  - `JsonViewerPanel.tsx`: 4 `useEffect`s, incluindo reset de campos quando `component.id` muda
- **Regra afetada:** "Não usar `useEffect` para derivar estado — usar `useMemo`"
- **Sugestão:** Usar `key={component.id}` no componente para remount automático, eliminando efeitos de sync.

---

## 3. O Que Está Bom e Deve Ser Preservado

### Padrões Corretos que NÃO devem ser quebrados:

1. **`NodeTypeDescriptor` registry** — O sistema de descriptors com `matches()`, `buildData()`, `buildStyle()`, e registry ordenado (c4 como catch-all) é excelente. Novos tipos de nó entram sem tocar `Canvas.tsx` ou `useCanvasNodes.ts`.

2. **`getCachedCanvasSnapshot` com `WeakMap`** — Cache que invalida automaticamente quando Immer produz novo objeto `Diagram`. Padrão elegante para selectors.

3. **`SceneDiff` como diff declarativo** — Cenas como overlay sobre base snapshot (adds/removes por id) é superior a cópias independentes. Suporta merge, compare, e futuramente branching.

4. **`commitNodeDrag` — operação atômica** — Unifica parent change + position update em uma transação com um único `pushHistory`. Elimina o bug de double-history/stale-position.

5. **`resolveActiveScene` como helper puro** — Extraído e reutilizado em todos os slices que precisam do scene ativo. Simples e correto.

6. **Type guards centralizados** (`component-type-constants.ts`, `component.guards.ts`) — `isPanelType()`, `isC4Type()`, etc. eliminam string literals espalhados.

7. **`pushHistory` com coalesce e cooldown** — Evita spam no undo stack por operações rápidas consecutivas.

8. **`buildChildrenIndex` + `getDescendantIdsFromIndex`** — Pré-computa índice de filhos para operações em árvore, evitando traversals O(n²).

9. **Barrel exports por feature** — `features/*/index.ts` define API pública. Mesmo com violações, o padrão existe e funciona.

10. **FlowMode como discriminated union** — `{ kind: "idle" } | { kind: "playing"; ... } | { kind: "recording"; ... }` — estados mutuamente exclusivos por design.

11. **`useLocalNodes` com merge strategy** — Reconcilia nodes do store com posições de drag transientes, com detecção de undo/redo para reset.

12. **Persist migrations com versioning** — `persist.config.ts` com `PERSIST_SCHEMA_VERSION`, migrations incrementais, e `mergePersistedState` robusto.

13. **`edgeBuilding.ts` como módulo puro** — Funções geométricas (orthogonal path, segment drag, point-at-offset) são puras, testáveis, e desacopladas do React Flow.

14. **`connectionDerivations.ts`** — Derivação de handle assignments, connection counts, e effective handle order como dados puros que alimentam tanto nodes quanto edges.

---

## 4. Quick Wins

Melhorias pequenas, seguras, e de alto impacto:

| # | Ação | Arquivos | Esforço |
|---|------|----------|---------|
| 1 | Adicionar `useShallow` a `useConnectionIds`, `useFlowIds`, `useServiceIds` | 3 selectors | Trivial |
| 2 | Adicionar `useShallow` a `useDiagrams`, `useFolders` | 2 selectors | Trivial |
| 3 | Remover `UnknownComponent` duplicado da union `Component` | `component.types.ts` | 1 linha |
| 4 | Substituir `"Grupo"` hardcoded por parâmetro i18n | `components.slice.ts` + caller | 2 arquivos |
| 5 | Substituir `"Cena ${index + 1}"` hardcoded por parâmetro i18n | `scenes.slice.ts` + caller | 2 arquivos |
| 6 | Exportar `getCachedCanvasSnapshot` no barrel `diagram/index.ts` | 1 arquivo | Trivial |
| 7 | Mover `pushHistory` para antes da geometria em `groupNodes` | `components.slice.ts` | 1 linha |
| 8 | Usar `key={component.id}` em `ComponentPanel` e `JsonViewerPanel` | 2 componentes | Trivial |
| 9 | Adicionar `useShallow` a `useNodeLayouts` e retornar `{}` como constante | `layout.selectors.ts` | 2 linhas |
| 10 | Mover side effects de `deleteDiagram` para caller | `diagram.slice.ts` + callers | 3 arquivos |

---

## 5. Refatorações Estruturais

### R1 — Expandir barrels e eliminar imports cross-feature

**Etapas:**
1. Auditar todos os imports `@/features/X/subpath` onde X não é o feature do arquivo
2. Para cada item faltante no barrel: adicioná-lo ao `index.ts` da feature
3. Redirecionar imports para usar barrel
4. Criar lint rule (ESLint) que bloqueia imports profundos entre features

**Casos especiais:**
- `useCollabHighlight` é importado em 14 node components — criar barrel em `collaboration/index.ts` (já exporta, mas nodes importam diretamente)
- `ApiGroupNode/constants` é importado por `export-service` — exportar constantes no barrel de canvas ou mover para `diagram/model/layout.constants`

### R2 — Decompor hooks grandes

**Prioridade:**
1. `useFlowModeRecording` (698 linhas) → extrair `useRecordingSteps`, `useRecordingBranches`, `useRecordingFinalize`
2. `useCollab` (708 linhas) → extrair `useCollabConnection`, `useCollabState`, `useCollabSync`
3. `useCanvasKeyboard` (416 linhas) → já parcialmente decomposto em `keyboard/*`; finalizar extração
4. `useCanvasEventHandlers` (346 linhas) → extrair `useNodeClickHandlers`, `useEdgeClickHandlers`, `usePaneHandlers`

### R3 — Decompor componentes grandes

**Prioridade:**
1. `dashboard/index.tsx` (663 linhas) → `DashboardHeader`, `DiagramGrid`, `FolderSection`, `DashboardActions`
2. `serviceRegistry/DetailPanel.tsx` (636 linhas) → `ServiceHeader`, `ServiceDetails`, `ServiceLinks`, `ServiceComponents`
3. `QuickInsertPopover.tsx` (597 linhas) → `QuickInsertSearch`, `QuickInsertCategories`, `QuickInsertResults`
4. `ComponentPanel.tsx` (541 linhas) → já tem sections, mas form logic está no componente principal

### R4 — Estabilizar `useCanvasNodes` context

1. Criar `useNodeBuildContext()` que retorna contexto separado em tiers de estabilidade
2. `staticCtx` (diagram, components, layouts, services) — muda raramente
3. `interactionCtx` (selection, highlight, dragTarget) — muda com interação
4. `playbackCtx` (flowHighlight, activeStep, recording) — muda com playback
5. Memoizar cada tier separadamente

### R5 — Migrar `resolveCanvasSnapshot` para `getCachedCanvasSnapshot` em canvas hooks

1. Exportar `getCachedCanvasSnapshot` no barrel de `features/diagram`
2. Substituir chamadas diretas em `useCanvasEdges`, `Canvas.tsx`, `useNodeDragParenting`, etc.
3. Para callbacks (event handlers), passar snapshot como closure variable

### R6 — Tipar `ComponentPatch` com discriminação

1. Criar `DiscriminatedComponentPatch` como union
2. Manter `ComponentPatch` existente como alias deprecated
3. Migrar consumers gradualmente
4. Remover alias quando todos migrados

---

## 6. Plano de Evolução (Sequência de PRs)

### Fase 1 — Quick Wins (sem risco, alto impacto)
```
PR 1: fix(selectors): add useShallow to object/array selectors
PR 2: fix(types): remove duplicate UnknownComponent from union
PR 3: fix(i18n): remove hardcoded strings from slices (Grupo, Cena)
PR 4: fix(history): move pushHistory to start in groupNodes
PR 5: refactor(selectors): export getCachedCanvasSnapshot in barrel
```

### Fase 2 — Estabilização de Performance
```
PR 6: perf(canvas): use getCachedCanvasSnapshot in useCanvasEdges
PR 7: perf(canvas): use getCachedCanvasSnapshot in useNodeDragParenting
PR 8: perf(canvas): use getCachedCanvasSnapshot in Canvas.tsx and keyboard hooks
PR 9: perf(canvas): stabilize useCanvasStore return with useMemo
PR 10: refactor(actions): split useDiagramActions into domain-specific hooks
```

### Fase 3 — Barrel Cleanup
```
PR 11: refactor(canvas): expand canvas/index.ts with missing exports
PR 12: refactor(collaboration): ensure all nodes import useCollabHighlight from barrel
PR 13: refactor(diagram): expand diagram/index.ts for missing model exports
PR 14: refactor(icons): ensure all consumers use icons/index.ts
PR 15: chore: add ESLint rule for cross-feature deep imports
```

### Fase 4 — Decomposição de Módulos
```
PR 16: refactor(canvas): decompose useCanvasEventHandlers into sub-hooks
PR 17: refactor(canvas): decompose useCanvasVisualState into sub-hooks
PR 18: refactor(flow): decompose useFlowModeRecording
PR 19: refactor(collab): decompose useCollab
PR 20: refactor(dashboard): decompose dashboard/index.tsx
PR 21: refactor(canvas): decompose QuickInsertPopover
PR 22: refactor(canvas): decompose ComponentPanel
```

### Fase 5 — Tipagem e Domain Purity
```
PR 23: refactor(types): create DiscriminatedComponentPatch
PR 24: refactor(domain): move getDefaultNameForNewComponent out of model
PR 25: refactor(slices): extract deleteDiagram side effects to caller
PR 26: refactor(slices): document icon bridge actions as exception
```

---

## 7. Exemplos Concretos

### Exemplo 1: Selector com `useShallow`

```typescript
// ANTES — connection.selectors.ts
export const useConnectionIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(getCachedCanvasSnapshot(d).connections);
  });

// DEPOIS
export const useConnectionIds = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.keys(getCachedCanvasSnapshot(d).connections);
    }),
  );
```

### Exemplo 2: Extraindo side effects de `deleteDiagram`

```typescript
// ANTES — diagram.slice.ts
deleteDiagram: (id: string) => {
  deletePreview(id);          // side effect
  set((s) => {
    delete s.diagrams[id];
    if (s.activeDiagramId === id) s.activeDiagramId = null;
  });
  removeRecentRef(id);        // side effect
},

// DEPOIS — diagram.slice.ts (puro)
deleteDiagram: (id: string) => {
  set((s) => {
    delete s.diagrams[id];
    if (s.activeDiagramId === id) s.activeDiagramId = null;
  });
},

// caller (UI/hook layer)
const handleDeleteDiagram = useCallback((id: string) => {
  deletePreview(id);
  actions.deleteDiagram(id);
  removeRecentRef(id);
}, [actions]);
```

### Exemplo 3: Decomposição de `useCanvasVisualState`

```typescript
// useSelectionState.ts
export function useSelectionState() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // ...
  return { selectedNodeId, setSelectedNodeId, /* ... */ };
}

// useHighlightState.ts
export function useHighlightState() {
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  // ...
  return { highlightedConnectionId, highlightedNodeIds, setHighlight, clearHighlight };
}

// useCanvasVisualState.ts (orchestrator)
export function useCanvasVisualState(activeDiagramId: string | null): CanvasVisualState {
  const selection = useSelectionState();
  const highlight = useHighlightState();
  const tagFilter = useTagFilterState(activeDiagramId);
  const contextMenu = useContextMenuState();
  const inlineEdit = useInlineEditState();
  // compose and return
}
```

### Exemplo 4: Estabilizando `useCanvasStore`

```typescript
// ANTES
export function useCanvasStore() {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  // ... 6 more hooks
  return { diagram, allDiagrams, /* ... */ };  // new object each render
}

// DEPOIS
export function useCanvasStore() {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const flows = useFlows();
  const actions = useDiagramActions();

  return useMemo(() => ({
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceRegistry: serviceRegistry ?? {},
    flows,
    actions,
  }), [diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions]);
}
```

---

## 8. Itens Que NÃO Devem Ser Mexidos Agora

| Item | Razão |
|------|-------|
| **Estrutura de `features/diagram/store/slices/`** | Slices estão bem organizados por domínio. Consolidar ou separar mais não traz valor agora. |
| **`FlowModeContext` como Context API** | O discriminated union `FlowMode` é correto. Converter para Zustand traria complexidade sem benefício claro (já é local ao canvas). |
| **Componentes `ui/` (shadcn/Radix)** | São primitivos gerados — customizar minimamente; não refatorar. |
| **`persist.config.ts` com migrations** | Complexo mas funcional. Migrations são incrementais e testáveis. Não simplificar sem necessidade. |
| **`server/` directory** | Separada do core; collab server é independente. |
| **`edgeBuilding.ts` geometria** | Funções puras bem testadas. Não refatorar sem motivo. |
| **`useLocalNodes` merge strategy** | Complexa mas correta — reconciliação de drag state com store state. Tem proteção de undo/redo. |
| **`nodeVisibility.ts`** | Lógica de visibilidade bem encapsulada. |
| **Sistema de cenas/compare** | Design de SceneDiff é maduro. Não simplificar. |
| **Integrations (`github/`, `defectdojo/`)** | Isoladas, com seus próprios hooks e components. Mexer quando houver necessidade funcional. |

---

## Apêndices

### Checklist de Cleanup Técnico

- [ ] Adicionar `useShallow` a 6 selectors identificados
- [ ] Remover `UnknownComponent` duplicado
- [ ] Corrigir strings hardcoded em slices ("Grupo", "Cena")
- [ ] Corrigir posição de `pushHistory` em `groupNodes`
- [ ] Exportar `getCachedCanvasSnapshot` no barrel
- [ ] Migrar 8 call sites de `resolveCanvasSnapshot` para cache
- [ ] Mover side effects de `deleteDiagram` para caller
- [ ] Adicionar fallback i18n keys para recorder UI
- [ ] Documentar bridge pattern dos selectors de diagram
- [ ] Atualizar `store/README.md` (desatualizado)

### Lista de Débitos Técnicos

| # | Débito | Severidade | Área |
|---|--------|------------|------|
| 1 | 15+ hooks acima de 100 linhas | Alta | Manutenibilidade |
| 2 | 30+ componentes acima de 150 linhas | Alta | Manutenibilidade |
| 3 | ~60 imports cross-feature via internals | Alta | Arquitetura |
| 4 | 6 selectors sem `useShallow` | Alta | Performance |
| 5 | `ComponentPatch` permissivo | Média | TypeScript |
| 6 | `i18n` importado no model domain | Baixa | Pureza |
| 7 | Side effects em `deleteDiagram` | Média | Zustand |
| 8 | Icon bridge actions como side effects | Baixa | Zustand |
| 9 | `useCanvasStore` retorna objeto instável | Média | Performance |
| 10 | `store/README.md` desatualizado | Baixa | Docs |

### Áreas Que Precisam de Testes Primeiro

| Área | Risco sem testes | Testes sugeridos |
|------|-----------------|------------------|
| `components.slice.ts` | Alto — lógica complexa de parenting, grouping, API group sync | Unit tests para `addComponent`, `removeComponent`, `commitNodeDrag`, `groupNodes`, `ungroupNodes` |
| `scene.utils.ts` | Alto — snapshot resolution, merge preview, compare | Já tem `scene.utils.test.ts` — expandir para cover edge cases de merge |
| `flow-traversal.ts` | Médio — graph walking, validation | Unit tests para `walkFlow`, `validateFlowGraph`, `getOrderedStepIds` |
| `connectionDerivations.ts` | Médio — handle assignment, edge visibility | Unit tests para `buildEdgeHandleAssignments`, `buildEffectiveHandleOrder` |
| `panelParenting.ts` | Médio — hit testing, absolute position | Unit tests para `findPanelContainingPoint`, `resolveAbsolutePosition` |
| `useNodeDragParenting.ts` | Alto — drag + reparenting + scene lock | Integration tests com React Testing Library |
| `clipboard.slice.ts` | Médio — paste with parent remapping | Unit tests para `pasteFromClipboard` com hierarquias |

### Considerações para Escalabilidade Futura

| Feature futura | Impacto na arquitetura atual | Preparação recomendada |
|---------------|------------------------------|------------------------|
| **Collaboration (Yjs/WebRTC)** | `useCollabStoreSync` já existe; snapshot resolution precisa ser determinístico | Garantir que todos os mutations sejam idempotentes e order-independent |
| **Linked diagrams** | `linkedDiagramId` já existe no model | Adicionar selector `useLinkedDiagram(id)` e UI de navegação |
| **Novos node types** | Sistema de descriptors suporta adição sem modificar core | Manter c4Descriptor como catch-all; documentar processo |
| **Backend/cloud sync** | `IStoragePort` abstrai persistência | Implementar CloudStorageAdapter; sem mudança em slices |
| **Import/export avançado** | `lib/export-service` é isolado | Expandir com novos formatos sem afetar domínio |
| **Scenes/versioning** | SceneDiff suporta branching conceitual | Considerar timestamps em diffs para conflict resolution |
| **Flow playback avançado** | Flow graph model é extensível | `FlowStep` suporta novos tipos via `FlowStepType` union |
| **Templates/patterns** | `UserTemplate` + `insertPattern` já funciona | Expandir catálogo sem afetar store |

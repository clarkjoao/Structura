# Auditoria geral do Structura — performance, arquitetura e UX/UI

Data: 2026-11-10 (seção 9 acrescentada em 2026-11-11). Somente leitura e medição nas seções 1–8; a seção 9 registra a implementação que se seguiu.
Etiquetas de evidência: `MEDIDO` (rodei e tenho número), `LIDO` (está no código, com arquivo:linha), `HIPÓTESE` (plausível, sem confirmação).

---

## 1. Resumo executivo

> **Duas bases medidas.** A auditoria foi feita sobre `main` (`60d51ec2`) e, a pedido, repetida sobre `feat/arrange-rule-refs` (`84f6d014`, 23 commits à frente). A branch já resolve os itens 1, 2 e 3 abaixo e melhora o arraste simples; o comparativo completo está na **seção 8**, e a lista a seguir marca o estado de cada item na branch. A ordem de implementação recomendada para quem parte da branch é: **4 → 5 → 6 → 7 → 8** e, dentro de performance, o arraste de multi-seleção (A3), que continua igual. A implementação feita a partir da branch está na **seção 9**.

Em ordem de valor ÷ esforço (estado em `main`; entre colchetes, o estado na branch):

1. **Arrange (ELK) grava o store uma vez por aresta** — a 400 nós o Arrange leva 9,0 s (main thread bloqueada 5,4 s de uma vez); a 1000 nós, 53,5 s com uma long task de 34,8 s. 24 s dos 53 s são avaliação de seletores Zustand, não ELK. Uma ação em lote resolve a maior parte. Ganho enorme, esforço M, risco baixo. (A7) **[Resolvido na branch: 1,2 s a 400, 3,6 s a 1000, ELK em worker — `applyLayoutEdges`, `elkRunner.ts`.]**
2. **Cada tick de roda (pan/zoom) serializa o workspace inteiro** — 30 eventos de roda = 30 `JSON.stringify` de 317 KB (9,5 MB) a 1000 nós, porque `onMoveEnd` escreve o store sem debounce. Ganho alto no pan (p95 de 75 ms → ~10 ms), esforço P, risco baixo. (A5) **[Resolvido na branch: 0 serializações em 30 ticks; pan p95 8,8 ms a 400, 42,6 ms a 1000 — `useSettledViewportWrite`.]**
3. **Mover o `JSON.stringify` do persist para o flush debounced** — hoje cada `set()` serializa o workspace; o I/O já é debounced 1 s, a serialização não. Reduz o custo fixo de todo commit, undo, seleção e Arrange. Esforço P–M, risco baixo. (A6) **[Resolvido na branch: 1 serialização por flush — `persist.config.ts:630-667`; workspace agora em IndexedDB.]**
4. **Mudança de seleção custa 86 ms (400) a 190 ms (1000) por clique** e reconstrói todos os nós; em diagramas grandes shift-clicks são perdidos (6/10 a 400, 1/10 a 1000). Esforço M, risco médio (toca na seleção com múltiplas fontes de verdade, já conhecida). (A4, C10) **[Na branch: melhora parcial — 40 ms (400) a 145 ms (1000) por clique; shift-clicks continuam perdidos (6/10, 1/10); seleção segue no `dataCtx`.]**
5. **Payload inicial de 657 kB gzip (2,27 MB bruto, 102 arquivos pré-carregados)** carrega os dois idiomas, os seeds de demo, jszip, a pilha react-markdown e o store do LLM antes de qualquer rota; o chat (`@assistant-ui`, 440 kB de fonte) vai junto com o chunk do canvas. Esforço P–M, risco baixo. (A1) **[Na branch: igual — 663 kB gzip.]**
6. **SVG do usuário é renderizado sem sanitização no caminho de render** (`SvgNode`, `CustomIconRenderer`); o sanitizador só roda no import de arquivo SVG, não em workspace importado, share URL, colaboração ou plugin. Esforço P, risco baixo. (B9) **[Na branch: igual.]**
7. **Documentação e regras duras divergem do código**: 21 arquivos fora de `infrastructure/persistence` acessam `localStorage`; o gate `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE` não existe no código; os specs Cypress de stress não rodam no CI; três "oportunidades altas" do doc de hot path já foram implementadas. Esforço P. (B1–B4) **[Na branch: o doc de hot path foi atualizado e a regra de `localStorage` foi restrita ao workspace; gate inexistente, Cypress fora do CI e seed de stress em schema 4 continuam.]**
8. **UX de primeiro uso e defeitos pequenos**: rota `/model/<id inexistente>` mostra o diagrama anterior; exclusão em massa sem confirmação nem toast com desfazer; clique simples no card só seleciona (abrir exige duplo clique, sem affordance); arrastar o canvas vazio com o botão esquerdo não faz nada. Esforço P cada. (C1, C5, C6, C7) **[Na branch: igual.]**

Alvo oficial "1.000 nós fluidos" **não é atingido em `main`** (MEDIDO): arraste de um nó a 1000 nós tem p95 de 67 ms por frame e 41 long tasks em 4 s. **Na branch chega perto no arraste simples** (p95 41,6 ms, 3 long tasks / 275 ms), mas o arraste de uma multi-seleção continua fora do orçamento nas duas bases (169 nós a 400: 40 long tasks, 2,9–3,6 s; 450 nós a 1000: 40 long tasks, 7,3–8,4 s). O próximo gargalo real, nas duas bases, é **re-render por nó durante arraste de muitos selecionados** (A3) e o custo por clique de seleção (A4).

---

## 2. Ambiente e método

| Item | Valor |
| --- | --- |
| HEAD | `60d51ec2` (`main`, igual a `origin/main`), worktree destacado, árvore limpa. Segunda base: `84f6d014` (`feat/arrange-rule-refs`), outro worktree destacado — ver seção 8 |
| Build | produção: `vite build --sourcemap` (8,2 s), servido por `vite preview` na porta 4173 (o dev server da 8080 não foi tocado) |
| Máquina | macOS Darwin 27.2.0, Apple Silicon, Node v25.4.0 |
| Navegador | Chromium headless do Playwright 1.62.1 (`chromium-1234`), viewport 1440×900, `locale=en-US`, uma única instância por execução |
| Massas | sintéticas: **50 nós / 45 arestas**, **400 / 360**, **1000 / 900** (payload 14 / 114 / 294 KB). Estrutura: n/25 painéis com 4 filhos cada, restante em grade de 20 colunas, ~0,9 aresta por nó, metade com rótulo. Os seeds reais (PixLedger) têm no máximo **51 nós**, então não serviram como massa média ou alvo |
| Gates (`main`) | `npm run typecheck` 12,2 s OK; `npm run lint` 18 s, 0 erros / 7 avisos; `vitest run` 429 arquivos, 4307 testes, 109 s de parede; `npm run fallow:check` OK (sem ciclos, sem dead code novo); `npm audit` 31 vulnerabilidades (9 high, 21 moderate, 1 low) |

**Instrumentos** (scripts `perf.mjs`, `profile.mjs`, `ux.mjs` no scratchpad da sessão, fora do repositório):

- `PerformanceObserver` de `longtask`; amostrador de gaps de `requestAnimationFrame`; amostrador de lag de `setTimeout(0)` ("busy");
- wrappers de `JSON.stringify` (conta chamadas; "big" = resultado > 20 KB), `Storage.prototype.setItem` e `IDBObjectStore.put/add` (conta escritas e bytes);
- CDP `Profiler` com amostragem de 0,5 ms, atribuído ao código-fonte original pelos source maps do build (`module.SourceMap`);
- CDP `Performance.getMetrics` (`JSHeapUsedSize`) após `HeapProfiler.collectGarbage`;
- composição de bundle por source map (bytes de fonte original por pacote, proxy da composição minificada).

**Limitações e possíveis distorções**

- Headless roda rAF a 120 Hz (p50 de frame = 8,3 ms); o orçamento de 16 ms corresponde a dois frames. Contagens ">16 ms" são conservadoras.
- Uma execução por massa, sem repetição: trate números como indicativos (±20 %). Ordem de grandeza e proporções entre massas são o que importa.
- O contador de `stringify` é global (inclui chamadas que não são do persist); por isso reporto separadamente os "big" (> 20 KB), que a 400+ nós só podem ser o workspace.
- O profiler de amostragem infla o tempo total; uso-o para atribuição relativa, não para valores absolutos (os absolutos vêm das long tasks sem profiler).
- Uma versão anterior do harness clicava fora da viewport depois do pan e apagou todos os nós com `Delete`; os números abaixo vêm da versão corrigida. Duas fases ficaram sem medida confiável: "arrastar seleção total" a 50/1000 (o harness não achou nó visível após `Cmd+A`) e "apagar 1 nó" a 50/400 pelo harness principal (medido depois pelo script de perfil).
- A UX foi exercitada por automação (sem toque humano real); o que não pude verificar está marcado.

---

## 3. Achados por frente

### Frente A — Performance

#### A1 · Boot e bundle `MEDIDO`

| Massa | 1.º nó visível | DCL | long tasks no boot | heap após boot (GC) |
| --- | --- | --- | --- | --- |
| 50 | 837 ms | 451 ms | 2 / 124 ms | 19,6 MB |
| 400 | 778 ms | 366 ms | 3 / 390 ms (max 146) | 55,4 MB |
| 1000 | 929 ms | 371 ms | 5 / 1045 ms (max 354) | 119 MB |

Rota do canvas carrega **186 arquivos JS (1041 KB transferidos)**. `index.html` tem **100 `modulepreload`**; o conjunto inicial é **102 arquivos, 2266 kB bruto, 657 kB gzip** (medido por `gzipSync` de cada arquivo referenciado).

O que está no conjunto inicial e poderia ser lazy (composição por source map, bytes de fonte original):

| Chunk | Tamanho min/gz | O que carrega | Onde entra |
| --- | --- | --- | --- |
| `diagram-*.js` 708 kB / — | i18n **ambos os idiomas** (282 kB), **seeds PixLedger** (179 kB), react-dom, sonner, immer | `i18n.ts:4-5` importa `pt-BR.json` e `en.json` estaticamente; `diagram.slice.ts:1,13` importa `SEED_DIAGRAMS` sempre |
| `index-*.js` 503 kB / 118 kB | renderizadores de nós do canvas (254 kB), registry (143 kB), **pilha react-markdown** (micromark, mdast, unified ≈ 300 kB) | `NoteNode.tsx:3` importa `react-markdown` estaticamente e o registry importa os renderizadores no bootstrap |
| `label-*.js` 301 kB / 77 kB | lucide-react (116 kB), tailwind-merge (73 kB), radix | shell |
| `llm-*.js` 103 kB / 32 kB | store do LLM + catálogos | `App.tsx:8` importa o barrel `@/features/llm` para o `ChatThreadsHydrator` |
| `download-file-*.js` 94 kB / 28 kB | **jszip** | pré-carregado embora só sirva ao export |
| `canvas-*.js` (lazy) 557 kB | 46 % canvas, **@assistant-ui 440 kB de fonte**, date-fns 78 kB | `Canvas.tsx` importa `AssistantUIChatPanel` estaticamente: o chat vai com o canvas mesmo nunca aberto |
| `FileSystemStatus-*.js` (lazy) 147 kB | framer-motion (440 kB de fonte) para 6 diálogos | ok ser lazy, mas é um motor de animação para fades |

ELK (1,57 MB de fonte), Monaco e os ícones AWS/Azure **já são lazy** — correto.

- Impacto: ~200 kB gzip evitáveis no boot; o chunk do canvas carrega 440 kB de fonte de chat que a maioria das sessões não abre.
- Proposta mínima: `React.lazy` no `AssistantUIChatPanel`; `import()` de `jszip` dentro de `download-file.ts`; `import()` dos locales por idioma detectado; `import()` dos seeds só quando o storage está vazio; `App.tsx` importar `useLLMStore` do módulo folha em vez do barrel (o próprio `AGENTS.md` pede isso).
- Esforço P–M · Risco baixo · Dependências: nenhuma.

#### A2 · Arraste de um nó `MEDIDO`

| Massa | frames | p50 | p95 | max | frames > 16 ms | long tasks | stringify "big" no commit | setItem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 147 | 8,3 | 9,2 | 50 | 1 | 1 / 54 ms | 0 | 2 (20 KB) |
| 400 | 173 | 8,4 | 17,2 | 117 | 19 | 2 / 184 ms | 1 (123 KB) | 2 (83 KB) + 4 (206 KB) no idle |
| 1000 | 181 | 8,4 | **67** | 234 | **45** | **41 / 3046 ms** | 1 (317 KB) | 4 (525 KB) + 4 no idle |

Perfil a 1000 (gesto + 100 ms, 2,08 s de script): `src/features/canvas` 730 ms, react-dom 448, **zustand (seletores) 258**, @xyflow/react 227, use-sync-external-store 92. Funções: `zustand/esm/react.mjs:8` 121 ms, **`edges/geometry/lineHops.ts:108` 108 ms**, `EditableEdge.tsx:69` 30 ms.

- Leitura: o frame de arraste ainda passa por seletores Zustand em massa (258 ms) e pelo cálculo de "line hops" a cada frame (`lineHops.ts:108`), apesar de o store não ser escrito durante o gesto. O documento de hot path já diz que o arraste não escreve o store; o que sobra é o custo de leitura por nó/aresta.
- Proposta mínima: perfilar `lineHops` (cachear por par de arestas e invalidar só para as arestas do nó arrastado); contar quantas instâncias de `useDiagramStore`/`useStore` existem por nó e por aresta (estratégia §6 do doc).
- Esforço M · Risco médio (sharp edge documentado).

#### A3 · Arraste de multi-seleção `MEDIDO`

| Caso | long tasks | p95 frame | observação |
| --- | --- | --- | --- |
| 400 nós, 169 selecionados (marquee) | **40 / 3632 ms** | 92 ms | 40 de 182 frames > 50 ms |
| 1000 nós, 450 selecionados | **40 / 8398 ms** | 208 ms | |
| 400 nós, todos (`Cmd+A`) | 40 / 4368 ms (max 176) | — | perfil: react-dom 912 ms, canvas 485, zustand 375, **i18next + react-i18next 268 ms** |

- Leitura: com muitos nós selecionados, cada frame re-renderiza cada nó movido (react-dom domina) e cada render chama `t()` (268 ms de i18n por gesto de 1,5 s — `useTranslation` dentro dos renderizadores de nó). `HIPÓTESE`: os nós selecionados recebem objetos novos a cada `setNodes`, derrubando a memoização.
- Proposta mínima: medir re-renders por nó durante um arraste de N selecionados (React Profiler); hoistar as strings traduzidas para fora do render do nó; verificar identidade de `node.data` dos nós que apenas mudaram de posição.
- Esforço M–G · Risco médio.

#### A4 · Mudança de seleção `MEDIDO`

| Massa | 6 cliques simples | 10 shift-clicks (300 ms entre eles) | `Cmd+A` |
| --- | --- | --- | --- |
| 50 | 0 long tasks | 1 / 55 ms · **4 de 10 selecionados** (a 450 ms: 4/4 ok) | 0 |
| 400 | 7 / 516 ms (~86 ms por clique) · 2 setItem (123 KB) | 11 / 1140 ms (max 214) · **6 de 10** | 2 / 122 ms |
| 1000 | 7 / 1132 ms (~190 ms, max 220) · 2 setItem (317 KB) | 13 / 2971 ms (max 493) · **1 de 10** | 2 / 292 ms |

Perfil a 1000 (5 cliques): react-dom 129 ms, **nativo 105 ms (`get scrollHeight` 58 ms, `getBoundingClientRect` 11 ms — layout forçado)**, @xyflow 65, canvas 61, zustand 60.

- `LIDO`: a seleção entra no `dataCtx` de `useCanvasNodes.ts:264-277` (`selectedNodeIds`), então toda mudança de seleção re-executa o `useMemo` de `useCanvasNodes.ts:321` sobre **todos** os nós visíveis (`projectNodes` + `applyEditorNodeOverlays` por nó), mesmo com o cache de identidade. Um clique também gera uma escrita de persist (2 `setItem`, 123–317 KB) — `HIPÓTESE`: o re-measure do nó selecionado (`ResizeObserver` → `batchUpdateNodeLayouts`) ou o painel lateral escrevendo o store.
- Impacto: em diagramas grandes a seleção é a interação mais lenta depois do Arrange, e shift-clicks são perdidos.
- Proposta mínima: tirar a seleção do `dataCtx` (deixar o `selected` do React Flow e um overlay por nó via contexto estável), eliminar a leitura de `scrollHeight` no caminho do clique, e confirmar/remover a escrita de persist por seleção.
- Esforço M · Risco médio (interage com a seleção de múltiplas fontes de verdade, já conhecida — isto é o custo medido dela, não um achado novo sobre a arquitetura).

#### A5 · Pan e zoom `MEDIDO` + `LIDO`

| Massa | pan roda ×30 | zoom ctrl+roda ×20 |
| --- | --- | --- |
| 50 | p95 8,8 ms · 0 big stringify | 0 big |
| 400 | p95 16,7 ms, 11 frames > 16 · **30 big stringify (3681 KB)** | **20 big (2454 KB)** |
| 1000 | p95 **75 ms**, 45/107 frames > 16, 6 long tasks · **30 big (9505 KB)** | 24 frames > 16 · **20 big (6336 KB)** |

Perfil a 1000 (40 eventos): **zustand 353 ms** (`react.mjs:8` 258), react-dom 295, @xyflow 278, `src/features/diagram` 143 (`stableSlice.ts:29` 103), use-sync-external-store 127.

- `LIDO`: `useCanvasEventHandlers.ts:177-182` → `onMoveEnd` chama `updateViewport` sem debounce; `layout.slice.ts:169-175` faz `set()`; cada `set()` serializa o workspace (`persist.config.ts`, `createJSONStorage`) e notifica todos os assinantes. `VIEWPORT_DEBOUNCE_MS` (800 ms) existe em `store.constants.ts:1` mas só é usado em `fileSystemBoot.ts:598`. Cada tick de roda é um gesto d3-zoom completo, logo um `moveEnd` por tick.
- Proposta mínima: debounce/throttle do `updateViewport` (reutilizar `VIEWPORT_DEBOUNCE_MS`) ou gravar o viewport fora do store persistido (ele não precisa de histórico nem de notificação para o canvas).
- Esforço P · Risco baixo.

#### A6 · Persistência e store `MEDIDO` + `LIDO`

- Cada `set()` do store serializa o workspace inteiro (`persist.config.ts:757`, `createJSONStorage`); o I/O é debounced 1 s (`PERSIST_DEBOUNCE_MS`, `persist.config.ts:674-712`). O documento de hot path reconhece isso como oportunidade "alta"; a medição confirma o custo em todo caminho: 1 stringify de 317 KB por commit de arraste, por undo, por redo, por clique de seleção (via re-measure), por tick de roda.
- `LIDO`: o Zustand v5 aceita um `PersistStorage` cujo `setItem` recebe o objeto (não a string); trocar `createJSONStorage(() => trackedStorage)` por um storage que guarda o último `StorageValue` e só faz `JSON.stringify` dentro de `flushPersist` elimina a serialização por `set()` com mudança local em `persist.config.ts`.
- Migrações: `mergePersistedState` (`persist.config.ts:614-642`) executa **todas** as 20 migrações a cada boot, independentemente da versão persistida; `migrate` (`persist.config.ts:770-781`) só usa a versão para duas delas. É idempotente (testado), mas é trabalho O(diagramas × componentes) a cada carga e torna `PERSIST_SCHEMA_VERSION` quase decorativa. `HIPÓTESE`: parte dos 354 ms de long task no boot a 1000 nós.
- Histórico: `history.slice.ts:14-16` usa `current()` do Immer — snapshots por referência, O(1) por checkpoint com compartilhamento estrutural; `MAX_HISTORY_STEPS` 30. O custo de undo/redo medido é 51–68 ms (400) e ~200 ms (1000), dominado pelo re-render e pela serialização do persist, não pelo histórico. A documentação diz "cópias completas" — está mais pessimista que o código.
- Memória: **sem vazamento** em 6 ciclos abrir/fechar: 15 → 15 MB (50), 45,1 → 45,1 MB (400), 96,5 → 96,6 MB (1000) após GC. O heap da primeira abertura é maior (19,6 / 55 / 119 MB) e cai após o primeiro ciclo.
- Listeners: 76 `addEventListener` × 67 `removeEventListener` em código não-teste. Os três sem remoção fora de `persist.config.ts` são `keydown` em `editor.getDomNode()` do Monaco (`JsonViewerNode.tsx:336`, `JsonViewerPanel.tsx:188`, `JsonField.tsx:99`) — morrem com o DOM do editor, risco baixo.
- Ruído: **0 `console.warn`/`console.error`** em todas as execuções medidas (bom). No código há 60 `console.warn` e 36 `console.error` diretos embora exista `lib/core/logger`.

Esforço: stringify no flush P–M; debounce do viewport P; migrações por versão P. Risco baixo.

#### A7 · Auto-layout (ELK) `MEDIDO` + `LIDO` — crítico

| Massa | nós movem após | long tasks | maior long task | perfil (script) |
| --- | --- | --- | --- | --- |
| 400 | **8,98 s** | 19 / 8621 ms | **5353 ms** | zustand 3732 ms · elkjs 2641 · diagram 1056 · canvas 671 · immer 124 |
| 1000 | **53,5 s** | 32 / 53249 ms | **34787 ms** | **zustand 23986 ms** (`react.mjs:8` 19270) · elkjs 13527 · diagram 7206 (`stableSlice.ts:29` 6541) · canvas 4887 · immer 842 |

- `LIDO`: `applyLayoutResult.ts:73-96` chama `store.resetEdgeControlPoints` uma vez por aresta e depois `store.setEdgeControlPoints` + `store.setEdgeLabelOffset` uma vez por aresta (`layout.slice.ts:182`, `:233`). A 1000 nós são ~1350+ `set()` sequenciais; cada um serializa o workspace e notifica todos os assinantes (1000 nós × hooks). Isso explica 24 s de seletores Zustand e 6,5 s em `stableSlice`. O `applyAutoLayout` dos nós (`layout.slice.ts:437`) já é um único `set()` — o lote só falta nas arestas.
- `LIDO`: ELK roda na main thread: `layoutEngine.ts:192` importa `elkjs/lib/elk.bundled.js` (não a variante com worker). Nos 13,5 s de ELK a 1000 nós a UI fica congelada; `chooseAutoRefs` (`autoLayoutDiagram.ts:100`) roda o ELK mais de uma vez para escolher referências.
- Não há cache do resultado; cada Arrange recomputa.
- Proposta mínima: (1) uma ação `applyEdgeLayouts(diagramId, Record<id, EdgeLayout>)` em `layout.slice.ts` e um único `set()` em `applyLayoutResult.ts`; (2) `elk-worker`/`Worker` para o ELK (o import já é dinâmico). Com (1) a estimativa é Arrange a 1000 nós cair de 53 s para a ordem do tempo do ELK (≈13 s), e com (2) a main thread deixa de bloquear.
- Esforço M · Risco baixo (a semântica "uma escrita, um checkpoint" já é a regra para arraste).

#### A8 · Interações discretas `MEDIDO`

| Operação | 400 | 1000 |
| --- | --- | --- |
| Undo / redo de um movimento | 51 / 68 ms (1 long task cada) | 201 / 205 ms (2 cada) |
| Apagar 1 nó | 1 / 85 ms | 2 / 291 ms (max 205) |
| Undo do delete | 1 / 77 ms | 1 / 164 ms |
| `Cmd+A` | 2 / 122 ms | 2 / 292 ms (max 146) |
| Clique no pane (limpar seleção) | 1 / 63 ms | 1 / 218 ms |
| Trocar de diagrama (ciclo /workspace → /model) | ≈2,8 s de parede por ciclo (inclui navegação e 600 ms de espera) | ≈3,0 s |

Cada uma dessas gera 1 stringify do workspace e, no caso de delete/undo, 2 `setItem`. Não medi: colapsar/expandir painel, redimensionar painel, mover rótulo/waypoint de aresta (o código já mantém rascunho local e só escreve no soltar — `useControlPoints.ts:50`, `useSegmentDrag.ts:69`, `useEdgeLabelDrag.ts:41`), abrir/fechar painéis laterais, busca. Abrir a paleta (`Cmd+K`) acendeu "Saving…" (`HIPÓTESE`: escrita de store ao abrir).

#### A9 · Cobertura de performance no CI `LIDO`

`cypress/e2e/stress-*.cy.ts` existem com orçamentos frouxos (seleção < 2000 ms, fitView < 8000 ms) e semeiam `PERSIST_VERSION = 4` (`cypress/support/seed-stress-diagram.ts:9`) contra o schema 16. **Nenhum job do CI roda Cypress** (`.github/workflows/ci.yml`: lint, fallow, typecheck, vitest, relay). Nenhuma regressão de A2–A7 seria detectada.

---

### Frente B — Arquitetura de software

#### B1 · `docs/concepts/canvas-hot-path.md` está desatualizado `LIDO` — médio

Das três oportunidades "altas — ainda no frame de arraste", as três já foram feitas: `elementsSelectable` saiu do `useStore` (`EditableEdge.tsx:100-103`, via `useElementsSelectable()`); os arrastes de ponto/segmento/rótulo de aresta usam rascunho local (`useControlPoints.ts:50`, `useSegmentDrag.ts:69`, `useEdgeLabelDrag.ts:41`); o `setTick` por frame foi contornado por `publishDragFrame` (`useLocalNodes.ts:455-459`, `useCanvasGraphState.ts:292-297`). Continuam em aberto: `useViewportOccupancy.ts:81-84` (scan de `nodeLookup` a cada notificação do RF), `useNodeDragParenting.ts:525/593/655` (`findPanelContainingPoint` no commit), `NodeToolbar` em `Canvas.tsx:58` e `PendingNodeToolbar.tsx`. A tabela "Already in place" também não lista `publishDragFrame`. Menor mudança: reescrever a seção "Remaining opportunities" com os achados A2–A7 desta auditoria.

#### B2 · Regra dura "nada fora de `infrastructure/persistence/` toca `localStorage`" não é verdadeira `LIDO` — médio

21 arquivos acessam `localStorage` diretamente, entre eles `features/integrations/{gitlab,defectdojo,github}/*` (tokens), `features/llm/llm-storage.ts`, `features/diagram/store/storage-monitor.ts`, `features/diagram/utils/{edge-style,recent-diagrams}.ts`, `lib/diagram-preview/previewCache.ts`, `hooks/useTheme.ts`, `hooks/useWorkspaceFocusSync.ts`, `pages/dashboard/favoriteDiagrams.ts`, `components/SettingsMenu.tsx`, `features/canvas/navigation/sidebarFolderStorage.ts`, `features/canvas/hooks/useCanvasCompareModeEffects.ts`. Ou a regra vale só para o workspace (então o `AGENTS.md` deve dizer isso), ou esses sítios migram para o port. Impacto: a porta `IStoragePort` não é a única fronteira de persistência, o que enfraquece a promessa de "trocar adaptador sem reescrita".

#### B3 · `AGENTS.md` cita um gate de build inexistente `LIDO` — baixo

`VITE_ENABLE_CLOUD_SERVICE_ID_WRITE` só aparece em `AGENTS.md:112` e `docs/adr/0010-element-registry.md:70`; não há referência em `src/`, `vite.config.ts`, `package.json`, `tools/` ou workflows. O build não é gated por nada.

#### B4 · Testes de stress fora do CI e specs Cypress com schema antigo `LIDO` — alto

Ver A9. O `AGENTS.md` ("Vitest (unit) + Cypress (`cypress/e2e/stress-*`) para testes") sugere que a suíte protege o canvas; não protege.

#### B5 · Estado: 16 stores Zustand e 22 contextos `LIDO` — médio

Stores: diagram, icon, saveStatus, llm, collab (3: store, session, bridge), catalogUi, sharedReveal, element-presets, walkthrough, canvas-preferences, autoArrangeWatcher, canvasSelection, textLayer, flowView. Seleção vive em `useCanvasSelectionStore` + `node.selected` do React Flow (já conhecido; o custo medido está em A4). Viewport: único dono é o store (`updateViewport`), mas é escrito por tick de roda (A5). `Canvas.tsx` tem 48 chamadas de hook e 779 linhas; `useCanvasController` 29; `useCanvasInteraction` 20 — o controlador é a parte mais difícil de raciocinar do app.

#### B6 · Modelo de dados e import `LIDO` — médio

- Versionamento: `PERSIST_SCHEMA_VERSION = 16` com 20 migrações idempotentes todas executadas no `merge` (A6).
- Share URL: `lib/share-url/decode.ts:58-61` aceita qualquer JSON com `id` e `snapshot`; sem validação de forma, sem limite de tamanho (o aviso de 8000 caracteres é só na codificação, `encode.ts:18`). O viewer tem `assertDiagram` para o `postMessage` (`ViewerPage.tsx:187`) mas o caminho `#share=` não o usa. Um payload malformado chega ao store e aos renderizadores.
- Import de workspace: `validateWorkspaceFile.ts:34` valida forma básica (não encontrei limites de tamanho nem sanitização de `svgContent`).
- Arquivo antigo: as migrações cobrem; arquivo malformado: depende de guards por campo. Não testei import malformado de ponta a ponta.

#### B7 · Extensibilidade `LIDO` — baixo

Registry de elementos (`features/elements`, 11 passos no guia) é a fonte única e está bem testado (invariantes de single owner, contrato de família). Ainda há **65** comparações `type === "…"` fora do registry e dos guards (`useNodeDragParenting.ts` 6, `useLocalNodes.ts` 6, `MultiSelectPanel.tsx` 4, `features/llm/*` 10, `persist.config.ts` 3, `collab.utils.ts` 3) e 7 `switch` por tipo. Exportação: um arquivo por formato em `lib/export-service/` sem registry — adicionar formato é novo arquivo + fiação no modal de export. Arestas: tipos fixos em `EditableEdge`.

#### B8 · Qualidade de código `LIDO` — médio

- 0 `any`, 36 `as unknown as` (7 em `persist.config.ts`, 3 em `FileSystemAdapter.ts`), 0 `@ts-ignore`.
- ESLint: `react-hooks/refs`, `set-state-in-effect`, `immutability`, `purity`, `static-components`, `preserve-manual-memoization` desligadas globalmente (`eslint.config.js:40-52`) — o comentário admite que escondem refs escritos no render e `setState` em efeito; 20 `eslint-disable-next-line react-hooks/exhaustive-deps` (o comentário fala em dezesseis).
- Vitest com `retry: 2` e `testTimeout: 90000` (`vitest.config.ts:24-25`): testes instáveis passam sem sinal.
- Arquivos > 650 linhas: `FileSystemAdapter.ts` 1168, `llm/store.ts` 1056, `pages/dashboard/index.tsx` 964, `components.slice.ts` 944, `persist.config.ts` 802, `Canvas.tsx` 779, `useNodeDragParenting.ts` 690, `useFileSystemStorage.ts` 650.
- Dead code: baseline do fallow com **545 exports e 266 tipos não usados** e 16 arquivos, dos quais **11 são barrels `index.ts`** (`canvas/{components,edges,hooks,navigation,panels,toolbar}`, `elements`, `plugins`, `walkthrough`, `lib/catalogs`, `lib/core`) — `docs/architecture/overview.md` chama esses barrels de "pontos de entrada canônicos"; o fallow diz que ninguém os importa.
- Erros engolidos: 179 `catch`, 58 só logam. `target="_blank"` sem `rel` em 9 sítios (baixo: navegadores modernos aplicam `noopener`).
- Strings fixas: `App.tsx:70` "Loading…" sem `t()`; `index.html` com `lang="en"` e meta description em português. Paridade i18n: 2718 chaves em ambos os idiomas, 0 faltantes.

#### B9 · Segurança `LIDO` — alto (XSS armazenado)

- `SvgNode.tsx:97,121` e `CustomIconRenderer.tsx:20` renderizam `svgContent` com `dangerouslySetInnerHTML`. O sanitizador `canvas/utils/svg.sanitizer.ts` só é chamado em `importSvgToCanvas.ts` e `IconPickerModal.tsx` (ingresso de arquivo SVG). `svgContent` também entra por import de workspace, share URL (`decode.ts`), colaboração e plugins, sem sanitização. `<svg onload=…>`, `<a href="javascript:…">` e `<foreignObject>` executam a partir de `innerHTML`. Menor mudança: sanitizar no render (um `useMemo(sanitize(svgContent))` nos dois componentes) e, adicionalmente, no `validateWorkspaceFile` e no `decodeSharePayload`.
- Viewer embed: `ViewerPage.tsx:181-210` aceita `STRUCTURA_LOAD` de qualquer origem e responde para `event.origin`. Por desenho para embed; vale uma allowlist opcional (decisão de produto).
- Segredos: tokens GitLab/DefectDojo/GitHub e chaves de LLM em `localStorage` em texto plano (documentado para LLM). Nenhum segredo no repositório encontrado.
- `npm audit`: 31 (9 high). Em runtime: `react-router-dom` 6.30 (open redirect, moderate), `dompurify` via `monaco-editor` (XSS, high — afeta hovers do Monaco). O restante é devDependency (vite/launch-editor, brace-expansion, js-yaml, serialize-javascript, source-map-js, systeminformation, undici, zod).

#### B10 · Testes `LIDO` — médio

Densidade (arquivos fonte / teste): `canvas` 411/197, `diagram` 112/81, `persistence` 29/10, `elements` 58/27, `lib` 59/28, `pages` 52/10, `components` 27/3, `hooks` 8/2. Sem teste: `canvas/toolbar` (9 arquivos), `canvas/navigation` (5), `canvas/chat` (5), `canvas/preferences`, `canvas/focus`. Caminhos críticos sem cobertura de integração: import de arquivo malformado, share URL malformada, `FileSystemAdapter` (1168 linhas, 10 testes no diretório inteiro). Hot path: há testes de contagem de `set()` e identidade (bom), mas nenhum orçamento de tempo.

#### B11 · Dívida documental (consolidado) `LIDO`

| Documento | Afirmação | Código |
| --- | --- | --- |
| `canvas-hot-path.md` | 3 oportunidades "altas" pendentes | já feitas (B1) |
| `AGENTS.md` | `localStorage` só em `infrastructure/persistence` | 21 arquivos fora (B2) |
| `AGENTS.md`, ADR-0010 | build gated por `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE` | não existe (B3) |
| `AGENTS.md` | Cypress stress-* como testes | não roda no CI (B4) |
| `AGENTS.md`, `state-management.md` | undo guarda "cópias completas" | referências com compartilhamento estrutural (A6) |
| `AGENTS.md` | "LLM feature is its own lazy chunk" | o chunk existe mas é pré-carregado no boot (barrel em `App.tsx:8`); a UI do chat vai no chunk do canvas (A1) |
| `overview.md` | barrels `index.ts` são entradas canônicas | 11 deles sem uso segundo o fallow (B8) |
| `eslint.config.js` | "dezesseis sítios" com disable | 20 |
| `seed-stress-diagram.ts` | `PERSIST_SCHEMA_VERSION (4)` | 16 |

---

### Frente C — Usabilidade, UI e UX

#### C1 · Primeiro uso: diagramas escondidos e abertura por duplo clique `MEDIDO` — oportunidade, impacto alto, esforço P

Reproduzir: storage vazio → `/` → `/workspace`. A raiz mostra duas pastas ("PixLedger", "Catálogo de elementos") e o tile "New diagram"; **0 cards de diagrama** visíveis. Entrar na pasta mostra 11 cards; um clique simples apenas seleciona (`DiagramCard.tsx:55 onSelect`; o anel de seleção não apareceu — `ring-2` count 0); abrir exige duplo clique, sem dica. Não há onboarding, template ou "comece por aqui". Proposta: clique simples abre (seleção por checkbox/hover), ou um estado vazio com "Abrir exemplo" e "Criar em branco"; mostrar os diagramas da raiz com as pastas. *(Na implementação da seção 9 o clique simples já abria nesta base; o que faltava era o estado visível de seleção.)*

#### C2 · Diálogo "New diagram" sem semântica de diálogo e com 4 campos `MEDIDO` + `LIDO` — defeito (a11y) + oportunidade, impacto médio, esforço P

`AddDiagramDialog.tsx:16-20` é `div` + `motion.div` sem `role="dialog"`, `aria-modal`, `aria-labelledby` nem focus trap (`[role=dialog]` retornou 0 inputs na automação). O mesmo padrão em `pages/services/index.tsx`. Nome e nível C4 são obrigatórios antes de ver o canvas. Proposta: usar o `Dialog` do shadcn já presente; criar com nome padrão e editar depois.

#### C3 · Abertura restaura viewport salvo mesmo quando ele mostra quase nada `MEDIDO` + `LIDO` — oportunidade, impacto médio, esforço P

"Catálogo de elementos" abre mostrando uma faixa de 230 px à esquerda com o resto fora da tela; `useCanvasEffects.ts:76-81` trata qualquer viewport ≠ (0,0,1) como salvo. Não há minimapa. Proposta: `fitView` quando < N % dos nós estão visíveis na abertura; minimapa opcional para > 100 nós.

#### C4 · Arrastar o canvas vazio com o botão esquerdo não faz nada `MEDIDO` + `LIDO` — oportunidade, impacto alto, esforço P (decisão de produto)

Reproduzir: pressionar no pane vazio e arrastar → seleção 0, viewport inalterado. Pan exige Space/botão do meio/direito (`panOnDrag=[1,2]`, `Canvas.tsx:80`), marquee exige Shift. É uma escolha documentada no funil de ponteiro, mas diverge de draw.io/Figma/Excalidraw (arrastar = marquee ou pan). **Parada de produto.**

#### C5 · Exclusão em massa sem confirmação nem toast com desfazer `MEDIDO` — oportunidade, impacto alto, esforço P

Reproduzir: `Cmd+A` → `Delete` em 50 nós → tudo some, 0 diálogos, 0 toasts; `Cmd+Z` restaura. Com 4 nós, idem. Proposta: toast "N elementos excluídos · Desfazer" para N ≥ 2 (sem diálogo modal), confirmação só para "todos".

#### C6 · `/model/<id inexistente>` mostra o diagrama anterior `MEDIDO` + `LIDO` — defeito, impacto médio, esforço P

Reproduzir: abrir um diagrama, depois navegar para `/model/does-not-exist` → URL fica errada e o canvas mostra o diagrama ativo anterior (50 nós). Com nada ativo mostra "No diagram selected". `pages/workspace/index.tsx:74` só abre quando `urlDiagramExists`; não trata o caso contrário. Proposta: redirecionar para `/workspace` com toast.

#### C7 · Shift-click perdido em diagramas grandes `MEDIDO` — defeito percebido, impacto alto em diagramas grandes, esforço M

Ver A4: com 300 ms entre cliques, 6/10 (400) e 1/10 (1000) ficam selecionados; a 50 nós com 450 ms, 4/4. O usuário percebe como "o shift-click não pega". Causa é o custo por clique (A4), não a lógica do funil (`pointerFunnel.ts:239-265` está correta).

#### C8 · Tema escuro: contêineres (painéis) quase invisíveis; nós permanecem claros `MEDIDO` — oportunidade, impacto médio, esforço P

Os grupos "C4"/"GCP" perdem fundo e borda no dark; os cards de nó continuam brancos sobre fundo escuro. Proposta: tokens de painel para dark; verificar contraste dos rótulos secundários (11 px cinza).

#### C9 · Telas pequenas `MEDIDO` — oportunidade, impacto depende do alvo, esforço M

A 390 px: `scrollWidth` 504–548 px (overflow horizontal), "Saving…" sobrepõe o badge de nível, o painel lateral cobre o canvas inteiro, o FAB do chat cobre os controles de zoom. Só `useCanvasInputProfile.ts` adapta algo (ponteiro grosso). O viewer/embed não foi testado em largura pequena. **Parada de produto: mobile é alvo?**

#### C10 · Alças de conexão com área de 3 px `MEDIDO` — oportunidade, impacto alto para "conectar", esforço P

Na abertura com fit (zoom ≈ 0,5) o `.react-flow__handle.source` mede 3,18 × 3,18 px. Arrastar a partir dela é quase impossível sem ampliar no hover. Proposta: área de acerto invisível (≥ 12 px) independente do zoom. Soltar sobre espaço vazio abre "Connect Node X to…" com busca — bom; soltar sobre um nó não foi verificado (o alvo saiu de posição por um `fitView`).

#### C11 · Teclado, foco e movimento reduzido `MEDIDO` + `LIDO` — oportunidade, impacto médio, esforço P–M

- Tab a partir do canvas entra primeiro nos campos do painel lateral; em 12 Tabs nenhum nó recebeu foco. Anel de foco: `outline 2px` nos inputs; botões dependem de `outline: auto`.
- Modal de atalhos existe (66 strings) em "More options"; `features.md` o declara fonte de verdade.
- `prefers-reduced-motion`: 2 blocos em `index.css:368,419`; os diálogos e cards com framer-motion (`DiagramCard.tsx:50-52`, 6 diálogos) animam sempre (nenhum `useReducedMotion`).
- Controles sem nome acessível: 5 no dashboard (chevrons de pasta `h-4 w-4` = 16 px), 14 no canvas (inputs de célula de tabela sem label); alvos < 24 px: 11–24 por tela (WCAG 2.5.8).

#### C12 · Vocabulário e idioma `MEDIDO` — oportunidade, impacto baixo–médio, esforço P

- Seeds em português (intencional) convivem com UI em inglês: "Catálogo de elementos" como pasta, "Nota de exemplo", legendas; `index.html` em português com `lang="en"`.
- Chips da multi-seleção: um `container` aparece como "1 application" ("1 system · 1 application · 1 component · 1 person" para tipos system/container/component/person).
- Dashboard: placeholder "Search component…" numa lista de diagramas; "Workspaces" (nav) vs "Workspace" (cabeçalho) vs "All diagrams".

#### C13 · Indicador de salvamento acende em seleção e ao abrir a paleta `MEDIDO` — ruído, impacto baixo, esforço P

"Saving…" aparece ao selecionar nós e ao abrir `Cmd+K` (A4/A8), sem o usuário ter editado nada.

#### C14 · Clique em aresta `MEDIDO` — não conclusivo

O clique automatizado no centro da bounding box da primeira aresta não foi recebido (timeout 3 s). Consistente com área de acerto fina; é o inverso do "clique roubado por aresta" já conhecido. Registro sem severidade.

#### C15 · Painel "Diagram" aberto por padrão, 320 px `MEDIDO` — oportunidade, impacto baixo, esforço P

Toda abertura mostra o painel do diagrama (nível, descrição, legenda) ocupando 22 % da largura. Não verifiquei se o estado colapsado é lembrado.

Pontos positivos observados (para não serem "corrigidos"): paleta `Cmd+K` com 317 elementos categorizados e dicas de teclado; quick-insert ao soltar conexão no vazio; multi-seleção escurece o resto do diagrama; indicador Saved/Saving; 0 erros de console em todos os fluxos; sem vazamento de memória.

---

## 4. Matriz de priorização

Valor: 1–5 (impacto × frequência). Esforço: P=1, M=2, G=3. Ordenado por valor ÷ esforço. "Indep." = pode ser feito sem outro item.

| ID | Achado | Evidência | Valor | Esforço | V/E | Indep. |
| --- | --- | --- | --- | --- | --- | --- |
| A7 | Arrange: lote de escritas de arestas (+ worker ELK) | MEDIDO | 5 | M | 2,5 | sim |
| A5 | Debounce do `updateViewport` | MEDIDO | 4 | P | 4,0 | sim |
| A6 | Stringify no flush, não por `set()` | MEDIDO | 4 | P–M | 2,7 | sim |
| B9 | Sanitizar SVG no render + validar share/import | LIDO | 4 | P | 4,0 | sim |
| C6 | Rota com id inexistente | MEDIDO | 3 | P | 3,0 | sim |
| C5 | Toast com desfazer na exclusão em massa | MEDIDO | 3 | P | 3,0 | sim |
| A1 | Lazy: chat, jszip, markdown, locale, seeds, barrel LLM | MEDIDO | 4 | P–M | 2,7 | sim |
| B1–B4, B11 | Atualizar docs/regras e CI de stress | LIDO | 3 | P | 3,0 | sim |
| C1 | Primeiro uso: abrir com 1 clique / estado vazio | MEDIDO | 4 | P–M | 2,7 | sim |
| C10 | Área de acerto das alças | MEDIDO | 4 | P–M | 2,7 | sim |
| A4/C7 | Seleção fora do `dataCtx`; sem layout forçado; sem persist por seleção | MEDIDO | 5 | M | 2,5 | conflita com seleção conhecida |
| C2 | Diálogos com `role`/focus trap | MEDIDO | 3 | P | 3,0 | sim |
| C3 | Fit na abertura quando viewport salvo mostra pouco | MEDIDO | 3 | P | 3,0 | sim |
| A2 | `lineHops` e seletores por aresta no frame | MEDIDO | 4 | M | 2,0 | sim |
| A3 | Multi-arraste: re-render por nó, `t()` no render | MEDIDO/HIP. | 4 | M–G | 1,6 | depende de A2/A4 |
| C8 | Tokens de painel no tema escuro | MEDIDO | 2 | P | 2,0 | sim |
| C11 | Foco/ARIA/reduced motion | MEDIDO | 3 | P–M | 2,0 | sim |
| B8 | Religar regras de hooks; `retry: 0`; quebrar arquivos > 800 linhas | LIDO | 2 | M | 1,0 | sim |
| B2 | Migrar `localStorage` direto para o port (ou relaxar a regra) | LIDO | 2 | M | 1,0 | sim |
| A6b | Migrações só quando `fromVersion` exige | LIDO | 2 | P | 2,0 | sim |
| B6 | Limites de tamanho e schema no share/import | LIDO | 3 | M | 1,5 | junto com B9 |
| C4 | Arrastar no vazio = pan ou marquee | MEDIDO | 4 | P | — | **parada de produto** |
| C9 | Responsividade | MEDIDO | 2–4 | M–G | — | **parada de produto** |
| C12/C13 | Vocabulário; "Saving…" em seleção | MEDIDO | 2 | P | 2,0 | C13 depende de A4 |
| B10 | Testes: import malformado, FileSystemAdapter, orçamento de tempo | LIDO | 3 | M | 1,5 | sim |

---

## 5. Proposta de fatiamento

Cada fatia cabe numa sessão de implementação independente. Ordem recomendada = ordem da lista.

**F1 · Arrange em lote e ELK fora da main thread (A7)** — `layout.slice.ts` ganha `applyEdgeLayouts(diagramId, layouts, { history: false })`; `applyLayoutResult.ts` passa a chamar uma vez; `layoutEngine.ts` carrega a variante worker do ELK. Aceite: Arrange a 1000 nós sintéticos termina em < 15 s com nenhuma long task > 1 s; a 400 nós < 4 s; testes de `singleCommit` estendidos para o Arrange (1 `set()` para arestas).

**F2 · Escritas de viewport e serialização do persist (A5, A6, A6b)** — debounce do `updateViewport`; `PersistStorage` que serializa no `flushPersist`; `migrate` por versão. Aceite: 30 ticks de roda a 1000 nós geram ≤ 1 stringify > 20 KB; pan p95 < 20 ms a 1000 nós; 1 stringify por commit de arraste; `persist.migrations.test.ts` continua verde.

**F3 · Segurança de conteúdo (B9, B6)** — sanitização no render de `SvgNode`/`CustomIconRenderer`; `assertDiagram` + limite de tamanho em `decodeSharePayload` e `validateWorkspaceFile`. Aceite: teste com `<svg onload>` em workspace importado e em `#share=` não executa; payload > N MB é recusado com mensagem. **Parada de produto** só para a allowlist de origens do embed.

**F4 · Bundle inicial (A1)** — lazy do chat, jszip, react-markdown, locale ativo, seeds sob demanda, `App.tsx` sem barrel do LLM. Aceite: conjunto pré-carregado < 450 kB gzip; chunk do canvas sem `@assistant-ui`; `npm run build` e testes verdes; o bug histórico de `allElements()` no chunk do LLM coberto por teste.

**F5 · Seleção barata (A4, C7, C13)** — seleção fora do `dataCtx`, remoção da leitura de `scrollHeight` no clique, sem escrita de persist em seleção. Aceite: clique a 1000 nós < 50 ms de long task; 10 shift-clicks a 300 ms selecionam 10/10 a 400 e 1000 nós; "Saving…" não acende ao selecionar. Deve ser coordenada com o trabalho conhecido de seleção com múltiplas fontes de verdade.

**F6 · Frame de arraste (A2, A3)** — cache de `lineHops`, auditoria de hooks por nó/aresta, `t()` fora do render do nó. Aceite: arraste simples a 1000 nós p95 < 33 ms (dois frames a 60 Hz) e ≤ 5 long tasks; arraste de 150 nós selecionados a 400 nós ≤ 5 long tasks.

**F7 · Defeitos e atritos de UX pequenos (C1, C2, C3, C5, C6, C8, C10, C12)** — cada um P e independente; podem ser uma sessão só. Aceite por item: rota inválida redireciona; toast com desfazer em exclusão ≥ 2; clique simples abre card (ou estado vazio com CTA); diálogos com `role="dialog"` e focus trap; alças com área ≥ 12 px; painéis visíveis no dark; chip "container" correto. **Parada de produto antes**: C4 (arrastar no vazio) e C9 (mobile).

**F8 · Documentação, regras e CI (B1–B4, B8, B10, B11)** — atualizar `canvas-hot-path.md`, `AGENTS.md` (regra de `localStorage`, gate inexistente, Cypress), `overview.md` (barrels), seed do Cypress para schema 16, job de stress no CI (ou orçamento Vitest com a massa de 400), `retry: 0` por um ciclo para medir flakiness. Aceite: docs sem as 9 divergências da tabela B11; CI falha se a seleção a 400 nós passar de X ms.

---

## 6. Premissas refutadas

- **"1.000 nós fluidos" (prompt, alvo oficial)** — não atingido em `main`: arraste simples p95 67 ms e 41 long tasks; seleção 190 ms por clique; Arrange 53 s. A 400 nós o arraste simples cumpre o orçamento.
- **"Há diagramas reais/fixtures realistas no repo" (prompt)** — o maior seed tem 51 nós; não há massa média nem alvo. Usei massas sintéticas. (A branch acrescenta uma fixture de 657 nós para o próprio harness dela.)
- **"O saneamento do hot path cobre o canvas" (prompt/docs)** — cobre o arraste de um nó; não cobre multi-arraste, seleção, pan/zoom nem Arrange, onde o store ainda é escrito por evento ou por aresta.
- **`AGENTS.md`: persistência só via `IStoragePort`** — 21 arquivos fora da camada acessam `localStorage`.
- **`AGENTS.md`: build gated por `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE`** — não existe no código.
- **`AGENTS.md`: Cypress `stress-*` como parte dos testes** — não roda no CI e semeia schema 4.
- **`AGENTS.md`: "LLM feature is its own lazy chunk"** — o chunk é pré-carregado no boot e a UI do chat está no chunk do canvas.
- **`canvas-hot-path.md`: três oportunidades "altas" pendentes** — já implementadas.
- **`state-management.md`/`AGENTS.md`: undo guarda cópias completas** — guarda referências com compartilhamento estrutural.
- **`overview.md`: barrels `index.ts` são as entradas canônicas** — 11 estão sem uso no baseline do fallow.
- **Prompt, §2: "número de re-renders por componente"** — não medi com React Profiler (build de produção sem hook de devtools); usei perfil de CPU atribuído a arquivo/linha como proxy. Registro como limitação, não como achado.
- **Minha própria afirmação na seção 8 de que a falha de `apply-ir.applicator.test.ts` era determinística** — era um flake (ids aleatórios mudam o layout; ~1/3 das execuções), ver seção 9.

---

## 7. Perguntas em aberto (só o dono do produto decide)

1. Arrastar o canvas vazio com o botão esquerdo deve panar, desenhar marquee, ou continuar neutro? (C4)
2. Telas pequenas (celular/tablet) são alvo do editor, só do viewer/embed, ou nenhum? (C9)
3. O viewer embutido deve aceitar `postMessage` de qualquer origem ou ter allowlist configurável? (B9)
4. Exclusão em massa: toast com desfazer basta, ou "excluir tudo" exige confirmação? (C5) — *implementado como toast com desfazer para ≥ 2 elementos, sem confirmação.*
5. Na abertura, um viewport salvo que mostra menos de X % dos nós deve ser respeitado ou substituído por fit? (C3) — *implementado com X = 20 %.*
6. A regra "só `infrastructure/persistence` toca `localStorage`" vale para tudo (migrar 21 arquivos) ou só para o workspace (reescrever a regra)? (B2) — *a branch reescreveu a regra para "workspace".*
7. Os seeds de demo devem continuar no bundle de todo usuário ou ser carregados sob demanda / baixáveis? (A1)
8. Com 317 KB por escrita a 1000 nós e `localStorage` como padrão (~5 MB), qual o tamanho de workspace que o produto se compromete a suportar sem pasta conectada? (A6) — *a branch move o workspace para IndexedDB.*
9. Arrange em diagramas grandes: aceitar ficar assíncrono (worker, com progresso cancelável) muda a UX de "aplica na hora"; está ok? (A7) — a branch já faz isso; a pergunta passa a ser se o estado "arrumando…" precisa de progresso/cancelamento.

---

## 8. Comparativo com `feat/arrange-rule-refs` (`84f6d014`)

Segundo worktree destacado em `84f6d014` (HEAD da branch; 23 commits à frente de `main`, 93 arquivos em `src`, +5920/−591). Mesmo build de produção (`vite build --sourcemap`, 7,1 s), mesmo harness, mesmas massas, `vite preview` na porta 4174.

### 8.1 O que a branch muda (LIDO, `git log 60d51ec2..84f6d014`)

| Commit | Mudança | Achado desta auditoria |
| --- | --- | --- |
| `4df1687f` | viewport persistido uma vez por gesto (`useSettledViewportWrite`, 200 ms; `useCanvasEventHandlers.ts:180`) | **A5 resolvido** |
| `e37a4072` | serialização do workspace no flush, não por `set()` (`PersistStorage` próprio, `persist.config.ts:630-667`) | **A6 resolvido** |
| `165abd14` | contexto de rótulos, `onNodeClick` e `handleOrder` com identidade estável: um nudge deixa de re-renderizar todos os nós/arestas | A2/A8 melhorados |
| `cffed067`, `5b9e0f51` | montar só arestas cuja rota alcança a viewport (`edges/culling/`); canvas "far" abaixo de zoom 0,45 (`canvasLod.ts`) | A2/A5 melhorados |
| `c2cd4179`, `d29441fe`, `0f00c223` | arestas do Arrange em um `set()` (`applyLayoutEdges`, `layout.slice.ts:287`); ELK em Web Worker (`elkRunner.ts:26-35`); poda de pares distantes na pontuação | **A7 resolvido** |
| `84c1b21f`, `c471302a`, `00a89f95`, `531bb09d` | adaptador IndexedDB atrás de `IStoragePort`, migração a partir do `localStorage`, nunca escrever antes de ler, saúde de storage pela quota da origem | A6 (limite de 5 MB) resolvido; muda B6 |
| `82dea671`, `18033869` | fixture determinística de 657 nós / 711 arestas, harness `npm run perf:large` (`scripts/perf-large-diagram.ts`) com baseline, três specs e2e corrigidos, doc de hot path atualizado | B1 resolvido; B4 parcialmente (harness existe, ainda fora do CI) |
| `AGENTS.md` | regra de `localStorage` passa a valer "para o workspace" | B2 passa a estar correto por definição; os 21 arquivos continuam |
| restante (`ruleRefs.ts`, `ArrangeControl.tsx`, `sourcesFirst.ts`, `FarEdge.tsx`, seeds) | referências automáticas, regras de leitura, menu do Arrange | fora do escopo de performance; não avaliei a UX dessas telas |

**Gates na branch** (MEDIDO): `typecheck` 11,7 s OK; `lint` 17,6 s, 0 erros / 7 avisos (os mesmos de `main`); `vitest run` 455 arquivos, **4461 passam, 1 falha** em 106 s — `src/features/llm/ir/apply-ir.applicator.test.ts:213` (`applied.referenceIds.length` é 0, esperado > 0). Falhou nas 3 tentativas do `retry: 2` naquela execução; a investigação da seção 9 mostrou que é um flake (~1/3 das execuções), não determinístico.

### 8.2 Medições lado a lado (MEDIDO, uma execução por base e massa)

**Boot e memória**

| Massa | 1.º nó visível (main → branch) | long tasks no boot | heap após 4–6 ciclos abrir/fechar |
| --- | --- | --- | --- |
| 50 | 837 → 791 ms | 2/124 → 1/53 ms | 15 → 15 MB |
| 400 | 778 → 812 ms | 3/390 → 3/315 ms | 45,1 → **26,0 MB** |
| 1000 | 929 → 915 ms | 5/1045 → 3/688 ms | 96,5 → 97,5 MB |

Sem vazamento em nenhuma das bases. Payload inicial: 657 → 663 kB gzip (A1 inalterado).

**Interações contínuas**

| Operação | Métrica | main 400 | branch 400 | main 1000 | branch 1000 |
| --- | --- | --- | --- | --- | --- |
| Arraste de 1 nó | p95 frame / long tasks | 17,2 ms / 2 (184 ms) | **9,0 ms / 1 (91 ms)** | 67 ms / 41 (3046 ms) | **41,6 ms / 3 (275 ms)** |
| Arraste de 1 nó | frames > 16 ms | 19 de 173 | 3 de 185 | 45 de 181 | 44 de 179 |
| Pan (30 ticks de roda) | p95 / serializações > 20 KB | 16,7 ms / 30 | **8,8 ms / 0** | 75 ms / 30 | **42,6 ms / 0** |
| Zoom (20 ticks) | p95 / serializações | 15,7 ms / 20 | 9,0 ms / 0 | 41,6 ms / 20 | 16,7 ms / 0 |
| Arraste de marquee (169 / 450 nós) | long tasks | 40 (3632 ms) | 39 (2921 ms) | 40 (8398 ms) | 40 (7313 ms) |
| Arraste de todos (`Cmd+A`) | long tasks (script de perfil) | 40 (4368 ms) | 39 (4105 ms) | não medido | 39 (9632 ms) |

**Interações discretas**

| Operação | main 400 | branch 400 | main 1000 | branch 1000 |
| --- | --- | --- | --- | --- |
| 6 cliques de seleção (long tasks) | 7 / 516 ms | **4 / 242 ms** | 7 / 1132 ms | 10 / 865 ms |
| 10 shift-clicks a 300 ms (long tasks · selecionados) | 11 / 1140 ms · 6 | 7 / 498 ms · 6 | 13 / 2971 ms · 1 | 14 / 1817 ms · 1 |
| Undo / redo de movimento | 51 / 68 ms | **0 / 0** | 201 / 205 ms | **0 / 0** (max frame 83 ms) |
| `Cmd+A` | 2 / 122 ms | 1 / 95 ms | 2 / 292 ms | 1 / 217 ms |
| Apagar 1 nó / desfazer | 85 / 77 ms | 59 / 0 ms | 291 / 164 ms | 152 / 72 ms |
| Clique no pane vazio | 63 ms | 0 | 218 ms | 170 ms |
| Escritas de persist por commit de arraste | 1 stringify + 2 setItem (localStorage) | 1 stringify no flush + 4 puts IndexedDB (576 KB a 1000) | | |

**Arrange (`Cmd+Shift+L`)**

| Massa | main: nós movem após / long tasks / maior | branch: nós movem após / long tasks / maior |
| --- | --- | --- |
| 400 | 8,98 s / 19 (8621 ms) / 5353 ms | **1,20 s / 3 (501 ms) / 195 ms** |
| 1000 | 53,5 s / 32 (53249 ms) / 34787 ms | **3,62 s / 5 (972 ms) / 340 ms** |

Perfil do Arrange a 1000 na branch: 603 ms de script na main thread (canvas 163, react-dom 82, @xyflow 81, diagram 45, zustand 29); o ELK está fora da thread principal. O número da própria branch na fixture de 657 nós (`openspec/changes/large-diagram-performance/baseline.json`, mediana de 3 execuções) é coerente com o que medi: arraste de filho p95 42 → 34 ms, pan p95 58 → 33 ms, nudge 20 → 0 long tasks.

### 8.3 Leitura

- **Resolvidos pela branch**: A5, A6, A7, o limite de 5 MB do `localStorage` (IndexedDB), B1 (doc de hot path), e o custo de undo/redo/delete cai para zero long tasks a 400 nós.
- **Melhorados, não resolvidos**: arraste simples a 1000 nós (p95 41,6 ms, ainda 44 frames > 16 ms); clique de seleção (40–145 ms); shift-clicks perdidos exatamente nas mesmas proporções (A4/C7 permanecem o gargalo de interação).
- **Iguais nas duas bases**: arraste de multi-seleção (A3), bundle inicial (A1), SVG sem sanitização (B9), validação de share/import (B6), rota inválida (C6), diálogo sem `role` (C2), 21 arquivos com `localStorage` (B2), Cypress fora do CI e seed de stress em schema 4 (B4), gate inexistente (B3).
- **Novo a verificar na branch**: o IndexedDB muda o custo e a semântica de boot (migração a partir do `localStorage`, "nunca escrever antes de ler"); o harness contou 4 `put` por commit a 1000 nós (576 KB): confirmar se são duas cópias (workspace + rescue) por desenho.
- **Fatiamento revisado para quem parte da branch**: F1 e F2 estão feitas; sobram **F5 (seleção)**, **F6 (frame de arraste, agora centrado em multi-seleção)**, **F3 (segurança)**, **F4 (bundle)**, **F7 (UX)** e **F8 (docs/CI)**.

### 8.4 Limitações específicas deste comparativo

- O script de perfil abriu o diagrama com fit automático na branch e, abaixo de zoom 0,45, o canvas entra em modo "far"; as fases "arraste de 1 nó" e "5 cliques" desse script ficaram quase sem script (35–40 ms), o que indica que os gestos não acertaram os nós nesse modo. Os números de arraste e clique da branch vêm do harness principal (zoom 1), que acertou. Não investiguei se o modo "far" muda a área de acerto dos nós — fica como pergunta.
- Uma execução por base; as diferenças pequenas (boot, clique no pane) estão dentro do ruído; as grandes (Arrange, pan, undo, long tasks de arraste) não.

---

## 9. Implementação a partir da branch (`feat/audit-fixes`)

Base: `84f6d014` (`feat/arrange-rule-refs`). Seis fatias, cada uma numa branch `audit/*` feita por um agente, integradas por merge em `feat/audit-fixes` (`7d03366c` + um commit de correção do gate de dead code, `d18d3437`). Nada foi enviado ao remoto; nenhum commit tem trailer de atribuição. As branches `audit/*` ficam para revisão individual.

### 9.1 Gates na integração (MEDIDO, 2026-11-11)

| Gate | Resultado |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run lint` | 0 erros, 7 avisos (os mesmos pré-existentes de `react-refresh`) |
| `npm run format:check` | OK |
| `npm run fallow:check` | OK (após `d18d3437`) |
| `npx vitest run` | **462 arquivos, 4497 testes, todos passam** (base: 455 / 4461 com 1 flake) |
| `vite build` | OK; conjunto inicial **107 arquivos, 1715 kB bruto, 479 kB gzip** (base 663 kB) |

### 9.2 O que cada fatia entregou

| Fatia (branch) | Commits | Entregue | Não entregue / decisão |
| --- | --- | --- | --- |
| Segurança (`audit/security-svg-share`) | `8d970b94`, `bd41054c` | SVG sanitizado no render (`SvgNode`, `CustomIconRenderer`, cache por string) e em todo ingresso (import de workspace/pasta, share link, `postMessage` do viewer); sanitizador corrigido para `<foreignObject>`, `javascript:` ofuscado e `<set>/<animate href>`; share decode com validação de forma e cap de 5 MB; import de workspace com cap de 25 MB e toast i18n; testes para cada caso | origem do `postMessage` do embed segue aberta (pergunta 3); colaboração e plugins só cobertos no render |
| Teste flake (`audit/fix-apply-ir-refs-test`) | `9d8569c2` | fixture de `apply-ir.applicator.test.ts` passou a conter uma linha longa que a regra de referências obrigatoriamente transforma em referência; prova de não-tautologia feita desligando a regra | causa real: o layout depende dos ids aleatórios (`sortById` em `layoutEngine.ts`) — qualquer teste de referências sobre fixture gerada pode flakear; tornar o layout independente dos ids é decisão de produto |
| Bundle (`audit/bundle-lazy`) | `0dc27489`, `0b9b1294`, `32a0e51b`, `d0251750`, `d56a0d5f`, `da7c6eb3` | chat em `React.lazy` (0 fontes `@assistant-ui` no chunk do canvas); store do LLM por `import()`; jszip dinâmico; `NoteMarkdown` lazy; locales por demanda (ativo + fallback `pt-BR` no boot, o outro no idle); barrel morto removido. **663 → 477 kB gzip** | seeds continuam síncronos (meta de 450 kB não atingida por ~27 kB); risco: busca cross-locale no catálogo antes do segundo idioma chegar; locale sem `modulepreload` (1 round-trip a mais) |
| UX (`audit/ux-fixes`) | `ae8ee272`, `32e7bb19`, `62b5b650`, `945d3096`, `9e636ccc`, `48827d6f`, `2af1dc00`, `97554d22`, `c535cf29` | C6 rota inválida → `/workspace` + toast; C5 toast "N elementos excluídos · Desfazer" para ≥ 2; C1 Shift-click seleciona card e seleção visível (o clique simples já abria nesta base); C2 `AddDiagramDialog` e `BulkDeleteConfirmDialog` no `Dialog` do shadcn; C10 área de acerto das alças 28 px de flow (≈14 px na tela a zoom 0,5); C3 `fitView` quando < 20 % dos nós visíveis na abertura; C8 painéis com fundo/borda no dark; C12 chip "container(s)" | C4 (arrastar no vazio) e C9 (mobile) não tocados — paradas de produto |
| Docs/CI (`audit/docs-ci`) | `456fbe36`, `44d0c298`, `e98c5ba6`, `e0438641`, `f42c8057`, `b25aa42c`, `0151e3b1`, `13c784a2` | gate inexistente removido de `AGENTS.md`/ADR-0010; seed Cypress em schema 16 (specs `stress-*` rodaram: 23 passam, 1 pending); **job `perf-large` no CI** (harness Playwright da fixture de 657 nós com orçamentos em `budgets.json` e `scripts/perf-budget-check.mjs`); `overview.md` sincero sobre barrels; undo documentado como compartilhamento estrutural; comentário do ESLint; hot-path "Already in place" com arquivos; `Loading…` via i18n; `index.html` em inglês | `retry: 0` **não** commitado: com ele, `element.registry.test.ts` falha nas duas execuções (bug real de isolamento — registry compartilhado), e `CollabClient.test.ts` (timeout) e `f9-lookup.baseline.test.ts` (tempo) falham sob carga; os orçamentos do job `perf-large` foram calibrados num laptop — as primeiras execuções no GitHub são o teste real |
| Performance (`audit/perf-selection-multidrag`) | `ff3362a5`, `1e8fec69`, `e3ef94b9`, `96d11af4`, `a9b5bdf1` | `clearClipboard` vazio não escreve o store (era a "escrita de persist por seleção" — vinha do Escape, não do clique); renderizadores de nó ignoram `positionAbsoluteX/Y` (memo deixava de valer a cada frame); aresta redesenha só o path quando chegam os line hops (`HoppedEdgePath`); arestas leem ações via `getState()` em vez de assinar (`useDiagramActions`) — guard test; Shift/Cmd-click alterna o nó exatamente uma vez (funil ouvia `pointerdown` e `mousedown`; React Flow reaplicava a seleção) | metas não atingidas: clique a 1000 nós ainda 60–130 ms (o `dataCtx` custava ~2 ms — a hipótese A4 estava errada; o que resta é `getBoundingClientRect` do d3-drag, autosize do `CommitField`, re-render do `Canvas` e o flip de `data.controlsDisabled` em todos os cards no primeiro select/deselect — mover para CSS muda semântica `disabled`/a11y, decisão de produto); multi-arraste ainda ~40 long tasks (p95 92 → 50 ms a 400); 10/10 shift-clicks no harness depende de rótulos de aresta desenhados sobre nós (clicar num rótulo seleciona a aresta e limpa os nós — decisão: rótulos sob os nós ou não limpar em Shift) |

### 9.3 Antes/depois no harness (MEDIDO, uma execução; "antes" = branch `84f6d014`, "depois" = `feat/audit-fixes`)

| Operação | 400 antes → depois | 1000 antes → depois |
| --- | --- | --- |
| Boot, 1.º nó visível / long tasks | 812 ms, 3/315 → 904 ms, 3/359 | 915 ms, 3/688 → 1050 ms, 3/825 |
| JS transferido na rota do canvas | 1049 KB → **913 KB** | idem |
| Heap após ciclos abrir/fechar | 26,0 → 31,0 MB | 97,5 → **61,4 MB** |
| Arraste de 1 nó: p95 / long tasks | 9,0 ms, 1/91 → 16,7 ms, 1/114 | 41,6 ms, 3/275 → 50 ms, 9/632 |
| Arraste de marquee: long tasks / p95 | 169 nós: 39/2921, 75 ms → **38/2038, 50 ms** | 450 nós: 40/7313, 184 ms → 128 nós: 41/3461, 92 ms (seleções diferentes; agente mediu 450 nós: 40/5808, 150 ms) |
| Arraste de todos (`Cmd+A`, perfil) | 39/4105 → 39/3046 (agente) | 39/9632 → 39/7974 |
| 6 cliques de seleção | 4/242 → 4/262 | 10/865 → **5/379** |
| 10 shift-clicks a 300 ms, selecionados | 6 → 6 (rótulos de aresta) | 1 → **10** |
| Pan ×30: p95 / long tasks | 8,8 ms, 0 → 9,2 ms, 0 | 42,6 ms, 3/158 → **50,4 ms, 22/1225** (ver 9.4) |
| `Cmd+A` | 1/95 → 2/108 | 1/217 → 4/541 |
| Apagar 1 nó / desfazer (perfil) | 59 / 0 → — | 152 / 72 → 2/236 / — |
| Arrange 1000 (perfil): nós movem após / long tasks | — | 3,62 s, 5/972 → 4,74 s, 6/1480 |
| Escritas de persist por clique de seleção | 2 → **0** | 2 → **0** |

### 9.4 Riscos e o que verificar antes de abrir PR

- **Pan a 1000 nós piorou numa execução** (3 → 22 long tasks). Uma execução, logo após a suíte de testes; pode ser carga. Se se confirmar, os suspeitos são o `HoppedEdgePath` (uma assinatura a mais por aresta visível) e o memo `positionBlindNode`. Repetir 3× antes de decidir.
- **Boot ~100 ms mais lento** nas duas massas: os locales e o store do LLM agora são `import()` (um round-trip a mais); compensado pelo payload menor (913 vs 1049 KB), mas vale medir em rede lenta.
- **`element.registry.test.ts` falha com `retry: 0`**: bug de isolamento de teste, não de produto; corrigir antes de baixar o retry.
- **Job `perf-large` no CI** roda em `push` e `pull_request` com orçamentos de laptop; se flakear no runner, afrouxar os tetos em `budgets.json` ou restringir a `pull_request`.
- **i18n lazy**: `element.registry.ts` deixou de validar chaves contra os JSONs estáticos; a paridade é coberta por `locales.parity.test.ts`. Busca cross-locale no catálogo depende do segundo idioma já ter chegado.
- **Decisões de produto pendentes** (seção 7 + 9.2): rótulos de aresta sobre nós vs. Shift-click; `controlsDisabled` em CSS; layout independente de ids; `postMessage` do embed; arrastar no vazio; mobile.

### 9.5 Segunda passagem A3/A4 (branch `audit/perf-a3-a4`, base `7d03366c`)

Quatro commits sobre `feat/audit-fixes`; build de produção, Chromium headless (rAF a 120 Hz). "Antes" = `7d03366c` servido à parte; harness `perf.mjs` rodado **2× antes e 2× depois** em 400 e 1000 nós; arraste de todos via `profile.mjs`; medições focadas com scripts próprios (cliques um a um, arraste de marquee com 40 movimentos, pan com trace).

| Commit | O que muda |
| --- | --- |
| `8e836b2c` | Âncoras de reconexão do React Flow (2 círculos invisíveis por aresta, movidos a cada frame) saem durante o arraste de nós: `edgesReconnectable` vai a `false` no store do React Flow no início do arraste e volta no fim. Reconectar funciona como antes quando os nós são soltos. |
| `219c6184` | `useTranslation` sai do corpo de `FullEditableEdge` e fica só nas alças de edição (aparecem com a aresta selecionada ou em hover). |
| `7457f8d2` | `controlsDisabled` derivado da seleção deixa de viajar no `data` de cada card: um store por instância do React Flow (`selection/selectionControls.ts`), sincronizado num layout effect, é lido pelos próprios controles (alças, badges, drill-down, embed). Semântica igual (desligados enquanto há seleção e o card não está nela, exceto em fluxo gravado/tocado; superfícies de leitura continuam com `controlsDisabled: true` no `data`). |
| `f50b5f45` | Destaque de alças (`HandleHighlightContext`) e rótulos revelados (`EdgeLabelRevealContext`) chegam a nós e arestas como **pertinência** (`contexts/idSetStore.ts`): cada elemento assina só a própria presença no conjunto. Antes, clicar numa aresta re-renderizava todos os nós (consumidores do contexto) e cada mudança de seleção todas as arestas. |

#### Antes/depois (MEDIDO)

| Fase | 400 antes → depois | 1000 antes → depois |
| --- | --- | --- |
| Arraste de marquee: long tasks / p95 | 169 nós: 37/1939, 23/1237 · 50 ms → **3/151, 3/157 · 42,5 ms** | 450 nós: 40/5859 · 150 ms (2.ª exec.; a 1.ª pegou 128 nós) → 41/5279, 41/5310 · 133 ms |
| Arraste de marquee, script focado (40 movimentos) | 28/1490 → **1–2/~80** | 450 nós: 5874, 6009, 5934 ms → 5174–5280 ms |
| Arraste de todos (`Cmd+A`, perfil) | 39/2848 → 39/2445 | 39/8620 → 40/6929 |
| Arraste de 1 nó | 1/97, 1/89 → 1/79, 1/79 | 8/550, 11/824 → **2/218, 2/213** |
| 6 cliques de seleção (harness) | 4/262, 4/240 → **0/0, 0/0** | 6/410, 8/786 → 7/521, 7/593 (dominado por composição, ver abaixo) |
| 6 cliques, script focado, sem o blur dos painéis | 150 ms → 59 ms | 742 → 537 ms; renders de card num clique que cai numa aresta 1600 → ≤ 4 |
| 10 shift-clicks | 3/197, 3/193 → 1/54, 1/57 | 10/697 (10 selecionados), 45/3197 (1) → 48/2892 (1), 47/2835 (1) |
| Pan ×30 | 0/0 → 0/0 | 22/1226, 19/1186 → 18/1131, 20/1242 (inalterado) |
| `Cmd+A` | 1/108, 2/111 → 1/52, 1/104 | 4/601, 2/222 → 1/222, 2/258 |

O número de nós selecionados por 10 shift-clicks a 1000 varia entre execuções **também na base** (10 numa, 1 na outra) — os cliques no centro do card caem em rótulos de aresta revelados (seção 9.2); com pontos livres de rótulo os dois builds dão 5/10 e 6/10 (MEDIDO).

#### Achados

- **Pan a 1000 nós: a regressão é real e não é JavaScript** `MEDIDO`. Trace do pan ×30: `Layerize` 1,7–2,9 s contra ~190 ms de script. Os suspeitos de 9.4 (`HoppedEdgePath`, `positionBlindNode`) estão **refutados**. Causa: `backdrop-blur-sm` nos painéis (`PanelNode`, 40 painéis a 1000 nós, 16 a 400). Desligar só esse `backdrop-filter` por CSS injetado: pan 24/1772 → **0/0**; 6 cliques 24/1834 → 8/847; arraste de marquee a 1000 −14 % (5280 → 4550 ms); a 400, 1–2 → 0 long tasks. Pixel a pixel a diferença é pequena (diferença máxima de 37 na soma dos canais, na vista ajustada) mas é uma mudança visual: **decisão de produto** (abaixo). Não foi alterado.
- **Variantes que mantêm o blur** `MEDIDO`: `will-change: transform` em `.react-flow__nodes` (pan 0/0) cria contexto de empilhamento e põe os painéis (z −1) acima das arestas; em `.react-flow__edges` (pan 0/0) prende o z-index elevado das arestas de nós aninhados selecionados abaixo dos cards e sobe as camadas compostas de 57 para 470; por SVG de aresta, 1271 camadas. Nenhuma é neutra; ficam como alternativas.
- **A3, pista 1 (i18n nos renderizadores de nó)** `MEDIDO`: refutada nesta base — com `positionBlindNode` um card renderiza **1 vez em 40 frames** de arraste. O i18n por frame estava nas arestas (`FullEditableEdge`, `EdgeLabel`); tirá-lo das arestas: 5 → 1–2 long tasks a 400. Memoizar o corpo do `EdgeLabel` não mediu ganho e não foi commitado.
- **A3, pista 2 (identidade do `data`)** `MEDIDO`: confirmada estável no arraste (contagem de renders por instrumentação temporária). O custo restante por frame é proporcional às arestas que se movem: ~240 arestas a 400 renderizam 1×/frame e o `HoppedEdgePath` 2×/frame; a 1000 (450 nós) ~600 arestas + 450 `NodeWrapper` do React Flow por frame, mais estilo (~3100 elementos/frame), pintura e `Layerize`.
- **A3, pista 4 (Zustand)** `MEDIDO`: ~5 % do script no arraste; não é o gargalo. Escrever posições só no fim do gesto já é o caso (`publishDragFrame`).
- **A4.1/A4.2 (`getBoundingClientRect` do d3-drag, autosize do `CommitField`, offsetHeight do `useExpandMaxHeight`)** `MEDIDO`: desligá-los em experimento não mudou os long tasks dos 6 cliques além do ruído — só antecipam o layout que o frame faria. Não alterados.
- **A4.3 (`Canvas` re-renderiza na seleção)** `MEDIDO`: 1–3 renders por clique, ~5 ms cada a 1000 nós; a seleção é estado do próprio `Canvas`. Estreitar exige separar o estado visual do `Canvas` — fora do escopo.
- **Line hops** `MEDIDO`: sem hops, o arraste a 400 chega a p95 33 ms e a 1000 cai ~20 %; o custo é o cálculo e os paths com arcos, não o segundo render (ler os hops sem assinar não mediu ganho). Congelar ou espaçar os hops durante o arraste muda o que se vê: decisão de produto.
- **MiniMap** `MEDIDO`: sem ele, a 1000 nós o arraste cai ~5 %; atualizar o minimapa menos durante o arraste também é visual.

#### Metas

| Meta | Resultado |
| --- | --- |
| A3: ≤ 10 long tasks por gesto a 400 | **atingida** (3/151) |
| A3: p95 ≤ 33 ms a 400 | não atingida (42,5 ms; um frame de 120 Hz acima). Só com hops desligados mediu 33 ms |
| A3: a 1000, metade do total de long tasks | não atingida (−10 % no marquee, −20 % no arraste de todos). Mesmo somando sem hops + sem minimapa + sem blur, mediu 3246 ms contra 5940 da base |
| A4: clique a 1000 ≤ 30 ms, 0 long tasks em 6 cliques | não atingida; o maior custo por frame a 1000 é o `Layerize` do blur dos painéis (~47 ms por frame em que algo pinta). A 400: 0 long tasks |

#### Decisões de produto abertas por esta passagem

1. **Blur dos painéis** (`backdrop-blur-sm` em `PanelNode`): tirar; ou tirar só no nível de detalhe distante (`data-lod="far"`, onde o harness roda a 1000 nós); ou aceitar uma das variantes de composição acima com sua mudança de empilhamento.
2. **Line hops durante o arraste**: manter ao vivo (hoje), congelar até soltar, ou recalcular em intervalo.
3. **MiniMap durante o arraste**: ao vivo (hoje) ou atualizado ao soltar.

#### Gates (MEDIDO)

`typecheck` OK · `lint` 0 erros, 7 avisos (os mesmos `react-refresh` da base) · `format:check` OK · `fallow:check` OK · `vitest run` 466 arquivos, **4513 testes, todos passam**.

#### Riscos

- `edgesReconnectable` é escrito direto no store do React Flow (a `<ReactFlow>` nunca recebe a prop; se um dia receber, o `StoreUpdater` passa a disputar o valor). Arrastar a caixa de seleção (`onSelectionDragStart`) não desliga as âncoras — só fica sem o ganho.
- `selectionControls` e `idSetStore` notificam no layout effect: controles e destaques mudam num render síncrono logo após o da seleção, antes da pintura. Os outros tipos de nó (grupo de API, endpoint) ainda recebem `controlsDisabled` pelo `data`.
- O seletor Cypress `.react-flow__edge-interaction` não foi tocado (a tentativa de unificar os dois paths de acerto deu ~2 % e foi descartada).

### 9.6 D5 e D7: blur dos painéis e minimapa

Branch `audit/perf-d5-d7` sobre `004634d5`; build de produção, Chromium headless (rAF a 120 Hz). Harness `perf.mjs` 2× em 400 e 1000 nós antes e depois de cada mudança; arraste de todos via `profile.mjs` e por script focado sem profiler; nível de detalhe completo medido com script focado (zoom 0,71–0,73 na região dos painéis, 9–12 painéis na tela, 2 repetições, trace `devtools.timeline`).

| Commit | O que muda |
| --- | --- |
| `bc1f5d24` | O elemento que borra o fundo em `PanelNode` e `ApiGroupNode` ganha `data-canvas-blur`; `index.css` zera o `backdrop-filter` sob `.react-flow[data-lod="far"]`. O fundo translúcido continua. Guarda: `nodes/canvasBlur.guard.test.ts` (todo nó com `backdrop-blur` tem a marca; a regra existe). |
| `a116ff9e` | `ViewportGestureSync` (dentro do `<ReactFlow>`) escreve `data-viewport-moving` no wrapper a partir do início/fim de viewport do React Flow e limpa 200 ms após o último movimento; a mesma regra zera o blur sob essa marca. Em repouso, no zoom completo, o blur é o de antes. |
| `6c611d03` | `DragThrottledMiniMap`: o `<MiniMap>` do React Flow dentro de um `ReactFlowProvider` próprio cujo store espelha o do canvas (recebe o objeto de estado tal qual). Em repouso cada mudança passa na hora; durante um arraste de nós o espelho é atualizado no máximo a cada 200 ms e uma vez no soltar. Teste: `miniMapDragThrottle.test.ts`. |

#### Zoom em que o harness roda `MEDIDO`

`fitView` deixa 400 nós em zoom 0,133 e 1000 em 0,108: **todas as fases do harness rodam no nível distante** (`data-lod="far"`). Por isso o primeiro commit sozinho já leva o pan a 1000 a zero; o zoom completo foi medido à parte.

#### Antes/depois, harness (MEDIDO)

Long tasks n/ms (p95 de frame quando relevante), duas execuções; "depois" = `6c611d03`.

| Fase | 400 antes → depois | 1000 antes → depois |
| --- | --- | --- |
| Pan ×30 | 0/0, 0/0 → 0/0, 0/0 | 20/1233, 23/1332 (p95 58,5) → **0/0, 0/0** (p95 16,7) |
| Zoom ctrl+roda ×20 | 0/0 → 0/0 | 0/0, 10/2036 → 0/0, 0/0 |
| 6 cliques | 0/0, 0/0 → 2/101, 0/0 (ruído: base em script focado 2/143, 0/0, 0/0) | 7/526, 6/391 → 7/568, 7/535 (p95 92/75 → 67/25) |
| Arraste de marquee | 3/154, 16/870 → 4/215, 0/0 | 41/5322, 41/3416 → 40/4822, 40/4377 — **ruído**: em execuções alternadas do mesmo harness, `bc1f5d24` deu 2312, 2490, 4531 e 5278 ms e `a116ff9e` 4681, 4806, 4860 e 4634 ms; não há ganho nem perda mensurável |
| Arraste de 1 nó | 1/86, 1/92 → 1/88, 1/80 | 5/370, 6/444 (p95 42) → **2/191, 2/187** (p95 17) |
| Arraste de todos, `profile.mjs` (39–40 long tasks) | 2935 → 2501 ms | 6550, 6954, 7089 → 6764 ms (com profiler; `bc1f5d24` deu 7563–7709, sem explicação além do ruído do profiler) |
| Arraste de todos, script focado sem profiler | — | antes do D7 4931, 4899 ms → **4653, 4550 ms**; com o minimapa desligado 4680, 4476, 4479 ms |

#### Zoom completo, 1000 nós (MEDIDO)

| Fase | Base | Sem blur (CSS injetado) | `a116ff9e` |
| --- | --- | --- | --- |
| Pan ×30 | 6/414, 6/416 · p95 34/50 · Layerize ~555 ms | 0/0, 0/0 · p95 16,6 | **0/0, 0/0** · p95 25 · Layerize ~225 ms |
| Arraste de 1 nó | 2/196, 2/216 | 2/160, 2/197 | 2/153, 2/150 |
| Arraste de 12 nós (cmd-clique) | 8/488, 8/457 | 6/372, 10/618 | — |
| 6 cliques | 7/610, 6/499 | 6/445, 6/513 | 5/332, 2/164 |

- **Decisão D5** `MEDIDO`: no nível distante o blur sai sempre (é onde o harness e a vista ajustada de diagramas grandes ficam; o custo era 1,2–1,3 s por pan de 30 ticks). No zoom completo o blur ainda dominava o pan (6 long tasks → 0), mas não o arraste (1 nó: ~205 → ~180 ms, 2 long tasks nos dois; 12 nós: sem diferença) nem os cliques. Por isso sai só enquanto a viewport se move, e o arraste de nós mantém o blur — trocar o filtro no início e no fim de cada arraste custaria um re-layerize a mais por gesto, por um ganho dentro do ruído. Em repouso no zoom completo o visual é o mesmo; tirar o blur também em repouso não foi feito porque as medições não mostram custo em repouso.
- **Por que 200 ms de espera** `MEDIDO`: o pan pela roda move a viewport programaticamente, com um início e um fim por tick. Limpando a marca na hora, ela alternou 60 vezes em 30 ticks e o pan ficou **pior** que a base (10/724, 9/607). Com a espera: 2 alternâncias por gesto.
- **D7** `MEDIDO`: o minimapa assina o store do React Flow diretamente (bounds de todos os nós + um seletor por nó a cada notificação, `LIDO` em `@xyflow/react` 12.11.2), por isso o espelho em vez de um wrapper. Escritas de atributo no SVG do minimapa durante um arraste de todos a 400: 31 686 → 11 226 (−65 %). Arraste de todos a 1000: −6 %, igual a desligar o minimapa. Pan, zoom e clique no minimapa continuam funcionando em repouso (verificado por eventos sintéticos; no layout do harness o minimapa fica sob o painel lateral direito, também na base).
- **Bug pré-existente** `MEDIDO`: arrastar uma seleção de marquee de 450 nós na vista ajustada a 1000 nós dispara o React #185 (profundidade máxima de atualização) após uma tarefa de ~3,3 s e derruba o canvas. Reproduz na base `004634d5`, sem estes commits. Não investigado aqui.
- **Variantes descartadas**: compositing hints para manter o blur (ver 9.5) não foram retomadas.

#### Gates (MEDIDO)

`typecheck` OK · `lint` 0 erros, 7 avisos (os mesmos da base) · `format:check` OK · `fallow:check` OK · `vitest run --retry 0`: 469 arquivos, 4523 testes, 2 falhas não relacionadas — `element.registry.test.ts` ("note" já registrado) falha igual na base `004634d5` com retry 0; `CollabClient.test.ts` (timeout) passa isolado.

#### Riscos

- `HIPÓTESE`: um gesto de viewport muito longo e lento (trackpad com pausas > 200 ms) pode alternar o blur no meio do gesto; cada alternância custa um re-layerize.
- `LIDO`: o espelho do minimapa compartilha o objeto de estado do store do canvas (incluindo `panZoom` e o `nodeLookup` mutável); se uma versão futura do `MiniMap` escrever no store pelo `useStoreApi()`, escreverá no espelho, não no canvas.
- `LIDO`: o arraste da caixa de seleção (`onSelectionDragStart`) não é sinalizado ao minimapa; nesse gesto ele segue ao vivo, como antes.
- O pan pela roda, programático, também dispara início/fim no auto-pan do arraste e no `fitView`: a marca aparece nesses casos por ≤ 200 ms após o fim.

### 9.7 R7 e R8

Branch `audit/fix-r7-r8` sobre `4f9a9f8a`; build de produção e servidor de desenvolvimento (pilha do React), Chromium headless. Commits: `af3eeac0` (R7), `951af05c` (R8).

#### R7 · React #185 ao "arrastar" uma seleção de marquee grande

- **Reprodução** `MEDIDO`: o gesto do D5/D7 aperta o centro de um **painel selecionado** (`panel_f1000_6`). O interior do painel deixa o ponteiro passar para o pane, então o "arraste" é na verdade um **novo marquee** começando dentro do painel. Com o painel e outros nós já selecionados, o canvas trava numa tarefa de 1,3–3,8 s e o React lança #185. Não depende do tamanho: disparou com **9 nós selecionados a 1000** e **27 a 400** (com 5 a 400 não disparou); só o painel selecionado, ou nenhuma seleção, não dispara. Arrastar um nó folha de uma seleção de 476 (1000) ou 272 (400) nunca disparou.
- **O ciclo** `MEDIDO` (gravação de commits pelo hook de DevTools + pilhas dos `set` do `useCanvasSelectionStore`): o seletor do marquee (`commitUserSelectionRect`) marca o painel como selecionado **no nó interno** do React Flow enquanto as mudanças que ele emite limpam o store (`onSelectionFromChanges` → `{}`). Daí em diante o `SelectionListener` do React Flow relata, num `useEffect`, a seleção que leu no render; no mesmo commit o `StoreUpdater` (efeito anterior, irmão) já entregou ao React Flow a projeção nova do store. Cada relato é portanto o valor que o store acabou de substituir: `onSelectionChange` grava `{painel}`, a projeção leva `{painel}`, o próximo relato traz `{}`, e assim por diante — 50+ commits seguidos de ~100 ms (Canvas + 1000 `NodeWrapper`) até o React desistir; o estouro aparece no detach de um ref (Switch do `DiagramPanel`), que é só o 50.º. O guarda `prevSelectionRef` não segura porque os relatos alternam.
- **Correção** `MEDIDO`: `onSelectionChange` descarta um relato que o `nodeLookup` atual do React Flow já não sustenta (`selection/staleSelectionReport.ts`); o React Flow relata de novo com a seleção atual e os dois assentam. Sem contador nem guarda de profundidade. Teste `useCanvasEventHandlers.staleSelectionReport.test.tsx`: `<ReactFlow>` real + o `onSelectionChange` real + o store; **sem a correção o teste falha com o próprio #185**, com ela passa.
- **Efeito colateral corrigido** `MEDIDO`: o mesmo relato atrasado cortava os últimos passos de todo marquee — a seleção final voltava ao penúltimo passo. Mesmo retângulo: 1000 nós 476 → **540** selecionados, focado 472 → **518**; 400 nós 272 → **288**, focado 385 → **394**; harness a 400 (zoom 0,133) 91 → **169**.

| Fase (viewport semeada a zoom 0,108) | Antes | Depois |
| --- | --- | --- |
| Marquee + aperto no painel, 1000 | #185, canvas desmonta (1 tarefa de 3,4–3,8 s) | 0/0 long tasks, p95 16,7 |
| Marquee + aperto no painel, 400 | #185 (tarefa de 1,7 s) | 2/~160 ms, p95 16,8 |
| Arraste de folha, 1000 | 476 sel.: 41/5565, 41/5186 ms | 540 sel.: 40/5364, 41/5606 ms |
| Arraste de folha, 400 | 272 sel.: 39/2177, 40/2308 ms | 288 sel.: 39/2176, 40/2438 ms |

Sem regressão por nó arrastado; a diferença é a seleção, agora completa. No harness a 400 o arraste de marquee subiu de 0/0 para 1/50 ms porque passou a mover 169 nós em vez de 91 (`MEDIDO`).

#### R8 · Dois `fitView` disputando a abertura

- **Causa** `MEDIDO` + `LIDO`: eram três peças. (1) `Canvas` passava `fitView` ao `<ReactFlow>` (min zoom do React Flow, 0,1) e `useCanvasEffects` ajustava de novo dois frames depois (padding 0,3, zoom 0,3–1,5). (2) O ajuste do React Flow podia persistir a viewport (`onMoveEnd`) antes da leitura do efeito, que então "restaurava" 0,133. (3) `buildReactFlowShellProps` devolvia um `fitViewOptions` novo a cada render; o `StoreUpdater` grava a prop no mesmo campo do store onde `fitView(options)` aguarda a medição dos nós, e sobrescrevia o min/max zoom do ajuste pendente. Só tirar a prop (1) ainda deu 9× 0,133 e 1× 0,30 a 400.
- **Correção**: o `useCanvasEffects` é o único dono do ajuste inicial e o pede já no efeito (o React Flow aplica ao medir os nós, antes de pintar); `fitViewOptions` passa a ser o mesmo objeto congelado em todo render. Testes: `useCanvasEffects.initialFit.test.tsx` (um ajuste com as opções do produto; viewport salva restaura; `Canvas.tsx` sem `fitView`) e identidade em `reactFlowBaseConfig.test.ts`.

| 10 aberturas, mesmo diagrama, sem viewport salva | Antes | Depois |
| --- | --- | --- |
| 400 nós | 0,133 ×9, 0,30 ×1 | **0,30 ×10** |
| 1000 nós | 0,30 ×10, mas passando por 0,108 em todas (dois ajustes visíveis) | **0,30 ×10**, primeiro frame já em 0,30 |

- `MEDIDO`: viewport salva continua restaurada (0,108 e 0,5); o viewer compartilhado (`/viewer#data=`, política de leitura, `fitView` próprio) dá a mesma viewport antes e depois (0,30 em 40 e 400 nós). A versão intermediária, com o ajuste ainda em duplo rAF, mostrava 3 frames (~108 ms) no zoom 1 antes do ajuste; descartada.

#### Gates (MEDIDO)

`typecheck` OK · `lint` 0 erros, 7 avisos (os mesmos da base) · `format:check` OK · `fallow:check` OK · `vitest run --retry 0`: 474 arquivos, **4545 testes, todos passam**.

#### Riscos

- `MEDIDO`: o harness agora abre 400 nós em zoom 0,30 (antes quase sempre 0,133, nível distante): as fases de 400 deixam de ser comparáveis com 9.5/9.6 (menos nós na tela; parte das fases sai do nível distante). A 1000 já era 0,30.
- `LIDO`: descartar relatos atrasados depende de o `SelectionListener` relatar de novo quando a seleção interna muda (ele assina o `nodeLookup` com igualdade por ids). Um relato descartado sem relato seguinte deixaria o store para trás; não observado.
- `HIPÓTESE`: o aperto no interior de um painel selecionado iniciar um marquee (em vez de arrastar a seleção) é comportamento do painel, não deste bug; não alterado.
- `LIDO`: com `?serviceId=` o efeito não ajusta e o React Flow também não ajusta mais; o foco do serviço enquadra os elementos. Se o serviço não existir, o parâmetro é limpo e o efeito ajusta.

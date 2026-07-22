# Melhorias para o Structura

> Documento de oportunidades de melhoria identificadas durante a auditoria
> staff+ do repositório. Cada item inclui o problema, a evidência, os
> arquivos envolvidos, o benefício esperado, a complexidade e a prioridade.

---

# Resumo

A auditoria revelou que o Structura é um projeto sólido no núcleo, com
arquitetura em *features* bem definida, testes disciplinados nos subsistemas
críticos e um fluxo de OpenSpec maduro. O débito técnico está concentrado em
três áreas:

1. **Drift documental.** `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
   `FEATURES_MAP.md` e vários arquivos em `docs/architecture/` ainda usam
   nomes pré-rename (`journeys`, `serviceRegistry`, `ModelExplorer`).
2. **Especificações incompletas.** As mudanças
   `openspec/changes/quickactions-toolbar` e `openspec/changes/expand-plugin-system-ui`
   foram arquivadas com tarefas de teste/QA em aberto.
3. **Persistência vazada.** `AGENTS.md` obriga passar pelo `IStoragePort`,
   mas seis arquivos acessam `localStorage` diretamente.

As melhorias abaixo priorizam correções cosméticas de baixo esforço,
seguidas de consolidação arquitetural, depois otimizações de performance e
finalmente evolução de longo prazo.

---

# Melhorias de Arquitetura

## A1. Consolidar dois sistemas de migração paralelos

- **Problema:** existem dois sistemas de migração concorrentes:
  `src/infrastructure/persistence/migrations.ts` (workspace JSON) e
  `src/features/diagram/store/persist.config.ts` (localStorage). Eles usam
  convenções de versão diferentes e o `persist.config.ts` já está na v11
  enquanto `migrations.ts` define apenas V0→V1.
- **Evidência:** `migrations.ts:14–48`, `persist.config.ts:36–475`.
- **Arquivos envolvidos:** `src/infrastructure/persistence/migrations.ts`,
  `src/infrastructure/persistence/validateWorkspaceFile.ts`,
  `src/features/diagram/store/persist.config.ts`.
- **Benefício esperado:** fonte única de verdade para migrações; menos risco
  de dessincronia entre estado persistido e workspace file.
- **Sugestão de implementação:** mover todas as funções `migrate*` para um
  único módulo `src/infrastructure/persistence/migrations/` e fazer
  `validateWorkspaceFile.ts` e `persist.config.ts` consumirem o mesmo pipeline.
- **Complexidade:** Alta
- **Prioridade:** Média

## A2. Roteamento de preferências/efêmero via `IStoragePort`

- **Problema:** `AGENTS.md:79` proíbe acesso direto a `localStorage` fora de
  `infrastructure/persistence/`, mas seis arquivos violam essa regra.
- **Evidência:** `useLastEdgeStyle.ts:16,24`, `recent-diagrams.ts:11,24`,
  `collab-preferences.ts:15,25`, `llm-storage.ts:276,303,304,330,392,430,447,462`,
  `llm-threads-idb.ts:153,180,195`, `storage-monitor.ts:22,23`.
- **Arquivos envolvidos:** os listados acima + `IStoragePort.ts`.
- **Benefício esperado:** respeitar o contrato arquitetural documentado;
  unificar tratamento de quota; habilitar storage alternativo para plugins.
- **Sugestão de implementação:** estender `IStoragePort` com namespaces
  `preferences` (chave-valor síncrono) e `ephemeral` (sessionStorage),
  fornecer adapters, e migrar os seis arquivos.
- **Complexidade:** Média
- **Prioridade:** Alta

## A3. Eliminar ciclo `FileSystemAdapter ↔ validateWorkspaceFile`

- **Problema:** `madge` reportou ciclo de dependência envolvendo
  `FileSystemAdapter.ts` e `validateWorkspaceFile.ts`. O segundo importa
  `migrateDiagram` de `migrations.ts`, que arrasta todo o grafo de tipos de
  diagrama.
- **Evidência:** `src/infrastructure/persistence/validateWorkspaceFile.ts:8`,
  `src/infrastructure/persistence/migrations.ts:1`.
- **Arquivos envolvidos:** os dois acima + `migrations.ts`.
- **Benefício esperado:** bundle inicial menor; grafo de imports mais
  previsível.
- **Sugestão de implementação:** extrair `migrateDiagram` para um arquivo
  que não importa `Diagram` (opera sobre `unknown` e usa guards); ou
  consolidá-lo com A1.
- **Complexidade:** Média
- **Prioridade:** Média

## A4. Publicar RFCs do sistema de plugins

- **Problema:** `plugin-loader.ts:46` usa `new Function(code)` para executar
  plugins. O comentário cita "RFC D6" e "RFC D1", mas essas RFCs não estão
  no repositório.
- **Evidência:** `src/features/plugins/plugin-loader.ts:30–67`.
- **Arquivos envolvidos:** `plugin-loader.ts`, `docs/adr/`.
- **Benefício esperado:** decisões arquiteturais registradas e
  pesquisáveis; usuários de plugin entendem o nível de sandbox.
- **Sugestão de implementação:** escrever RFCs D1 (contrato de plugin) e D6
  (sandbox) em `docs/adr/` ou `docs/plugins/`, linkando-as a partir do
  `plugin.types.ts`.
- **Complexidade:** Baixa
- **Prioridade:** Média

## A5. Quebrar `useCollab.ts` em hooks menores

- **Problema:** `useCollab.ts` tem 656 linhas, mistura sessão, patches,
  cursors e preferências em uma única função.
- **Evidência:** `src/features/collaboration/hooks/useCollab.ts:1–656`.
- **Benefivo esperado:** melhor perfíl React DevTools; re-renders menores;
  testabilidade.
- **Sugestão de implementação:** dividir em `useCollabSession`,
  `useCollabPatches`, `useCollabCursors`, `useCollabPreferences`.
- **Complexidade:** Média
- **Prioridade:** Baixa

## A6. Remover `ENABLE_LEGACY_PANEL_ACTIONS` após ciclo de release

- **Problema:** flag `ENABLE_LEGACY_PANEL_ACTIONS = false` esconde
  controles legados em `ComponentPanel.tsx` e `ConnectionPanel.tsx`. A
  proposta OpenSpec (§Open Decisions 4) prevê remoção após adoção.
- **Evidência:** `src/features/canvas/selection-actions/featureFlags.ts`,
  `ComponentPanel.tsx:56`, `ConnectionPanel.tsx:20`.
- **Benefício esperado:** código morto eliminado; menos branches.
- **Sugestão de implementação:** após duas versões minor, deletar flag +
  código gated.
- **Complexidade:** Baixa
- **Prioridade:** Baixa

---

# Melhorias de Organização

## O1. Remover `teste.json` e blindar `.gitignore`

- **Problema:** arquivo `teste.json` (4,3 KB) na raiz contém um diagrama
  de debug ("Novo Person", "Amazon EC2", fluxo "teste") sem utilidade.
- **Evidência:** `teste.json` na raiz, nenhum import ou referência.
- **Benefício esperado:** repositório limpo; evita recorrência.
- **Sugestão de implementação:** `git rm teste.json` e adicionar
  `teste*.json` ao `.gitignore`.
- **Complexidade:** Baixa
- **Prioridade:** 🔴 Alta impacto / baixo esforço

## O2. Remover ou realocar `collab-stateless/`

- **Problema:** diretório `collab-stateless/` contém CDK da AWS sem
  `package.json` próprio e sem nenhuma referência no restante do repo.
  Inclui `node_modules/` versionado.
- **Evidência:** `find collab-stateless -maxdepth 2` retorna apenas
  `src/cdk/`, `src/collab/`, `node_modules/`.
- **Benefício esperado:** repo mais enxuto; sem `node_modules/` órfão.
- **Sugestão de implementação:** confirmar com time de infra; mover para
  repositório separado ou apagar.
- **Complexidade:** Baixa
- **Prioridade:** 🔴 Alta impacto / baixo esforço

## O3. Apagar barrels profundos

- **Problema:** `src/features/diagram/index.ts` tem 324 linhas. É
  importado por 167 arquivos. Isso prejudica tree-shaking.
- **Evidência:** `wc -l src/features/diagram/index.ts`,
  `grep -rn '@/features/diagram' src --include="*.tsx" | wc -l = 167`.
- **Benefício esperado:** bundles menores, code-splitting mais eficaz.
- **Sugestão de implementação:** adicionar regra ESLint que avise quando
  barrel é importado fora do feature, com exceções para allow-list.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## O4. Padronizar nomes de pastas para novo idioma

- **Problema:** nomes de pastas ainda usam o vocabulário antigo
  (`features/journeys/` aparece em alguns comentários e docs). Há rota
  alias `/journeys` em `App.tsx:79–83`.
- **Evidência:** `App.tsx:79–83`, `ROADMAP.md`, `AGENTS.md`,
  `README.md`.
- **Benefício esperado:** clareza para novos contribuidores.
- **Sugestão de implementação:** na próxima minor, remover redirects
  `/journeys` e atualizar referências textuais.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## O5. Apagar entradas mortas de OpenSpec

- **Problema:** tarefas em `expand-plugin-system-ui/tasks.md:51–55` e
  `quickactions-toolbar/tasks.md:93–100` continuam abertas mesmo após
  arquivo das mudanças.
- **Evidência:** os dois arquivos de `tasks.md`.
- **Benefício esperado:** histórico de OpenSpec reflete a realidade.
- **Sugestão de implementação:** ou completar tarefas faltantes ou
  formalizar decisão de drop via PR.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

---

# Melhorias de Código

## C1. Remover exports não utilizados

- **Problema:** `getSuggestionForMessage` (`store.ts:806`) e
  `summarizePatchActions` (`store.ts:817`) são exportados mas nunca
  importados.
- **Evidência:** `grep -rn` retorna apenas os sítios de declaração.
- **Benefício esperado:** API pública menor; menos superfície para
  manter.
- **Sugestão de implementação:** deletar as duas funções.
- **Complexidade:** Baixa
- **Prioridade:** 🔴 Alta impacto / baixo esforço

## C2. Implementar `case "AUTO_LAYOUT"` em `apply-diagram-patch.ts`

- **Problema:** a operação `AUTO_LAYOUT` do LLM patch é um no-op com
  `console.warn` e TODO.
- **Evidência:** `src/features/llm/apply-diagram-patch.ts:99–102`.
- **Benefício esperado:** feature anunciada passa a funcionar.
- **Sugestão de implementação:** rotear para `autoLayoutEngine.ts` —
  `computeLayeredLayout` ou `computeGridLayout` — e emitir patch de
  `nodeLayouts`.
- **Complexidade:** Baixa
- **Prioridade:** 🟡 Alto impacto / médio esforço

## C3. Implementar `CollabProvider.updateViewport`

- **Problema:** callback está vazio com TODO. Viewport sync é um
  destaque do collab em `FEATURES_MAP.md`.
- **Evidência:** `src/features/collaboration/components/CollabProvider.tsx:224–226`.
- **Benefício esperado:** sincronização pan/zoom funcional.
- **Sugestão de implementação:** enviar via Yjs awareness doc.
- **Complexidade:** Baixa
- **Prioridade:** 🟡 Alto impacto / médio esforço

## C4. Extrair `colorUtils.ts` compartilhado

- **Problema:** lógica de cor (`getCurrentColor`, `getNotePresetPair`,
  `usesCustomColor`, `supportsColor`, `pickColorGroup`) vive em
  `NodeQuickActionsBar.tsx` e é duplicada em `PanelColorPicker.tsx`,
  `ColorAccentSection.tsx`, `NoteNode.tsx`, `PanelNode.tsx`.
- **Evidência:** `grep -rn panelColor src --include="*.tsx"` lista
  oito arquivos relevantes.
- **Benefício esperado:** fonte única; correções de bug em um único
  lugar.
- **Sugestão de implementação:** criar
  `src/features/canvas/panels/ElementPanel/components/colorUtils.ts`.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## C5. Generalizar resolvedor de ícones de cloud

- **Problema:** `aws.icon-resolver.ts`, `azure.icon-resolver.ts`,
  `gcp.icon-resolver.ts` repetem o mesmo padrão (dynamic import →
  normalização → `resolve(id)`).
- **Evidência:** os três arquivos em `src/features/cloud/providers/`.
- **Benefício esperado:** adicionar novo provedor (Oracle, Alibaba)
  sem repetir boilerplate.
- **Sugestão de implementação:** `createIconResolver({ module,
  catalog })` em `features/cloud/iconResolver.ts`.
- **Complexidade:** Média
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## C6. Substituir 36 `catch {}` vazios por logging explícito

- **Problema:** 36 blocos `catch {}` engolem erros silenciosamente.
- **Evidência:** ver inventário completo na seção *Dead Code §4* do
  relatório principal.
- **Benefício esperado:** diagnóstico melhor; alinhamento com
  `useSaveStatusStore` que já existe para erros de persistência.
- **Sugestão de implementação:** helper `safeReadJson<T>(key, fallback)`
  para leituras esperadas; `console.warn` para o resto.
- **Complexidade:** Baixa
- **Prioridade:** 🟡 Alto impacto / médio esforço

## C7. Apagar comentários de código morto

- **Problema:** `helpers.ts:36–41` e `migrations.ts:27–30` têm blocos
  comentados.
- **Evidência:** os arquivos.
- **Benefício esperado:** leitura mais limpa.
- **Sugestão de implementação:** `git rm` das linhas.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## C8. Remover alias deprecado `useRegistryActions`

- **Problema:** `useRegistryActions = useCatalogActions` em
  `diagram.store.ts:361` é alias deprecated.
- **Evidência:** único caller é
  `src/features/integrations/github/hooks/useGithubImport.ts:7,18`.
- **Benefício esperado:** nome consistente; menos aliases.
- **Sugestão de implementação:** migrar caller e remover alias.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

---

# Melhorias de Performance

## P1. Lazy-load de dependências pesadas

- **Problema:** `elkjs` (~150 KB), `cmdk`, `react-markdown`+plugins
  (`react-markdown`, `rehype-highlight`, `remark-gfm`), `framer-motion`
  e resolvers de ícones de cloud são bundle do app principal.
- **Evidência:** imports em
  `src/features/canvas/layout/autoLayoutEngine.ts`,
  `src/components/ui/command.tsx`,
  `src/features/llm/components/MarkdownContent.tsx`,
  `src/features/cloud/providers/*/icon-resolver.ts`.
- **Benefício esperado:** TTI menor; bundle inicial menor.
- **Sugestão de implementação:** `React.lazy` + `Suspense` ou
  `import()` dinâmico para cada um.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## P2. Lazy-load das fixtures (seeds)

- **Problema:** quatro arquivos em `fixtures/seeds/` têm ~2.000 linhas
  cada. Mesmo desabilitados via flag, são parseados pelo bundler.
- **Evidência:** `banking-example.ts` (1.992 linhas),
  `plataforma-digital-example.ts` (2.021),
  `urlshort-example.ts` (1.984), `fintech-example.ts` (1.779).
- **Benefício esperado:** redução drástica do bundle de produção.
- **Sugestão de implementação:** converter para `JSON` e carregar
  apenas quando `VITE_DISABLE_SEEDS=false`.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## P3. Migrar `migrateIconLibraryToGlobalStore` para batch async

- **Problema:** `persist.config.ts:431` faz `useIconStore.getState().addIcon`
  síncrono por ícone dentro de um `try {} catch {}`. Em workspace com
  muitos ícones, isso bloqueia o main thread.
- **Evidência:** `src/features/diagram/store/persist.config.ts:409–432`.
- **Benefício esperado:** startup mais rápido em workspaces grandes.
- **Sugestão de implementação:** enfileirar com `queueMicrotask` ou
  `requestIdleCallback`; ou tornar assíncrono e retornar migração
  parcial.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## P4. Memoizar `useFlowState`

- **Problema:** `useFlowState` recomputa highlights a partir de
  `nodes + flows` a cada keystroke no chat LLM.
- **Evidência:** `src/features/canvas/flow/useFlowState.ts`.
- **Benefício esperado:** render mais fluido em diagramas grandes.
- **Sugestão de implementação:** adicionar `useMemo` com dependências
  precisas; considerar `useSyncExternalStore`.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## P5. Particionar `persist.config.ts`

- **Problema:** 616 linhas carregadas no boot. Cada mutação da store
  passa por aqui.
- **Evidência:** `src/features/diagram/store/persist.config.ts:1–616`.
- **Benefício esperado:** startup mais rápido; código mais legível.
- **Sugestão de implementação:** dividir migrate functions em arquivos
  por versão (`migrations/v6.ts`, `v7.ts`, ...).
- **Complexidade:** Média
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

---

# Melhorias de Developer Experience

## D1. Padronizar geração de changelog via commitlint

- **Problema:** Conventional Commits é citado em `AGENTS.md` e
  `CONTRIBUTING.md`, mas não há tooling que valide ou agrupe commits.
- **Evidência:** ausência de `commitlint.config.js` ou similar; ausência
  de `release-please` no CI.
- **Benefício esperado:** changelog automático; releases previsíveis.
- **Sugestão de implementação:** adicionar `commitlint`,
  `@commitlint/config-conventional`, `husky` para pre-commit, e
  `release-please` no workflow de release.
- **Complexidade:** Baixa
- **Prioridade:** 🟡 Alto impacto / médio esforço

## D2. Subir cobertura de testes para 80%

- **Problema:** `ROADMAP.md:75` lista "Increase unit test coverage to
  80%+" como pendente. A área de colaboração tem só um teste
  (`collab.utils.test.ts`); `useCollab.ts` tem 656 linhas sem teste
  direto.
- **Evidência:** contagem de arquivos `*.test.ts` na colaboração = 1;
  `useCollab.ts` = 656 linhas.
- **Benefício esperado:** confiança em refactor; menos regressões.
- **Sugestão de implementação:** adicionar testes para os hooks de
  colaboração e para `useFlowState`. Configurar `vitest --coverage`
  com threshold no CI.
- **Complexidade:** Alta
- **Prioridade:** 🟡 Alto impacto / médio esforço

## D3. Adicionar Storybook

- **Problema:** `ROADMAP.md:77` lista Storybook como pendente. Não há
  catálogo visual de componentes; `components/ui/*.tsx` (21 arquivos)
  só são testáveis via integração.
- **Evidência:** ausência de `.storybook/` no repo.
- **Benefício esperado:** documentação visual viva; revisão de design
  mais rápida.
- **Sugestão de implementação:** `npx storybook@latest init` e
  adicionar stories para cada componente `ui/`.
- **Complexidade:** Média
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## D4. Adicionar tarefa `cy:run` no CI

- **Problema:** `cy:run` é executável localmente, mas o workflow
  `.github/workflows/ci.yml` só roda lint/typecheck/test/build.
- **Evidência:** `.github/workflows/ci.yml:1–92`.
- **Benefício esperado:** regressões detectadas em PR.
- **Sugestão de implementação:** adicionar job `e2e` no CI usando
  `cypress/github-action`.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## D5. Falar mais alto sobre erros de quota no dashboard

- **Problema:** `SaveStatusIndicator.tsx` já existe, mas
  `useSaveStatusStore` é atualizado dentro de `try/catch` que engole
  erros. O usuário pode perder trabalho sem aviso.
- **Evidência:** `src/features/diagram/store/persist.config.ts:492–548`.
- **Benefício esperado:** perda de trabalho evitada.
- **Sugestão de implementação:** adicionar `sonner` toast em caso de
  `QuotaExceededError` com link para `Settings`.
- **Complexidade:** Baixa
- **Prioridade:** 🔴 Alta impacto / baixo esforço

---

# Melhorias de Segurança

## S1. Substituir `localStorage` cru por `IStoragePort`

- **Problema:** vazamento direto de `localStorage` viola a regra
  arquitetural. Falhas de quota são engolidas sem aviso.
- **Evidência:** ver A2.
- **Benefício esperado:** melhor observabilidade de falhas; contratos
  honrados.
- **Complexidade:** Média
- **Prioridade:** 🔴 Alta impacto / baixo esforço

## S2. Documentar o nível de sandbox do plugin system

- **Problema:** `new Function(code)` é poderoso; usuários de plugin
  não são avisados explicitamente.
- **Evidência:** `plugin-loader.ts:46`.
- **Benefício esperado:** expectativas corretas dos autores de
  plugins.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## S3. Sanitizar `localStorage` antes de desserializar

- **Problema:** `JSON.parse` é chamado em vários sites com
  tratamento de erro mínimo. Um valor corrupto pode travar o boot.
- **Evidência:** `recent-diagrams.ts:11`, `collab-preferences.ts:15`,
  `useLastEdgeStyle.ts:16`.
- **Benefício esperado:** resiliência contra corrupção.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

---

# Melhorias de Testes

## T1. Cobrir hooks de colaboração

- **Problema:** `useCollab.ts` (656 linhas) tem zero teste direto.
- **Evidência:** apenas `collab.utils.test.ts` na feature.
- **Benefício esperado:** confiança ao refatorar.
- **Complexidade:** Alta
- **Prioridade:** 🟡 Alto impacto / médio esforço

## T2. Cobrir `walkthroughs.store.ts`

- **Problema:** store grande (`walkthroughs.store.ts` + `useWalkthroughRecordingFinalize.ts`)
  com cobertura fina.
- **Evidência:** apenas dois testes em `__tests__/`.
- **Benefício esperado:** confiança ao evoluir o modelo de walkthrough.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## T3. Adicionar teste E2E para drag-to-parent

- **Problema:** `useNodeDragParenting.ts` é marcado como "deliberate
  and fragile" em `AGENTS.md:97` mas o teste E2E correspondente não
  existe.
- **Evidência:** ausência de arquivo `drag-to-parent.cy.ts`.
- **Benefício esperado:** cobertura de regressão para um dos fluxos
  mais arriscados.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

## T4. Adicionar teste para o pipeline de undo/redo cross-slice

- **Problema:** `ROADMAP.md:42` lista "Phase 3: Incomplete undo/redo
  across scenes, flows, services, folders, and edge layouts". Não há
  teste automatizado verificando cobertura.
- **Evidência:** apenas `history.slice.test.ts`.
- **Benefício esperado:**验收 objetivo da fase 3.
- **Complexidade:** Alta
- **Prioridade:** 🟡 Alto impacto / médio esforço

---

# Melhorias de Documentação

## DOC1. Sweep de nomes deprecados

- **Problema:** README, AGENTS, CONTRIBUTING, FEATURES_MAP, vision.md,
  overview.md, core-concepts.md ainda usam `Journeys`, `ServiceRegistry`,
  `ModelExplorer`, `processos`, `registryServiceId`.
- **Evidência:** ver tabela completa no relatório principal
  *Documentation Issues*.
- **Benefício esperado:** novos contribuidores encontram a feature
  correta.
- **Complexidade:** Baixa
- **Prioridade:** 🔴 Alta impacto / baixo esforço

## DOC2. Atualizar `ROADMAP.md` "Completed" para refletir OpenSpec

- **Problema:** "Plugin system foundation" é marcado como concluído
  mas foi apenas RFC.
- **Evidência:** `ROADMAP.md:25` vs `archive/2026-07-03-add-plugin-system-foundation/`.
- **Benefício esperado:** honestidade no roadmap.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## DOC3. Corrigir typo em `FEATURES_MAP.md:215`

- **Problema:** caractere chinês (笨拙) numa seção em português.
- **Evidência:** `FEATURES_MAP.md:215`.
- **Benefício esperado:** apresentação profissional.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## DOC4. Publicar ADRs do plugin system

- **Problema:** decisões D1 (contrato) e D6 (sandbox) referenciadas no
  código mas ausentes.
- **Evidência:** `plugin-loader.ts:24`.
- **Benefício esperado:** decisões rastreáveis.
- **Complexidade:** Baixa
- **Prioridade:** 🔵 Baixo impacto / baixo esforço

## DOC5. Completar QA das mudanças ativas

- **Problema:** §13 do `quickactions-toolbar/tasks.md` está 100%
  pendente; §9 do `expand-plugin-system-ui/tasks.md` também.
- **Evidência:** os dois arquivos de `tasks.md`.
- **Benefício esperado:** qualidade de release.
- **Complexidade:** Média
- **Prioridade:** 🟡 Alto impacto / médio esforço

---

# Roadmap Sugerido

Priorização usando os ícones:

- 🔴 Alto impacto / baixo esforço (fazer primeiro)
- 🟡 Alto impacto / médio esforço (planejar e executar)
- 🔵 Baixo impacto / baixo esforço (backlog rápido)
- ⚫ Longo prazo (evolução)

## Sprint 1 — Higienização 🔴

| # | Item | Complexidade | Prioridade |
|---|------|--------------|------------|
| 1 | O1 — Deletar `teste.json` e atualizar `.gitignore` | Baixa | 🔴 |
| 2 | C1 — Remover `getSuggestionForMessage` e `summarizePatchActions` | Baixa | 🔴 |
| 3 | DOC1 — Sweep de nomes deprecados (README, AGENTS, CONTRIBUTING, FEATURES_MAP, vision, overview, core-concepts) | Baixa | 🔴 |
| 4 | S1 — Iniciar migração para `IStoragePort` (substituir primeiros dois arquivos) | Média | 🔴 |
| 5 | D5 — Toast em `QuotaExceededError` | Baixa | 🔴 |
| 6 | C7 — Apagar blocos de código comentado | Baixa | 🔵 |
| 7 | O2 — Remover `collab-stateless/` | Baixa | 🔴 |

## Sprint 2 — Funcionalidades em aberto 🟡

| # | Item | Complexidade | Prioridade |
|---|------|--------------|------------|
| 8 | C2 — Wire `AUTO_LAYOUT` patch | Baixa | 🟡 |
| 9 | C3 — Implementar `CollabProvider.updateViewport` | Baixa | 🟡 |
| 10 | C6 — Substituir `catch {}` vazios | Baixa | 🟡 |
| 11 | C4 — Extrair `colorUtils.ts` compartilhado | Média | 🟡 |
| 12 | C8 — Migrar `useRegistryActions` → `useCatalogActions` | Baixa | 🔵 |
| 13 | DOC5 — Completar QA checklists de OpenSpec | Média | 🟡 |

## Sprint 3 — Consolidação arquitetural 🟡

| # | Item | Complexidade | Prioridade |
|---|------|--------------|------------|
| 14 | A2 — Concluir migração `IStoragePort` (restantes 4 arquivos) | Média | 🟡 |
| 15 | A1 — Consolidar migrações em um módulo | Alta | 🟡 |
| 16 | A3 — Quebrar ciclo `FileSystemAdapter ↔ validateWorkspaceFile` | Média | 🟡 |
| 17 | C5 — Generalizar resolvedor de ícones | Média | 🔵 |
| 18 | O3 — Regra ESLint contra barrel imports | Média | 🟡 |
| 19 | A6 — Remover `ENABLE_LEGACY_PANEL_ACTIONS` | Baixa | 🔵 |

## Backlog — Performance e polish 🔵

| # | Item | Complexidade | Prioridade |
|---|------|--------------|------------|
| 20 | P1 — Lazy-load `elkjs`, `cmdk`, `react-markdown` | Média | 🟡 |
| 21 | P2 — Lazy-load das fixtures (seeds) | Média | 🟡 |
| 22 | P3 — Migrar `migrateIconLibraryToGlobalStore` para batch async | Média | 🟡 |
| 23 | P5 — Particionar `persist.config.ts` | Média | 🔵 |
| 24 | P4 — Memoizar `useFlowState` | Baixa | 🔵 |
| 25 | D2 — Subir cobertura para 80% | Alta | 🟡 |
| 26 | T1 — Cobrir hooks de colaboração | Alta | 🟡 |
| 27 | T2 — Cobrir `walkthroughs.store.ts` | Média | 🟡 |
| 28 | T3 — E2E para drag-to-parent | Média | 🟡 |
| 29 | O4 — Remover redirects `/journeys` | Baixa | 🔵 |
| 30 | O5 — Formalizar drop de tarefas OpenSpec pendentes | Baixa | 🔵 |

## Longo prazo ⚫

| # | Item | Complexidade | Prioridade |
|---|------|--------------|------------|
| 31 | T4 — Cobertura E2E de undo/redo cross-slice (Phase 3 do roadmap) | Alta | ⚫ |
| 32 | D1 — Adotar commitlint + release-please | Baixa | ⚫ |
| 33 | D3 — Storybook para `components/ui/` | Média | ⚫ |
| 34 | D4 — Job `e2e` no CI | Média | ⚫ |
| 35 | Upgrade React 18 → 19 | Alta | ⚫ |
| 36 | Upgrade Tailwind 3 → 4 | Média | ⚫ |
| 37 | Upgrade date-fns 3 → 4 | Média | ⚫ |
| 38 | Avaliar migração para `Web Worker` no plugin loader | Alta | ⚫ |

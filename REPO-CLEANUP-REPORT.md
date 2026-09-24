# Relatório — padronização do repositório (chore/oss-repo-standardization)

Branch `chore/oss-repo-standardization`, criada a partir de `main` em `dc6fd0b`. **Zero commits**:
tudo está no working tree, nada foi staged. Nenhuma ação foi executada fora do repo (nada no
GitHub, nenhuma issue/branch tocada).

> Este arquivo é só para você. Ele não é referenciado por nenhum outro arquivo; apague antes de
> commitar se não quiser mantê-lo.

---

## 1. Baseline × resultado

### Como medi

O `node_modules` do seu checkout está **poluído**: tem uma árvore `node_modules/.pnpm/` (767
pacotes, de algum `pnpm install` antigo) misturada com a instalação do npm. Isso quebra o
typecheck localmente (duas cópias de `@assistant-ui/core` / `assistant-stream` →
`TS2345` em `AssistantUIChatPanel.tsx:83`) e muda resultados de teste. Além disso, o lint e o
Prettier do seu checkout varrem `.claude/worktrees/feat+walkthrough-v1/` (uma worktree git
aninhada, excluída só via `.git/info/exclude`).

Por isso a baseline **e** o resultado foram medidos numa cópia limpa (`git archive main` +
`npm ci`, Node 25.4.0), onde o working tree desta branch foi espelhado antes de cada rodada.
Os números do seu checkout poluído estão na última coluna só como referência.

| Comando                      | Baseline limpa (`main`)            | Resultado (esta branch)           | Seu checkout atual (poluído)      |
| ---------------------------- | ---------------------------------- | --------------------------------- | --------------------------------- |
| `npm run typecheck`          | ✅ 0 erros                         | ✅ 0 erros                        | ❌ 1 erro (pnpm duplicado)        |
| `npm test`                   | ❌ 2990 ✓ / **7 ✗** (304 arquivos) | ❌ 2990 ✓ / **7 ✗** (as mesmas 7) | 7 ✗ (mesmas)                      |
| `npm run lint`               | 33 warnings, 0 erros               | **5 warnings, 0 erros**           | 67 problemas (1 erro na worktree) |
| `npm run format:check`       | ✅ 0 arquivos                      | ✅ 0 arquivos                     | ❌ 1 arquivo (na worktree)        |
| `npm run build`              | ✅                                 | ✅                                | ❌ (para no typecheck)            |
| `npm run plugins:sync-check` | ✅                                 | ✅                                | ✅                                |

**Sua referência estava desatualizada:** hoje são ~3.000 testes (não ~758), lint 33 (não ~228) e
format 0 (não ~95). Como format já era 0, "melhorar" aqui só pode significar "continuar 0".

**As 7 falhas de teste são pré-existentes e não foram tocadas** (layout está fora de escopo):
`src/features/canvas/layout/generated-diagrams.baseline.test.ts` (6 casos, `renderedCrossings`
10 → 11 etc.) e `layoutReadability.baseline.test.ts` (1 caso). O CI de `main` está vermelho no job
_Unit tests_ desde pelo menos 2026-09-18 (#232 até #245, confirmado pela API do GitHub), e por isso
o job _Build_ nem roda. O critério "testes todos verdes" não era atingível sem mexer em baselines de
layout; ficou igual à baseline.

## 2. Arquivos criados, alterados e removidos

### Frente 1 — padrões de comunidade

| Arquivo                                      | Ação           | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LICENSE`                                    | mantido        | MIT, © 2025 João Luis Clark; referenciado no README e no `package.json`.                                                                                                                                                                                                                                                                                                                                                                                       |
| `CONTRIBUTING.md`                            | reescrito      | Node 20+ (era 18+), `npm ci`, scripts reais, regras atuais do AGENTS.md; removidas regras obsoletas (imports de `src/lib/model-types`, que não existe; "ordem de renderização" não verificável); convenção de branch/commit com escopos atuais; OpenSpec/ADR para propor mudanças.                                                                                                                                                                             |
| `CODE_OF_CONDUCT.md`                         | ajustado       | Denúncias só por e-mail (antes sugeria issue pública `[conduct]`).                                                                                                                                                                                                                                                                                                                                                                                             |
| `SECURITY.md`                                | mantido        | Já adequado (GitHub Security Advisories).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.github/ISSUE_TEMPLATE/config.yml`          | reescrito      | Linkava para Discussions, que estão **desabilitadas** no repo (link quebrado). Agora: advisory de segurança, docs e o app.                                                                                                                                                                                                                                                                                                                                     |
| `.github/ISSUE_TEMPLATE/bug_report.yml`      | ajustado       | Áreas atualizadas (versions, viewer, plugins, colaboração, catálogos…); exemplo de versão.                                                                                                                                                                                                                                                                                                                                                                     |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | ajustado       | Áreas atualizadas; link do ROADMAP era relativo e quebrava na UI de issues.                                                                                                                                                                                                                                                                                                                                                                                    |
| `.github/PULL_REQUEST_TEMPLATE.md`           | reescrito      | Checklist alinhado às hard rules atuais (removidas regras de arquivos inexistentes).                                                                                                                                                                                                                                                                                                                                                                           |
| `.github/CODEOWNERS`                         | criado         | `* @clarkjoao`.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `.editorconfig`                              | criado         | Espelha Prettier (LF, 2 espaços, 100 colunas); tab para Go (`server/go`).                                                                                                                                                                                                                                                                                                                                                                                      |
| `CHANGELOG.md`                               | reestruturado  | Keep a Changelog: separei o que é de `0.2.0` (conteúdo exato do CHANGELOG na tag `v0.2.0`) do que veio depois (_Unreleased_, via `git diff v0.2.0 main`); destaques do Unreleased a partir dos títulos de PR; tabela das tags antigas `v1`…`v2.1`; links de compare. Corrigi a entrada quebrada "`useServiceActions` alias removed. Use `useServiceActions`" (um find/replace em #237 tinha trocado os dois nomes; o alias removido era `useRegistryActions`). |
| `package.json`                               | ajustado       | `description`, `author` com nome, `repository` no formato `git+…​.git`, `homepage` → https://structur.dev/, `keywords`, script `media:capture`.                                                                                                                                                                                                                                                                                                                |
| `.gitignore`                                 | ajustado       | `.claude/worktrees/` (hoje só está no `.git/info/exclude` da sua máquina).                                                                                                                                                                                                                                                                                                                                                                                     |
| `.prettierignore` / `eslint.config.js`       | ajustados      | Ignorar `.claude/worktrees` — sem isso, lint/format locais divergem do CI.                                                                                                                                                                                                                                                                                                                                                                                     |
| `dependabot.yml`                             | **não criado** | Você removeu de propósito em `c4b2f3a` ("Remove dependabot configuration file to streamline dependency management").                                                                                                                                                                                                                                                                                                                                           |

### Frente 2 — README e mídia

| Arquivo                                                                          | Ação      | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                                      | reescrito | Tagline, badges (CI, licença, release, site), hero, o que é/para quem, features conferidas no código, quick start, scripts, plugins, docs, roadmap, contribuição, licença. Removidos: seção de embed que apontava para `app.structura.dev/embed` (rota inexistente — é `/viewer`) e um componente `StructuraEmbed` removido em #106/#107; "WebRTC + Yjs" (é relay WebSocket); "Walkthroughs" como feature ativa; árvore de pastas desatualizada; "TypeScript 5" (é 6). |
| `docs/features.md`                                                               | criado    | Tradução + verificação do antigo `FEATURES_MAP.md` (ver Frente 3).                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/guides/embedding.md`                                                       | criado    | Guia de embed correto: `/viewer#data=`, protocolo `STRUCTURA_READY` → `STRUCTURA_LOAD` → `STRUCTURA_LOADED`, `#flow=`.                                                                                                                                                                                                                                                                                                                                                 |
| `docs/README.md`                                                                 | ajustado  | Mapa inclui features, guides, decisions, protocolo de colab, assets; seção sobre os logs históricos em português.                                                                                                                                                                                                                                                                                                                                                      |
| `plugins/README.md`                                                              | ajustado  | Link para `extension-points.md` estava quebrado (`../../docs` → `../docs`); plugin LeanIX na árvore.                                                                                                                                                                                                                                                                                                                                                                   |
| `ROADMAP.md`                                                                     | ajustado  | Itens concluídos que faltavam (catálogos, versions, viewer/embed, bulk export, live sessions); "Yjs/WebRTC" corrigido; data.                                                                                                                                                                                                                                                                                                                                           |
| `scripts/capture-media.mjs`                                                      | criado    | Regenera tudo em `docs/assets/` (Playwright + ffmpeg). `npm run dev` e depois `npm run media:capture`; `PLAYWRIGHT_CHANNEL=chrome` usa o Chrome instalado.                                                                                                                                                                                                                                                                                                             |
| `docs/assets/screenshots/{workspace,canvas-c4,canvas-aws,plugins,dark-mode}.png` | criados   | 2× (2880×1800), gerados pelo script.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/assets/demo.gif` (3,1 MB) / `demo.webm` (0,24 MB)                          | criados   | Fluxo de ~19 s: criar diagrama → 3 elementos → 2 conexões → Export.                                                                                                                                                                                                                                                                                                                                                                                                    |

### Frente 3 — docs e resíduos

| Arquivo                                                                                                             | Ação                          | Motivo                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openspec/changes/{canvas-findability,canvas-scroll-pan-drawio,fix-import-orphan-folder,service-relink-on-import}/` | removidos                     | Duplicatas byte a byte de `archive/2026-08-25-*` (proposal, tasks, `.openspec.yaml`); o archive tinha ficado sem os delta specs.                                                                                                             |
| `openspec/changes/archive/2026-08-25-*/specs/`                                                                      | movidos para cá               | Os delta specs acima. Conferi que os requisitos ADDED já estão em `openspec/specs/` (os ausentes são os REMOVED).                                                                                                                            |
| `docs/concepts/edge-labels-drag-parenting.md`                                                                       | traduzido                     | Doc de conceito válido; atualizado onde o código mudou (host montado em `core/DiagramSurface.tsx`, não em `Canvas.tsx`; "scene mode" → version mode).                                                                                        |
| `FEATURES_MAP.md`                                                                                                   | removido → `docs/features.md` | Em português e desatualizado (Cmd+E em vez de Shift+E; `SaveCustomComponentModal`, `ChatPanel`, `MentionInput`, `CustomComponentTemplate`, "Scenes" — nada disso existe mais). Reescrito conferindo `ShortcutsModal.tsx`, enums e catálogos. |
| `docs/chore/post-node-pipeline.md`                                                                                  | removido                      | Relatório de sessão (L1/L2/L3 de #220), sem referências.                                                                                                                                                                                     |
| `docs/superpowers/plans/…workspace-bulk-export.md` e `…/specs/…-design.md`                                          | removidos                     | Plano/spec de agente para feature já mergeada (#243), sem referências.                                                                                                                                                                       |
| `docs/investigation/correcao-edge-relayer.md`, `ajustes-pos-correcao.md`                                            | removidos                     | Relatórios de sessão (branch `investigation/edge-relayer`), não citados por código nem por outro doc.                                                                                                                                        |
| `.claude/changes/polish-editable-edge-ux.md`                                                                        | removido                      | Proposta "proposed" de 2026-07-07 superada por `openspec/changes/archive/2026-07-08-improve-editable-step-ux`.                                                                                                                               |
| `docs/investigation/README.md`                                                                                      | criado                        | Explica em inglês por que há logs em português e que eles descrevem o código da época.                                                                                                                                                       |
| `docs/decisions/2026-08-26-remove-walkthroughs.md`                                                                  | nota adicionada               | O módulo foi reconstruído depois (#238, atrás de `VITE_ENABLE_WALKTHROUGHS`); a decisão lia como definitiva.                                                                                                                                 |
| `docs/architecture/plugin-system-preparation.md`                                                                    | status corrigido              | Dizia "Nothing here is implemented"; o sistema de plugins existe.                                                                                                                                                                            |

### Frente 4 — dependências

`package.json` e `package-lock.json` (só remoções, −394 linhas; `npm install --package-lock-only`,
validado com `npm ci` na cópia limpa). Detalhe na seção 3.

### Frente 5 — código morto e lint

| Arquivo                                                                                                                                | Mudança                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/cloud/providers/{aws,azure,gcp}/*.provider.ts`                                                                           | **removidos** — órfãos: nada os importa desde #227; `cloud/bootstrap.ts` documenta que os adapters agora são derivados de `registerCloudFamily`.                                                                                                                                                                                              |
| `src/features/canvas/models/panelParenting.ts`                                                                                         | removidos `isInsidePanel`, `toAbsolutePosition`, `toRelativePosition` (0 usos).                                                                                                                                                                                                                                                               |
| `src/features/canvas/hooks/useCanvasVisualState.ts`                                                                                    | removida interface `NodeSelectionState` (0 usos).                                                                                                                                                                                                                                                                                             |
| `src/features/canvas/selection/pointerFunnel.ts`                                                                                       | removida interface `GestureResolve` (0 usos).                                                                                                                                                                                                                                                                                                 |
| `src/features/canvas/nodes/ApiGroupNode/constants.ts`                                                                                  | removido re-export `FRAME_W` (0 usos).                                                                                                                                                                                                                                                                                                        |
| `src/features/canvas/panels/ElementPanel/components/colorPresets.ts`                                                                   | removido `C4_DEFAULT_COLORS` (0 usos).                                                                                                                                                                                                                                                                                                        |
| `src/features/diagram/utils/version.utils.ts`                                                                                          | removidos `isConnectionAddedInActiveVersion`, `isBaseSnapshotComponent` (0 usos).                                                                                                                                                                                                                                                             |
| `src/features/elements/element.palette.ts`                                                                                             | removido `paletteEntryMatchesQuery` (0 usos).                                                                                                                                                                                                                                                                                                 |
| `src/features/elements/families/cloud-family.registry.ts`                                                                              | removido `cloudFamilyForCategoryType` (0 usos).                                                                                                                                                                                                                                                                                               |
| `src/features/llm/component-catalog.ts`                                                                                                | removidos 6 wrappers `@deprecated … kept for call-site stability` sem nenhum call site + `buildPatternCatalog` (0 usos).                                                                                                                                                                                                                      |
| `src/features/llm/add-node-validation.ts`                                                                                              | removido `patchContainsSearchElements` (0 usos) e o import que ficou órfão.                                                                                                                                                                                                                                                                   |
| `src/features/llm/adapters/useAssistantUIAdapter.ts`                                                                                   | removida interface `AssistantUIAdapterState` (0 usos).                                                                                                                                                                                                                                                                                        |
| `src/features/llm/components/AssistantUIComposer.tsx`                                                                                  | removido tipo `SlashCommand` (0 usos).                                                                                                                                                                                                                                                                                                        |
| `src/features/plugins/panel-registry.ts`                                                                                               | removido `getPanelsForSlot` (0 usos) e import órfão.                                                                                                                                                                                                                                                                                          |
| `src/test/stress-helpers.ts`                                                                                                           | removido `measureMsAsync` (0 usos).                                                                                                                                                                                                                                                                                                           |
| `src/index.css`                                                                                                                        | removido `.dark .hljs { … }` — CSS do highlight.js, que não é mais usado.                                                                                                                                                                                                                                                                     |
| `src/features/canvas/nodes/swimlane-color.ts`                                                                                          | criado: `withAlpha` saiu de `SwimlaneNode.tsx` (corrige `only-export-components`); `SwimlaneNode.tsx` e `SwimlaneNode.test.ts` importam daqui.                                                                                                                                                                                                |
| `src/features/elements/f9-lookup.baseline.test.ts`, `families/cloud-family-perf.baseline.test.ts`, `llm/element-catalog-query.test.ts` | removidos 4 `eslint-disable-next-line no-console` sem efeito (regra não está ativa).                                                                                                                                                                                                                                                          |
| `src/features/canvas/nodes/CardNode/TypeConfig.ts`                                                                                     | **só comentário**: `awsCategoryBorders` parece morto (knip acusa, 0 leituras), mas as bordas são montadas como `` `border-l-${categoryId}` `` e esse mapa é a única fonte dos literais que o Tailwind escaneia. **Medi**: com o mapa, o CSS gerado tem 16 classes `border-l-aws-*`; sem ele, 0. Apagar quebraria as cores das categorias AWS. |
| `eslint.config.js`                                                                                                                     | `react-refresh/only-export-components` desligada só em `src/components/ui/**` (gerado pelo shadcn CLI, não se edita à mão — exporta `buttonVariants` etc. por design) e `.design-sync/**` (entry de bundle com `export *`).                                                                                                                   |

**Critério usado para "morto":** o símbolo aparece **uma única vez** em `src/`, `plugins/`,
`server/`, `scripts/`, `cypress/` e `tools/` (a própria definição), fora das áreas proibidas
(persistência, export drawio, collab, layout). Exports usados internamente no próprio arquivo
não foram tocados (tirar `export` só gera ruído no diff).

**Queda do lint (33 → 5):** 20 warnings do `.design-sync/entry.tsx` + 3 do `components/ui` via
escopo de config; 4 diretivas inúteis removidas; 1 (`withAlpha`) corrigido no código.

**Prettier (rodado por último):** `npx prettier --write .` alterou 6 arquivos —
`CONTRIBUTING.md`, `scripts/capture-media.mjs`, `element.palette.ts`, `add-node-validation.ts`,
`panel-registry.ts`, `stress-helpers.ts`. **Nenhum arquivo mudou só por formatação**: todos já
tinham mudanças minhas (nos quatro `.ts` foi só a linha em branco que sobrou no fim do arquivo).
`docs/` e `CHANGELOG.md` estão no `.prettierignore`.

## 3. Dependências

### Removidas (evidência)

Para cada uma: `git grep -F <nome>` no repo inteiro (exceto lockfile) = **0 ocorrências** —
nenhum import, nenhum uso em `vite/vitest/tailwind/postcss/eslint/cypress.config`, scripts do
`package.json`, `plugins/` ou `server/`. Também sem import dinâmico/`import.meta.glob`.

| Pacote                         | Tipo   | Observação                                  |
| ------------------------------ | ------ | ------------------------------------------- |
| `@assistant-ui/react-markdown` | dep    | O chat usa `react-markdown` diretamente.    |
| `highlight.js`                 | dep    | Só restava o CSS `.dark .hljs` (removido).  |
| `rehype-highlight`             | dep    | —                                           |
| `remark-gfm`                   | dep    | —                                           |
| `next-themes`                  | dep    | O tema é `src/hooks/useTheme.ts` (próprio). |
| `@playwright/test`             | devDep | Os scripts usam `playwright` (mantido).     |

O lockfile perdeu 29 entradas (essas + transitivas: `lowlight`, `mdast-util-gfm*`,
`micromark-extension-gfm*`…). Nenhuma adição. Build, typecheck e testes idênticos à baseline.

### Suspeitas mantidas

| Pacote / item                                    | Por que ficou                                                                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gcp-icons`                                      | knip acusa, mas é carregado via `import.meta.glob("/node_modules/gcp-icons/…")`.                                                                                                               |
| `mochawesome-report-generator`                   | 0 imports, mas fornece o binário `marge` usado em `cy:report:html`.                                                                                                                            |
| `@types/lodash.debounce`                         | Tipos implícitos de `lodash.debounce`.                                                                                                                                                         |
| `tailwindcss-animate`, `@tailwindcss/typography` | Plugins em `tailwind.config.ts` (como você avisou).                                                                                                                                            |
| `playwright`                                     | Usado por `scripts/collab-*.mjs`, `canvas-render-profile.mjs` e `capture-media.mjs`.                                                                                                           |
| **Não listada:** `@assistant-ui/core`            | Importada diretamente em `src/features/llm/adapters/useAssistantUIAdapter.ts`, mas só chega como transitiva. Sugestão: declarar no `package.json` (não fiz para não mudar versões resolvidas). |

## 4. Documentação: removidos × traduzidos × mantidos

**Inventário em português** (fora de i18n e seeds, que são produto e não foram tocados):

| Documento                                                               | Decisão                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `FEATURES_MAP.md`                                                       | **traduzido e verificado** → `docs/features.md`                         |
| `docs/concepts/edge-labels-drag-parenting.md`                           | **traduzido** (no mesmo caminho)                                        |
| `docs/investigation/correcao-edge-relayer.md`                           | **removido** (relatório de sessão, sem referências)                     |
| `docs/investigation/ajustes-pos-correcao.md`                            | **removido** (idem)                                                     |
| `docs/investigation/divergencia-edicao-visualizacao.md` (3,8k palavras) | **mantido** — citado por §seção em 13 arquivos de `src/`                |
| `docs/investigation/edge-relayer.md` (4k)                               | **mantido** — citado em `useLocalNodes.ts` e teste                      |
| `docs/investigation/paridade-editor-viewer-caixa-do-no.md` (1,8k)       | **mantido** — citado em `reader-catalog.ts`                             |
| `docs/discovery/bug3-filesystem-instability.md` (3,7k)                  | **mantido** — citado em `fileSystemBoot.ts` e `concepts/persistence.md` |
| `docs/epico-virtualizacao/*.md` (4 arquivos, ~8k)                       | **mantidos** — a pasta é citada em 3 arquivos de `src/`                 |
| `docs/epico-layout-visualization/*.md` (2 arquivos, ~7,3k)              | **mantidos** — citados por §seção em `divergencia-…`                    |
| `docs/collab-entity-patches.md` (3,8k)                                  | **mantido** — registro de design citado pela spec de protocolo          |

Os mantidos somam ~35k palavras; tradução grande demais para esta passada. Todos ficaram
sinalizados em `docs/README.md` e `docs/investigation/README.md`. Se quiser traduzir, sugiro a
ordem: `divergencia-edicao-visualizacao.md` (a mais citada) → `edge-relayer.md` → o resto.

**Outros removidos (inglês, processo interno):** `docs/chore/`, `docs/superpowers/`,
`.claude/changes/`, e as 4 changes duplicadas do OpenSpec.

**Mantidos e revisados (inglês):** ADRs, `docs/architecture/*`, `docs/concepts/*`,
`docs/grammar/*`, `docs/collab-architecture-study.md` (um teste cita as linhas 621-646),
`docs/collab-websocket-protocol.md`, `tools/mutation/`, `.design-sync/`, `.cursor/rules/`,
`.claude/commands` e `.claude/skills` (tooling do OpenSpec).

## 5. Triagem das issues do GitHub

`gh` não está instalado nesta máquina; li pela API REST pública (só leitura).

**Não há issues abertas.** O repo só teve uma issue na vida inteira: #22 "t" (fechada em
2026-03-17, teste). Também não há PRs abertos.

| #   | Título | Ação proposta | Motivo                |
| --- | ------ | ------------- | --------------------- |
| —   | —      | —             | Nenhuma issue aberta. |

## 6. Ações propostas fora do repo (não executadas)

1. **Descrição e site do repo** (hoje vazios): descrição = "Local-first, open source architecture
   diagramming tool built on the C4 model and React Flow."; website = `https://structur.dev/`.
2. **Topics** (hoje nenhum): `architecture`, `software-architecture`, `c4-model`, `diagram`,
   `diagramming`, `react-flow`, `aws`, `cloud-architecture`, `local-first`, `typescript`, `react`.
3. **Social preview:** usar `docs/assets/screenshots/canvas-aws.png` recortado para 1280×640.
4. **Branches remotas:** `feat/asl` (1 commit à frente, 44 atrás, parado desde 2026-08-24) —
   decidir entre abrir PR ou apagar. `nvda` (acessibilidade, 6 à frente, 13 atrás, 2026-09-19) —
   parece trabalho em andamento; não apagar sem decidir. Localmente há ainda `fix/i18n`,
   `back/walktrhouth` etc.; não mexi.
5. **Tags:** `v1`…`v2.1` são anteriores a `v0.2.0`, então ordenação semver deixa `v2.1` como
   "última". Considere apagar ou renomear as antigas (ou publicar a próxima como `v2.2`/`v3`) e
   criar Releases no GitHub (hoje não há nenhuma). A tag `pre-remove-walkthroughs` citada no
   CHANGELOG não existe localmente; verifique no remoto. `pre-rebase-backup` parece lixo.
6. **Versão:** `package.json` diz `0.1.0`, mas a última tag é `v0.2.0`. Alinhar no próximo release.
7. **Labels:** as padrão do GitHub + `codex`, `javascript`, `github_actions`, `dependencies`
   (sobra do dependabot). O CONTRIBUTING antigo citava labels `persistence`, `canvas`, `diagram`,
   `performance` que não existem — removi a tabela; se quiser, crie essas labels.
8. **Discussions:** o template antigo apontava para elas; ativar ou deixar como está (troquei o link).
9. **CI vermelho em `main`** (seção 1): o badge do README vai aparecer como "failing" até as 7
   baselines de layout serem atualizadas ou o problema corrigido.

## 7. Pendências

### Mídia

Tudo foi gerado automaticamente; **nada precisa ser gravado à mão**. Pontos que você talvez queira
refazer:

- As telas usam o workspace de demonstração (PixLedger, **conteúdo em português**, como definido
  no AGENTS.md). Para um README 100% em inglês, seria preciso um seed em inglês — mudança de
  produto, não fiz.
- O GIF tem 3,1 MB (< 5 MB). Os PNGs somam ~2,5 MB; sem `pngquant`/`oxipng` na máquina não
  otimizei.
- Aparece "Saving…" no header de algumas capturas (o seed está sendo gravado).

### Lint — regras que exigem mudança de lógica (não tocadas)

Essas regras estão **desligadas** em `eslint.config.js`. Com elas ligadas: **195 ocorrências**
em `src/` — `react-hooks/refs` 113 (17 arquivos), `set-state-in-effect` 53 (40),
`immutability` 21 (12), `preserve-manual-memoization` 5, `static-components` 2, `purity` 1.
`exhaustive-deps` já está ligada como erro e está limpa. Lista completa no apêndice.

Os 5 warnings que sobraram (`only-export-components`) são arquivos que exportam Provider + hook
juntos: `ElementsSelectableContext.tsx`, `HandleHighlightContext.tsx`, `EdgeLabelPortal.tsx`,
`FlowModeContext.tsx`, `CollabProvider.tsx`. Corrigir = separar contexto/hook em outro arquivo e
reescrever imports (até 21 arquivos para `useFlowMode`; `CollabProvider` é collab, fora de escopo).
Deixei como follow-up.

### Outras coisas que encontrei

- **Hook do husky vai falhar no commit:** `.husky/pre-commit` roda `npx lint-staged`, mas
  `lint-staged` não é dependência e não há config. Ao commitar, o `npx` vai baixar o pacote e
  falhar por falta de config (ou pedir confirmação). Opções: adicionar `lint-staged` + config, ou
  remover o hook. Não mexi porque vai mudar seu fluxo de commit.
- **Seu `node_modules`:** rode `rm -rf node_modules && npm ci` para sumir com a árvore `.pnpm` —
  isso resolve o typecheck local.
- `plugins/structura-plugin-leanix/manifest.json` é uma **cópia** do manifest do
  `structura-plugin-example-ui` (mesmo id e nome). O manifest real está no `src/index.tsx` do
  plugin; se o `manifest.json` for lido por alguma ferramenta, está errado.
- `useAssistantUIAdapter.ts` tem mensagens de erro em inglês hardcoded (viola a regra de i18n).
- `src/features/llm/llm-storage.ts`: `loadThreadFromStorage`, `saveThreadToStorage`,
  `loadConfigFromLocalStorage`, `saveConfigToLocalStorage` têm 0 usos, mas mexem com
  `localStorage` — deixei por ser persistência.
- `AZURE_CATEGORY_ID_GENERAL` / `GCP_CATEGORY_ID_GENERAL`: 0 usos, mas o `satisfies` pode ser
  intencional como checagem de tipo. Mantidos.
- Barrels não importados por ninguém (knip): `features/canvas/{components,edges,hooks,navigation,nodes,panels,selection,toolbar}/index.ts`,
  `features/elements/index.ts`, `features/plugins/index.ts`, `features/walkthrough/index.ts`,
  `lib/catalogs/index.ts`, `lib/core/index.ts`. Apagar é decisão de arquitetura (AGENTS.md fala dos
  barrels); não mexi.
- Mais ~100 exports que só são usados dentro do próprio arquivo (knip "unused exports"); não
  toquei.
- OpenSpec: `flow-editing-panel`, `flow-state-accumulator` e
  `walkthrough-parity-playback-filesystem` têm todas as tasks marcadas — estão prontas para
  `/opsx:archive` (que faz sync dos specs). `flow-reading-call-stack`, `flow-step-endpoint` e
  `shared-flow-reading` têm 1–2 tasks abertas.
- `ROADMAP.md` ainda lista itens que talvez já estejam feitos (ex.: mapeamento de estilos de
  aresta no draw.io, #130/#137). Não marquei nada que eu não conseguisse confirmar.

## 8. Sugestão de commits

Na ordem, cada um passa sozinho nos gates (exceto as 7 falhas pré-existentes):

1. `chore(deps): remove unused dependencies` — `package.json` (só o bloco de deps), `package-lock.json`, `src/index.css`.
2. `refactor: remove dead code` — os `.ts/.tsx` de `src/` da Frente 5 (inclui os 3 `*.provider.ts`, `swimlane-color.ts` e o comentário em `TypeConfig.ts`).
3. `chore(lint): scope react-refresh and ignore nested worktrees` — `eslint.config.js`, `.prettierignore`, `.gitignore`, os 3 testes sem as diretivas.
4. `chore(openspec): move archived delta specs and drop duplicate changes` — `openspec/`.
5. `docs: remove session reports and translate remaining docs` — deleções em `docs/` e `.claude/changes`, `FEATURES_MAP.md` → `docs/features.md`, `edge-labels-drag-parenting.md`, `docs/investigation/README.md`, `docs/README.md`, notas em `decisions/` e `architecture/`.
6. `docs: community health files` — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/*`, `.editorconfig`, `CODEOWNERS`, metadados do `package.json`.
7. `docs: rewrite README with screenshots and demo` — `README.md`, `docs/assets/`, `docs/guides/embedding.md`, `scripts/capture-media.mjs`, script `media:capture`, `plugins/README.md`, `ROADMAP.md`.
8. `docs(changelog): restructure into Keep a Changelog` — `CHANGELOG.md`.

`package.json` tem mudanças de três commits (deps, metadados, script); use `git add -p`.

## 9. Adendo — nova paleta do dark mode (pedido posterior)

Isto é mudança de **produto** (fora do escopo original); ficou isolado para virar um commit próprio:
`feat(theme): refresh dark palette`.

- `src/index.css` (bloco `.dark`): o azul-marinho saturado (`222 47% 6%`) virou um grafite frio com
  leve tom violeta (família Dracula, ~15% de saturação), em camadas como nos temas escuros do VS Code:
  sidebar `231 16% 10%` → canvas `231 15% 12%` → cards `231 15% 15%` (= "darker background" do
  Dracula) → popovers/inputs. Bordas `231 13% 24%`, texto off-white `60 20% 93%`. O ciano da marca
  continua com o mesmo matiz (187), só mais claro. Nós C4 em tons Dracula mais suaves (roxo
  `265 80% 74%`, verde `140 60% 56%`, laranja `34 100% 68%`); JSON com a leitura Dracula (chave
  ciano, string amarela, número roxo, booleano rosa). `--accent` no dark virou neutro (antes era o
  ciano, então todo hover de menu ficava ciano); agora segue a mesma semântica do tema claro. Cores
  de catálogos (AWS/Azure/GCP/K8s) e gráficos não mudaram.
- **Títulos de painel e swimlane invisíveis no dark (bug):** `contrastLabelColor` sempre misturava a
  cor do painel com **branco**, então no dark escolhia texto quase preto. Agora recebe o fundo real
  (`backdrop`, padrão branco → tema claro idêntico); `PanelNode`/`SwimlaneNode` passam o
  `--background` do tema via o novo `src/features/canvas/nodes/use-canvas-backdrop.ts`. +3 testes em
  `labelContrast.test.ts`.
- **Miniaturas do dashboard no dark:** as notas saíam como blocos claros (a miniatura é um `<img>`
  SVG e não enxerga o tema). `generatePreviewSvg` aceita `theme`; o cache guarda também uma variante
  `structura_diagram-preview:dark:<id>` (a chave clara não mudou, então caches antigos continuam
  válidos); `DiagramCard` escolhe pelo tema atual com fallback para a clara; `deletePreview` apaga
  as duas. +1 teste.
- `docs/assets/screenshots/*.png` regenerados (o `dark-mode.png` agora mostra a paleta nova).

Gates após o adendo: typecheck 0, lint 5 warnings, format 0, build ok, sync ok, testes 2994 ✓ / as
mesmas 7 ✗ pré-existentes (3001 no total, +4 novos).

Não mexi nas cores de nota salvas (`NOTE_PRESET_PAIRS`): são valores persistidos nos diagramas e
usados como chave de lookup. As variáveis `--color-border-*`, `--color-text-*` usadas pelo viewer
não estão definidas em nenhum tema (pré-existente); vale definir num próximo passo.

---

## Apêndice — ocorrências das regras de hooks desligadas

| Regra                       |  Nº | Arquivo                                                                     |
| --------------------------- | --: | --------------------------------------------------------------------------- |
| immutability                |   2 | `src/features/canvas/core/readWriteParity.test.tsx`                         |
| immutability                |   1 | `src/features/canvas/edges/EdgeLabelPortal.test.tsx`                        |
| immutability                |   3 | `src/features/canvas/edges/interaction/gesture-boundary.test.tsx`           |
| immutability                |   1 | `src/features/canvas/edges/useCanvasEdges.dataIdentity.test.tsx`            |
| immutability                |   1 | `src/features/canvas/flow/useFlowModePlayback.stepping.test.tsx`            |
| immutability                |   6 | `src/features/canvas/hooks/useCanvasEventHandlers.ts`                       |
| immutability                |   1 | `src/features/canvas/hooks/useLocalNodes.ts`                                |
| immutability                |   1 | `src/features/canvas/nodes/JsonViewerNode/JsonViewerNode.tsx`               |
| immutability                |   1 | `src/features/canvas/nodes/NoteNode.tsx`                                    |
| immutability                |   1 | `src/features/canvas/nodes/useCanvasNodes.reading-lock.test.tsx`            |
| immutability                |   1 | `src/features/canvas/nodes/useCanvasNodes.selection-dim.test.tsx`           |
| immutability                |   2 | `src/features/collaboration/hooks/useCollab.ts`                             |
| preserve-manual-memoization |   1 | `src/features/canvas/flow/reading/FlowReadingRail.tsx`                      |
| preserve-manual-memoization |   1 | `src/features/canvas/selection-actions/NodeQuickActionsBar.tsx`             |
| preserve-manual-memoization |   1 | `src/features/collaboration/components/CollabProvider.tsx`                  |
| preserve-manual-memoization |   1 | `src/features/collaboration/hooks/useCollab.ts`                             |
| preserve-manual-memoization |   1 | `src/features/viewer/components/ViewerCanvas.tsx`                           |
| purity                      |   1 | `src/features/collaboration/components/CollabProvider.tsx`                  |
| refs                        |  19 | `src/features/canvas/edges/useCanvasEdges.ts`                               |
| refs                        |   2 | `src/features/canvas/edges/useCanvasHandleReorder.ts`                       |
| refs                        |   2 | `src/features/canvas/hooks/useCanvasDrillHandlers.ts`                       |
| refs                        |   2 | `src/features/canvas/hooks/useCanvasInteraction.ts`                         |
| refs                        |   3 | `src/features/canvas/hooks/useCanvasKeyboard.ts`                            |
| refs                        |   7 | `src/features/canvas/hooks/useCanvasVisualState.ts`                         |
| refs                        |  33 | `src/features/canvas/hooks/useLocalNodes.ts`                                |
| refs                        |   2 | `src/features/canvas/hooks/useNodeDragParenting.ts`                         |
| refs                        |   6 | `src/features/canvas/hooks/useStableSetByContent.ts`                        |
| refs                        |   2 | `src/features/canvas/nodes/CardNode/index.tsx`                              |
| refs                        |   1 | `src/features/canvas/nodes/DbTableNode/DbTableNode.tsx`                     |
| refs                        |  25 | `src/features/canvas/nodes/useCanvasNodes.ts`                               |
| refs                        |   1 | `src/features/canvas/panels/ElementPanel/DbTablePanel.tsx`                  |
| refs                        |   2 | `src/features/canvas/panels/ElementPanel/components/ConnectionsTab.tsx`     |
| refs                        |   1 | `src/features/collaboration/components/CollabProvider.tsx`                  |
| refs                        |   4 | `src/features/collaboration/hooks/useCollab.ts`                             |
| refs                        |   1 | `src/features/viewer/components/ViewerCanvas.tsx`                           |
| set-state-in-effect         |   1 | `src/components/FileSystemStatus.tsx`                                       |
| set-state-in-effect         |   1 | `src/components/folders/FolderTree.tsx`                                     |
| set-state-in-effect         |   1 | `src/features/canvas/Canvas.tsx`                                            |
| set-state-in-effect         |   1 | `src/features/canvas/edges/interaction/useEdgeLabelDrag.ts`                 |
| set-state-in-effect         |   2 | `src/features/canvas/flow/MermaidImportDialog.tsx`                          |
| set-state-in-effect         |   2 | `src/features/canvas/hooks/useCanvasVisualState.ts`                         |
| set-state-in-effect         |   2 | `src/features/canvas/navigation/DiagramCommandPalette.tsx`                  |
| set-state-in-effect         |   1 | `src/features/canvas/navigation/DiagramSidebar.tsx`                         |
| set-state-in-effect         |   1 | `src/features/canvas/nodes/DbTableNode/DbTableNode.tsx`                     |
| set-state-in-effect         |   1 | `src/features/canvas/nodes/JsonViewerNode/JsonViewerNode.tsx`               |
| set-state-in-effect         |   1 | `src/features/canvas/nodes/NoteNode.tsx`                                    |
| set-state-in-effect         |   3 | `src/features/canvas/panels/ElementPanel/ComponentPanel.tsx`                |
| set-state-in-effect         |   2 | `src/features/canvas/panels/ElementPanel/DbTablePanel.tsx`                  |
| set-state-in-effect         |   2 | `src/features/canvas/panels/ElementPanel/JsonViewerPanel.tsx`               |
| set-state-in-effect         |   1 | `src/features/canvas/panels/ElementPanel/SvgPanel.tsx`                      |
| set-state-in-effect         |   2 | `src/features/canvas/panels/ElementPanel/components/ConnectionsTab.tsx`     |
| set-state-in-effect         |   1 | `src/features/canvas/panels/ElementPanel/sections/LinkedDiagramSection.tsx` |
| set-state-in-effect         |   1 | `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx`    |
| set-state-in-effect         |   1 | `src/features/canvas/panels/ElementPanel/sections/PositionSection.tsx`      |
| set-state-in-effect         |   1 | `src/features/canvas/panels/MultiSelectPanel.tsx`                           |
| set-state-in-effect         |   1 | `src/features/canvas/toolbar/CanvasSearch.tsx`                              |
| set-state-in-effect         |   2 | `src/features/canvas/toolbar/CanvasToolbar.tsx`                             |
| set-state-in-effect         |   1 | `src/features/canvas/toolbar/MergeVersionDialog.tsx`                        |
| set-state-in-effect         |   1 | `src/features/canvas/toolbar/UserTemplateCard.tsx`                          |
| set-state-in-effect         |   1 | `src/features/canvas/toolbar/components/CanvasToolbarDiagramPanel.tsx`      |
| set-state-in-effect         |   2 | `src/features/collaboration/components/CollabProvider.tsx`                  |
| set-state-in-effect         |   1 | `src/features/integrations/github/components/GithubMergeDialog.tsx`         |
| set-state-in-effect         |   1 | `src/features/integrations/github/components/GithubSearchBar.tsx`           |
| set-state-in-effect         |   1 | `src/features/llm/components/AssistantUIChatPanel.tsx`                      |
| set-state-in-effect         |   1 | `src/features/llm/components/AssistantUIComposer.tsx`                       |
| set-state-in-effect         |   1 | `src/features/walkthrough/pages/WalkthroughEditorPage.tsx`                  |
| set-state-in-effect         |   2 | `src/infrastructure/persistence/useFileSystemStorage.ts`                    |
| set-state-in-effect         |   1 | `src/pages/ImportModal.tsx`                                                 |
| set-state-in-effect         |   1 | `src/pages/ViewerPage.tsx`                                                  |
| set-state-in-effect         |   1 | `src/pages/dashboard/DiagramCard.tsx`                                       |
| set-state-in-effect         |   1 | `src/pages/dashboard/RenameDiagramModal.tsx`                                |
| set-state-in-effect         |   1 | `src/pages/services/DetailPanel.tsx`                                        |
| set-state-in-effect         |   3 | `src/pages/services/index.tsx`                                              |
| set-state-in-effect         |   1 | `src/pages/workspace/ExportModal.tsx`                                       |
| set-state-in-effect         |   1 | `src/pages/workspace/WorkspaceExportModal.tsx`                              |
| static-components           |   1 | `src/features/canvas/components/icons/CustomIconRenderer.tsx`               |
| static-components           |   1 | `src/features/canvas/components/icons/LucidePickerPanel.tsx`                |

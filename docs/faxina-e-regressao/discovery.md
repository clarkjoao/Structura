# Discovery: faxina de código morto e rede de regressão no Structura

Discovery feita em 2026-11-26 sobre a `main` `b3595158`, em worktree limpa. Os números abaixo foram medidos nesse commit.

## Decisões tomadas (2026-11-26)

- **IR `/generate` (DC-011): remover.** A feature migra para um MCP. Fica o `ir.types.ts` (catálogo estático do assistente); qualquer parte do IR de que o épico de layout dependa é sinalizada antes de sair.
- **Walkthrough (DC-010): por último** no plano.
- **fallow: remover o gate de código morto** e o baseline, porque o relatório tem falsos positivos demais. O check de ciclos de import (`fallow architecture`) fica.
- **Cópias geradas (DC-053): corrigir na fonte** e sincronizar de novo.
- Plano aprovado; execução na branch `chore/faxina-e-regressao`, um commit por item.


## 1. Resumo executivo

- **Baseline:** todos os gates passam na `main` `b3595158`. São 5304 testes (585 arquivos), 0 erros de lint, cobertura de 69,7% das linhas. Os números antigos ("252 problemas de lint", "770/770 testes") não valem mais.
- **Código morto de verdade é pouco:**
  - 9 arquivos (barrels vazios) e cerca de 35 símbolos inteiros.
  - O volume está na superfície de API: cerca de 350 linhas de re-export em barrels e cerca de 100 `export` de símbolos que só o próprio arquivo usa.
  - 223 chaves de i18n.
  - Nenhuma dependência morta: as 7 que o fallow aponta são falsos positivos.
- **O gate do fallow não diminui o estoque:** ele passa porque o baseline aceita exatamente o estado atual. Desde que foi salvo, ninguém reduziu os números.
- **O briefing não bate com o código em dois temas.** A geração por IR (`/generate`) está viva e sem flag. O módulo `walkthrough` foi reconstruído no #238, fica atrás de uma flag desligada e é usado pelo "Apresentar por fase" do guided. Os dois foram para decisão, não para remoção.
- **Structurizr e GIF não existem na `main`:** não há código nem teste.
- **As regressões se repetem onde não há teste:** `Canvas.tsx`, `useCanvasInteraction`, `useCanvasKeyboard` e `useFileSystemStorage` estão perto de 0% de cobertura e estão entre os arquivos mais corrigidos.
- **E2E desligado:** nenhum dos 14 specs Cypress roda no CI.

## 2. Baseline medido (2026-11-26, worktree limpa de `origin/main`)

| Comando                 | Resultado                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `npm ci`                | ok, 764 pacotes, sem `--legacy-peer-deps`. Aviso: `nanoid@6` exige Node ≥22, e o CI usa Node 20 |
| `typecheck`             | 0 erros                                                                                         |
| `test`                  | 585 arquivos, 5304 testes verdes (146 s)                                                        |
| cobertura v8            | linhas 69,7%, branches 60,8%, funções 64,0%                                                     |
| `lint`                  | 0 erros, 7 warnings, todos `react-refresh/only-export-components`                               |
| `format:check`          | ok                                                                                              |
| `build` / `build:embed` | ok, com aviso de chunk acima de 500 kB                                                          |
| `fallow:check`          | ok só por causa do baseline: 17 arquivos, 525 exports e 253 tipos aceitos                       |
| `plugins:sync-check`    | ok, mas não cobre o plugin `observability` nem a extensão VSCode                                |
| CI equivalente          | os 19 testes de plugin e extensão só rodam com `OPSCR_REPO_TOKEN`. Cypress não roda             |

## 3. Inventário de código morto

| Categoria                  | MORTO-SEGURO                                                                | MORTO-PROVÁVEL                                                                                                | DECISÃO-HUMANA                                                                         | VIVO / falso positivo                                                                                    |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Arquivos                   | 9 barrels (DC-020)                                                          | —                                                                                                             | barrels de `elements` e `plugins` (DC-021)                                             | 8 entradas: exemplos de plugin, loadtest, script de fixtures (DC-022)                                    |
| Exports (símbolo inteiro)  | 13 no `diagram` (DC-060) e 22 no resto (DC-050)                             | `saveLastEdgeStyle`, possível bug (DC-061); 3 métodos do FileSystemAdapter (DC-024); collab/loadtest (DC-025) | FLOW, node-types, layout, deploy, services, LeanIX, presets (DC-033, DC-064, DC-054)   | cópias geradas e shadcn (DC-053)                                                                         |
| Re-exports de barrel       | ~163 no `diagram` (DC-062), ~96 no `canvas` (DC-030, DC-031)                | ~89 em persistence, llm, viewer, lib (DC-051)                                                                 | flow e node-types (DC-033)                                                             | —                                                                                                        |
| `export` só de uso interno | 41 no `canvas` (DC-032), 22 no `diagram` (DC-063)                           | ~35 no resto (DC-052)                                                                                         | —                                                                                      | —                                                                                                        |
| Só usados por testes       | —                                                                           | 17 símbolos (DC-065)                                                                                          | regra a decidir                                                                        | —                                                                                                        |
| Dependências               | 0                                                                           | —                                                                                                             | —                                                                                      | 7 falsos positivos, por `import.meta.glob`, config do Tailwind e pastas `generated` (DC-023, DC-027)     |
| i18n                       | 223 chaves (DC-012)                                                         | 689 alcançadas só por prefixo dinâmico (DC-013)                                                               | `elementPanel`, `flowScript`, `llmChat`, `services`                                    | paridade en/pt-BR em 100% (2986 chaves)                                                                  |
| Flags                      | `VITE_ENABLE_DEFECTDOJO` e `VITE_ENABLE_GITHUB_IMPORT`, sem leitor (DC-014) | —                                                                                                             | `VITE_ENABLE_WALKTHROUGHS` (DC-010)                                                    | as demais flags são lidas                                                                                |
| Docs e specs               | —                                                                           | spec `step-edge-drag-preview` (DC-040)                                                                        | 17 openspec changes concluídas e não arquivadas (DC-038); ADR-0010 e ADR-0014 (DC-037) | corrigir 8 docs de conceito, mais README e AGENTS (DC-035, DC-036); arquivar 2 investigações (DC-039)    |
| TODO, FIXME, stubs         | 0 ocorrências                                                               | —                                                                                                             | —                                                                                      | categoria fechada (DC-016)                                                                               |
| Duplicação (só mapeada)    | —                                                                           | —                                                                                                             | dois motores ELK com opções copiadas à mão (DC-041)                                    | helpers repetidos: escape de XML ×5, clipboard ×8, ids ad-hoc (DC-043); relay em Node e Go é intencional |

Temas abandonados:
- **Story trail e templates de diagrama:** não há resíduo na `main`.
- **Walkthrough e IR:** estão vivos (DC-010 e DC-011).
- **Sufixo `.walkthrough.json` e migrações do `persist.config`:** precisam ficar, para proteger as pastas e os dados dos usuários.

## 4. Matriz de bugs recorrentes × cobertura

Fontes:
- 181 PRs mergeados, via API pública do GitHub, porque não há `gh` nesta máquina. 25 deles são do dependabot.
- 227 linhas de correção tiradas dos corpos dos squashes.

| #   | Grupo (nº aprox. de correções)                              | Onde volta                                            | Teste hoje                                 | Proposta (mais barata)                           | Card   |
| --- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | ------ |
| 1   | `pushHistory` faltando (~9)                                 | slices do store                                       | nenhum guarda genérico                     | teste tabelado por ação                          | RT-010 |
| 2   | Boot e hidratação da persistência (~12)                     | `fileSystemBoot` (38%), `useFileSystemStorage` (0,9%) | parcial                                    | invariantes com InMemoryAdapter e fake-indexeddb | RT-011 |
| 3   | Import/export e share URL (~10)                             | `export-service`, `share-url`                         | golden, mas nenhum fixture de arquivo real | corpus de fixtures e round-trip                  | RT-012 |
| 4   | Sincronia de seleção (~10)                                  | `useCanvasInteraction` (0%)                           | só Cypress, fora do CI                     | `renderHook` dos cenários                        | RT-013 |
| 5   | Escopo dos atalhos (~5)                                     | `useCanvasKeyboard` (0%)                              | parcial                                    | tabela de alvo do evento × atalho                | RT-014 |
| 6   | Parenting e clipboard (~6)                                  | slices (branches 78%)                                 | casos pontuais                             | testes de propriedades                           | RT-015 |
| 7   | Paridade viewer/embed (~8)                                  | viewer, embed                                         | Cypress de pixel, fora do CI               | paridade de projeção por seed                    | RT-016 |
| 8   | Fit e viewport (~6)                                         | `canvas/navigation` (0%)                              | nenhum                                     | tabela de decisão do fit                         | RT-017 |
| 9   | Direção de leitura e handles (~8)                           | nodes, edges                                          | guardas fortes                             | render de todos os tipos em LR e TB              | RT-018 |
| 10  | Dashboard e rotas (~4, uma delas perda de código no squash) | `pages/dashboard` (15%)                               | quase nenhum                               | testes de componente                             | RT-019 |
| 11  | Colaboração com corridas (~7)                               | collab (63%)                                          | parcial                                    | intercalação determinística                      | RT-021 |
| 12  | Chunk lazy e registry (~3)                                  | llm, elements                                         | nenhum                                     | import do llm com registry vazio                 | RT-022 |
| 13  | Gate que não checa nada (~5)                                | tsconfig, plugins, squash                             | nenhum                                     | meta-testes de CI                                | RT-023 |
| 14  | E2E desligado                                               | Cypress                                               | 14 specs, 0 no CI                          | 4 specs de smoke no CI                           | RT-020 |
| 15  | FLOW (~12)                                                  | flow                                                  | ~720 casos, 83%                            | decisão sua                                      | RT-025 |

Ordem de prioridade dos testes: RT-010 → RT-011 → RT-012 → RT-013 → RT-014 → RT-015 → RT-023 → RT-020 → o resto.

## 5. Plano em PRs pequenos e ordenados

Todo PR de remoção roda `fallow:baseline`, e o diff do baseline só pode encolher.

1. Configurar o fallow para os falsos positivos (DC-022, DC-023, DC-053). Aceite: a lista do fallow perde as entradas falsas e nada real some.
2. Remover os 9 barrels mortos (DC-020). Aceite: typecheck, test e build verdes, `unused_files` −9.
3. Remover as linhas de barrel do `diagram` (DC-062).
4. Remover re-exports do `canvas` (DC-030, DC-031).
5. Enxugar os outros barrels (DC-051).
6. Tirar os `export` de uso interno (DC-032, DC-052, DC-063).
7. Remover os símbolos mortos (DC-050, DC-060).
8. Remover as 223 chaves de i18n (DC-012).
9. Corrigir flags e docs (DC-014, DC-015, DC-035, DC-036, DC-039, DC-040).
10. Higiene de CI: Node 22/24, typecheck do `observability`, `sync-check` completo, `tsconfig.cypress`, meta-gates (BL-003, BL-006, DC-042, BL-009, RT-023).
11. a 17. Testes de regressão, um grupo por PR, na ordem da seção 4.
18. Os de risco, no fim: DC-024, DC-025, DC-061, e depois o que sair das decisões (DC-010, DC-011, DC-034, DC-038).

## 6. Decisões que preciso de você

1. **IR `/generate` (DC-011).** Recomendo manter por enquanto e decidir o produto à parte. Se for removido por engano, quebra o assistente e cerca de 25 testes de layout.
2. **Walkthrough (DC-010).** Recomendo manter atrás da flag até decidir o "Apresentar por fase". Removê-lo derruba essa função do guided. Manter custa cerca de 2600 linhas paradas.
3. **Cypress no CI (BL-004, RT-020).** Recomendo começar com 4 specs de smoke. O custo é tempo de CI, que ainda não medi.
4. **Arquivar as 17 openspec changes concluídas (DC-038).** Recomendo arquivar. Hoje as specs principais estão incompletas, e o custo de errar é baixo.
5. **Exports mortos dentro de épicos (DC-021, DC-026, DC-033, DC-054, DC-064).** Recomendo congelar até cada dono revisar. Custo baixo.
6. **Fixtures `generated-diagrams`, ~72 KB (DC-034).** Recomendo manter enquanto o épico de layout usar como benchmark.
7. **Exports mantidos só para testes (DC-065).** Recomendo mantê-los quando o teste cobre um comportamento real.
8. **Testes de plugin sem o token opscr (BL-010).** Recomendo rodar sem token os testes que não importam o pacote `opscr`.
9. **BL-007 (resolvido em 2026-11-26):** o épico vive no opscr, fora deste repo; as menções a um perfil Step Functions saíram dos docs.

## 7. Riscos e falsos positivos conhecidos

- **O fallow erra bastante.** Cerca de 70% dos "membros de classe mortos" são chamados por variáveis tipadas. As 7 dependências são falsas: `import.meta.glob`, config do Tailwind e pastas `generated` ignoradas na config.
- **Cópias geradas** (`sync-types` e `sync-shared`) só podem ser corrigidas na fonte, seguido de nova sincronização.
- **Chaves de i18n com prefixo dinâmico** (689) precisam ser conferidas contra o enum ou registry que gera cada chave.
- **Precisam ficar:** os exports `default` das páginas lazy, o sufixo `.walkthrough.json` e as migrações do `persist.config`.
- **Ambiente:** a máquina local usa Node 25 e o CI usa Node 20, então um resultado local pode não se repetir no CI.

**Amostra de verificação:** sorteei 10 itens MORTO-SEGURO (seed 20261126) e conferi com `git grep -w` em todo o repo. Os 10 não têm consumidor. A única ocorrência externa de cada um é a linha no próprio baseline do fallow. Os 9 barrels também não têm nenhuma importação por alias.

## 8. Quadro Kanban

- Arquivos: `docs/faxina-e-regressao/kanban.html` e `kanban.json`, fora do git desde `c3df9a06` (ficam só locais).
- Artifact: https://claude.ai/artifact/2xviZWvJAhFssP8JrRHoz3
- Estado no fim do discovery: Fase 3, com 78 cards. São 43 em Backlog, 0 em andamento, 16 aguardando decisão e 19 concluídos (24%). O estado depois da execução está na seção 9.
- Conferi que o JSON é válido e que o HTML abre num navegador headless, sem erros de console e sem rolagem horizontal a 390 px.

## 9. Resultado da execução (2026-11-26 e 27)

Executado na branch `chore/faxina-e-regressao`, um commit por item, sem push. Os números abaixo foram medidos no HEAD `a8bc7fc8`, com a máquina sem carga.

### Gates

| Gate | `main` (`b3595158`) | Branch |
|---|---|---|
| Testes | 585 arquivos, 5304 testes | 593 arquivos, 5675 testes, 0 `it.fails` |
| Cobertura de linhas | 69,7% | 74,2% |
| Cobertura de branches | 60,8% | 64,0% |
| Cobertura de funções | 64,0% | 68,6% |
| Cypress no CI | nenhum spec | 4 specs, 87 testes (`cy:run:smoke`) |
| typecheck, lint, format, build | ok (7 warnings) | ok (os mesmos 7 warnings) |
| `plugins:sync-check` | 2 plugins | 4 plugins + extensão VSCode |
| Gate de código morto | fallow com baseline | removido; ficou `cycles:check` |

A suíte tem menos testes do que no pico (5840), porque o `/generate`, o IR e o walkthrough saíram junto com os testes deles. O CI no GitHub Actions ainda não rodou nada disso: Node 24, o job `e2e-smoke`, o typecheck do `observability` e os meta-testes de gate só serão confirmados no primeiro push.

### Cobertura nos arquivos onde as regressões voltavam

| Arquivo ou pasta | Antes | Depois |
|---|---|---|
| `canvas/hooks/useCanvasKeyboard.ts` | 0% | 91,5% |
| `canvas/hooks/useCanvasController.ts` | 0% | 100% |
| `canvas/hooks/useCanvasEventHandlers.ts` | 48,8% | 79,8% |
| `canvas/hooks/useCanvasInteraction.ts` | 0% | 43,1% |
| `persistence/fileSystemBoot.ts` | 38,5% | 63,1% |
| `persistence/useFileSystemStorage.ts` | 0,9% | 24,1% |
| `lib/export-service/import-drawio.ts` | 69,6% | 79,7% |
| `canvas/hooks` (pasta) | 50,4% | 71,7% |
| `features/collaboration` | 62,7% | 73,0% |
| `pages/dashboard` | 15,5% | 66,0% |
| `pages/workspace` | 14,0% | 37,4% |

`Canvas.tsx` (1,6%) e `CanvasContextMenu.tsx` (0%) seguem sem cobertura de vitest: quem os cobre agora são os specs Cypress do CI (seleção, menu de contexto, arestas editáveis e paridade). `features/llm` caiu de 54,7% para 50,2% porque o IR, que era bem testado, saiu.

### O que foi removido

- Gate e baseline de código morto do fallow (64 KB), a pedido do usuário.
- 8 barrels sem importador, mais o do walkthrough.
- Cerca de 310 re-exports mortos, cerca de 60 símbolos sem chamador, e o `export` de 94 símbolos de uso interno.
- 205 chaves de i18n sem uso (169 + 36 de prefixo dinâmico), mais 194 do walkthrough.
- O comando `/generate` e todo o `src/features/llm/ir`. Os fixtures de layout viraram documentos Diagram, e os baselines de layout foram regravados no caminho real do produto (tabela de antes e depois em `2b7d8404`).
- O módulo walkthrough inteiro (`4bad604c`). O sufixo `.walkthrough.json` fica, para proteger as pastas dos usuários.
- A cópia do motor ELK no plugin opscr, que agora chama `api.layout.arrange` do host (API 1.19). A extensão VSCode ainda usa a cópia (DC-073).
- Docs e specs com referências quebradas, mais os planos de perfil Step Functions.

### Testes de regressão adicionados

Todos foram conferidos quebrando de propósito a correção original: o teste falhou como devia.

- Guarda de histórico: toda ação estrutural do store grava undo, e uma ação nova sem classificação faz o teste falhar.
- Boot da persistência, corpus de 20 fixtures de import/export, seleção, escopo de atalhos, invariantes de parenting e clipboard (250 cenários).
- Paridade editor × viewer × embed, direção de leitura em todos os tipos de nó, ações do dashboard e rotas, decisão de fit na abertura.
- Corridas na colaboração, chunk do LLM com registry vazio, meta-testes dos gates de CI, paridade das opções ELK, correções antigas do FLOW.

### Bugs que os testes acharam na `main`, já corrigidos

| Bug | Commit |
|---|---|
| O Structura não reimportava o próprio export AWS para draw.io | `62ef6bfe` |
| Arquivo draw.io comprimido importava vazio (mais limite de 25 MB na descompressão) | `08d2cb06`, `dfbb8c9c` |
| Colar painel → painel → nó posicionava o nó longe | `2f18c1c2` |
| Criar ou duplicar uma versão não tinha undo | `d18046c7` |
| Mudar a ordem das camadas não tinha undo | `7bdb49de` |
| Auto-layout disparava com overlay aberto | `0ee04e78` |
| O highlight da aresta sumia ao clicá-la com um nó selecionado | `44c283e2` |
| Diagrama legado sem envelope não era migrado | `0ee7d603` |
| O editor não lembrava mais o último estilo de aresta (desde o #198) | `b5d9842b` |
| Mensagens de erro do assistente em português no `en.json` | `6f92f71a` |
| Editor e viewer desenhavam o card com alturas diferentes (desde o #245) | `34197df9` |
| O cliente da colaboração não validava os patches do relay | `176e2553` |

### Pendente

- Decisões: DC-064 (exports mortos em épicos), DC-071 (exclusão que falha na pasta conectada), RT-039 (a reconexão perde edições não confirmadas), DC-073 (a extensão VSCode ainda usa a cópia do ELK), RT-043 (export de flowchart Mermaid), DC-038 (arquivar 17 openspec changes), DC-033, DC-021 e DC-026.
- Backlog: RT-042, o `EmbedPreview.test.tsx` que falha com a máquina sobrecarregada.
- Sem verificação local: o typecheck e os testes do plugin opscr, que dependem do pacote privado `opscr` e só rodam no job do CI com `OPSCR_REPO_TOKEN`.

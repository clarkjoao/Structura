# Roteiro de verificação manual — Fase 4 do épico de seleção

Execute em **Chrome real** sobre o diagrama `diag_selection_test` no workspace. Tempo total: ~8 min por plataforma. Marque `ok?` por linha. Anote qualquer desvio no fim.

URL: `/model/diag_selection_test`. O diagrama tem `panel_big` com `child_1`/`child_2`, dois `standalone_*` soltos, e `standalone_offset` em (102, 703) — propositalmente fora da grade de 15 px.

---

## 0. Decisão #7 — menu do botão direito abre no SOLTAR (requisito nominal, bloqueia o merge)

> **Requisito, na palavra do dono do produto:** *"Só deveria abrir opções do botão direito quando soltar o botão direito. Se clicar e segurar, o usuário quer arrastar."*

**Este item não é mais um da lista de checagem: o merge depende dele.** Foi cobrado nominalmente, e é a única das nove decisões que passou a fase anterior sem nenhuma verificação de gesto — só leitura de código, que foi exatamente o que deixou o defeito passar.

O limiar é o mesmo da decisão #4: `DRAG_THRESHOLD_PX = 4`, medido em coordenada bruta do ponteiro.

**Como medir o "solta sem mover" de verdade:** aperte o botão direito e **segure por uns 2 segundos** antes de soltar. Se o menu aparecer enquanto o botão ainda está pressionado, a linha reprova — mesmo que ele também apareça depois. Um clique rápido não distingue press de release a olho nu.

### Matriz: 3 gestos × 4 alvos

| # | alvo | gesto | resultado esperado | ok? |
|---|---|---|---|---|
| 0.1 | **nó** (`standalone_1`) | aperta, segura 2 s, solta sem mover | menu do nó abre **só quando solta**; nada aparece durante o hold | [ ] |
| 0.2 | **nó** (`standalone_1`) | aperta, move 1–2 px, solta | menu do nó abre — tremor de mão não pode custar o menu | [ ] |
| 0.3 | **nó** (`standalone_1`) | aperta, move ~50 px, solta | menu **não** abre **e o viewport panoramiza** | [ ] |
| 0.4 | **corpo de painel** (interior vazio de `panel_big`) | aperta, segura 2 s, solta sem mover | menu do painel abre **só quando solta** | [ ] |
| 0.5 | **corpo de painel** | aperta, move 1–2 px, solta | menu do painel abre | [ ] |
| 0.6 | **corpo de painel** | aperta, move ~50 px, solta | menu **não** abre **e o viewport panoramiza** | [ ] |
| 0.7 | **cabeçalho de painel** (faixa do título de `panel_big`) | aperta, segura 2 s, solta sem mover | menu do painel abre **só quando solta** | [ ] |
| 0.8 | **cabeçalho de painel** | aperta, move 1–2 px, solta | menu do painel abre | [ ] |
| 0.9 | **cabeçalho de painel** | aperta, move ~50 px, solta | menu **não** abre **e o viewport panoramiza** | [ ] |
| 0.10 | **fundo do canvas** (pane vazia, sem nada selecionado) | aperta, segura 2 s, solta sem mover | o *quick insert* abre **só quando solta** | [ ] |
| 0.11 | **fundo do canvas** | aperta, move 1–2 px, solta | o *quick insert* abre | [ ] |
| 0.12 | **fundo do canvas** | aperta, move ~50 px, solta | quick insert **não** abre; o viewport **panoramiza** | [ ] |
| 0.13 | **trackpad** — clique direito é gesto de dois dedos e o tremor é maior | repita 0.1, 0.4, 0.7 e 0.10 no trackpad, sem mouse | menu abre nos quatro alvos; o tremor dos dois dedos **não** deve derrubar o menu. Se derrubar, o limiar de 4 px é curto demais para trackpad — anote o número de reprovações em 10 tentativas | [ ] |

### Notas de leitura desta seção

- **Pan por botão direito vale em qualquer lugar do canvas.** Nas linhas 0.3, 0.6 e 0.9 o viewport **deve** panoramizar junto — a regra anterior ("é gesto de pane, sobre nó não panoramiza") foi revogada pelo dono do produto e implementada. Se o menu ficar fechado mas o canvas não se mover, **reprove a linha**. Quem move o viewport muda com o alvo (o d3-zoom sobre a pane, o funil de ponteiro sobre nó e painel, porque o filtro do d3 recusa `.nopan`), mas isso é invisível para quem testa: o efeito é o mesmo.
- **Um detalhe assimétrico, conhecido e aceito:** o limiar de 4 px governa o pan sobre nó e painel, mas **não** sobre a pane — ali quem panoramiza é o d3-zoom, que não tem limiar, então 2 px de tremor movem o viewport 2 px. O requisito nominal é o menu, e esse vale nos cinco alvos. Não reporte o micro-pan da pane como defeito.
- **"Corpo de painel" é o interior vazio abaixo do cabeçalho**, e desde a correção de geometria esse ponto pertence de fato ao `.panel-body` (`397×272`, contra `397×0` antes). O botão direito ali continua sendo do painel: o encaminhamento do gesto para a pane vale só para o botão esquerdo, exatamente para não mexer nesta seção.
- **Plataforma importa e é o motivo do defeito original.** No macOS o evento `contextmenu` dispara no *mousedown*; no Windows e no Linux, depois do *mouseup*. Um menu preso ao `contextmenu` funciona no Linux e abre no aperto no mac. Por isso a matriz precisa rodar nas três plataformas, e por isso o hold de 2 segundos é obrigatório.

---

## 1. Demais itens da fase 4

| # | gesto | resultado esperado | ok? |
|---|---|---|---|
| 1 | **Travamento**: clique e arraste o cabeçalho de `panel_big` da esquerda para a direita em ~5 cm | painel move; cursor volta a `default` ao soltar | [ ] |
| 2 | **Travamento**: clique e arraste do **corpo** de `panel_big` em ~5 cm | painel **não** move; o retângulo de marquee aparece durante o gesto. Quanto ao que ele seleciona no fim, ver a ressalva abaixo da tabela | [ ] |
| 3 | **#4 limiar**: toque curto (≤3 px) em `standalone_1` | nó não se move, sem seleção acidental | [ ] |
| 4 | **#4 limiar**: arraste de ~4–5 px em `standalone_1` | nó se move (snapped para grade de 15 px) | [ ] |
| 5 | **#4 limiar**: toque curto em `standalone_offset` (fora da grade) | nó não se move — esta é a regressão que o commit `18af7ed` da `main` deixou passar | [ ] |
| 6 | **#1 body**: clique no **corpo** (vazio) de `panel_big` | painel **não** seleciona; clique no fundo (pane) limpa | [ ] |
| 7 | **#1 borda**: clique na faixa de 8 px dentro da borda de `panel_big`, nos **quatro** lados | painel seleciona nos quatro | [ ] |
| 7b | **#2 borda arrasta**: arraste o painel pegando pela faixa de 8 px | painel move, igual ao cabeçalho | [ ] |
| 8 | **#3 replace**: arraste `standalone_2` enquanto `standalone_1` está selecionado | seleção passa a ser **só** `standalone_2` | [ ] |
| 9 | **#3+#6 shift-add**: `Shift`+arraste `standalone_2` enquanto `standalone_1` está selecionado | ambos selecionados; arraste move os dois juntos | [ ] |
| 10 | **#5 esc**: durante um marquee ativo, pressione `Esc` | marquee cancela, seleção anterior preservada | [ ] |
| 11 | **#5 esc**: `Esc` sem gesto em andamento, com seleção ativa | seleção limpa | [ ] |
| 12 | **#9 marquee rect**: `Cmd+A`, depois clique em área vazia dentro do bbox da seleção (longe dos nós) | seleção limpa | [ ] |
| 13 | **pan por botão do meio**: arraste com botão do meio a partir da pane | viewport pan | [ ] |
| 14 | **pan por Space**: `Space` + arraste com botão esquerdo | viewport pan | [ ] |
| 15 | **#8 pan por botão direito**: arraste com botão direito a partir da **pane** | viewport pan (ver 0.12) | [ ] |
| 16 | **#8 pan sobre nó e painel**: arraste com botão direito a partir de um **nó**, do **cabeçalho**, da **borda** e do **interior** de um painel | viewport panoramiza nos quatro, igual à pane | [ ] |

### Ressalva no item 2 — o que o marquee seleciona depende da direção do arraste

O retângulo aparecer é o que o item 2 verifica, e isso é determinístico. **Já a seleção resultante varia com a direção do gesto**, e varia igual quando o marquee começa na pane — medido lado a lado, mesmo retângulo, mesma direção, resultado idêntico começando no corpo ou fora do painel. Não é comportamento desta fatia; está registrado como follow-up A em `selection-phase4-followups.md`. Se `child_1`/`child_2` não ficarem selecionados, **não reprove o item 2 por isso** — reprove só se o retângulo não aparecer ou se o painel se mover.

## Observações

(anote aqui qualquer desvio do resultado esperado)

## Plataformas verificadas

| plataforma | seção 0 (decisão #7) | seção 1 |
|---|---|---|
| macOS / Chrome | [ ] | [ ] |
| macOS / Safari | [ ] | [ ] |
| Windows / Chrome | [ ] | [ ] |
| Linux / Chrome | [ ] | [ ] |

## Itens não verificáveis neste harness

- **Travamento** (1, 2): não reproduzido em headless (sem compositor real). Confirmar em Chrome real é obrigatório antes de fechar a fatia como corrigida. A geometria e o marquee em si já foram medidos em Chrome real com ponteiro e com eventos espaçados; o que falta aqui é especificamente a sensação de travar/soltar com a mão.
- **Trackpad** (0.13, 3–5): arraste sintético não reproduz o tremor natural do dedo. Manual é onde isso se mede de verdade.
- **Menu de contexto por plataforma** (seção 0): o Cypress cobre as duas ordenações de `contextmenu` de forma sintética em `cypress/e2e/right-button-context-menu.cy.ts` — 3 gestos × 5 alvos × 2 ordenações. Isso trava a lógica, mas não substitui um mouse de verdade em cada SO.

## Comportamento explicitamente fora do escopo desta fatia

- Nenhum teste acima verifica reparenting, waypoints, modos foco/comparação/playback, ou troca de diagrama. Se a mutação afetar algum desses, ele vira `NÃO VERIFICADO`.

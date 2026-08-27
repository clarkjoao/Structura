# Fase 4 — follow-ups nomeados

Cole na descrição do PR.

Os follow-ups 1 e 2 **foram resolvidos** na sessão de geometria do painel; ficam registrados abaixo com o que se mediu antes e depois, porque a forma do defeito (teste verde sobre um caminho que o usuário não percorre) é o que precisa não se repetir. O que continua em aberto está na seção "Ainda abertos".

---

## Follow-up 1 — RESOLVIDO — `.panel-body` não era alcançável; a decisão #1 não valia para um ponteiro real

**Como estava**, medido em Chrome real sobre `diag_selection_test` com uma grade de 7×8 pontos e `document.elementFromPoint`:

| pergunta | antes | agora |
|---|---|---|
| Quem recebe o clique no interior do painel? | `.panel-border`, em **todos** os pontos abaixo do cabeçalho | `.panel-body` |
| Caixa do `.panel-body` | `397×0` — altura zero, nunca atingido | `397×272` |
| Caixa do `.panel-border` | `397×317` — o painel inteiro (`absolute inset-0`) | quatro faixas: `397×6`, `397×6`, `6×317`, `6×317` |
| Clique no interior seleciona o painel? | **Sim** — a decisão #1 não se sustentava | Não |
| Clique no interior limpa a seleção? | Não | **Sim** |
| Arraste do interior desenha marquee? | Não — 0 frames num arraste de 330×240 px | Sim — 12 frames, retângulo final medido |
| Arraste pela borda move o painel? | Não | Sim |

**A causa era geométrica em dois lugares ao mesmo tempo:** `.panel-border` era `absolute inset-0` (o "anel de 8 px" era só um `border-width`, e a caixa que recebe o ponteiro é a caixa inteira do div), e `.panel-body` era um filho sem altura dentro de um container que não era flex. Hoje o anel são quatro faixas absolutas de `PANEL_BORDER_HIT_PX`, e o corpo é `flex-1` num container `flex flex-col`.

**Alvo de clique vs. traço desenhado:** o traço continua em 2 px; o alvo do anel é 8 px medidos para dentro, em unidades de nó (portanto 6,4 px de tela a zoom 0,8). A escolha está justificada no docblock de `PANEL_BORDER_HIT_PX` — a 2 px, "pegar o painel pela borda" é caça ao pixel, que é a mesma classe de problema da queixa original.

---

## Follow-up 2 — RESOLVIDO — a cobertura não distinguia qual mecanismo segurava o comportamento

Agora distingue, e a resposta foi medida, não deduzida:

- **O que impede o interior de selecionar** é o `stopPropagation` do `onClick` do `.panel-body`. Não é a geometria: com a geometria corrigida e esse handler removido, um clique real no interior com nada selecionado **selecionava** `panel_big`. Ele deixou de ser peso morto e passou a ser o mecanismo; a mutação que o remove derruba 2 testes.
- **O que impede o interior de mover o painel** é o `dragHandle` no descriptor, hoje `".panel-header, .panel-border"`.
- **O que faz o interior limpar a seleção** é `onBackgroundClick` no funil de ponteiro — porque com `selectionOnDrag` ligado o React Flow não dá `onClick` nenhum à pane e roteia o clique de pane pelo `onPointerUp` com `event.target === container.current`, condição que uma soltura sobre o corpo do painel nunca satisfaz.
- **O que faz o interior desenhar marquee** é o encaminhamento do `pointerdown` de botão esquerdo do `.panel-body` para a `.react-flow__pane`, pelo mesmo motivo acima.

Os testes de painel foram reescritos sobre coordenadas reais e **nenhum usa `force: true`**; ver `cypress/e2e/panel-hit-geometry.cy.ts`.

---

## Follow-up 3 — RESOLVIDO — decisão #8 revogada: pan por botão direito vale sobre nó e painel

A regra anterior era "pan por botão direito é gesto de pane", registrada no `Canvas.tsx`, no `pointerFunnel.ts`, no roteiro manual e em **oito `it.skip`** de `right-button-context-menu.cy.ts`. O dono do produto revogou. Os oito testes foram reativados e são o critério de aceite; a spec passou de 40 casos com 8 pendentes para **50 casos, nenhum pendente**.

**Mecanismo escolhido: o funil conduz o pan, e só onde o d3 recusa.** A rota alternativa — fazer o d3 aceitar o gesto — não é escopável por botão: o filtro do React Flow (`createFilter`, em `@xyflow/system`) testa `event.target.closest('.nopan')` de forma incondicional para todo evento que não seja de roda, e o único prop que chega ali, `noPanClassName`, é global. Renomear a classe reabilitaria o pan por cima de campos de texto, sliders e da barra de ações rápidas dentro de nós. Vale notar que o próprio React Flow resolve o caso análogo do mesmo jeito, com um early-return hardcoded para o **botão do meio** sobre nós e arestas; simplesmente não existe equivalente para o direito.

**Como os dois caminhos não brigam:** quem panoramiza é decidido uma única vez, no `pointerdown`, por `funnelOwnsPan = button === 2 && dentro de .nopan`. Fora de `.nopan` o funil não toca no viewport; dentro, o d3 já recusou. Nunca há dois donos no mesmo gesto — que era exatamente a objeção que sustentava a decisão antiga.

Medido em Chrome real, no build de produção, arrasto de 120 px com o botão direito:

| alvo | menu no press | menu ao soltar | viewport |
|---|---|---|---|
| nó | nenhum | nenhum | `translate(0px, 0px)` → `translate(120px, 0px)` |
| cabeçalho de painel | nenhum | nenhum | `translate(0px, 0px)` → `translate(120px, 0px)` |
| interior de painel | nenhum | nenhum | `translate(0px, 0px)` → `translate(120px, 0px)` |
| borda de painel | nenhum | nenhum | `translate(0px, 0px)` → `translate(120px, 0px)` |
| pane (controle) | nenhum | nenhum | `translate(0px, 0px)` → `translate(120px, 0px)` |

---

## Ainda abertos

### A — marquee iniciado no interior seleciona menos que o mesmo retângulo iniciado na pane, dependendo da direção

Medido em Chrome real, com o mesmo retângulo e a mesma geometria:

| gesto | seleção resultante |
|---|---|
| pane, canto superior-direito → inferior-esquerdo | `child_1 child_2 panel_big` |
| pane, canto inferior-direito → superior-esquerdo | `panel_big` |
| corpo, canto inferior-esquerdo → superior-direito | `panel_big` |
| corpo, canto superior-direito → inferior-esquerdo | `child_2 panel_big` |

**Não é regressão desta fatia e não é específico do corpo do painel:** o controle mostra que um marquee iniciado na pane, com a mesma direção, dá exatamente o mesmo resultado. A variável é a direção do gesto, não a origem. Fica registrado porque o item 2 do roteiro manual espera `child_1`/`child_2` selecionados e, dependendo da direção do arraste do avaliador, pode não ser o que ele vê.

### D — o limiar de 4 px governa o pan sobre nó e painel, mas não sobre a pane

Medido nos dois lugares: um arrasto de botão direito de 2 px sobre nó ou painel **não** move o viewport (o funil aplica o mesmo limiar da decisão #4), enquanto sobre a pane move exatamente 2 px, porque ali quem panoramiza é o d3-zoom e ele não tem limiar nenhum.

É anterior a esta fatia e não é o requisito — o que o dono do produto pediu é o menu, e esse se comporta igual nos cinco alvos. Alinhar o d3 exigiria interceptar também o pan da pane, ou seja, criar o segundo caminho de pan que a implementação existe para evitar. Os dois sentidos estão travados em teste (`limiarGovernaOPan` em `right-button-context-menu.cy.ts`) para a assimetria não virar surpresa.

### B — o teste de Shift percorre o caminho do React Flow em vez do funil

Inalterado desde a fatia anterior.

### C — `stress-panels-interaction`: 4 falhas, pré-existentes

`multi-select with Ctrl/Meta` e `fit view` / `zoom controls`. As duas primeiras falham porque, com um nó selecionado, o React Flow monta um `.react-flow__node-toolbar` que **repete o `data-id` do nó**, e `cy.getNode(id).click()` passa a ter 2 elementos no subject. Verificado que não vem desta fatia: com todas as mudanças desta sessão revertidas, as mesmas 4 falham. O relatório de 26/08 registra 2 falhas (só `fit view` e `zoom`), então as outras duas entraram entre 26/08 e o início desta sessão. Correção provável: `cy.getNode` filtrar por `.react-flow__node`.

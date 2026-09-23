# Paridade editor × viewer: a caixa do nó

Continuação de [`divergencia-edicao-visualizacao.md`](./divergencia-edicao-visualizacao.md), que
mapeou quatro divergências de **projeção**. Esta sessão achou uma quinta que não está lá, e que é
de outra natureza — com correção aplicada.

Marcação igual à do doc anterior: **MEDIDO** (medido no browser nesta sessão), **LIDO NO CÓDIGO**
(com `arquivo:linha` aberto nesta sessão), **HIPÓTESE** (não verificada).

---

## 0. Resumo

1. **A quinta divergência não está na projeção nem no render: está na _medida_.** Um card é
   dimensionado pelo conteúdo, e as duas superfícies não renderizam o mesmo conteúdo. O leitor zera
   `services` e `allDiagrams` (**LIDO NO CÓDIGO**: `core/buildReadNodeContext.ts:60-62`), então o
   chip de serviço e a linha "explore inside" somem. **MEDIDO** em `d-pl-ct-hub`: o card
   `pl-hub-cob-api` tem 173,5px no editor e 103,5px no viewer. Mesmo componente, mesma projeção,
   mesmo `buildData` — 70px de diferença.
2. **Isso invalida toda a geometria persistida.** O autolayout ancora cada waypoint em
   `(slot + 1) / (count + 1)` da altura que entregou ao ELK (`layout/renderedEdgePath.ts`,
   `handleAnchor`). Com o card 70px mais baixo, todo handle cai fora do corredor. **MEDIDO**: no
   viewer, 5 de 20 edges chegavam com desvio de 15 a 47px, terminando em perna vertical — o
   `marker-end` com `orient="auto"` pega o ângulo do último segmento, então a seta aponta para
   cima, para fora do nó.
3. **O teste de paridade proposto no §5.2 do doc anterior não pegaria isto.** Ele compara as duas
   projeções em "posição, tamanho, z e dados de geometria", e as duas projeções produzem **nós
   idênticos** — nenhuma delas carrega tamanho para um card. A divergência só existe depois do
   DOM. Paridade tem de ser medida no que foi renderizado, não no que foi projetado.
4. **Correção aplicada:** o card passa a carregar `laidOutMinHeight` — a altura que o autolayout
   mediu — e a aplicar como `minHeight` no próprio card. **MEDIDO depois:** 0 nós com altura
   divergente, e as 20 edges com `d` idêntico entre `/model/:id` e `/viewer?diagramId=:id`, pior
   delta 0,0002px (ruído de float).

---

## 1. A causa, em uma frase

> O autolayout grava coordenadas **absolutas**; elas só valem se toda superfície reproduzir a mesma
> caixa. A caixa do card era **emergente do conteúdo**, e o conteúdo depende de contexto que só o
> editor tem.

Nota e swimlane nunca tiveram o problema porque **declaram** o tamanho
(`note.element.ts:70-78`, `panel.element.ts:65-71`: `width/height` vindos de
`ctx.resolvedNodeLayouts`, com o componente usando `w-full h-full`). **MEDIDO**: nota 475 = 475,
painel 1172 = 1172, nos dois modos. O card era o único que não declarava — e era o único que
divergia.

### Por que `minHeight` e não `height`

A store **nunca** carrega `measured` (`hooks/useLocalNodes.ts:76-89`): a altura de um card em
`nodeLayouts` vem da semente ou do ELK, não de medição contínua. Fixar `height` cortaria conteúdo
quando a entrada estivesse velha. `minHeight` faz o piso valer e deixa o card crescer.

### Por que no card e não no wrapper do React Flow

Primeira tentativa foi pelo `buildStyle`, como nota e painel fazem. **MEDIDO**: o wrapper foi a
174px e os handles **continuaram** em 1023,83 / 1057,66 — o card interno seguiu com 103,5 e os
handles são posicionados contra ele, não contra o wrapper. Piso no wrapper estica a caixa e deixa
os handles amontoados na altura velha. Por isso `laidOutMinHeight` vai pelo `data`, no elemento que
os handles enxergam.

---

## 2. A classe do bug, para não repetir

O doc anterior lista `descriptor.buildData` / `buildStyle` em **§4.1 "Já compartilhado (não
mexer)"**. Está certo sobre a função e errado sobre a garantia: a função é a mesma, **a entrada
não é**. `NodeBuildContext` tem campos que o leitor zera de propósito, e qualquer um deles que
chegue ao tamanho do nó vira divergência silenciosa.

Vale a pena acrescentar uma linha à tabela do §4.2:

| responsabilidade | editor | leitor |
|---|---|---|
| contexto de conteúdo do nó | catálogo real (`services`, `allDiagrams`) | `{}` (`buildReadNodeContext`) |

E uma regra, que é o que fecha a classe inteira:

> **Nada que o layout mede pode ser emergente.** Se o autolayout ancora geometria numa dimensão,
> essa dimensão é declarada pelo dado, não deduzida do conteúdo. Um `buildData` pode mudar o que o
> nó **mostra** conforme a superfície; nunca o quanto ele **ocupa**.

---

## 3. Três guardas, da mais barata para a mais cara

### 3.1 Teste de paridade renderizada — **FEITO**

Está em `cypress/e2e/editor-viewer-render-parity.cy.ts`.

**Provado que falha**, uma mutação por vez: sem o piso do card, o seed mede
`cmp_linked: editor 260x173.5 vs viewer 260x103.5` e 3 dos 4 testes reprovam; com `buildStepPath`
de volta ao `H x V y`, o quarto reprova com `ends on a vertical: (698, 290.664) -> (698, 290)`.

O desenho original segue abaixo, porque a forma importa mais que o arquivo.

O script desta sessão já é o teste. Em Cypress, que o repo já usa para stress:

1. abrir `/model/:id`, coletar de cada `.react-flow__edge-path` o `d`, e de cada
   `.react-flow__node` a caixa e o z;
2. abrir `/viewer?diagramId=:id` e coletar igual;
3. comparar número a número com tolerância de 0,01px.

Pega esta divergência, as quatro do doc anterior, e qualquer futura — porque compara a figura, não
a intenção. É o único teste que teria falhado antes desta correção.

**Cuidado medido:** a comparação tem de ser numérica com tolerância, não de string. As duas
superfícies diferem por ruído de float (`2566.4998807335314` × `2566.5`) e uma comparação exata
reprova 20 de 20 edges que estão visualmente idênticas.

### 3.2 Tornar o contexto do leitor explícito

`buildReadNodeContext` devolve `services: {}, allDiagrams: {}` sem dizer que é uma decisão. Um tipo
que nomeie o que o leitor não tem — e um comentário apontando para esta regra — transforma "campo
vazio" em "capacidade ausente", que é o que ele é.

### 3.3 Virar o invariante da seta em estrutura — **FEITO**

A primeira versão desta correção foi o `snapTerminalCorners`: grudar o canto terminal no handle
quando o desvio fosse menor que 2px. Era um remendo — escolhia uma tolerância, e não tinha resposta
para desvio maior.

A versão estrutural está em `buildStepPath` (`edges/geometry/orthogonal.ts`): a perna que chega ao
alvo emite `V y H x` em vez de `H x V y`, ou seja, **vira antes de chegar**. Assim o último segmento
é horizontal por construção, em qualquer desvio, sem tolerância e sem dado nenhum. O
`snapTerminalCorners` foi removido.

**Por que isso não muda desenho nenhum:** numa rota ortogonal bem formada o último canto compartilha
exatamente um eixo com o alvo — `computeCornerDrag` trava o canto vizinho do alvo justamente para o
segmento final não sair diagonal. Com um eixo compartilhado, um dos dois comandos é no-op de
qualquer jeito. **MEDIDO**: em 800 rotas bem formadas geradas, a polilinha antiga e a nova são
idênticas em 100%; só divergem onde a rota **não** é bem formada, que é o caso que interessa. É por
isso que as baselines de `layoutReadability` não se mexeram (`C4 Context healthcare crossings 5`,
igual antes e depois).

`stepPolyline` (`layout/renderedEdgePath.ts`) espelha a mudança, como o próprio teste dela exige.

### 3.4 Parar de gravar Y absoluto no waypoint

A correção mais profunda, e a mais cara — e a única que apagaria também o `laidOutMinHeight`. Hoje
`edgeLayouts[].points` guarda coordenada absoluta, que embute a altura do nó no momento do layout.
Se o waypoint guardasse o corredor mais a referência de handle, resolvendo o Y no desenho, nenhuma
superfície poderia errar. Encaixa na fatia 6 do §5.2 do doc anterior ("edge sem store"), que já mexe
nessa camada.

**Custo medido:** `edgeLayouts` é lido ou escrito por **42 arquivos**, incluindo
`collaboration/utils/snapshotChecksum.ts`, `collaboration/hooks/useCollabStoreSync.ts`,
`store/persist.config.ts` e `store/slices/history.slice.ts` — é migração de schema com colaboração
em cima, não um refactor local.

---

## 3.5 O dado ausente, resolvido (2026-09-22)

O §3.2 pedia tornar o contexto do leitor explícito. Foi feito como **dado**, não como política:

- `ReaderCatalog` (`diagram/utils/reader-catalog.ts`): só os **nomes** de serviço e diagrama linkado que
  o diagrama referencia. `NodeBuildContext.services`/`allDiagrams` foram estreitados para `{ name }`, de
  modo que nenhum nó possa ler do workspace algo que o leitor não tem.
- O link carrega o catálogo (`readerCatalog`, ao lado do diagrama no payload de `#data=` e `#share=`), e
  o decoder o tira antes de qualquer importação chegar ao store. Leitores na máquina do autor
  (`?diagramId`, arquivo, walkthrough) montam o catálogo do próprio store.
- A linha "explore inside" é desenhada sempre que o card aponta para um diagrama, e só é **botão** onde
  há para onde ir. No leitor ela fica, sem ação: faz parte da caixa.

**MEDIDO** pelo spec novo, antes das correções: `pl-risk-api` tinha **260px de largura no editor e
252,9 no leitor** — a largura também é emergente, e o piso de altura não a cobria. Depois: igual.

Duas causas a mais apareceram, as duas do **editor** divergindo do próprio store:

- `useNodeDragParenting` gravava a medida do React Flow de volta no layout. A medida vem de
  `offsetWidth/offsetHeight`, que são inteiros: um painel de 933,333 virava 933 no store enquanto o
  canvas continuava desenhando 933,333. **MEDIDO** (stack capturada no dev server). Agora uma
  re-medida a menos de 1px do valor salvo, fora de um resize do usuário, não é gravada.
- `PanelStyleSection` fazia a mesma coisa pelo inspetor (auto-commit do valor arredondado sem o usuário
  digitar). **Não era a causa medida acima** — foi achado no caminho, provado por teste e corrigido.

## 4. Não verificado

- Só `?diagramId` foi medido. `#data=` (link compartilhado) e `?source=file` usam o mesmo
  `ViewerCanvas`/`projectReadDiagram`, então a correção deve valer igual — **HIPÓTESE**, não aberta
  no browser. O payload de `#data=` precisa carregar `nodeLayouts` com `height` para o piso existir.
- Diagramas cujos cards **não** têm `height` em `nodeLayouts`: sem piso, a divergência volta. Não
  medi quantos diagramas estão nessa situação, nem o que `fromDiagram` entrega ao ELK nesse caso.
- Modo comparação foi excluído do piso por decisão (duas revisões do mesmo card), não por medição.
- `ApiGroupNode`, `DbTableNode`, `JsonViewerNode`, `ProcessNode` e `SvgNode` não foram medidos;
  a mesma pergunta vale para cada um que seja dimensionado por conteúdo.

---

## 5. Como foi medido

- `vite` já rodando na 8080 (sessão do usuário), uma aba Playwright em perfil isolado.
- Por superfície, o mesmo script lê de cada `.react-flow__edge-path` o `d` e a direção do último
  segmento via `getPointAtLength(len - 1) → getPointAtLength(len)`, e de cada `.react-flow__node` a
  caixa em coordenadas de flow (dividindo pelo zoom lido do `transform` do `.react-flow__viewport`).
- Alturas comparadas contra `nodeLayouts` lido do `localStorage` (`structura_diagram-store`).
- As duas superfícies foram abertas na mesma aba, em sequência, e os `d` comparados por script.

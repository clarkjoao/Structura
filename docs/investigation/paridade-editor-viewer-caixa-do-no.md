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

### 3.1 Teste de paridade renderizada (recomendado, cobre as cinco divergências)

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

### 3.3 Parar de gravar Y absoluto no waypoint

A correção mais profunda, e a mais cara. Hoje `edgeLayouts[].points` guarda coordenada absoluta,
que embute a altura do nó no momento do layout. Se o waypoint guardasse o corredor mais a
referência de handle, resolvendo o Y no desenho, nenhuma superfície poderia errar, e o
`snapTerminalCorners` (`edges/geometry/orthogonal.ts`) — que hoje absorve o arredondamento de
sub-pixel do ELK — deixaria de ser necessário. Encaixa na fatia 6 do §5.2 do doc anterior
("edge sem store"), que já mexe nessa camada.

---

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

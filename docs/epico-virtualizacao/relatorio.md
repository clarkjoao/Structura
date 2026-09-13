# Épico de virtualização do canvas — relatório

Sessão de 2026-09-13. Branch `perf/canvas-virtualization`, base `c4b2f3a`.

Toda afirmação está marcada **MEDIDO**, **LIDO NO CÓDIGO** ou **HIPÓTESE**. Todo
`arquivo:linha` citado foi aberto nesta sessão. Todas as medições de tempo são build de
produção (`npm run build` + `vite preview --port 8199 --strictPort`), 7 repetições
independentes salvo onde indicado, reportadas como mediana (mín–máx).

---

## 1. Resultado em cinco linhas

1. **MEDIDO:** M2 (1.000 nós) já faz **5,4 ms de JS por quadro de arraste** na `main` atual,
   contra a meta de ≤16 ms — a virtualização não é necessária para o alvo do épico.
2. Pela regra do item 0 (“se o JS por quadro já estiver ≤16 ms, documente e encerre o
   épico”), **os itens 1–4 não foram executados**: nenhuma worktree, nenhuma flag,
   `onlyRenderVisibleElements` nunca foi ligado. Não há threshold a reportar.
3. **Os números da premissa do épico não reproduzem**: 9,8 ms (G) e 204 ms / 20,7 s (XG)
   são snapshots do *meio* da sessão anterior; o estado final daquela branch era 3,3 ms e
   39,5 ms / 15,6 s. Hoje medi 2,8 ms (G) e 32,1 ms / 14,2 s (XG). Nada regrediu.
4. **MEDIDO, e é o achado que importa:** soltar o mouse depois de arrastar **um** nó
   satura a thread principal por **~25 s** a partir de **~600 nós** (400 nós: 338 ms). Em
   uma repetição de cada três em 1.000 nós o laço passou de 120 s **sem salvar o diagrama**.
5. **Em aberto:** o que fazer com esse laço (decisão 1), e se o dono ainda quer a sondagem
   de virtualização para XG (decisão 2). Nenhum código de produção foi alterado nesta sessão.

---

## 2. Precondições

| Item | Valor |
|---|---|
| Commit base | `c4b2f3a` (main) |
| `git rev-list --left-right --count origin/main...HEAD` | `0  0` |
| `git status --porcelain` inicial | vazio |
| Branch criada | `perf/canvas-virtualization` |
| `lsof -i :8080 -sTCP:LISTEN` no início | vazio — ninguém escutando |
| Porta usada | 8199 (`--strictPort`), PID pai 46352, filho 46372 |
| Arquivos encenados de terceiros | nenhum encontrado |

### Portões (build de produção, antes de qualquer mudança)

| Portão | Exit code | Observação |
|---|---|---|
| `npm run typecheck` | **0** | roda dentro de `npm run build` |
| `npm run build` | **0** | |
| `npm test` | 9 falhas / 1.884 passes, 3 arquivos | dentro da faixa herdada de 8–10 |

Os 3 arquivos que falham são exatamente os herdados:
`src/lib/share-url/share-url.test.ts`, `src/lib/diagram-url.flow.test.ts`,
`src/features/viewer/viewer-opens-on-base.test.ts`. Nenhuma falha nova. Nenhum arquivo de
`src/` foi tocado nesta sessão, então `npx prettier --check` se aplica apenas a este
relatório.

---

## 3. Baseline — item 0

### Fixtures

| Fixture | Nós | Painéis | Níveis | Arestas | Arestas no DOM |
|---|---|---|---|---|---|
| G | 400 | 18 | 3 (`[3,6,9]`) | 550 | 439 |
| **M2 (criado nesta sessão)** | **1.000** | **12** | **2 (`[4,8]`)** | **1.300** | **1.058** |
| XG | 5.000 | 47 | 3 (`[5,12,30]`) | 6.500 | 5.198 |

M2 veio de `~/structura-scratch/virtualizacao/make-fixtures-m2.mjs`: cópia de
`make-fixtures.mjs` com a mesma semente `20260911` e a mesma função geradora, só a spec
`M2` acrescentada. Geração verificada determinística (md5 idêntico em duas execuções). G e
XG conferidos por md5 antes e depois — intactos. Os originais não foram editados.

### Resultados (MEDIDO, 7 repetições)

| Métrica | G (400) | M2 (1.000) | XG (5.000) |
|---|---|---|---|
| Boot até o primeiro nó no DOM | 2.091 ms (2.036–2.144) | 3.316 ms (3.213–3.553) | 14.228 ms (13.684–14.753) |
| **JS por quadro de arraste** | **2,8 ms** (2,8–3,1) | **5,4 ms** (5,1–5,6) | **32,1 ms** (29,1–145,0) |
| Mutações de DOM na fase de movimento | 229 | 7.174 | 34.531 (máx 112.387) |
| Nós com `transform` alterado no movimento | 1 | 1 | 1 (máx 3.010) |
| Long tasks no commit (janela de 2,5 s) | 338 ms (331–356) | 3.209 ms (2.391–3.320) | 5.138 ms (4.938–6.980) |
| Long tasks no commit (**até o silêncio**) | **338 ms / 2 tasks** | **23.164 ms / 60 tasks** | não medido |
| Alteração da store fora do arraste | 360 ms (344–376) | 0 ms | 0 ms |
| `.react-flow__node` no DOM | 400 | 1.000 | 5.000 |

Duas ressalvas honestas:

- O máximo de XG (145 ms/quadro, 3.010 nós com `transform` alterado) é uma repetição em que
  o seletor de alvo do harness herdado agarrou um painel em vez de uma folha, arrastando os
  filhos junto. A sessão anterior registrou o mesmo efeito. A mediana representa o gesto de
  nó único.
- A métrica “alteração da store fora do arraste” usa `ArrowRight` sobre o nó selecionado, e
  não “renomear um componente” como o enunciado pede. Mantive o gesto do harness herdado
  para preservar a comparabilidade com a linha de base da sessão anterior.

### Veredito do item 0

**M2 está em 5,4 ms, a meta era ≤16 ms.** A regra do épico manda documentar e encerrar, e é
o que foi feito. **XG não piorou** (32,1 ms e 14,2 s contra 39,5 ms e 15,6 s do estado final
da sessão anterior), então nenhuma condição de parada da seção 5 foi acionada por esse lado.

---

## 4. Probe de virtualização — item 1

**NÃO EXECUTADO**, por decisão do próprio enunciado do item 0. Nenhuma worktree foi criada,
`onlyRenderVisibleElements` nunca foi ligado, e as cinco perguntas do item 1 permanecem sem
resposta. Elas estão relistadas na decisão 2 para o caso de o dono querer a sondagem assim
mesmo, mirando XG em vez de M2.

## 5. Threshold e flag — item 2

**NÃO EXECUTADO.** Sem os dados do item 1 não há threshold medido, e implementar
`canvas.render.virtualize` seria construir a solução de um problema que a medição não
encontrou. `canvas.constants.ts` não foi tocado e nenhum teste foi escrito.

## 6. Matriz de interações — item 3

**NÃO EXECUTADA** (V1–V10 dependem da virtualização ativa).

## 7. Medição final — item 4

**NÃO APLICÁVEL**: não houve mudança de código, então “antes” e “depois” seriam a mesma
tabela da seção 3. O critério de saída do épico está assim contra a `main` atual, sem
nenhuma alteração:

| Fixture | Meta de JS/quadro | Medido | Meta de boot | Medido | Situação |
|---|---|---|---|---|---|
| G (400) | ≤9,8 ms | **2,8 ms** | ≤2,4 s | **2,09 s** | atingido |
| M2 (1.000) | **≤16 ms** | **5,4 ms** | ≤8 s | **3,32 s** | **atingido** |
| XG (5.000) | sem meta | 32,1 ms | ≤25 s | **14,2 s** | atingido |

---

## 8. O achado não previsto — o commit do arraste entra em laço a partir de ~600 nós

O arraste é fluido. O **commit** do arraste não é.

### Sintoma (MEDIDO, 7 repetições, variação < 1 %)

| Fixture | Nós | Long tasks no commit até o silêncio | Nº de tasks | Parede |
|---|---|---|---|---|
| G | 400 | 338 ms (331–343) | 2 | 1,55 s |
| M2 | 1.000 | **23.164 ms** (23.006–23.247) | **60** | **25,4 s** |

`reparented: false` em todas as repetições — o nó não muda de pai, então não é churn de
reparent.

### Mecanismo (MEDIDO, instrumentando `Storage.prototype.setItem`)

| Fixture | Escritas de `structura:recentDiagrams` no commit | Período |
|---|---|---|
| G (400) | **1** | — |
| M2 (1.000) | **27–29**, e numa repetição **144** | ~830 ms |

Em G a chave é escrita uma vez e acabou. Em M2 ela é reescrita em laço até que a
persistência da store consiga rodar. **Em uma repetição de cada três, isso não aconteceu**:
o laço passou de 120 s (meu teto de medição) com 144 escritas e **nenhuma** escrita de
`structura_diagram-store` — ou seja, o arraste não foi salvo enquanto o laço durou.

### Onde começa (MEDIDO — varredura com tudo constante menos o número de nós)

Família de fixtures idêntica (`panelSpec [4,8]`, `mixed`, `waypointRatio 0.2`,
arestas = 1,3 × nós); só o número de nós varia:

| Nós | Escritas de `recentDiagrams` | Período do ciclo | Parede do commit |
|---|---|---|---|
| 400 | **1** | — | 1,21 s |
| 600 | **54–55** | ~470 ms | 26,3 s |
| 800 | **39–40** | ~640 ms | 25,8 s |
| 1.000 | **27–29** (uma rep.: 144) | ~830 ms | 24,5 s / 120 s+ |

**O degrau está entre 400 e 600 nós** — bem abaixo do alvo de 1.000 deste épico. O período
do ciclo cresce com o número de nós (470 → 640 → 830 ms), isto é, é o custo de um render
completo.

### Controles (MEDIDO)

- **Ocioso, sem gesto nenhum, 20 s**, em M2 e em G: 0 long tasks e 0 escritas de
  `recentDiagrams`. O laço não existe em repouso — é o gesto que o dispara.
- A medição “até o silêncio” (23,2 s / 60 long tasks) foi feita **sem** instrumentar
  `setItem`. O laço não é artefato da instrumentação.

### Suspeito (LIDO NO CÓDIGO)

`src/features/canvas/hooks/useCanvasDiagramNavigation.ts:89-92`:

```ts
const { recordOpened } = useRecentDiagrams();

useEffect(() => {
  if (diagram) recordOpened(diagram.id);
}, [diagram, recordOpened]);
```

O efeito depende do **objeto** `diagram` inteiro, não de `diagram.id`. Qualquer mutação da
store que produza um novo objeto de diagrama refaz o efeito, que chama `recordOpened`, que
em `src/features/canvas/navigation/useRecentDiagrams.ts:12-18` faz `setRecent` com um array
sempre novo (`appendRecentRef`, em
`src/features/diagram/utils/recent-diagrams.ts:32-34`, carimba `openedAt: Date.now()`) e
escreve no localStorage — provocando novo render.

**HIPÓTESE, não provada nesta sessão:** o ciclo converge quando um render completo cabe
dentro de alguma janela de debounce (~400–450 ms, pelo degrau medido entre 400 e 600 nós) e
diverge quando não cabe; o período medido em 600 nós (~470 ms) fica logo acima disso.
Provar exige profile com source maps em build de desenvolvimento — o profile de produção é
minificado e atribui 42 % do tempo a `(program)`. Fora `(program)` e o coletor de lixo
(4–6 %), o profile nomeia `_compress` / `compressToEncodedURIComponent` (lz-string, ~1 s, a
geração do preview), `toResolveHierarchy`, `formatLanguageCode` e funções de
`useTranslation` (~1 s somadas).

**Não corrigi nada disso.** Corrigir está fora do escopo declarado deste épico e a causa
exata ainda é hipótese.

---

## 9. DECISÕES DO DONO

**Decisão 1 — o laço do commit (a partir de ~600 nós).**
É um defeito de usabilidade grave e abaixo do alvo deste épico; em ~1/3 das repetições em
1.000 nós o diagrama fica sem salvar enquanto o laço dura.

- (a) Abrir um épico próprio: provar a causa com profile source-mapped e corrigir a
  dependência do efeito. Consequência: é o caminho que ataca o que o usuário sente hoje; não
  entrega nada nesta sessão.
- (b) Correção mínima já, sem épico: trocar a dependência de `diagram` por `diagram.id` em
  `useCanvasDiagramNavigation.ts:92` e medir de novo. Consequência: barato e provavelmente
  eficaz, mas seria eu mexendo em código de produção com a causa ainda em hipótese, e o
  enunciado desta sessão não autorizou mudança de código fora dos itens 1–4.
- (c) Deixar como está. Consequência: quem passa de ~600 nós encontra congelamento de ~25 s
  a cada arraste, às vezes sem salvar.

**Decisão 2 — a sondagem de virtualização ainda interessa?**
O épico alvejava M2, e M2 já passa. Sobra XG (5.000 nós) a 32,1 ms/quadro (~31 fps).

- (a) Não sondar. Consequência: `onlyRenderVisibleElements` fica sem dado; 5.000 nós seguem
  em ~31 fps, que o épico declarou explicitamente sem meta de arraste.
- (b) Sondar mirando XG, respondendo as cinco perguntas do item 1 e a matriz V1–V10.
  Consequência: custo de uma sessão; pode render uma flag útil para diagramas muito grandes,
  mas nada para a faixa de 1.000 que este épico definiu como alvo.

**Decisão 3 — o aviso acima de 1.200 nós, já previsto como feature futura.**
A medição sugere que o número certo talvez não seja 1.200. O degrau real de usabilidade que
encontrei está em ~600 nós, e é o do laço do commit, não o do arraste.

- (a) Manter 1.200 e tratar o laço como bug separado.
- (b) Rever o limiar do aviso depois de resolver a decisão 1, já que corrigir o laço pode
  mover o degrau para muito além de 1.200.

---

## 10. Correções de números herdados

| Número herdado (enunciado) | O que medi hoje | Explicação |
|---|---|---|
| G: **9,8 ms**/quadro | **2,8 ms** | 9,8 ms é `m2-head-G.json` (“HEAD perf/canvas-node-pipeline”), snapshot do meio da sessão anterior. O estado final daquela branch foi **3,3 ms** (`m2-final-head-G.json`, e a própria tabela final do relatório anterior, linha 482: “10,9 → 3,3 ms (−70 %)”). Os 2,8 ms de hoje são consistentes com 3,3 ms. |
| XG: **204 ms**/quadro | **32,1 ms** | 204,6 ms é `m2-head-XG.json`, também do meio da sessão. O final foi **39,5 ms** (`m2-final-head-XG.json`, linha 506 do relatório anterior). |
| XG: boot **20,7 s** | **14,2 s** | 20,7 s é do mesmo snapshot intermediário; o final foi 15,6 s. |
| “400→5.000 faz o JS/quadro ir de 9,8 ms para 204 ms (21×)” | 2,8 → 32,1 ms (**11,5×**) | A superlinearidade existe, mas é metade da que a premissa descreve. |

Em resumo: a premissa do épico foi montada sobre as seções iniciais do relatório anterior,
antes de dois defeitos que aquela mesma sessão ainda corrigiu. Nada regrediu entre aquela
branch e a `main` de hoje.

---

## 11. NÃO VERIFICADO

- As cinco perguntas do item 1 e toda a matriz V1–V10 (item 3): dependem de ligar a
  virtualização, o que o item 0 mandou não fazer.
- O custo de entrada de um nó no viewport, o comportamento de painéis parcialmente visíveis
  e o zoom out total sob virtualização.
- A causa exata do laço do commit: localizada em `useCanvasDiagramNavigation.ts:89-92` por
  leitura de código e coerente com toda a medição, mas a aresta exata de realimentação não
  foi provada. O profile de produção é minificado (42 % em `(program)`).
- Se o laço afeta também XG: medi o commit até o silêncio só em G e M2.
- Se o laço aparece em outros gestos além do arraste (renomear, mover por teclado, colar).
  Note que “alteração da store fora do arraste” deu **0 ms** em M2 mas **360 ms** em G, o que
  não está explicado e merece ser olhado junto com o laço.
- `npm run lint`: não executado. O enunciado lista quatro portões e lint não é um deles; a
  memória do projeto registra que esse portão está verde por supressão.

---

## 12. Estado final

| Item | Valor |
|---|---|
| Branch | `perf/canvas-virtualization` (base `c4b2f3a`) |
| Commits | 1 — apenas este relatório; nenhum arquivo de `src/` alterado |
| `git status --porcelain` inicial | vazio |
| `git status --porcelain` final | vazio (após o commit) |
| `lsof -i :8080 -sTCP:LISTEN` início | vazio |
| `lsof -i :8080 -sTCP:LISTEN` fim | vazio — nunca subi nada na 8080 |
| PIDs criados | preview 8199: pai **46352**, filho **46372** (derrubado só esse) |
| Processos de terceiros | nenhum tocado; `pkill`/`killall`/`kill` por nome ou porta não usados |
| Chaves limpas na origem 8199 | **1** (`structura_language`), restando 0 |

Sobre as chaves: os navegadores de medição usaram perfis efêmeros do Playwright e cada
repetição começa com `localStorage.clear()`, então nada do dono se acumulou na 8199. A
verificação final encontrou 1 chave (`structura_language`, criada pelo próprio carregamento
da verificação) e a removeu.

Artefatos de medição em `~/structura-scratch/virtualizacao/` (`baseline.md`,
`commit-loop.md`, `raw/`, `logs/`, scripts). Os scripts e fixtures herdados em
`~/structura-scratch/build-nodes/` não foram editados.

Nenhum PR foi aberto.

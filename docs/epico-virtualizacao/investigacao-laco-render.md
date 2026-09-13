# Investigação — laço de render e perda de arraste

Sessão de diagnóstico, 2026-09-13, branch `perf/canvas-virtualization` sobre `4089d6e`.
Nenhum arquivo de `src/` foi alterado no repositório. Toda instrumentação viveu numa
worktree descartável (`/tmp/structura-diag`), removida ao final.

Superfície: **build de desenvolvimento** (`npm run dev -- --port 8199 --strictPort`) rodando
a partir da worktree, onde o Vite serve módulos ES não empacotados e o `callFrame.url` do
profile já é o caminho real do fonte. Tempos de dev são citados como dev.

---

## 1. Causa encontrada

1. **É um ping-pong entre dois donos da mesma posição.** `PositionSection` (os campos X/Y do
   painel do elemento) faz auto-commit com debounce de 300 ms escrevendo `updateNodeLayout`;
   esse write dispara a rodada do `ResizeObserver` do React Flow, que chama
   `batchUpdateNodeLayouts`; esse write muda a identidade de `nodeLayout`, que re-arma o
   debounce do `PositionSection`. **MEDIDO**, com as duas pilhas capturadas alternando.
2. **Os campos X/Y ficam sempre um ciclo atrás do store**, então cada lado reescreve o valor
   antigo do outro: o nó **oscila** entre a posição arrastada e a original a cada ~1,1 s,
   indefinidamente. A "perda do arraste" nunca foi perda — é a fase da oscilação no instante
   em que a persistência tira o retrato.
3. **O laço não depende do número de nós.** Ele roda igual em 400 nós; lá cada ciclo é pequeno
   demais para virar long task. O "degrau entre 400 e 600 nós" das sessões anteriores era
   **artefato do método de medição**, que usava silêncio de long tasks como critério de parada.

---

## 2. Tarefa 1 — reprodução em dev

`main.tsx:8` monta `createRoot(...).render(<App />)` **sem `StrictMode`** (LIDO NO CÓDIGO), então
a duplicação de efeitos que o enunciado temia não existe e não precisou de adaptação.

MEDIDO, fixture M2, 3 repetições em dev:

| Métrica | Dev | Produção (sessão anterior) |
|---|---|---|
| Tempo até o silêncio | 22.541 ms (21.882–22.818) | 23.977 ms |
| Long tasks | 37 (37–37) | 58 |
| Posição final correta | 1 de 3 | 3 de 7 |

O laço reproduz. Note que o **tempo de parede é praticamente o mesmo em dev e em produção**
(~22–24 s) enquanto o número de ciclos muda (37 contra 58) — primeiro sinal de que a duração
não é limitada por CPU.

---

## 3. Tarefa 2 — profile com caminhos de fonte reais

### 3.1 A cadeia que domina o custo de cada ciclo

Cadeia raiz→folha mais cara de um ciclo (671 ms, rep0):

```
performSyncWorkOnRoot -> renderRootSync -> workLoopSync -> performUnitOfWork
  -> beginWork -> updateFunctionComponent
    -> EmbedModal            src/features/canvas/components/EmbedModal.tsx:24
      -> useMemo
        -> (anonymous)       src/features/canvas/components/EmbedModal.tsx:29
          -> generateViewerUrl        src/lib/share-url/viewer.ts:7
            -> encodeDiagramPayload   src/lib/share-url/encode.ts:7
              -> compressToEncodedURIComponent   lz-string
                -> _compress                     lz-string
```

`EmbedModal.tsx:45-48` (LIDO NO CÓDIGO):

```ts
const hashIframeCode = useMemo(() => {
  const embedUrl = generateViewerUrl(diagram);
  return buildIframeCode(embedUrl);
}, [diagram]);
```

Keyed no **objeto `diagram`** inteiro, e o componente está montado
incondicionalmente em `WorkspaceContent.tsx:352` (`<EmbedModal open={embedModalOpen} ... />`).
Ou seja: **com o modal fechado**, toda mutação do store recomprime o diagrama inteiro com
lz-string. É o mesmo padrão do bug já corrigido em `useCanvasDiagramNavigation`, e é o que
torna cada ciclo caro em 1.000 nós. **É amplificador, não motor** — um `useMemo` não dispara
outro render por si só.

Outras frames de `src/` que rodam por ciclo: `stableSlice.ts:26` (a mais quente do app, é o
seletor rodando a cada notificação — está fazendo o trabalho dele),
`llm/serializer.ts:4 serializeDiagramContext`, `utils/snapshot-cache.ts:3`,
`chat/useMentionSearch.ts:59`.

### 3.2 O motor do laço

Instrumentei o `set` do store na worktree para guardar uma pilha por mutação. MEDIDO em M2,
janela do commit:

| Repetições | Pilha |
|---|---|
| 19x (rep0) / 263x (rep1) | `set` ← `batchUpdateNodeLayouts` (`layout.slice.ts:48`) ← `useNodeDragParenting.ts` |
| 18x (rep0) / 261x (rep1) | `set` ← `updateNodeLayout` (`layout.slice.ts:7`) ← **`PositionSection.tsx:61` ← `PositionSection.tsx:78`** |
| 1x | `set` ← `batchCommitNodeDrag` (`component-parenting.slice.ts:97`) ← `flush` ← `useNodeDragParenting.ts` |

Intervalos: `[1089, 19, 1118, 23, 1186, 21, 1137, 21, ...]` — um par a cada ~1,1 s.
**Na rep1 foram 527 mutações e o laço bateu meu teto de 300 s sem terminar.**

O mecanismo, LIDO NO CÓDIGO em `PositionSection.tsx`:

- `:7` — `const DEBOUNCE_MS = 300;`
- `:32-44` — efeito que copia `nodeLayout` para os estados `xInput`/`yInput`, dependente de `[nodeLayout]`.
- `:46-88` — `commit` é um `useCallback` que depende de `nodeLayout`, `xInput`, `yInput`; escreve
  `updateNodeLayout(componentId, { x: nextX, y: nextY })` com valores arredondados, protegido por
  `if (nextX === nodeLayout.x && nextY === nodeLayout.y) return;`
- `:90-98` — efeito que agenda `commit()` num `setTimeout(…, DEBOUNCE_MS)`, dependente de
  `[commit, nodeLayout]`, ou seja, **re-armado a cada nova identidade de `nodeLayout`**.

E o outro lado, em `useNodeDragParenting.ts:40-44` e `:170-179` (LIDO NO CÓDIGO): o comentário
do próprio arquivo diz que `batchUpdateNodeLayouts` existe porque *"React Flow's ResizeObserver
can report every node on screen at once"*; o flush monta as entradas a partir de
`snapshot.nodeLayouts` e escreve `if (entries.length > 0) batchUpdateNodeLayouts(entries)`.

O ciclo medido de ~1,1 s é coerente: 300 ms de debounce + ~800 ms de render em 1.000 nós.

### 3.3 A diferença entre G e M2 — e a correção do diagnóstico herdado

Aqui o resultado contraria o que as duas sessões anteriores registraram.

Contando mutações do store numa **janela fixa de 30 s** (sem captura de pilha, que é cara
demais e perturba a medida), MEDIDO:

| Fixture | Nós | Mutações em 30 s | Ainda rodando no fim da janela |
|---|---|---|---|
| G | 400 | 104, 106, 106 | **3 de 3** |
| M2 | 1.000 | 38, 38, 51 | 1 de 3 |

**Em 400 nós o laço roda o tempo todo, e é até mais persistente que em 1.000.** Os intervalos
em G são `[452, 7, 464, 6, ...]` — o mesmo par alternado, só que cada ciclo custa ~460 ms em vez
de ~1.100 ms.

Por que ninguém viu isso antes: todas as medições anteriores (minhas inclusive) paravam o
cronômetro quando passavam N segundos **sem long tasks**. Em 400 nós cada ciclo do laço custa
menos de 50 ms e portanto **não gera long task nenhuma** — o cronômetro parava em ~368 ms e
declarava "assentou", enquanto o laço seguia rodando invisível. O número de nós não liga nem
desliga o laço: ele decide se cada ciclo é grande o bastante para ser sentido.

---

## 4. Tarefa 3 — a perda de posição é oscilação

Amostrando o `transform` do nó a cada 150 ms depois do `pointerup`, MEDIDO em M2, 4 de 4
repetições idênticas (original `(1400,380)`, arrastado para `(1785,360)`):

```
2ms:(1785,360) -> 1151ms:(1400,380) -> 2304ms:(1785,360) -> 3505ms:(1400,380)
-> 4638ms:(1785,360) -> 5737ms:(1400,380) -> ... -> 11384ms:(1785,360)
```

O nó **volta e vai** a cada ~1,1 s, visivelmente, sem parar. E o log de cada `commit()` do
`PositionSection` mostra a causa direta:

| t | `xInput`,`yInput` | `nodeLayout` | escreve |
|---|---|---|---|
| 11044 | 1400, 380 | **1785, 360** | **1400, 380** |
| 12204 | 1785, 360 | **1400, 380** | **1785, 360** |
| 13365 | 1400, 380 | **1785, 360** | **1400, 380** |
| 14561 | 1785, 360 | **1400, 380** | **1785, 360** |

Os campos do painel estão **sempre um ciclo atrás** do store, e a guarda
`if (nextX === nodeLayout.x && nextY === nodeLayout.y) return;` nunca fecha porque os dois
valores nunca coincidem no mesmo instante: cada lado escreve por cima do outro.

Respondendo ao que a Tarefa 3 pergunta: `batchCommitNodeDrag` **foi** chamado, uma única vez,
com a posição certa — o arraste chega ao store corretamente. O que acontece depois é o painel
reescrever a posição antiga. Não é corrida com `useLocalNodes` (hipótese 2 do enunciado):
**não confirmada** — a posição não é descartada no merge, ela é sobrescrita pelo painel.

---

## 5. Tarefa 4 — quais gestos disparam

MEDIDO em M2, janela fixa de 15 s por gesto:

| Gesto | Mutações do store | Laço |
|---|---|---|
| Arrastar com o nó selecionado | 28 | **sim, ainda rodando no fim** |
| Selecionar e não arrastar | **0** | não |
| Mover por teclado (`ArrowRight`) | **0** | não |
| Arrastar e **desselecionar** (clique no vazio) | **0** | **não — o laço para** |

As duas últimas linhas são a confirmação do mecanismo: o laço precisa do `PositionSection`
montado, isto é, do painel do elemento aberto sobre o nó arrastado. Fechar o painel encerra o
laço. E `ArrowRight`, que também muda a posição, **não** dispara — consistente com a guarda de
igualdade fechando quando os valores coincidem.

Isso também explica o `storeChangeLongMs = 0` em M2 que ficou sem explicação no relatório do
épico: aquele teste usava `ArrowRight`, que não entra no laço.

---

## 6. DECISÕES DO DONO

Não implementei nada. Há duas correções candidatas, independentes.

**Decisão 1 — quem é o dono da posição enquanto o painel está aberto.**
O defeito é o `PositionSection` reescrever a posição a partir de estado obsoleto.

- (a) Só comitar a partir de interação real do usuário (`onBlur` / `Enter` / `onChange` do
  input), em vez de um efeito com debounce que dispara sozinho a cada mudança de `nodeLayout`.
  Consequência: acaba com o ping-pong na raiz; muda o comportamento dos campos (deixam de
  aplicar sozinhos enquanto se digita).
- (b) Manter o auto-commit, mas não re-armar o timer quando a mudança de `nodeLayout` veio do
  store (comparar com o último valor semeado antes de agendar). Consequência: preserva a UX
  atual; é uma guarda a mais para manter correta no futuro.
- (c) Não montar `PositionSection` com auto-commit enquanto houver gesto de arraste em curso.
  Consequência: mais estreito, não cobre outras origens de mudança de layout.

**Decisão 2 — o `useMemo` do `EmbedModal`.**
`EmbedModal.tsx:45-48` recomprime o diagrama inteiro com lz-string a cada mutação do store,
com o modal fechado. Não é o motor do laço, mas é o que torna cada ciclo caro — e o custo
continua existindo fora do laço, em qualquer edição.

- (a) Calcular a URL só quando `open` for verdadeiro.
- (b) Trocar a dependência de `[diagram]` por algo estável e recomputar sob demanda.
- (c) Deixar como está.

**Decisão 3 — o alvo de 1.200 nós e o aviso ao usuário.**
Como o laço não depende do número de nós, o limiar de aviso discutido nos relatórios
anteriores não tem relação com este defeito. Vale decidir se o aviso continua fazendo sentido
depois que a decisão 1 for tomada.

---

## 7. NÃO VERIFICADO

- **O mecanismo foi provado em dev, não em produção.** A instrumentação do `set` e do
  `PositionSection` só existiu na worktree em modo dev. Os sintomas de produção medidos nas
  sessões anteriores (~24 s, posição ora original ora movida) são coerentes com a oscilação,
  mas a cadeia de pilhas em si não foi recapturada num build de produção.
- Por que o laço às vezes termina em M2 (1 de 3 janelas de 30 s) e nunca terminou em G.
  Suspeito de convergência acidental dos valores arredondados, **não testado**.
- O valor anômalo `x:1500, y:-240` de uma repetição da sessão anterior segue sem explicação.
- Colar (`Cmd+V`) e renomear não foram medidos: o enunciado pedia, e eu cobri `ArrowRight`,
  seleção pura e desseleção, mas não esses dois.
- Se o laço afeta múltipla seleção, painéis ou arrastes que reparentam.
- Se `serializeDiagramContext`, `snapshot-cache` e `useMentionSearch` — que também aparecem
  por ciclo no profile — têm o mesmo padrão de dependência ampla. Não os li.

---

## 8. Estado final

| Item | Valor |
|---|---|
| Branch | `perf/canvas-virtualization` |
| Commit base | `4089d6e` |
| Commits desta sessão | 1 — apenas este relatório |
| Arquivos de `src/` alterados no repositório | **nenhum** |
| Worktree criada | `/tmp/structura-diag` em `4089d6e` |
| Worktree removida | sim — `git worktree list` mostra só o repositório principal |
| Instrumentação descartada com a worktree | `diagram.store.ts` (+17/−2) e `PositionSection.tsx` (+15) |
| `git status --porcelain` inicial | vazio |
| `git status --porcelain` final | vazio (após o commit) |
| PIDs | dev 8199: pai 27686, filho 27717 — derrubados só esses |
| `lsof -i :8080 -sTCP:LISTEN` início | vazio |
| `lsof -i :8080 -sTCP:LISTEN` fim | vazio — nada foi subido na 8080 |

Artefatos em `~/structura-scratch/investigacao/` (`raw/`, `logs/`, scripts de sondagem).

Nenhum PR foi aberto.

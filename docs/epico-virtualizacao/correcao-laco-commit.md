# Correção do laço do commit — relatório

Sessão de 2026-09-13, branch `perf/canvas-virtualization`, sobre `89c9df5`.
Build de produção (`npm run build` + `vite preview --port 8199 --strictPort`), fixtures
G (400 nós) e M2 (1.000 nós), 7 repetições independentes por número.
Silêncio definido como 3 s sem nenhuma long task, conforme o enunciado.

---

## 1. Resultado em duas linhas

1. **O laço reproduziu** em M2 (27 escritas de `structura:recentDiagrams`, ~23,8 s até o
   silêncio, 56 long tasks) e a correção **eliminou as escritas: 27 → 0**.
2. **Mas o congelamento não sumiu.** Depois da correção M2 continua em **~24,0 s e 58 long
   tasks**, idêntico ao antes. `recentDiagrams` era **sintoma, não causa** — pela regra do
   passo 4 eu parei aqui em vez de seguir mexendo no escuro.

---

## 2. Baseline do passo 1 (antes da correção)

| Métrica | G (400 nós) | M2 (1.000 nós) |
|---|---|---|
| Escritas de `structura:recentDiagrams` | 1 (1–1) | **27** (25–133) |
| Tempo até o silêncio | 368 ms (360–379) | **23.754 ms** (22.835–118.040) |
| Long tasks | 2 (2–2) | **56** (50–270) |
| Soma das long tasks | 356 ms (347–360) | **22.607 ms** (21.693–115.359) |
| `structura_diagram-store` escrito | 7 de 7 | **6 de 7** |
| Bateu o teto de 120 s | 0 de 7 | **1 de 7** |
| Posição do nó arrastado persistida corretamente | **7 de 7** | **3 de 7** |

O laço reproduziu. Duas coisas que o enunciado não previa apareceram na medição:

- **O arraste é perdido, não só atrasado.** Em 4 das 7 repetições em M2 a posição
  persistida do nó é exatamente a original do fixture (`x:1400, y:380`), ou seja, o
  movimento sumiu mesmo nas repetições em que a store *foi* escrita. Em G a posição
  persistida é a movida, idêntica nas 7 repetições (`1400,250 → 1785,240`). MEDIDO.
- Uma repetição de M2 (rep4) persistiu `x:1500, y:-240`, que não corresponde nem à
  original nem ao gesto (meu arraste move y em ±10 px). Não expliquei esse valor.

---

## 3. A correção

Diff exato aplicado em `src/features/canvas/hooks/useCanvasDiagramNavigation.ts`:

```diff
   const { recordOpened } = useRecentDiagrams();

+  // Keyed on the id, not on the diagram object: every store mutation hands us a
+  // new object, and re-recording on each one writes localStorage and re-renders,
+  // which produces another object. Above ~600 nodes a cycle outlasts the debounce
+  // and the loop never settles — ~23s of long tasks after one drag, and the drag
+  // itself can be lost. Measured 2026-09-13; see docs/epico-virtualizacao/.
   useEffect(() => {
     if (diagram) recordOpened(diagram.id);
-  }, [diagram, recordOpened]);
+  }, [diagram?.id, recordOpened]);
```

Nada mais foi alterado nesse arquivo. O guard `if (diagram)` já cobre nulo/undefined, e
`diagram?.id` vira `undefined` quando o diagrama é nulo, então o efeito continua correto.

### Testes, escritos antes e vistos falhar

Em `src/features/canvas/hooks/useCanvasDiagramNavigation.test.ts`. O mock existente de
`useRecentDiagrams` devolvia um `vi.fn()` novo a cada chamada, o que impedia contar
chamadas; troquei por um mock estável via `vi.hoisted` (os três testes que já existiam não
dependiam disso e seguem passando).

1. `records the diagram once when the store emits a new object with the same id` — dois
   rerenders com objetos `diagram` distintos e mesmo `id`.
   **Antes da correção: falhou** — `expected "vi.fn()" to be called 1 times, but got 3 times`.
   **Depois: passa.**
2. `records again when the diagram id actually changes` — garante que navegar entre
   diagramas continua registrando. Passava antes e continua passando (é a trava contra
   corrigir demais).

---

## 4. Medição final (passo 4) — antes e depois

### M2 (1.000 nós) — o alvo

| Métrica | Antes | Depois | Efeito |
|---|---|---|---|
| Escritas de `structura:recentDiagrams` | 27 (25–133) | **0** (0–0) | **eliminado** |
| Tempo até o silêncio | 23.754 ms (22.835–118.040) | **23.977 ms** (23.832–118.280) | **sem mudança** |
| Long tasks | 56 (50–270) | **58** (56–287) | sem mudança |
| Soma das long tasks | 22.607 ms (21.693–115.359) | **22.992 ms** (22.671–115.199) | sem mudança |
| `structura_diagram-store` escrito | 6 de 7 | 6 de 7 | sem mudança |
| Bateu o teto de 120 s | 1 de 7 | 1 de 7 | sem mudança |
| Posição persistida corretamente | 3 de 7 | 3 de 7 | sem mudança |

### G (400 nós) — verificação de regressão

| Métrica | Antes | Depois |
|---|---|---|
| Escritas de `structura:recentDiagrams` | 1 | **0** |
| Tempo até o silêncio | 368 ms (360–379) | 367 ms (360–378) |
| Long tasks / soma | 2 / 356 ms | 2 / 351 ms |
| `structura_diagram-store` escrito | 7 de 7 | 7 de 7 |
| Posição persistida corretamente | 7 de 7 | 7 de 7 |

Nada regrediu em G, e a escrita redundante por gesto sumiu nos dois fixtures.

### Leitura honesta

As escritas de `recentDiagrams` foram a **zero** — o que também prova que o bundle medido é
o corrigido, já que o efeito deixou de refazer. E ainda assim o tempo até o silêncio, o
número de long tasks e a perda do arraste ficaram **iguais dentro do ruído**.

Portanto: o efeito em `useCanvasDiagramNavigation.ts:89-92` era um **passageiro** do laço de
render, não o motor dele. Ele era reexecutado a cada ciclo e por isso escrevia o
localStorage a cada ciclo — foi esse rastro que a sessão anterior observou e do qual inferiu
a causa. A inferência estava errada. Pelo passo 4 do enunciado ("se o laço persistir, pare e
reporte"), parei.

---

## 5. DECISÕES DO DONO

**Decisão 1 — manter ou reverter esta correção.**
Ela não entrega o que o épico pedia (o congelamento continua), mas é uma melhora medida por
si só: elimina 27 escritas redundantes de localStorage por gesto em 1.000 nós e 1 em 400,
tem teste que trava o comportamento, e não regrediu nada.

- (a) Manter. Consequência: o repositório fica com uma correção correta e testada, e o bug
  do congelamento segue aberto com o diagnóstico agora corrigido.
- (b) Reverter e deixar a branch só com o relatório. Consequência: nada muda no produto; o
  conhecimento fica apenas escrito.

**Decisão 2 — investigar a causa real do congelamento.**
O que sobra é um laço de render de ~800 ms por ciclo em 1.000 nós que dura ~24 s, às vezes
não termina em 120 s, e **perde o arraste em 4 de 7 tentativas**. A perda do gesto é o lado
mais grave e não estava no enunciado.

- (a) Abrir investigação com build de desenvolvimento e source maps, atacando primeiro a
  perda de posição (dado perdido) e depois o congelamento. Consequência: é o caminho para
  resolver de fato; custo de uma sessão, sem garantia de causa única.
- (b) Adiar. Consequência: acima de ~600 nós cada arraste congela ~24 s e pode ser perdido.

Não faço recomendação entre (a) e (b): é decisão de produto.

---

## 6. NÃO VERIFICADO

- **A causa real do laço.** Descartei `recentDiagrams` por medição, mas não identifiquei o
  que dispara os ciclos. O profile de produção é minificado e atribui 42 % a `(program)`.
- Por que o arraste é perdido em 4 de 7 repetições mesmo quando a store é escrita. Suspeito
  de corrida entre o laço de render e o merge de `useLocalNodes`, mas **não testei** — é
  hipótese, não resultado.
- O valor anômalo `x:1500, y:-240` de uma repetição antes da correção.
- Se o laço ocorre em gestos que não o arraste (renomear, colar, mover por teclado).
- XG (5.000 nós): fora do escopo declarado, não medido nem mencionado nos números acima.
- `npm run lint`: não está na lista de portões do enunciado e não foi executado.

---

## 7. Estado final

| Item | Valor |
|---|---|
| Branch | `perf/canvas-virtualization` |
| Commit base desta fatia | `89c9df5` |
| Commits nesta fatia | 1 |
| `git status --porcelain` inicial | vazio |
| `git status --porcelain` final | vazio (após o commit) |
| `npm run typecheck` | exit **0** |
| `npm run build` | exit **0** |
| `npm test` | 10 falhas / 1.885 passes, nos 3 arquivos herdados de share-url/viewer |
| `npx prettier --check` nos arquivos tocados | exit **0** |
| `lsof -i :8080 -sTCP:LISTEN` início | vazio |
| `lsof -i :8080 -sTCP:LISTEN` fim | vazio — nada foi subido na 8080 |
| PIDs criados na 8199 | pai 2481/filho 2515 (antes), pai 11772/filho 11792 (depois) — derrubados só esses |

Sobre o `npm test`: eram 9 falhas antes da correção e 10 depois, sempre nos mesmos 3
arquivos (`share-url.test.ts`, `diagram-url.flow.test.ts`, `viewer-opens-on-base.test.ts`).
A diferença é instabilidade do próprio arquivo: rodando `share-url.test.ts` sozinho 5 vezes
na mesma árvore com `--retry=0`, deu 3, 3, 2, 3 e 3 falhas. O total de testes subiu de 1.893
para 1.895 — são os dois que acrescentei. Nenhuma falha nova fora desses 3 arquivos.

Nenhum PR foi aberto.

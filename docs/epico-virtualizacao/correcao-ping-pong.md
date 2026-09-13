# Correção — ping-pong de posição e EmbedModal

Sessão de 2026-09-13, branch `perf/canvas-virtualization` sobre `bee9ed1`.
Todos os números são build de produção (`npm run build` + `vite preview --port 8199
--strictPort`), fixture M2 (1.000 nós) salvo onde indicado, 7 repetições independentes,
mediana (mín–máx).

Nota de caminho: o enunciado aponta `panels/ElementPanel/PositionSection.tsx`; o arquivo
real é `panels/ElementPanel/sections/PositionSection.tsx`. É o mesmo arquivo.

---

## 1. Resultado em duas linhas por commit

**Commit 1 — `PositionSection` (`faae545`).** O sintoma sumiu por completo: as oscilações da
posição do nó depois de um arraste caíram de **13 para 0** (7 de 7 repetições), o tempo até o
silêncio de **23.977 ms para 859 ms** e a posição arrastada agora sobrevive em **7 de 7**
repetições contra 3 de 7.

**Commit 2 — `EmbedModal` (`6f2bbab`).** Com o modal fechado, o tempo de CPU em lz-string
durante 10 s de edição caiu de **42 ms para 0 ms** (216 amostras para 0) e as long tasks de
13 para 9.

---

## 2. Commit 1 — `PositionSection`

### 2.1 Medição antes

MEDIDO em M2, 7 repetições, observando o `transform` do nó por 12 s após o `pointerup`:

| Métrica | Antes |
|---|---|
| **Oscilações da posição (flips) em 12 s** | **13** (11–14) |
| Tempo até o silêncio | 23.977 ms (23.832–118.280) |
| Long tasks | 58 (56–287) |
| **Posição arrastada preservada** | **3 de 7** |
| Repetições que bateram o teto de 120 s | 1 de 7 |

Numa segunda bateria com o mesmo instrumento e janela de observação de 12 s, 4 de 7
repetições bateram o teto de 120 s e a mediana do tempo até o silêncio foi 129.043 ms — o
laço não termina sozinho de forma confiável.

A linha do tempo de uma repetição, MEDIDA:

```
1:(1785,360) -> 872:(1400,380) -> 1701:(1785,360) -> 2491:(1400,380) -> 3375:(1785,360) ...
```

O nó vai e volta entre a posição arrastada e a original a cada ~0,9 s.

### 2.2 O diff

```diff
-import { useCallback, useEffect, useState } from "react";
+import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

 const MIN_PANEL_HEIGHT = 150;
-const DEBOUNCE_MS = 300;

   const [heightInput, setHeightInput] = useState("");
+  /**
+   * True while one of these fields has focus. The store is not the only writer of
+   * a node's position -- a drag, the keyboard and the layout pass all move it --
+   * so the fields follow the store, but never while the user is mid-edit.
+   */
+  const isEditingRef = useRef(false);

   useEffect(() => {
     ...
+    if (isEditingRef.current) return;
     setXInput(String(Math.round(nodeLayout.x)));

-  useEffect(() => {
-    if (!nodeLayout) return;
-    const timeoutId = window.setTimeout(() => {
-      commit();
-    }, DEBOUNCE_MS);
-    return () => window.clearTimeout(timeoutId);
-  }, [commit, nodeLayout]);
+  const handleFocus = useCallback(() => {
+    isEditingRef.current = true;
+  }, []);
+
+  const handleBlur = useCallback(() => {
+    isEditingRef.current = false;
+    commit();
+  }, [commit]);
+
+  const handleKeyDown = useCallback(
+    (event: KeyboardEvent<HTMLInputElement>) => {
+      if (event.key !== "Enter") return;
+      commit();
+    },
+    [commit],
+  );
```

Nos quatro inputs (X, Y, W, H), `onBlur={commit}` virou
`onFocus={handleFocus} onBlur={handleBlur} onKeyDown={handleKeyDown}`. O `onChange` continua
só atualizando o estado local, como o enunciado pede.

### 2.3 Testes — falharam antes, passam depois

Arquivo novo: `PositionSection.test.tsx`, 5 testes.

| Teste | Antes | Depois |
|---|---|---|
| `writes nothing to the store when the node moves underneath it` | **falhou** | passa |
| `commits on blur` | passou | passa |
| `commits on Enter` | **falhou** | passa |
| `does not overwrite a field the user is editing` | **falhou** | passa |
| `follows the store while no field is focused` | passou | passa |

O primeiro teste entrega ao componente uma posição **fracionária** (`1785.4, 360.2`), que é
como o React Flow reporta a posição depois de um arraste. Antes, os campos arredondavam e o
debounce escrevia o valor arredondado de volta na store sem nenhuma interação do usuário —
exatamente o gatilho do ping-pong. Os dois que já passavam são a trava contra corrigir demais:
o commit por `blur` e o acompanhamento da store continuam funcionando.

### 2.4 Medição depois

| Métrica | Antes | Depois | Efeito |
|---|---|---|---|
| **Oscilações em 12 s** | 13 (11–14) | **0** (0–0) | **eliminado** |
| Tempo até o silêncio | 23.977 ms | **859 ms** (826–942) | **28× menor** |
| Long tasks | 58 | **2** (2–3) | |
| Soma das long tasks | 22.992 ms | **838 ms** (804–889) | |
| **Posição arrastada preservada** | 3 de 7 | **7 de 7** | |
| Bateu o teto de 120 s | 1 de 7 | **0 de 7** | |

---

## 3. Commit 2 — `EmbedModal`

### 3.1 Medição antes

MEDIDO em M2, 7 repetições, **modal fechado o tempo todo** (verificado por repetição:
nenhum `[role="dialog"]` no DOM), 10 s de arrastes repetidos:

| Métrica | Antes |
|---|---|
| **Tempo de CPU em lz-string** | **42 ms** (35–129) |
| Amostras em funções de compressão | 216 (181–628) |
| Long tasks | 13 (7–26) |
| Soma das long tasks | 2.170 ms (1.493–3.074) |

Nota de método: o enunciado pede "renomear um nó repetidamente". Tentei primeiro `ArrowRight`
como gatilho de edição e **ele não produz nenhuma mutação da store neste app** (MEDIDO: 0
chamadas de `set()`, coerente com a Tarefa 4 da investigação anterior), então não exercitava
nada — a primeira bateria deu 0 ms de compressão por esse motivo, não por ausência do defeito.
Troquei por arrastes curtos repetidos, que são mutações de store inequívocas e produzem
exatamente a entrada que o efeito observa: um objeto `diagram` novo.

### 3.2 O diff

```diff
+  // Only while the dialog is open: generateViewerUrl lz-compresses the whole
+  // diagram, and this component is mounted unconditionally, so keying it on the
+  // diagram alone re-compressed everything on every store mutation with nobody
+  // looking at the result. Measured 2026-09-13; see docs/epico-virtualizacao/.
   const hashIframeCode = useMemo(() => {
+    if (!open) return "";
     const embedUrl = generateViewerUrl(diagram);
     return buildIframeCode(embedUrl);
-  }, [diagram]);
+  }, [open, diagram]);
```

### 3.3 Testes — falharam antes, passam depois

Arquivo novo: `EmbedModal.test.tsx`, 3 testes.

| Teste | Antes | Depois |
|---|---|---|
| `does not build the viewer URL while closed` | **falhou** | passa |
| `builds the viewer URL once the modal opens` | **falhou** | passa |
| `shows the iframe snippet with the viewer URL when open` | passou | passa |

O terceiro já passava e é a trava: o modal aberto continua exibindo o snippet com a URL
correta. Sobre o "flash de conteúdo vazio" que o enunciado pede para conferir: o `useMemo`
recalcula no mesmo render em que `open` vira `true`, antes da pintura, então o `Textarea`
nunca chega a ser pintado vazio — o teste 3 lê o valor logo após abrir e encontra a URL.

### 3.4 Medição depois

| Métrica | Antes | Depois | Efeito |
|---|---|---|---|
| **Tempo de CPU em lz-string (modal fechado)** | 42 ms (35–129) | **0 ms** (0–0) | **eliminado** |
| Amostras em funções de compressão | 216 | **0** | |
| Long tasks | 13 (7–26) | **9** (8–11) | |
| Soma das long tasks | 2.170 ms | **1.637 ms** (1.554–2.216) | |

---

## 4. Verificação de regressão em G (400 nós)

MEDIDO depois dos dois commits, 7 repetições (5 para as oscilações):

| Métrica | Antes (sessões anteriores) | Depois |
|---|---|---|
| Tempo até o silêncio | 367 ms (360–378) | 358 ms (347–377) |
| Long tasks | 2 | 2 |
| Store escrita | 7 de 7 | 7 de 7 |
| Posição preservada | 7 de 7 | 7 de 7 |
| **Oscilações em 12 s** | não medido antes | **0** (5 de 5) |

Nada regrediu. A linha das oscilações em G é relevante porque a investigação anterior mostrou
que em 400 nós o mesmo ping-pong rodava, só que invisível a qualquer medição baseada em long
tasks (cada ciclo custava menos de 50 ms). Hoje ele está em zero — mas **não capturei o valor
de antes em G**, então isso é o estado atual, não um delta medido.

---

## 5. DECISÕES DO DONO

Nenhuma decisão nova surgiu. Duas observações que o dono pode querer decidir depois:

1. **Mudança de comportamento dos campos X/Y.** Antes, digitar um valor o aplicava sozinho
   após 300 ms. Agora é preciso sair do campo ou apertar Enter. Foi a opção (a) da decisão 1
   do relatório de investigação, que é o que este enunciado mandou implementar — registro aqui
   só para o caso de a UX de auto-aplicar ser desejada de volta com outra guarda.
2. **O mesmo padrão de dependência ampla existe em outros lugares.** A investigação listou
   `serializeDiagramContext`, `snapshot-cache` e `useMentionSearch` rodando por ciclo. Não
   foram tocados nesta sessão nem verificados.

---

## 6. NÃO VERIFICADO

- **Renomear e colar** como gatilhos: usei arrastes. Renomear é o gesto que o enunciado cita
  e continua sem medição.
- O comportamento dos campos **W/H de painel**: os handlers foram aplicados aos quatro inputs,
  mas os testes cobrem só X e Y com `isPanel={false}`.
- Se o ping-pong pode ser disparado por outro par de escritores que não `PositionSection` —
  por exemplo em múltipla seleção ou em arrastes que reparentam.
- O valor anômalo `x:1500, y:-240` das sessões anteriores. Nesta sessão apareceu uma variante
  (`2085,-195` numa repetição do "antes"), também sem explicação; o alvo do arraste às vezes
  acaba em coordenada diferente da esperada.
- `npm run lint` não está na lista de portões do enunciado e não foi executado.
- A medição do tempo até o silêncio no `probe-osc` tem piso de 12 s por construção (observa
  12 s antes de medir o silêncio); os números de silêncio citados nas tabelas vêm do
  `probe-loop`, que mede direto a partir do `pointerup`.

---

## 7. Estado final

| Item | Valor |
|---|---|
| Branch | `perf/canvas-virtualization` |
| Commit base | `bee9ed1` |
| Commits | `faae545` (PositionSection + testes), `6f2bbab` (EmbedModal + testes), e este relatório |
| `git status --porcelain` inicial | vazio |
| `git status --porcelain` final | vazio |
| `npm run typecheck` | exit **0** nos dois commits |
| `npm run build` | exit **0** nos dois commits |
| `npm test` | 8 falhas / 1.895 passes, nos 3 arquivos herdados de share-url/viewer |
| `npx prettier --check` nos arquivos tocados | exit **0** |
| `lsof -i :8080 -sTCP:LISTEN` início | vazio |
| `lsof -i :8080 -sTCP:LISTEN` fim | vazio — nada foi subido na 8080 |
| PIDs na 8199 | 62694/62726, 77023/77055, 89972/89992 — derrubados só esses |

Sobre o `npm test`: 8 falhas está **dentro** da faixa herdada de 8–10, e sempre nos mesmos 3
arquivos (`share-url.test.ts`, `diagram-url.flow.test.ts`, `viewer-opens-on-base.test.ts`).
O total de testes subiu de 1.895 para 1.903 — são os 8 que acrescentei (5 em `PositionSection`,
3 em `EmbedModal`). Nenhuma falha nova fora desses 3 arquivos.

Nenhum PR foi aberto.

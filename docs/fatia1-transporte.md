# Épico de Geração — Fatia 1: transporte e primeira medição a ~40 nós

Sessão de implementação sobre `main`. Artefatos em `docs/fatia1-transporte/`.
Três seções separadas — **Medido**, **Inferido**, **NÃO VERIFICADO** — como no
relatório de baseline.

---

## Veredito

As três tarefas foram entregues. **Os Casos A e B renderizam 3/3 cada**, onde
falhavam 3/3 na Fase 0.

E a fatia encontrou o próximo obstáculo, que é o que ela existia para descobrir:

> **Uma aresta do IR cujo source ou target é um nó que tem filhos nunca chega ao
> canvas.** O React Flow recusa criá-la (erro #008) e a conexão simplesmente não
> existe no diagrama renderizado. No B-run1, 16 das 27 conexões sumiram por isso.

Isso dispara a **parada obrigatória**. Está reportado, **não corrigido**.

---

## 0. O que mudou no código

| Arquivo | Mudança |
|---|---|
| `src/features/llm/types.ts` | novo `LLMStopReason` (`stop` \| `length` \| `unknown`) e `LLMCompletion` (`{ text, stopReason }`) |
| `providers/openai-compatible.ts` | lê `choices[].finish_reason`, mapeia em `toStopReason`, devolve `LLMCompletion` |
| `providers/anthropic.ts` | lê `stop_reason` do `message_delta`, mapeia `max_tokens → length`; stream extraído para `readAnthropicStream` |
| `providers/openai.ts` | teto `OPENAI_MAX_OUTPUT_TOKENS = 16000` (era 3000), com a proveniência da medição no comentário |
| `providers/anthropic.ts` | teto `ANTHROPIC_MAX_OUTPUT_TOKENS = 16000`, comentado explicitamente como **não medido** |
| `providers/custom.ts`, `providers/proxy.ts` | tipo de retorno `LLMCompletion`; proxy propaga `finish_reason` quando o upstream o repassa |
| `ir/ir-validator.ts` | novo membro `"responseTruncated"` no union `IRIssueCode` — **nenhuma regra do validator foi tocada** |
| `llm/store.ts` | `/generate` verifica `stopReason === "length"` **antes de parsear** e emite a mensagem de truncamento |
| `i18n/locales/{en,pt-BR}.json` | `llmChat.ir.truncated` e `llmChat.ir.issue.responseTruncated` |

Testes novos: `providers/stop-reason.test.ts` (10), `store.generate-truncation.test.ts` (5),
`infrastructure/i18n/locales.parity.test.ts` (3).

Nada da lista de fora-de-escopo foi tocado: o canal de warnings do validator e as
17 regras bloqueantes, `apply-ir.ts`, o posicionamento do grafo gerado, o passo de
histórico espúrio, o tipo `database`, as regras de domínio AWS.

---

## 1. MEDIDO

### 1.1 O teto: o número veio da API, não de um chute

A tarefa exigia verificar o limite real antes de escolher o valor. Método: mandar
`max_tokens: 999999` e ler o limite que o próprio 400 nomeia.

| modelo | status | teto que o erro nomeia |
|---|---:|---:|
| gpt-4o | 400 | 16384 |
| gpt-4o-mini | 400 | 16384 |
| gpt-4.1 | 400 | 32768 |
| gpt-4.1-mini | 400 | 32768 |

Mensagem verbatim: `max_tokens is too large: 999999. This model supports at most
<N> completion tokens, whereas you provided 999999.`

**O limite varia por modelo dentro do provider** — a segunda restrição da tarefa
se aplica. Uma constante única tem que caber no menor modelo suportado, então
**16000**, e não algo entre 16384 e 32768. Controle positivo: `max_tokens: 16000`
devolve **HTTP 200 nos quatro** presets.

`docs/fatia1-transporte/measure-openai-max-tokens.json`

**Por que 16000 é suficiente, e não só maior.** Com o system prompt do próprio app
e os prompts verbatim dos Casos A e B, `usage.completion_tokens`:

| caso | prompt_tokens | completion_tokens | chars | finish_reason |
|---|---:|---:|---:|---|
| A (C4, ~40 nós) | 4233 | **3235** | 9898 | `stop` |
| B (AWS, ~40 nós) | 4236 | **3610** | 10715 | `stop` |

O teto antigo de 3000 não cabia em nenhum dos dois. Isso é a causa da falha da
Fase 0, medida em tokens e não inferida em bytes.
`docs/fatia1-transporte/measure-completion-tokens.json`

### 1.2 `finish_reason` chega mesmo — a inferência da Fase 0 virou medição

A Fase 0 registrou por leitura de código que o campo existia e era descartado. Foi
medido, com um `fetch` direto (não um wrapper sobre o `fetch` do app — perigo 8),
partindo as linhas SSE exatamente como `readOpenAICompatibleStream` parte:

| sonda | max_tokens | linhas `data:` | `finish_reason` visto |
|---|---:|---:|---|
| corte forçado | 30 | 32 | `["length"]` |
| parada natural | 4000 | 1053 | `["stop"]` |

Chega **exatamente uma vez por resposta** e distingue os dois casos.
`docs/fatia1-transporte/measure-stream-finish-reason.json`

### 1.3 A mensagem de truncamento é distinta e acionável

`en`: *"The diagram was cut off: the response hit the model's output limit before
it finished."* + *"Try again describing fewer elements, or generate the diagram in
parts — one boundary or subsystem at a time."*
`pt-BR`: as equivalentes, código `responseTruncated`.

Os testes provam três coisas separadas, com as strings importadas do JSON de
locale (chave ausente ⇒ teste vermelho, não verde vazio): a mensagem de corte
contém as duas chaves novas e **não** contém `invalidJson`; JSON malformado com
parada limpa continua produzindo `invalidJson`; **os mesmos bytes com stop reasons
diferentes produzem mensagens diferentes**.

### 1.4 Casos A e B renderizam — 3/3 cada

App real, UI dirigida, sem `force`, sem input sintético, diagrama novo por run,
prompts verbatim da §1.1 do baseline. Mesmo caminho de produção da Fase 0
(`irToLayoutGraph` → `layoutElkGraph` → `readElkHandleOrder` →
`measureRenderedReadability`).

| run | nós IR | arestas IR | nós DOM | `.react-flow__edge-path` | veredito |
|---|---:|---:|---:|---:|---|
| A-run1 | 33 | 33 | 33 | 33 | **renderiza** |
| A-run2 | 34 | 40 | 34 | 40 | **renderiza** |
| A-run3 | 34 | 40 | 34 | 40 | **renderiza** |
| B-run1 | 39 | 27 | 39 | **11** | renderiza, **16 conexões sumiram** |
| B-run2 | 42 | 33 | 42 | 33 | **renderiza** |
| B-run3 | 33 | 37 | 33 | 37 | **renderiza** |

Baseline: 0 nós no DOM nos seis runs, `invalidJson` nos seis.

Tempo da chamada à API (entrada do `PerformanceObserver` para
`https://api.openai.com`): A-run2 18 373 ms, A-run3 19 859 ms, B-run1 17 265 ms,
B-run2 20 128 ms, B-run3 26 339 ms. (A-run1 rodou antes do observer.)

Screenshots: `docs/fatia1-transporte/{A,B}-run{1,2,3}-render.jpg`.
IRs e métricas: `{A,B}-run{1,2,3}.{ir,measure}.json`.

### 1.5 Geometria — a medição que ninguém tinha feito

| run | cruz. renderizados | cruz. ELK | sobrep. aresta-nó renderizadas | sobrep. ELK | prof. de aninhamento | **filhos fora do pai** |
|---|---:|---:|---:|---:|---:|---:|
| A-run1 | 10 | 1 | 5 | 0 | 2 | **0** |
| A-run2 | 7 | 0 | 5 | 0 | 2 | **0** |
| A-run3 | 51 | 4 | 14 | 0 | 2 | **0** |
| B-run1 | 23 | 7 | 23 | 0 | **4** | **0** |
| B-run2 | 99 | 33 | 36 | 0 | 3 | **0** |
| B-run3 | 83 | 52 | 7 | 0 | **4** | **0** |

Três leituras:

**(a) O containment aguenta 4 níveis.** `childrenOutsideParent` é **0 em todos os
seis runs**, incluindo os dois que atingiram VPC → AZ → Subnet → serviço. O item 1
do "não verificado" da Fase 0 (§7) está respondido, e a resposta é boa.

**(b) A geometria é instável para o mesmo prompt.** Caso A: 10 / 7 / 51
cruzamentos. Caso B: 23 / 99 / 83. Não é ruído de medição — é o modelo produzindo
grafos diferentes, e o layout respondendo com qualidade muito diferente.

**(c) O redesenho por handles multiplica os cruzamentos que o ELK resolveu.**
B-run2: ELK 33 → renderizado 99. A-run3: ELK 4 → renderizado 51. E as
sobreposições aresta-nó chegam a 36 renderizadas onde o roteamento do ELK tem
**0** em todos os runs. Isso confirma, agora a ~40 nós, o que o baseline viu a ~10.

### 1.6 Efeito colateral do teto nos casos pequenos: nenhum

Mesmo método, prompts verbatim dos Casos C e D, 3 runs cada, diagrama novo por run.

| | baseline (teto 3000) | Fatia 1 (teto 16000) |
|---|---|---|
| **C** — tempo | 8534 / 6685 / 5400 ms | 5715 / 4452 / 5852 ms (API) |
| **C** — bytes da resposta | 2921 / 2739 / 2577 | 2670 / 2216 / 2080 |
| **D** — tempo | 6237 / 5392 / 4774 ms | 4141 / 5011 / 5154 ms (API) |
| **D** — bytes da resposta | 2101 / 2507 / 1894 | 1963 / 2145 / 2098 |

Nem mais lento nem mais volumoso — se algo, ligeiramente mais rápido, dentro da
variação. **`max_tokens` é um teto, não uma meta**: o modelo emite o que o diagrama
pede e para. 6/6 renderizaram, 0 arestas descartadas.

`docs/fatia1-transporte/measure-small-cases.json` e `{C,D}-run{1,2,3}-fatia1.measure.json`.
Ressalva registrada lá: o `clickToLastIrLogMs` de 9835 ms do C-run1 está inflado
(o `arm` foi um round-trip de ferramenta separado, ~4 s antes do clique); os outros
cinco armaram no mesmo lote do clique. O `apiDurationMs` não é afetado em nenhum.

### 1.7 Tabela de mutações — as quatro mordem

Cada mutação aplicada ao código real, suíte alvo rodada com `--retry=0`, revertida.
Log completo em `docs/fatia1-transporte/mutation-log.txt`.

| # | mutação | o que caiu |
|---|---|---|
| **A** | teto de volta a 3000 | `openai clears a measured ~40-node diagram, with headroom` — `expected 3000 to be greater than or equal to 7220` |
| **B** | ignorar `finish_reason` no stream | 2 testes: `reports 'length' when the provider cut…`, `reports 'stop' on a natural finish` |
| **C** | emitir `invalidJson` em vez do código novo | 3 testes, entre eles `produces two different messages for the two causes` |
| **D** | remover a chave nova só do pt-BR | 2 testes: paridade de locales e a checagem explícita das duas chaves |

**Nenhuma mutação passou em branco.** Mas ver §5: a versão original do teste da
mutação A **não mordia**, e isso é achado.

Estado final: `npx vitest run --retry=0` → **836 testes, 109 arquivos, 0 falhas**.
`npx tsc -b` → **exit 0**.

---

## 2. INFERIDO

Marcado como inferência: sustentado pelos dados, não medido diretamente.

1. **O caminho Anthropic funciona como o do OpenAI.** `toStopReason` mapeia
   `max_tokens → length` conforme a forma documentada do evento `message_delta`, e
   os testes de unidade exercitam o reader com essa forma. Nenhuma resposta real da
   Anthropic passou por ele. Ver §3.1.

2. **O teto de 16000 é seguro para os modelos Anthropic dos presets.** Está abaixo
   do limite de saída documentado de todos eles, mas ninguém probou a API. É
   escolha conservadora, não medição.

3. **Um diagrama grande o bastante ainda vai truncar.** 16000 é ~4,4× o que um
   diagrama de 40 nós custa (3610). Em ~180 nós o teto volta a morder — por isso a
   detecção de truncamento é a parte não-negociável da fatia, e não o teto.

4. **A instabilidade de cruzamentos entre runs vem do grafo, não do layout.** Os
   IRs de A-run2 e A-run3 têm o mesmo tamanho (34/40) e produzem 7 vs 51
   cruzamentos renderizados. Como o ELK é determinístico para uma mesma entrada, a
   diferença tem que estar na entrada. Não isolei qual propriedade do grafo.

5. **`custom` e `proxy` herdam a detecção de truncamento.** O código propaga o tipo;
   um proxy que engula o `finish_reason` cai em `unknown` e se comporta como hoje.
   Nenhum dos dois foi exercitado contra um endpoint real.

---

## 3. NÃO VERIFICADO

1. **O caminho Anthropic, ponta a ponta.** Este app só tem conexão OpenAI
   configurada. `readAnthropicStream` nunca viu um stream real, e
   `ANTHROPIC_MAX_OUTPUT_TOKENS` nunca foi aceito ou rejeitado pela API. Está
   implementado e **declarado como não verificado — não afirmo que funciona**.

2. **Se o modo `proxy` ou `custom` reporta truncamento na prática.** Sem endpoint
   para exercitar.

3. **Por que o `finish_reason` chega em um chunk com delta vazio, e se algum
   provider compatível o manda de outra forma.** Medi contra `api.openai.com` e
   mais nada.

4. **A causa do redesenho por handles multiplicar cruzamentos.** Medi que acontece
   (§1.5c) e o tamanho do efeito. Não localizei a linha. Não investiguei além
   porque seria correção.

5. **Se as 17 regras bloqueantes do validator rejeitariam algum destes 6 IRs.** Fora
   de escopo por instrução; nenhum dos 6 foi barrado, mas não sondei o limite.

6. **Estabilidade sob repetição além de 3 runs.** Os cruzamentos variam 7–51 em três
   runs do mesmo prompt; não sei a forma dessa distribuição.

7. **Comportamento em modelo diferente de `gpt-4.1`.** Todos os 12 runs desta
   sessão usaram a conexão configurada. Os tetos dos outros três presets foram
   probados (§1.1), mas nenhum gerou diagrama.

8. **Se a aresta descartada (§4) tem outros gatilhos além de "endpoint é
   container".** A correlação é exata nos 6 runs, mas 6 runs é 6 runs.

---

## 4. Modo de falha novo — parada obrigatória

**Arestas para um nó-container são descartadas silenciosamente.**

O que se vê no console do app, verbatim:

```
[React Flow]: Couldn't create edge for target handle id: "target-1",
edge id: conn-… Help: https://reactflow.dev/error#008
```

O React Flow não cria a aresta e segue. Não há erro na UI, não há aviso ao
usuário: o diagrama simplesmente aparece com menos conexões do que o modelo
descreveu, e nada indica que faltou alguma coisa.

Correlação exata nos seis runs — uma aresta conta como "toca container" quando seu
source ou target aparece como `parentId` de outro nó:

| run | arestas IR | tocam container | paths no DOM | `IR − tocam` |
|---|---:|---:|---:|---:|
| A-run1 | 33 | 0 | 33 | 33 |
| A-run2 | 40 | 0 | 40 | 40 |
| A-run3 | 40 | 0 | 40 | 40 |
| **B-run1** | 27 | **16** | **11** | **11** |
| B-run2 | 33 | 0 | 33 | 33 |
| B-run3 | 37 | 0 | 37 | 37 |

`domEdgePaths == irEdges − edgesTouchingContainer` nos seis, sem exceção.

**Não é virtualização**: `onlyRenderVisibleElements` não aparece em lugar nenhum do
código-fonte (grep).

**Por que só um run.** O gatilho é o que o modelo escreveu, não o pipeline. A saída
do Caso A liga só folha-a-folha nos três runs. O Caso B bateu no problema no run em
que o modelo escreveu "ALB → serviço ECS" e semelhantes — o jeito idiomático de
descrever AWS. Está **latente** nos outros cinco, não ausente.

`docs/fatia1-transporte/finding-container-edges-dropped.json`

**Não comecei a corrigir.** Descobrir o obstáculo era o resultado da fatia;
consertá-lo é escopo de outra, com decisão de produto no meio — e a decisão aqui
não é óbvia: "aresta para container" pode significar *ligar ao painel*, *ligar a
todos os filhos*, ou *rejeitar no validator com uma mensagem*. São três produtos
diferentes.

---

## 5. Erros próprios desta sessão

**1. Escrevi um teste decorativo e ele passou na mutação A.** A primeira versão do
teste de teto estimava tokens dividindo caracteres por 4, concluía que 40 nós
custavam ~2250 tokens, e portanto **continuava verde com o teto revertido a 3000**.
Só apareceu porque a tabela de mutações era obrigatória. Corrigido medindo
`usage.completion_tokens` na API real (3235 e 3610; ~3,0 chars/token para JSON
denso, não 4) e substituindo a estimativa pelo número medido com exigência de 2× de
folga. O erro está registrado no comentário do teste e em
`measure-completion-tokens.json`. **Este é o sexto teste decorativo do projeto** — o
padrão é: número estimado em vez de medido.

**2. Afirmei `npx tsc -b` exit 0 quando não era.** Ao fechar a sessão o typecheck
acusava `TS2493` em `stop-reason.test.ts:144` (`fetchSpy.mock.calls[0]?.[1]` sobre
um spy tipado sem argumentos). Corrigido com anotação de tipo no spy; mutação A
reaplicada sobre o arquivo corrigido e ainda morde (log atualizado). O `-b` é
incremental — não confiar em um exit 0 anterior a uma edição.

**3. Li o store errado.** `import('/src/features/llm/store.ts')` pelo dev server
devolve **outra instância do módulo**, não a do app: `lastGeneratedIR` vinha `null`
e um `subscribe` meu nunca disparava. Teria medido um store vazio. Pego por
conferência contra os 35 nós que estavam no DOM. Passei a ler o IR do log
`[ir] validated IR:` do próprio app (sonda leve, perigo 8).

**4. Cliquei no lugar errado e não mandei a mensagem.** A janela mudou de 764 para
706 px entre dois screenshots; o clique de "enviar" caiu no seletor de conexão.
Passei a reler as coordenadas de um screenshot fresco antes de cada envio.

**5. `performance.getEntriesByType("resource")` me deu lixo.** O buffer de 250
entradas estava cheio e os dois matches de "openai" eram URLs de módulo do Vite
(`openai.ts`), não a chamada à API. Trocado por um `PerformanceObserver` filtrando
`https://api.openai.com`.

**6. Medi `domEdges: 0` com o overlay de sugestão aberto.** A medição do A-run1
rodou antes de clicar "Aceitar". Refeita depois; o seletor devolveu 33.

Perdi ainda dois `javascript_tool` para `[BLOCKED: Cookie/query string data]`
(script continha `Bearer ` + chave literal) e a extensão do Chrome caiu duas vezes,
apagando os diagramas F1-* do workspace. Nenhum dos dois afetou um número.

---

## 6. Como reproduzir

```bash
# suíte inteira, sem o retry: 2 do vitest.config.ts
npx vitest run --retry=0

# só as três suítes desta fatia
npx vitest run --retry=0 \
  src/features/llm/providers/stop-reason.test.ts \
  src/features/llm/store.generate-truncation.test.ts \
  src/infrastructure/i18n/locales.parity.test.ts

# typecheck
npx tsc -b

# mutação A (a que já falhou em morder uma vez)
sed -i '' 's/OPENAI_MAX_OUTPUT_TOKENS = 16000/OPENAI_MAX_OUTPUT_TOKENS = 3000/' \
  src/features/llm/providers/openai.ts
npx vitest run --retry=0 src/features/llm/providers/stop-reason.test.ts
git checkout src/features/llm/providers/openai.ts
```

As medições de browser (§1.1, §1.2, §1.4–1.6, §4) precisam da aba em primeiro plano
e de uma conexão OpenAI configurada; o método de cada uma está no campo `how` do
JSON correspondente em `docs/fatia1-transporte/`.

---

## 7. O que a próxima fatia herda

Em ordem de bloqueio, sem propor solução:

1. **Aresta para container descartada** (§4). É o único achado que perde informação
   do usuário sem avisar. Precisa de decisão de produto antes de código.
2. **O redesenho por handles multiplica cruzamentos** (§1.5c) — até 3× o que o ELK
   entregou, e sobreposições aresta-nó de 0 para 36.
3. **A geometria varia demais entre runs do mesmo prompt** (§1.5b). Sem entender
   isso, qualquer métrica de qualidade de layout medida em um run é anedota.
4. **Anthropic e proxy continuam não exercitados** (§3.1, §3.2).

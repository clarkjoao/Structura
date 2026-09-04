# Collab — migração para patches por entidade

> **Status:** implementado — fases 1 a 9 concluídas
> **Início:** 2026-09-03
> **Branch:** `improve/collab`
> **Decisão anterior:** [collab-architecture-study.md](./collab-architecture-study.md)

Documento vivo. Cada fase registra o que foi feito, o que foi medido e o que
ficou pendente.

---

## 1. Problema

O transporte é last-write-wins **por coleção inteira**. `diffPatch` envia
`patch.nodeLayouts = current.nodeLayouts` — o mapa completo — e tanto
`applyPatch` (servidor) quanto `onPatch` (cliente) substituem a coleção toda.

Duas consequências:

1. **Correção.** Dois usuários movendo nós *diferentes* disputam a mesma chave.
   O último a escrever reverte o outro.
2. **Escala.** Cada edição num diagrama de 300 nós trafega ~21KB em vez de
   ~70 bytes, e o operation log guarda esses patches inteiros.

---

## 2. Decisão

**Patches por entidade**, não operações tipadas.

Descartamos a proposta de ops tipadas do estudo (`UPDATE_NODE_LAYOUT`,
`REMOVE_NODE`, linhas 621-646) porque ela exige um tipo de op e um handler por
feature, coloca conhecimento de domínio no servidor (cascade de arestas) e
entrega semântica de conflito que o produto não pediu. O gargalo medido é
payload, não semântica.

### Forma do estado (o que torna isso simples)

Uniformemente **dois níveis**: `coleção → entityId → entidade`.

| Coleções (7) | Escalares (5) |
|---|---|
| `components`, `connections`, `flows`, `iconLibrary`, `nodeLayouts`, `edgeLayouts`, `scenes` | `diagramName`, `domain`, `description`, `activeSceneId`, `compareSceneId` |

`NodeLayout` = `{elementId, x, y, zIndex?, width?, height?}` — ~60 bytes.

### Formato de fio

As chaves de topo **não mudam**. Muda a semântica de merge:

```jsonc
// antes: "substitua nodeLayouts inteiro"
{"nodeLayouts": { /* os 300 nós */ }}

// depois: "faça merge destas entradas; null remove"
{"nodeLayouts": {"node-42": {"elementId":"node-42","x":120,"y":300}}}
{"nodeLayouts": {"node-42": null}}   // tombstone
```

### Regra de merge — genérica, sem lista de coleções

O servidor **não** conhece os nomes das coleções. A regra é estrutural:

- valor é objeto → é coleção: merge um nível, `null` na entrada remove
- valor é primitivo ou `null` → é escalar: atribui

Assim, adicionar uma coleção nova no futuro não exige tocar no servidor. A
invariante a manter: *todo valor objeto no topo do patch é uma coleção de
entidades*.

O caminho de snapshot (`host:join`, `session:init`, `SYNC_SNAPSHOT`) continua
substituindo tudo — não passa por essa regra.

---

## 3. Validação prévia (feita antes de implementar)

Simulamos os dois formatos no harness de carga, mesma carga, só trocando o
patch. Cenário pesado: 50 salas × 15, 300 nós, 6 editores/sala a 4Hz.

| | coleção inteira | por entidade | ganho |
|---|---|---|---|
| Patch p50 / p99 / máx | 101 / 657 / 2135 ms | **13 / 27 / 33 ms** | ~24× no p99 |
| Cursor p50 | 93 ms | **11 ms** | 8× |
| Event loop lag médio | 54,4 ms | **0,73 ms** | 74× |
| Heap pico | 730 MB | **66 MB** | 11× |
| Bytes trafegados | 1180 MB | **127 MB** | 9,3× |

Reproduzir: `PATCH_MODE=entity npm run loadtest` (em `server/`).

---

## 4. Plano

| # | Fase | Status |
|---|---|---|
| 1 | `diffPatch` por entidade + teste que falha antes | ✅ |
| 2 | `applyPatch` no servidor (merge genérico + tombstone) | ✅ |
| 3 | `onPatch` no cliente (merge em vez de substituir) | ✅ |
| 4 | Versão de protocolo no handshake | ✅ |
| 5 | `it.skip` vira teste real de convergência | ✅ |
| 6 | Revalidar carga e comparar com a tabela acima | ✅ |
| 7 | Tombstones com janela (remove-wins) | ✅ |
| 8 | Detecção de gap movida para onde é observável | ✅ |
| 9 | Replay no reconnect | ✅ |

### Ordem e porquê

`diffPatch` primeiro porque é onde o formato nasce; com ele pronto dá para
escrever o teste de convergência que até então era `it.skip`. Servidor antes do
cliente porque o servidor é quem guarda o estado autoritativo. A versão de
protocolo por último, mas **antes de qualquer deploy**.

---

## 5. Riscos conhecidos

### ~~Deletes podem ressuscitar~~ — resolvido na fase 7
A apaga `node-7`, B move `node-7` concorrentemente → o move recriava o nó, e
como o delete cobre várias coleções enquanto a edição em voo costuma tocar uma
só, ele voltava **órfão** (layout sem componente). Resolvido com remove-wins
por janela — ver fase 7.

### Mudança de semântica é silenciosa
Cliente antigo + servidor novo interpretaria o patch esparso como "a coleção
agora só tem 1 entrada" e **apagaria o diagrama na tela**. É o risco real da
transição — por isso a fase 4 é obrigatória antes de deploy.
Mitigação de migração: `rooms` é um `Map` em memória, salas não sobrevivem a
restart, então não há estado para migrar; deploy coordenado basta.

### Cascade delete
Resolve sozinho: o diff sai do estado real da store, então apagar um nó já faz
as arestas sumirem de `connections` e o diff emite os tombstones. Ninguém
precisa codificar a intenção.

---

## 6. Registro de execução

### Fase 1 — `diffPatch` por entidade

`src/features/collaboration/hooks/useCollabStoreSync.ts`

Novo `diffCollection(previous, current)`: percorre as chaves comparando **por
referência** (a store atualiza imutavelmente, então entidade intocada mantém
identidade). Emite só o que mudou; `null` para removida. O(n) de comparações de
ponteiro, não deep diff.

`diffPatch` passou a iterar `ENTITY_COLLECTIONS` (as 7) chamando `diffCollection`.
Os 5 escalares continuam indo inteiros.

`diffCollection` e `diffPatch` foram exportados para teste.

**Prova:** substituí `diffCollection` por `return {...current}` (o comportamento
antigo) e **9 dos 11 testes falharam**. Restaurado, 11/11 passam.

### Fase 2 — `applyPatch` no servidor

`server/src/collab.ts`

Merge estrutural, sem lista de coleções: valor objeto → merge um nível com
`null` removendo a entidade; qualquer outra coisa → atribui. Adicionar coleção
nova no domínio não exige tocar no servidor.

**Prova:** o teste de convergência falhava com `layouts["node-a"] === undefined`
(o patch do guest apagava o mapa inteiro) e passou depois da mudança.

### Fase 3 — `onPatch` no cliente

Novo `mergeCollection(existing, delta)` espelhando a regra do servidor. Retorna
a **referência original** quando não há nada a aplicar, para não invalidar
memoização à toa. Substituiu 7 blocos de `patch.x ? patch.x : diagram.x`.

### Fase 4 — versão de protocolo

`COLLAB_PROTOCOL_VERSION = 2`, enviado em `host:join`/`guest:join` e validado no
servidor. Join sem `protocol` é tratado como v1 e **recusado** com
`protocol_mismatch` + close.

Sem isso, um cliente v1 contra servidor v2 leria "estas entidades mudaram" como
"a coleção agora só tem estas" e apagaria o diagrama na tela do usuário. É o
único risco real da transição, e agora é impossível.

### Fase 5 — testes

- `it.skip` "[conhecido] ... sobrescrita" **removido** — a limitação deixou de existir.
- Novo `server/src/collab.test.ts`: convergência (dois clientes, nós diferentes,
  ambos sobrevivem), tombstone (remove uma entidade sem tocar nas irmãs),
  guard de protocolo. Servidor: 10 → **13 testes**.
- Novo `src/features/collaboration/__tests__/useCollabStoreSync.test.ts`: 11
  testes de `diffCollection`/`diffPatch`. Cliente: 10+1 skip → **21 testes**.

### Fase 6 — carga revalidada

Cenário pesado (50×15, 300 nós, 6 editores/sala a 4Hz), agora com a
implementação real em vez da simulação do harness:

| | antes (coleção) | previsto (simulado) | **medido (real)** |
|---|---|---|---|
| Patch p50 | 101 ms | 13 ms | **5 ms** |
| Patch p99 | 657 ms | 27 ms | **21 ms** |
| Cursor p50 | 93 ms | 11 ms | **11 ms** |
| Loop lag médio | 54,4 ms | 0,73 ms | **0,76 ms** |
| Heap pico | 730 MB | 66 MB | **85 MB** |
| Bytes trafegados | 1180 MB | 127 MB | **126 MB** |

A implementação real bateu a previsão (p99 31× melhor que o baseline).

### Estado da verificação

- `npm run typecheck` limpo na raiz e em `server/`
- 13 testes de servidor + 21 de cliente, todos verdes
- Lint: `useCollabStoreSync.ts` limpo; `useCollab.ts` idêntico ao estado anterior
  (nenhuma regra nova)

---

### Fase 7 — tombstones com janela (remove-wins)

`server/src/collab.ts`

O servidor passa a guardar por sala `coleção → entityId → versão em que foi
apagada`. Uma escrita numa entidade apagada em versão `D` é **descartada** se o
remetente declarou versão `< D` — ele não tinha visto o delete. Se declarou
`>= D`, sabia e está recriando de propósito: a escrita vale e o tombstone é
limpo.

Duas consequências que exigiram cuidado:

1. **O broadcast leva o patch efetivo, não o recebido.** `applyPatch` passou a
   retornar o que de fato entrou. Se o servidor suprime uma escrita e mesmo
   assim retransmite o patch original, os peers aplicam a ressurreição que o
   servidor não tem — e divergem em silêncio. O oplog também registra o efetivo,
   senão o replay reproduz um estado que nunca existiu.
2. **Poda.** Tombstones anteriores ao último snapshot são inúteis (quem está
   tão atrasado recebe o snapshot inteiro), então são removidos junto com a
   poda do oplog. A memória fica limitada sem precisar de TTL.

**Bug encontrado de permeio:** o teste falhou por um motivo diferente do
esperado — `host:ack` de sala **nova** não mandava `version` (só o caminho de
sala retomada mandava). Sem isso o host não tinha versão para declarar ao
enviar patches, e o guard não conseguia decidir. Corrigido; `host:ack` agora
carrega `version` e `protocol` nos dois caminhos.

**Testes:** ressurreição bloqueada, recriação deliberada permitida. Servidor:
13 → **15 testes**.

**Carga:** sem regressão. A primeira medição deu p50 16ms, a segunda p50 4ms /
lag 0,89ms — dentro da variância já documentada e igual ao pré-tombstone.

### Fase 8 — detecção de gap no lugar certo

Entrei nesta fase para *reativar* o gate de version gap no servidor. A medição
disse o contrário: o certo era **removê-lo**.

**Medido antes de decidir.** Instrumentei o harness para contar resyncs, com o
worker declarando `version` nos patches como o cliente real faz. Cenário
padrão, 30s:

| | antes | depois |
|---|---|---|
| `SYNC_REQUIRED` emitidos | **23.800** (~793/s) | **0** |
| Operações reenviadas | **137.181** | **0** |

Quase 5% de todos os patches disparavam um round trip de resync — para clientes
conectados que não tinham perdido nada.

**Por que o gate estava errado.** O servidor comparava a versão declarada pelo
remetente com a da sala e concluía "gap". Mas num socket ordenado e confiável um
cliente conectado **não perde broadcast**: essa diferença é concorrência e
latência em voo, nunca perda. O servidor não tem como distinguir as duas coisas
— da posição dele elas são idênticas.

Além de desperdício, era prejudicial: o `SYNC_COMPLETE` reaplica operações
antigas, e uma op antiga carrega o valor antigo da entidade — podendo **reverter
edição mais nova** do próprio cliente.

**Onde a detecção passou a viver.** No cliente, no fluxo de broadcast: as versões
chegam uma a uma, então `version > conhecida + 1` significa que operações
realmente faltaram. É o único ponto em que perda é observável, e aí o cliente
pede `sync:request` sozinho. `SYNC_REQUIRED` deixou de existir.

**Bug de permeio:** `baseVersion` nunca era atualizado em patches comuns (havia
até um comentário afirmando que era proposital), então todo `sync:request` pedia
replay desde o momento do join — o que explica as 137 mil ops. Os dois campos
viraram um só, sempre atual.

**Testes:** servidor afirma que cliente atrasado não recebe resync; cliente
afirma que salto de versão pede sync e que versões consecutivas não pedem.
Cliente: 21 → **23 testes**. Verifiquei desabilitando a detecção — o teste falha.

### Fase 9 — replay no reconnect

Até aqui, todo cliente que reconectava recebia o diagrama inteiro. Agora ele
declara a versão que já tem e o servidor manda só as operações que faltaram.

**Ganho medido** (`npx tsx loadtest/measure-resume.ts`), diagrama de 300 nós com
5 edições perdidas durante a queda:

| | bytes |
|---|---|
| Join novo (snapshot) | 22,4 KB |
| Rejoin (replay) | **1,0 KB** |
| | **95,4% menor** |

**O risco que definiu o desenho.** `sendRaw` descarta em silêncio quando o socket
não está aberto. Hoje o snapshot completo sobrescreve qualquer edição feita
offline: perde o dado, mas cliente e servidor ficam consistentes. Com replay
essa edição **sobreviveria localmente e divergiria calada** — pior que perdê-la.

Então o resume só acontece quando o estado local comprovadamente equivale à
versão declarada. O cliente só emite `resumeFrom` se, no momento da queda:

- nada estava sem ACK (`pendingOps` vazio), **e**
- nada estava enfileirado (`pendingBatch` vazio), **e**
- nenhum envio foi tentado enquanto o socket estava fechado — qualquer chamada a
  `sendRaw` com socket fora do ar invalida o passe na hora

Fora dessas condições cai no snapshot completo, que é o comportamento antigo.
Isso cobre o caso dominante (queda com o usuário parado ou entre edições) sem
apostar em reconciliação.

**Do lado do servidor**, `replayableFrom` recusa o replay se a versão pedida for
anterior ao último snapshot, se o log não tiver a operação seguinte à pedida
(buraco no meio) ou se a versão for impossível. Em qualquer recusa manda o
snapshot. O `session:init` passa a carregar `operations` **ou** `snapshot`,
nunca os dois.

**Testes:** servidor afirma replay no rejoin, snapshot no join novo e fallback
quando o log não cobre. Cliente afirma que o passe é emitido na queda limpa e
**negado** nos dois modos de sujeira, e que operações no lugar do snapshot são
aplicadas como patches. Servidor: 15 → **18**; cliente: 23 → **27**. Verifiquei
desabilitando o guard — os dois testes de negação falham.

---

### Fase 10 — divergência persistente: as duas metades que faltavam

**Como apareceu.** A pergunta era de *fluidez*, não de correção: o canvas parecia
travado com 15 pessoas. A investigação de desempenho (fase 11) exigiu comparar o
estado final de todo mundo, e a comparação por **conteúdo** — não por contagem de
nós, que era o que o stress test checava — mostrou outra coisa: 5 a 8 de 14
convidados terminavam com **1 ou 2 nós em posições diferentes**, com desvios de
até 500px, e **não convergiam** depois de 12 segundos de silêncio.

Não era corrida de medição: a leitura aos 4s e aos 12s dava exatamente o mesmo
resultado. Também não era rate limit — os 382 patches enviados receberam 382
acks, zero rejeições. E não era renderização: comparando o store persistido em
vez do DOM, a divergência estava no **dado**.

Duas causas independentes, cada uma capaz de perder uma edição sozinha.

**Causa 1 — o loop de sync engolia a edição local.** `useCollabStoreSync` mantém
uma baseline do que os pares já sabem e transmite a diferença uma vez por frame.
Ao aplicar um patch remoto, ele resetava essa baseline para o estado **inteiro**
do store. Uma edição local que ainda esperava seu frame passava a fazer parte da
baseline sem nunca ter sido enviada: quem moveu ficava com a posição nova, todo
o resto ficava com a antiga, e nada reconciliava.

A baseline agora avança **exatamente pelo patch aplicado** (`applyPatchToTracked`),
reusando os objetos do próprio patch para que o diff seguinte os veja como
inalterados. O patch remoto continua não ecoando, e a edição local sobrevive.
Isso tornou o `isApplyingRemoteRef` desnecessário — o subscriber não precisa mais
de caso especial.

**Causa 2 — o remetente não via a própria operação.** O servidor transmitia com
`exceptClientId: state.clientId`. O remetente, então, tinha uma visão ordenada da
sala com um buraco: as próprias operações. Sequência real: B move o nó (v10), A
move o mesmo nó (v11). O servidor guarda o valor de A. A recebe o v10 de B
*depois* de ter enviado o v11 e o aplica — e como o v11 nunca chega até A, A fica
permanentemente com o valor de B enquanto a sala tem o de A.

O remetente passou a ser incluído no broadcast de patches. Não há eco: a baseline
do cliente avança pelo mesmo patch, então o diff seguinte não encontra diferença.
A exclusão continua onde faz sentido, no `peer:joined`.

**Medição (produção, 40 nós, 13 convidados + host, 30s):**

| | divergentes | host vs servidor |
|---|---|---|
| antes | 5–8 de 14, toda execução | — |
| só correção do servidor | 3 de 13 | bate |
| ambas | **0 de 13**, três execuções | bate |

**Testes:** cliente afirma que um movimento local sobrevive a um patch remoto que
chega no mesmo frame, e que um patch aplicado não é ecoado. Servidor afirma que o
remetente recebe a própria operação com versão maior que a do peer anterior.
Verifiquei os dois desabilitando a correção: ambos falham.

---

### Fase 11 — a fluidez não estava onde eu procurei

A hipótese era tamanho e frequência das mensagens. Medindo o fio com 14 editores:
**5–15 KB/s, ~10 mensagens/s, patch mediano de 1 entidade e ~240 bytes**. O
trabalho por entidade das fases 1–3 já tinha resolvido isso.

Correlacionando cada long task com o que chegou nos 120ms anteriores, não há
relação com o tamanho: uma travada de **182ms** carregava **474 bytes**; uma de
67ms carregava 7,4KB; uma de 150ms não teve mensagem nenhuma. O custo escala com
os nós **na tela**, não com os alterados — 5 nós: 62ms bloqueado; 60 nós: 2292ms,
com o mesmo tráfego.

Onde o tempo está, pelo trace do renderer (produção, dentro das long tasks):
**PrePaint 44,6%**, JS 16,5%. É o pipeline de paint do Blink, não o nosso código.
Duas hipóteses minhas caíram por medição: `useCanvasNodes` custa 2,6% do tempo
bloqueado e reaproveita 98,4% dos objetos de nó; e o DOM recebe 3 escritas por
entidade alterada, sem amplificação.

E o build importa mais que tudo isso: **dev 123–168 ms/s bloqueado, produção
9–31 ms/s** na mesma configuração. O stress test que motivou a pergunta rodava em
dev.

Duas tentativas de otimização (fatia de presença separada e buffer de commit por
rAF) mediram **pior** que a baseline e foram descartadas.

**Ferramentas que ficaram:** `scripts/collab-wire.mjs` (tráfego, convergência por
conteúdo contra a verdade do servidor, escritas de DOM), `scripts/collab-trace.mjs`
(timeline do renderer dentro das long tasks) e `scripts/collab-profile.mjs`
(perfil de CPU do host).

---

## 7. O que ficou de fora

- **Granularidade de campo dentro da entidade.** Dois usuários editando campos
  diferentes do *mesmo* componente ainda disputam. Bem mais raro que o caso de
  nós diferentes, que era o que doía; refinamento futuro se aparecer demanda.
- **Reconciliar edições feitas offline.** Quando há edição sem envio, o resume
  é recusado e o snapshot descarta essa edição. Reconciliar de verdade exigiria
  reenviar as operações pendentes com o conteúdo — hoje `pendingOps` guarda só o
  id, não o patch.
- **Checksum de snapshot como rede de segurança.** As duas causas da fase 10
  foram encontradas e corrigidas, mas nada *detecta* divergência: um cliente que
  perca um patch por qualquer outro motivo fica calado para sempre. Um checksum
  do snapshot no `PERIODIC_SNAPSHOT`, comparado pelo cliente, transformaria isso
  num resync automático. Hoje o `collab-wire.mjs` faz essa comparação de fora,
  que é o suficiente para o teste mas não para produção.
- **Tombstone para escrita sem versão declarada.** Um cliente que não manda
  `version` não pode ser avaliado e a escrita passa. Hoje é inalcançável — o
  guard de protocolo já recusa qualquer cliente que não seja v2, e o v2 sempre
  declara versão — mas o caminho existe no código.

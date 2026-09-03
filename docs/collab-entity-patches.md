# Collab — migração para patches por entidade

> **Status:** implementado — fases 1 a 6 concluídas
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

### Ordem e porquê

`diffPatch` primeiro porque é onde o formato nasce; com ele pronto dá para
escrever o teste de convergência que até então era `it.skip`. Servidor antes do
cliente porque o servidor é quem guarda o estado autoritativo. A versão de
protocolo por último, mas **antes de qualquer deploy**.

---

## 5. Riscos conhecidos

### Deletes podem ressuscitar
A apaga `node-7`, B move `node-7` concorrentemente → o move recria o nó.
**Decisão:** aceitar por ora (raro, visível, desfazível). Se incomodar, set de
tombstones no servidor com janela igual à retenção do oplog (~40 linhas).

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

## 7. O que ficou de fora

- **Tombstones com janela no servidor.** Delete concorrente com edit ainda pode
  ressuscitar a entidade. Decisão consciente (ver seção 5).
- **Granularidade de campo dentro da entidade.** Dois usuários editando campos
  diferentes do *mesmo* componente ainda disputam. Bem mais raro que o caso de
  nós diferentes, que era o que doía; refinamento futuro se aparecer demanda.
- **Reativar o gate de version gap.** Com patches disjuntos por entidade ele
  volta a fazer sentido (foi removido porque sob LWW-de-coleção não protegia
  nada). Não reativado nesta rodada.

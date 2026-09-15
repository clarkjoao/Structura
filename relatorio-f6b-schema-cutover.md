# Relatório — Fatia F6b: corte de schema (`cloudServiceId`)

**Branch:** `feat/element-registry-f6b-schema-cutover`  
**Base:** `feat/element-registry-f6a-schema-tolerance`  
**Data:** 2026-09-14

---

## ⛔ NÃO MERGEAR / NÃO DEPLOYAR

Esta branch está **pronta em código** (gates locais verdes), mas **não deve ser
mergeada nem deployada** até um humano confirmar que **F6a já rodou tempo
suficiente em produção**.

Motivo (plano §2.1.2 / relatório F6a): o checksum de colaboração **diverge**
entre um cliente que ainda grava `awsService`/`gcpService`/`azureService` e um
que grava `cloudServiceId`. Não existe gate de versão de schema de `Component`
(só `COLLAB_PROTOCOL_VERSION` de transporte). Uma sala mista F6a-writer +
F6b-writer quebra paridade de checksum — essa é a natureza do corte, não um bug
a “consertar” nesta fatia.

**Decisão de merge = humana.** Esta sessão não abre PR e não trata a fatia como
pronta para a linha de produção.

---

## Decisão de nome — Opção A: `cloudServiceId`

| Opção | Campo unificado | Resultado |
|-------|-----------------|-----------|
| **A (escolhida)** | `cloudServiceId` | Nome próprio para id de serviço de nuvem |
| B | reutilizar `serviceId` | **Rejeitada** |

**Por que não B:** `BaseComponent.serviceId` já é o **catálogo de negócio** desde
a migração v11 (`migrateUnifyRegistryServiceId`). Coexiste com campos de nuvem:
a UI permite `linkComponentToService` em nós cloud; testes F6a modelam
`awsService: "lambda"` + `serviceId: "svc-pay"` no mesmo componente. Gravar o id
de nuvem em `serviceId` recria a colisão **na escrita**, sem `??` para
desambiguar.

**Desvio vs plano/proposta:** aqueles documentos pediam `serviceId` para o corte
F6 — foram escritos **antes** de F6a descobrir a colisão. Este relatório registra
o desvio com a mesma honestidade das correções de contrato anteriores.

**Leitura tolerante (F6a, preservada e estendida):**

```
cloudServiceId ?? awsService ?? gcpService ?? azureService ?? serviceId
```

(`serviceId` de catálogo continua por último.)

---

## O que foi implementado

1. **Tipos** — `AwsComponent` / `GcpComponent` / `AzureComponent` usam
   `cloudServiceId?`; campos legados só existem na leitura tolerante.
2. **Migração `migrateUnifyCloudServiceId`** — `PERSIST_SCHEMA_VERSION` **12 → 13**;
   varre `snapshot.components` e `scenes[*].addedComponents`; copia o primeiro
   legado não-vazio para `cloudServiceId` (se vazio); `delete` dos três legados.
3. **Gravação** — families (`attachService`), `ComponentPanel`, import draw.io,
   patterns, generated-graph / IR apply, templates — escrevem `cloudServiceId`.
4. **`addComponent`** — 5º parâmetro posicional renomeado de `awsService` para
   `cloudServiceId` (assinatura posicional mantida para não quebrar
   ElementPicker / QuickInsert). `ElementCreateOptions.serviceId` permanece o
   input de criação da palette; `attachService` mapeia para o campo persistido
   `cloudServiceId`.
5. **Fixtures Component** — `patterns.ts`, `urlshort-example.ts`, goldens /
   testes de export/clipboard migrados para `cloudServiceId`.
6. **Baselines IR (`B-run*.ts`, `reference-diagrams.ts`)** — **não migrados**.
   São `DiagramIR` com `IRNode.awsService` (schema IR / LLM), não `Component`.
   O plano §2.1.1 os listou junto com fixtures de Component por engano de
   classificação. Apply-time já mapeia `awsService` → `cloudServiceId`. Testes
   de layout/baselines reconferidos: **passam sem alteração de números**.
7. **Round-trip** — `persist.cloud-service-id.migration.test.ts`.
8. **Checksum** — teste reescrito: F6b write vs legado **deve divergir**;
   `resolveCloudServiceId` entende ambos (cliente F6a ainda lê o campo novo).
9. **Golden export** — inalterado em conteúdo gerado (leitura via
   `resolveCloudServiceId`); fixtures de teste usam `cloudServiceId`.

---

## Fora de escopo (intocado)

- Merge / PR / deploy
- Gate de versão de collab
- Kubernetes / `oss`
- Catch-all
- Tools hierárquicas do LLM (`awsService` no IR / tools permanece)

---

## Gates

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | OK |
| Vitest (migração, checksum, families, IR, golden, layout baselines) | OK |
| `npm run lint` (erros pré-existentes em arquivos não tocados) | Sem erros novos nos arquivos desta fatia |
| `sync-shared.mjs --check` | Sem alteração em `src/lib/export-core` nesta fatia (nada a re-sincronizar). Execução direta do script no ambiente da sessão falhou por inacessibilidade do path `plugins/` ao runtime Node; conteúdo export-core verificado via `git diff` vazio vs base F6a. |

---

## Commits (etapas)

Ver `git log` nesta branch a partir de F6a: decisão de nome / tipos → migração
v13 → gravação → parâmetro `addComponent` → fixtures/testes → este relatório.

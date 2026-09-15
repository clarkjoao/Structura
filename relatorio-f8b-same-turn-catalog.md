# Relatório F8b — mesmo turno: search_elements antes de add_node

Branch: `feat/element-registry-f8b-same-turn-catalog`  
Base: `feat/element-registry-f8-oss-llm-hierarchy`

## Achado de arquitetura

O loop **não** chama o modelo de novo com tool results no mesmo turno. Em
`llm/store.ts` o fluxo era:

1. aplicar `ADD_NODE` / `ADD_EDGE` (preview)
2. só depois executar `SEARCH_ELEMENTS` / `LIST_ELEMENT_FAMILIES` e anexar JSON à mensagem

Alimentar o **modelo** mid-turn exigiria um tool-loop (segunda chamada LLM) —
reestruturação maior, fora do escopo. O que é viável sem isso: processar as
catalog reads **antes** dos writes e usar os hits como gate no aplicador.

## Escolha

| Item                     | Decisão                                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Validação defensiva   | **Implementada** — antes só `isValidNodeType` no parser (tipo). `awsService`/categoria não eram checados; `addComponent` aceitava serviço inválido. Agora `validateAddNodeAgainstRegistry` exige tipo registrado e, em categorias cloud com serviços, um `serviceId` que pertença a essa categoria. |
| 2. Ordem no mesmo turno  | **Implementada** (aplicador, não modelo) — `runCatalogReadActions` roda primeiro; se o patch contém `search_elements`, todo `add_node` cloud precisa bater num hit daquele search.                                                                                                                  |
| Rejeitar patch combinado | Não — preferimos permitir search+add_node no mesmo patch **quando o add bate no search**.                                                                                                                                                                                                           |
| Prompt                   | Instrução: preferir turno só-search; se combinar, unmatched são skipped.                                                                                                                                                                                                                            |

## Comportamento

- `search` + `add_node(oss-datastore, redis)` alinhado → aplica
- `search(redis)` + `add_node(aws-compute, lambda)` → **skip** (não está nos hits)
- `add_node(oss-datastore, not-a-service)` → **skip** (registry)
- `add_node(system)` sem search → aplica (não-cloud)
- `add_node(oss-datastore, redis)` sem search no patch → aplica se o par for real (turno seguinte após o modelo ter visto o JSON)

## Trabalho futuro nomeado (não silencioso)

Tool-loop multi-turn nativo (modelo vê `tool` results e só então emite
`add_node`) continua desejável para UX; F8b mitiga corrupção e alucinação no
mesmo patch sem esse loop.

## Gates

typecheck · llm+elements 662 · `plugins:sync-check` ok

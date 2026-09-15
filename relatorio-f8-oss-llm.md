# Relatório F8 — família `oss` + catálogo LLM hierárquico

Branch: `feat/element-registry-f8-oss-llm-hierarchy`  
Base: `feat/element-registry-f7-kubernetes-family`

## Parte 1 — Família `oss`

Redis + Kafka via o mesmo `registerCloudFamily` / `CloudFamilyDefinition` de K8s.
Contrato **aguenta família plana** sem ajuste: duas categorias (`oss-datastore`,
`oss-messaging`), um serviço cada. Crescer (RabbitMQ, Elasticsearch) = novos
serviços nas natures existentes.

| Item           | Decisão                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Ícones         | Simple Icons (CC0 paths) + trademark caveats Redis® / Apache Kafka (`families/oss/ICONS_LICENSE.md`) |
| Export         | piso `image` (sem mxgraph)                                                                           |
| i18n + accents | mesmo gate de apresentação que F7                                                                    |

## Parte 2 — Catálogo hierárquico (decisão 10)

- `list_element_families` / `search_elements` em `tools.ts`
- Fora de `WRITE_TOOL_NAMES`; em `CATALOG_READ_TOOL_NAMES` (executáveis sem gate de confirmação)
- Dispatch em `apply-diagram-patch.ts`; parser converte esses toolCalls em actions
- `diagramFamilyMix` = contagem por `getElement(type).family` no diagrama ativo
- Prompt estático: structural/C4 detalhados; cloud/tech só famílias + categorias
- Resultados de catalog tools anexados à mensagem do assistente no generate (histórico para o próximo turno)

### Tamanho do bloco estático (números reais)

| Métrica                             | ANTES (F7 tip) | DEPOIS (F8) | Δ                            |
| ----------------------------------- | -------------- | ----------- | ---------------------------- |
| `allComponentTypes().length`        | 269            | 271 (+oss)  | +2                           |
| `buildComponentTypeCatalog()` chars | 7237           | 6106        | **−1131 (−15.6%)**           |
| catalog lines                       | 120            | 125         | +5 (instruções hierárquicas) |
| `buildSystemPrompt` chars           | 20381          | 20333       | **−48**                      |

O prompt total quase não encolhe porque as **duas tools novas** aumentam
`buildToolsSection`. O ganho está no catálogo (sem listas de service ids) e no
roteiro de descoberta. A estimativa do plano (~145 entradas verbose → famílias)
já tinha sido parcialmente antecipada pelo catálogo compacto de F5b; F8 remove o
restante das listas de serviços do bloco estático.

### Comportamento do assistente (comparação manual / análise)

Não rodei o modelo live nesta sessão (sem chave/turno multi-step aqui). Avaliação
honesta do desenho:

| Caso                | Antes                                           | Depois                                           | Risco                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "adicione um Redis" | modelo via lista OSS/AWS no prompt ou inventava | deve `search_elements` → `oss-datastore`+`redis` | **regressão possível no mesmo turno**: se o modelo emitir search + add_node juntos, o add_node não vê o resultado do search (resultado só entra no histórico da mensagem). Próximo turno fica informado. |
| "cache" ambíguo     | tendia a ElastiCache se AWS dominava o prompt   | `diagramFamilyMix` + search devem desambiguar    | melhora _se_ o modelo chamar `list_element_families`                                                                                                                                                     |
| nodeType inventado  | validado por `isValidNodeType`                  | igual                                            | estável                                                                                                                                                                                                  |

**Conclusão:** a fatia entrega o contrato da decisão 10 e encolhe o catálogo
estático, mas o loop de tools **não é multi-turn nativo** — resultados de
leitura só alimentam o próximo turno via texto da mensagem. Isso é a regressão
menos determinística que o plano antecipou; vale observar em uso real e, se
preciso, uma fatia futura de tool-loop.

## Performance

`allProviders×2000` continua no caminho cached da série
(`cloud-family-perf.baseline.test.ts`). +1 família oss.

## Gates

- typecheck ok
- testes elements + llm (incl. hierarchical + oss) ok
- `plugins:sync-check` ok

## Fora de escopo (respeitado)

Deploy F6b, limpeza final do repo, PR.

# ADR-012: Organizar componentes de mensageria em tier `backend`, não em `data`

**Status:** Aceito
**Data:** 2026-08-02
**Decisores:** Architecture-gen team

---

## Contexto e problema

O validador `edge/crosses-node`.reportava erros falsos positivos em diagramas de arquitetura
event-driven. O modelo gerava IRs como:

```
Product Service (application) ──→ DynamoDB (data)
              │
              └──→ SNS Topic (data)     ←── bloqueia a aresta acima
```

O validador verificava o segmento reto entre os centros dos nós e detectava que SNS (no tier
`data`) intersectava o retângulo da aresta Product Service → DynamoDB. O erro era legítimo do
ponto de vista geométrico, mas a correção proposta ("mova um endpoint para um tier adjacente")
era sem sentido para a topologia: o Product Service não vai para `data` e o DynamoDB não vai
para `gateway`.

O resultado era um loop de refinamento que nunca convergia: o modelo tentava mover nós entre
tiers, o validador disparava em outro par, e o diagrama nunca ficava limpo.

---

## Força motriz

1. **Zero erros de validação** no output do `propose_architecture`.
2. **Correções propositadas** — todo erro deve ter uma ação concreta em IR, não uma geo-metria.
3. **Sem quebra de compatibilidade** — existing IRs e eval harness existentes não podem quebrar.
4. **Regra simples e memorizável** — o modelo deve internalizar a decisão sem precisar consultar documentação.

---

## Opções consideradas

### Opção 1 — Tier `messaging` dedicado (REJEITADA)

Adicionar `messaging` como tier oficial entre `application` e `backend`:

```
tierSchema: ["external", "client", "gateway", "application",
              "messaging", "backend", "data", "cross-cutting"]
```

**Prós:**
- Separação semântica clara entre storage e messaging.

**Contras:**
- `flow/non-monotonic`: uma aresta `EventBridge (messaging) → Payment Service (application)`
  aponta contra a leitura left-to-right. O validador `flow/non-monotonic` exige que a aresta
  inverta (`Payment Service → EventBridge`), mas isso inverte a direção de evento.
- Não resolve: SNS no tier `messaging` ainda bloqueia arestas entre application e backend.
- Quebra o eval harness existente: todos os `aws-cases.ts` que usam SNS como tier `data`
  passariam a dar `layout/tier-not-in-layout`.
- Tiers vazios colapsam, mas o tier precisa existir para o modelo usar — adicioná-lo "só quando
  precisar" é mais confusão do que clareza.

### Opção 2 — Exceção de validação para edges que cruzam o tier `data` (REJEITADA)

Modificar `validateEdges` para exempt edges que cruzam nós SNS/SQS/EventBridge quando
ambos os endpoints são `application → data`.

**Prós:**
- Não muda schema nem skill.

**Contras:**
- Heurística frágil: qualquer SNS no `data` seria exempt, mesmo quando está posicionado
  incorretamente no IR.
- Esconde um problema de IR atrás de uma exceção de validação.
- A regra exata ("SNS/SQS/EventBridge em `data` é sempre exempt") é mais confusa do que
  a regra simples ("SNS vai em `backend`").

### Opção 3 — Regra na skill: event buses ficam em `backend` (ACEITA)

Escrever explicitamente na skill que SNS, SQS, EventBridge e Kafka pertencem ao tier
`backend`, não ao `data`. Nenhum改动 no schema, validator ou eval harness.

---

## Decisão

Adotar a **Opção 3**: mudar a descrição do tier `backend` na skill de "workers e batch jobs"
para "event buses, workers e batch jobs", e adicionar uma regra explícita:

> Event buses go in `backend`, not `data`. SNS, SQS, EventBridge and Kafka are messaging
> infrastructure, not storage — putting them in the `data` tier makes them block the edges
> between your services and their databases.

### Tier resultante

| Tier           | Conteúdo                                                       |
| -------------- | -------------------------------------------------------------- |
| `external`     | Pessoas, sistemas externos                                     |
| `client`       | Apps, CLIs                                                     |
| `gateway`      | API GW, ALB, CloudFront, WAF                                   |
| `application`  | Serviços de domínio                                            |
| `backend`      | SNS, SQS, EventBridge, Kafka, Lambda workers, batch jobs       |
| `data`         | DynamoDB, RDS, ElastiCache, S3 — apenas stores persistentes   |
| `cross-cutting`| CloudWatch, Cognito, secrets                                   |

---

## Consequências

**Positivas:**
- Elimina `edge/crosses-node` para o caso SNS → databases.
- Cada tier tem exatamente um papel semântico — sem ambiguidade de "o que vai em `data`?".
- O modelo internaliza a regra com uma frase.

**Negativas:**
- O modelo pode ainda colocar SNS no `data` se não ler a skill com atenção. A regra precisa
  estar presente nos testes de skill e no worked example.

**Mitigação:**
- Atualizar o worked example do eval harness para incluir SNS em `backend` como referência.
- Considerar adicionar `aws/invalid-tier` que verifica se SNS/SQS/EventBridge estão em
  `backend` — mas isso é futuro e não bloqueante.

---

## Acompanhamento

- [x] Skill atualizada com nova regra de tier
- [x] NAT Gateway adicionado ao catálogo AWS (erro paralelo `aws/unknown-service`)
- [x] ECS services agora são `type: "container"`, não `aws-*` sem `aws_service`
- [ ] Eval harness: atualizar `aws-cases.ts` para mover SNS/SQS para `backend` onde aplicável
- [ ] Worked example do skill pode ser expandido com um caso event-driven

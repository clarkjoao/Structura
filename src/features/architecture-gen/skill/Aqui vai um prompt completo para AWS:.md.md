Aqui vai um prompt completo para AWS:

---

**Prompt para colar no chat do Structura:**

```
Draw an AWS architecture diagram for a serverless e-commerce order processing system.

Use case: a customer places an order through a Next.js web app. The order API is an API Gateway backed by Lambda. The Lambda writes the order to DynamoDB and publishes an OrderPlaced event to EventBridge. An event-driven Lambda消费者 validates inventory via DynamoDB, then publishes an OrderConfirmed event. Another Lambda sends a confirmation email via SES. DynamoDB Streams trigger a Lambda to update a read model in RDS for the admin dashboard.

Include:
- CloudFront + S3 for static assets (web app)
- Cognito for customer authentication
- API Gateway → Lambda (order service)
- DynamoDB (orders table)
- EventBridge bus
- 3 Lambda consumers (inventory, confirmation, read model sync)
- RDS (admin read replica)
- SES for transactional email
- CloudWatch for observability
- SQS as dead-letter queue for failed Lambda invocations
```

---

Esse prompt vai forçar o modelo a:
- Usar tipos AWS específicos (`aws-compute`, `aws-database`, `aws-networking`, etc.)
- Posicionar em tiers corretos (client → gateway → application → data)
- Mostrar fluxos síncronos (API → Lambda → DynamoDB) e assíncronos (EventBridge → consumers)
- Incluir cross-cutting (CloudWatch, SQS DLQ)
- Criar boundaries se fizer sentido (VPC, ou não — o modelo pergunta se necessário)

Quer que eu ajuste para outro padrão (micro-serviços com ECS, event-driven completo, etc.)?
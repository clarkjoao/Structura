Prompt mais direto — elimina ambiguidade antes do modelo perguntar:

---

```
Draw a C4 container diagram for a microservices e-commerce platform.

Users authenticate via Cognito and browse products in a React web app served by CloudFront + S3.

Backend is split into three services behind an API Gateway:
- Product Service (Node.js) reads from DynamoDB (product catalog) and S3 (images)
- Order Service (Node.js) writes to DynamoDB (orders) and publishes OrderPlaced to SNS
- Payment Service (Node.js) subscribes to SNS OrderPlaced, charges via Stripe, publishes OrderPaid

A notification worker (Lambda) listens to SNS OrderPaid and sends confirmation email via SES.

All services emit logs to CloudWatch Logs; RDS (PostgreSQL) holds the analytics read model, updated by a nightly batch job (Lambda + EventBridge Schedule).

Infrastructure:
- VPC with public subnets for ALB, private subnets for ECS services, NAT Gateway for outbound
- SQS dead-letter queue for failed message deliveries
- ElastiCache Redis for session storage, shared across services

Show the three ECS services in a single VPC boundary. Put observability and caching in cross-cutting.
```

---

Esse prompt evita o problema anterior porque:
- **Conexões síncronas explícitas** (`API GW → Product Service → DynamoDB`)
- **SNS como subscriber pattern** — `Order Service → SNS → Payment Service`, sem `call` de volta ao SNS
- **Cross-cutting óbvio** — SES, CloudWatch, ElastiCache sem arestas desnecessárias
- **VPC boundary** — força o modelo a agrupar antes de wire
import type { ComponentType } from "@/features/diagram";

export interface PatternComponent {
  type: ComponentType;
  name: string;
  description?: string;
  technology?: string;
  awsService?: string;
}

export interface PatternConnection {
  fromIndex: number; // index into components array
  toIndex: number;
  label: string;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;
  components: PatternComponent[];
  connections: PatternConnection[];
}

export type PatternCategory =
  | "messaging"
  | "api"
  | "resilience"
  | "data"
  | "event-driven"
  | "security";

export const PATTERN_CATEGORY_LABELS: Record<PatternCategory, string> = {
  messaging: "Messaging",
  api: "API",
  resilience: "Resilience",
  data: "Data",
  "event-driven": "Event-Driven",
  security: "Security",
};

export const PATTERNS: PatternTemplate[] = [
  // ── Messaging ────────────────────────────────────────────────────────────
  {
    id: "fifo-queue-aws",
    name: "FIFO Queue (AWS SQS)",
    description:
      "Producer → SQS FIFO queue → Consumer. Guarantees ordered, exactly-once delivery.",
    category: "messaging",
    components: [
      { type: "container", name: "Producer", description: "Sends messages" },
      {
        type: "aws-integration",
        name: "SQS FIFO Queue",
        description: "Ordered message queue",
        awsService: "sqs",
      },
      { type: "container", name: "Consumer", description: "Processes messages" },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Enqueue" },
      { fromIndex: 1, toIndex: 2, label: "Dequeue" },
    ],
  },
  {
    id: "fifo-queue-kafka",
    name: "FIFO Queue (Kafka / MSK)",
    description:
      "Producer → Kafka topic → Consumer Group. High-throughput ordered log streaming.",
    category: "messaging",
    components: [
      { type: "container", name: "Producer", description: "Publishes events" },
      {
        type: "aws-analytics",
        name: "MSK Kafka Topic",
        description: "Distributed log",
        awsService: "msk",
      },
      {
        type: "container",
        name: "Consumer Group",
        description: "Reads partitions",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Publish" },
      { fromIndex: 1, toIndex: 2, label: "Subscribe" },
    ],
  },

  // ── API ───────────────────────────────────────────────────────────────────
  {
    id: "api-gateway-bff",
    name: "API Gateway + BFF",
    description:
      "Client → API Gateway → Backend For Frontend → downstream services.",
    category: "api",
    components: [
      { type: "person", name: "Client", description: "Web or mobile app" },
      {
        type: "aws-networking",
        name: "API Gateway",
        description: "Entry point, auth, rate-limiting",
        awsService: "api-gateway",
      },
      {
        type: "container",
        name: "BFF",
        description: "Backend for Frontend — aggregates APIs",
      },
      {
        type: "container",
        name: "Service A",
        description: "Downstream microservice",
      },
      {
        type: "container",
        name: "Service B",
        description: "Downstream microservice",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "HTTPS" },
      { fromIndex: 1, toIndex: 2, label: "Routes to" },
      { fromIndex: 2, toIndex: 3, label: "Calls" },
      { fromIndex: 2, toIndex: 4, label: "Calls" },
    ],
  },

  // ── Resilience ────────────────────────────────────────────────────────────
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    description:
      "Caller → Circuit Breaker → Provider. On failure the breaker opens and returns a fallback.",
    category: "resilience",
    components: [
      { type: "container", name: "Caller", description: "Service that calls" },
      {
        type: "component",
        name: "Circuit Breaker",
        description: "Monitors failure rate, opens on threshold",
      },
      {
        type: "container",
        name: "Provider",
        description: "Target service (potentially unavailable)",
      },
      {
        type: "component",
        name: "Fallback Handler",
        description: "Returns cached / default response when open",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Request" },
      { fromIndex: 1, toIndex: 2, label: "Forward (closed)" },
      { fromIndex: 1, toIndex: 3, label: "Short-circuit (open)" },
    ],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    id: "transactional-outbox",
    name: "Transactional Outbox",
    description:
      "Write to DB + outbox table atomically; relay polls and publishes events.",
    category: "data",
    components: [
      { type: "container", name: "Service", description: "Business logic" },
      {
        type: "aws-database",
        name: "Database",
        description: "Main DB + outbox table",
        awsService: "rds",
      },
      {
        type: "component",
        name: "Outbox Relay",
        description: "Polls outbox, publishes events",
      },
      {
        type: "aws-integration",
        name: "Message Broker",
        description: "EventBridge / SQS / Kafka",
        awsService: "eventbridge",
      },
      {
        type: "container",
        name: "Consumer",
        description: "Receives published events",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Write + outbox (tx)" },
      { fromIndex: 2, toIndex: 1, label: "Poll outbox" },
      { fromIndex: 2, toIndex: 3, label: "Publish event" },
      { fromIndex: 3, toIndex: 4, label: "Consume" },
    ],
  },
  {
    id: "cqrs",
    name: "CQRS",
    description:
      "Commands write to the write model; queries read from a dedicated read model.",
    category: "data",
    components: [
      { type: "person", name: "Client", description: "Sends commands & queries" },
      {
        type: "container",
        name: "Command Handler",
        description: "Validates and applies commands",
      },
      {
        type: "aws-database",
        name: "Write DB",
        description: "Source of truth",
        awsService: "rds",
      },
      {
        type: "component",
        name: "Projector",
        description: "Builds read model from events",
      },
      {
        type: "aws-database",
        name: "Read DB",
        description: "Optimised query store",
        awsService: "dynamodb",
      },
      {
        type: "container",
        name: "Query Handler",
        description: "Serves read-only queries",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Command" },
      { fromIndex: 1, toIndex: 2, label: "Persist" },
      { fromIndex: 2, toIndex: 3, label: "Domain events" },
      { fromIndex: 3, toIndex: 4, label: "Upsert" },
      { fromIndex: 0, toIndex: 5, label: "Query" },
      { fromIndex: 5, toIndex: 4, label: "Read" },
    ],
  },
  {
    id: "cache-aside",
    name: "Cache-Aside",
    description:
      "Application checks cache first; on miss reads DB and populates cache.",
    category: "data",
    components: [
      {
        type: "container",
        name: "Application",
        description: "Business service",
      },
      {
        type: "aws-database",
        name: "Cache",
        description: "ElastiCache / Redis",
        awsService: "elasticache",
      },
      {
        type: "aws-database",
        name: "Database",
        description: "Source of truth",
        awsService: "rds",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Read (hit)" },
      { fromIndex: 0, toIndex: 2, label: "Read (miss)" },
      { fromIndex: 0, toIndex: 1, label: "Populate cache" },
    ],
  },

  // ── Event-Driven ─────────────────────────────────────────────────────────
  {
    id: "saga-choreography",
    name: "Saga (Choreography)",
    description:
      "Each service publishes domain events; compensating events handle rollbacks.",
    category: "event-driven",
    components: [
      {
        type: "container",
        name: "Order Service",
        description: "Creates order, emits OrderCreated",
      },
      {
        type: "aws-integration",
        name: "Event Bus",
        description: "EventBridge / Kafka",
        awsService: "eventbridge",
      },
      {
        type: "container",
        name: "Payment Service",
        description: "Charges payment, emits PaymentProcessed",
      },
      {
        type: "container",
        name: "Inventory Service",
        description: "Reserves stock, emits StockReserved",
      },
      {
        type: "container",
        name: "Shipping Service",
        description: "Schedules shipment",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "OrderCreated" },
      { fromIndex: 1, toIndex: 2, label: "OrderCreated" },
      { fromIndex: 2, toIndex: 1, label: "PaymentProcessed" },
      { fromIndex: 1, toIndex: 3, label: "PaymentProcessed" },
      { fromIndex: 3, toIndex: 1, label: "StockReserved" },
      { fromIndex: 1, toIndex: 4, label: "StockReserved" },
    ],
  },
  {
    id: "event-sourcing",
    name: "Event Sourcing",
    description:
      "State derived from an append-only event log; projections build read views.",
    category: "event-driven",
    components: [
      {
        type: "container",
        name: "Command API",
        description: "Validates and emits events",
      },
      {
        type: "aws-database",
        name: "Event Store",
        description: "Append-only log (DynamoDB / Aurora)",
        awsService: "dynamodb",
      },
      {
        type: "component",
        name: "Projection Engine",
        description: "Replays events into read views",
      },
      {
        type: "aws-database",
        name: "Read Model",
        description: "Denormalised query store",
        awsService: "dynamodb",
      },
      {
        type: "container",
        name: "Query API",
        description: "Serves read requests",
      },
      {
        type: "person",
        name: "Client",
        description: "Sends commands and queries",
      },
    ],
    connections: [
      { fromIndex: 5, toIndex: 0, label: "Command" },
      { fromIndex: 0, toIndex: 1, label: "Append event" },
      { fromIndex: 1, toIndex: 2, label: "Stream events" },
      { fromIndex: 2, toIndex: 3, label: "Upsert view" },
      { fromIndex: 5, toIndex: 4, label: "Query" },
      { fromIndex: 4, toIndex: 3, label: "Read" },
    ],
  },

  // ── Messaging (new) ──────────────────────────────────────────────────────
  {
    id: "dead-letter-queue-aws",
    name: "Dead Letter Queue (AWS)",
    description:
      "SQS → Lambda processor; failed messages go to DLQ; CloudWatch alarms on DLQ depth.",
    category: "messaging",
    components: [
      {
        type: "aws-integration",
        name: "SQS Queue",
        description: "Main message queue",
        awsService: "sqs",
      },
      {
        type: "aws-compute",
        name: "Lambda Processor",
        description: "Processes messages",
        awsService: "lambda",
      },
      {
        type: "aws-integration",
        name: "Dead Letter Queue",
        description: "Failed messages",
        awsService: "sqs",
      },
      {
        type: "aws-management",
        name: "CloudWatch Alert",
        description: "Alarm on DLQ depth",
        awsService: "cloudwatch",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Triggers" },
      { fromIndex: 1, toIndex: 2, label: "Failed messages" },
      { fromIndex: 2, toIndex: 3, label: "Alarm on depth" },
    ],
  },
  {
    id: "fan-out",
    name: "Fan-out",
    description: "SNS topic fans out to multiple SQS queues for parallel processing.",
    category: "messaging",
    components: [
      {
        type: "aws-integration",
        name: "SNS Topic",
        description: "Pub/sub topic",
        awsService: "sns",
      },
      {
        type: "aws-integration",
        name: "SQS Queue A",
        description: "Subscriber queue",
        awsService: "sqs",
      },
      {
        type: "aws-integration",
        name: "SQS Queue B",
        description: "Subscriber queue",
        awsService: "sqs",
      },
      {
        type: "aws-integration",
        name: "SQS Queue C",
        description: "Subscriber queue",
        awsService: "sqs",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Fan-out" },
      { fromIndex: 0, toIndex: 2, label: "Fan-out" },
      { fromIndex: 0, toIndex: 3, label: "Fan-out" },
    ],
  },
  {
    id: "competing-consumers",
    name: "Competing Consumers",
    description:
      "Message broker distributes to multiple consumers; each writes to a shared database.",
    category: "messaging",
    components: [
      {
        type: "container",
        name: "Message Broker",
        description: "Distributes messages",
        technology: "Kafka / RabbitMQ",
      },
      { type: "container", name: "Consumer A", description: "Competing consumer" },
      { type: "container", name: "Consumer B", description: "Competing consumer" },
      { type: "container", name: "Consumer C", description: "Competing consumer" },
      {
        type: "container",
        name: "Database",
        description: "Shared persistence",
        technology: "PostgreSQL",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Distribute" },
      { fromIndex: 0, toIndex: 2, label: "Distribute" },
      { fromIndex: 0, toIndex: 3, label: "Distribute" },
      { fromIndex: 1, toIndex: 4, label: "Write" },
      { fromIndex: 2, toIndex: 4, label: "Write" },
      { fromIndex: 3, toIndex: 4, label: "Write" },
    ],
  },

  // ── Data (new) ───────────────────────────────────────────────────────────
  {
    id: "event-sourcing-cqrs",
    name: "Event Sourcing + CQRS",
    description:
      "Commands append to event store; event bus feeds projections; read model serves queries.",
    category: "data",
    components: [
      {
        type: "container",
        name: "Command Handler",
        description: "Validates and appends events",
      },
      {
        type: "container",
        name: "Event Store",
        description: "Append-only event log",
        technology: "EventStoreDB",
      },
      {
        type: "container",
        name: "Event Bus",
        description: "Publishes domain events",
        technology: "Kafka / EventBridge",
      },
      {
        type: "container",
        name: "Projection Builder",
        description: "Consumes events, builds read model",
      },
      {
        type: "container",
        name: "Read Model",
        description: "Query-optimised store",
        technology: "PostgreSQL / Redis",
      },
      {
        type: "container",
        name: "Query Handler",
        description: "Serves read-only queries",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Append event" },
      { fromIndex: 1, toIndex: 2, label: "Publish event" },
      { fromIndex: 2, toIndex: 3, label: "Consume" },
      { fromIndex: 3, toIndex: 4, label: "Update projection" },
      { fromIndex: 5, toIndex: 4, label: "Query" },
    ],
  },
  {
    id: "read-replica",
    name: "Read Replica",
    description: "Application writes to primary DB; reads from replica; primary replicates to replica.",
    category: "data",
    components: [
      { type: "container", name: "Application", description: "App service" },
      {
        type: "container",
        name: "Primary DB",
        description: "Source of truth",
        technology: "PostgreSQL",
      },
      {
        type: "container",
        name: "Read Replica",
        description: "Read-only copy",
        technology: "PostgreSQL",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Write" },
      { fromIndex: 0, toIndex: 2, label: "Read" },
      { fromIndex: 1, toIndex: 2, label: "Replicate" },
    ],
  },
  {
    id: "database-per-service",
    name: "Database per Service",
    description:
      "Each service owns its database; services communicate via event bus.",
    category: "data",
    components: [
      { type: "container", name: "Service A", description: "Bounded context A" },
      {
        type: "container",
        name: "Database A",
        description: "Service A data",
        technology: "PostgreSQL",
      },
      { type: "container", name: "Service B", description: "Bounded context B" },
      {
        type: "container",
        name: "Database B",
        description: "Service B data",
        technology: "MongoDB",
      },
      {
        type: "container",
        name: "Event Bus",
        description: "Async communication",
        technology: "Kafka",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Read/Write" },
      { fromIndex: 2, toIndex: 3, label: "Read/Write" },
      { fromIndex: 0, toIndex: 4, label: "Publish" },
      { fromIndex: 2, toIndex: 4, label: "Subscribe" },
    ],
  },
  {
    id: "multi-tier-cache",
    name: "Multi-tier Cache",
    description:
      "L1 in-memory cache; on miss check L2 (Redis); on miss hit DB; populate back up the chain.",
    category: "data",
    components: [
      { type: "container", name: "Application", description: "App service" },
      {
        type: "container",
        name: "L1 Cache",
        description: "In-process cache",
        technology: "In-memory",
      },
      {
        type: "container",
        name: "L2 Cache",
        description: "Distributed cache",
        technology: "Redis",
      },
      {
        type: "container",
        name: "Database",
        description: "Source of truth",
        technology: "PostgreSQL",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Check cache" },
      { fromIndex: 1, toIndex: 2, label: "Cache miss" },
      { fromIndex: 2, toIndex: 3, label: "Cache miss" },
      { fromIndex: 3, toIndex: 2, label: "Populate" },
      { fromIndex: 2, toIndex: 1, label: "Populate" },
    ],
  },

  // ── Security ─────────────────────────────────────────────────────────────
  {
    id: "policy-enforcement-point-opa",
    name: "Policy Enforcement Point (OPA)",
    description:
      "API Gateway delegates policy checks to OPA; OPA fetches policies from store; gateway forwards or denies.",
    category: "security",
    components: [
      { type: "person", name: "Client", description: "Request origin" },
      {
        type: "container",
        name: "API Gateway",
        description: "Entry point",
        technology: "Kong / Nginx",
      },
      {
        type: "container",
        name: "OPA Sidecar",
        description: "Policy evaluation",
        technology: "Open Policy Agent",
      },
      {
        type: "container",
        name: "Policy Store",
        description: "Policies (Git / bundle)",
        technology: "Git / Bundle",
      },
      { type: "container", name: "Service", description: "Backend service" },
      { type: "container", name: "Data Store", description: "Persistence" },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Request" },
      { fromIndex: 1, toIndex: 2, label: "Check policy" },
      { fromIndex: 2, toIndex: 3, label: "Fetch policies" },
      { fromIndex: 2, toIndex: 1, label: "Allow / Deny" },
      { fromIndex: 1, toIndex: 4, label: "Forward (if allowed)" },
      { fromIndex: 4, toIndex: 5, label: "Read/Write" },
    ],
  },
  {
    id: "rbac-with-opa",
    name: "RBAC with OPA",
    description:
      "User authenticates via Auth; OPA checks roles against Role Store; Auth issues token; user calls Resource with token.",
    category: "security",
    components: [
      { type: "person", name: "User", description: "End user" },
      {
        type: "container",
        name: "Auth Service",
        description: "Issues tokens",
        technology: "OAuth2 / OIDC",
      },
      {
        type: "container",
        name: "OPA Engine",
        description: "Role-based policy",
        technology: "Open Policy Agent",
      },
      {
        type: "container",
        name: "Role Store",
        description: "Roles and permissions",
        technology: "LDAP / DB",
      },
      {
        type: "container",
        name: "Resource Server",
        description: "Protected API",
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, label: "Authenticate" },
      { fromIndex: 1, toIndex: 2, label: "Check role" },
      { fromIndex: 2, toIndex: 3, label: "Fetch roles" },
      { fromIndex: 2, toIndex: 1, label: "Permit / Deny" },
      { fromIndex: 1, toIndex: 4, label: "Access token" },
      { fromIndex: 0, toIndex: 4, label: "Request + token" },
    ],
  },
];

export const PATTERNS_BY_CATEGORY = PATTERNS.reduce<
  Record<PatternCategory, PatternTemplate[]>
>(
  (acc, p) => {
    acc[p.category].push(p);
    return acc;
  },
  {
    messaging: [],
    api: [],
    resilience: [],
    data: [],
    "event-driven": [],
    security: [],
  },
);

import type { ComponentType } from "@/features/diagram";

export interface PatternComponent {
  type: ComponentType;
  name: string;
  description?: string;
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
  | "event-driven";

export const PATTERN_CATEGORY_LABELS: Record<PatternCategory, string> = {
  messaging: "Messaging",
  api: "API",
  resilience: "Resilience",
  data: "Data",
  "event-driven": "Event-Driven",
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
  },
);

import { edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";
const FIDELIS = "https://fidelissauro.dev";
const AWS_PG = "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns";

export const INTEGRATION_MESSAGING_PATTERNS: PatternTemplate[] = [
  {
    id: "publisher-subscriber",
    category: "integration-messaging",
    nodes: [
      service("publisher", 0, 1),
      role("topic", "topic", 1, 1),
      service("billing", 2, 0),
      service("shipping", 2, 1),
      service("analytics", 2, 2),
    ],
    edges: [
      edge("publisher", "topic", "publish"),
      edge("topic", "billing", "deliver"),
      edge("topic", "shipping", "deliver"),
      edge("topic", "analytics", "deliver"),
    ],
    references: {
      en: `${AZURE}/publisher-subscriber`,
      "pt-BR": `${FIDELIS}/mensageria-eventos-streaming/`,
    },
  },
  {
    id: "fan-out",
    category: "integration-messaging",
    nodes: [
      service("publisher", 0, 1),
      role("topic", "topic", 1, 1),
      role("queueA", "queue", 2, 0),
      role("queueB", "queue", 2, 2),
      service("workerA", 3, 0),
      service("workerB", 3, 2),
    ],
    edges: [
      edge("publisher", "topic", "publish"),
      edge("topic", "queueA", "deliver"),
      edge("topic", "queueB", "deliver"),
      edge("queueA", "workerA", "consume"),
      edge("queueB", "workerB", "consume"),
    ],
    references: {
      en: "https://docs.aws.amazon.com/sns/latest/dg/sns-common-scenarios.html",
      "pt-BR": `${FIDELIS}/mensageria-eventos-streaming/`,
    },
  },
  {
    id: "queue-based-load-leveling",
    category: "integration-messaging",
    nodes: [
      service("producer", 0, 1),
      role("queue", "queue", 1, 1),
      service("service", 2, 1),
      role("database", "relational-db", 3, 1),
    ],
    edges: [
      edge("producer", "queue", "enqueue"),
      edge("queue", "service", "consume"),
      edge("service", "database", "write"),
    ],
    references: {
      en: `${AZURE}/queue-based-load-leveling`,
      "pt-BR": `${AZURE_PT}/queue-based-load-leveling`,
    },
  },
  {
    id: "competing-consumers",
    category: "integration-messaging",
    nodes: [
      service("producer", 0, 1),
      role("queue", "queue", 1, 1),
      service("worker1", 2, 0),
      service("worker2", 2, 1),
      service("worker3", 2, 2),
    ],
    edges: [
      edge("producer", "queue", "enqueue"),
      edge("queue", "worker1", "consume"),
      edge("queue", "worker2", "consume"),
      edge("queue", "worker3", "consume"),
    ],
    references: {
      en: `${AZURE}/competing-consumers`,
      "pt-BR": `${AZURE_PT}/competing-consumers`,
    },
  },
  {
    id: "async-request-reply",
    category: "integration-messaging",
    nodes: [
      element("client", "person", 0, 1),
      service("api", 1, 1),
      role("statusStore", "nosql-db", 2, 0),
      role("queue", "queue", 2, 2),
      service("worker", 3, 1),
    ],
    edges: [
      edge("client", "api", "poll-status"),
      edge("api", "queue", "enqueue"),
      edge("api", "statusStore", "read-status"),
      edge("queue", "worker", "consume"),
      edge("worker", "statusStore", "write-status"),
    ],
    references: {
      en: `${AZURE}/async-request-reply`,
      "pt-BR": `${AZURE_PT}/async-request-reply`,
    },
  },
  {
    id: "claim-check",
    category: "integration-messaging",
    nodes: [
      service("sender", 0, 1),
      role("storage", "object-storage", 1, 0),
      role("queue", "queue", 1, 2),
      service("receiver", 2, 1),
    ],
    edges: [
      edge("sender", "storage", "store-payload"),
      edge("sender", "queue", "send-reference"),
      edge("queue", "receiver", "consume"),
      edge("receiver", "storage", "fetch-payload"),
    ],
    references: { en: `${AZURE}/claim-check`, "pt-BR": `${AZURE_PT}/claim-check` },
  },
  {
    id: "pipes-and-filters",
    category: "integration-messaging",
    nodes: [
      service("source", 0, 0),
      service("validate", 1, 0),
      service("enrich", 2, 0),
      service("transform", 3, 0),
      role("sink", "warehouse", 4, 0),
    ],
    edges: [
      edge("source", "validate", "pipe"),
      edge("validate", "enrich", "pipe"),
      edge("enrich", "transform", "pipe"),
      edge("transform", "sink", "pipe"),
    ],
    references: { en: `${AZURE}/pipes-and-filters`, "pt-BR": `${AZURE_PT}/pipes-and-filters` },
  },
  {
    id: "scatter-gather",
    category: "integration-messaging",
    nodes: [
      element("client", "person", 0, 1),
      service("aggregator", 1, 1),
      service("supplierA", 2, 0),
      service("supplierB", 2, 1),
      service("supplierC", 2, 2),
    ],
    edges: [
      edge("client", "aggregator", "request"),
      edge("aggregator", "supplierA", "scatter"),
      edge("aggregator", "supplierB", "scatter"),
      edge("aggregator", "supplierC", "scatter"),
    ],
    references: { en: `${AWS_PG}/scatter-gather.html` },
  },
];

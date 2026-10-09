import { edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";
const FIDELIS = "https://fidelissauro.dev";
const AWS_PG = "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns";
const CACHING_EN =
  "https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html";

export const DATA_CONSISTENCY_PATTERNS: PatternTemplate[] = [
  {
    id: "cqrs",
    category: "data-consistency",
    nodes: [
      element("client", "person", 0, 1),
      service("commandApi", 1, 0),
      role("writeDb", "relational-db", 2, 0),
      service("projector", 3, 1),
      role("readDb", "nosql-db", 2, 2),
      service("queryApi", 1, 2),
    ],
    edges: [
      edge("client", "commandApi", "command"),
      edge("commandApi", "writeDb", "write"),
      edge("writeDb", "projector", "change-events"),
      edge("projector", "readDb", "project"),
      edge("client", "queryApi", "query"),
      edge("queryApi", "readDb", "read"),
    ],
    references: { en: `${AZURE}/cqrs`, "pt-BR": `${FIDELIS}/cqrs/` },
  },
  {
    id: "event-sourcing",
    category: "data-consistency",
    nodes: [
      element("client", "person", 0, 1),
      service("commandApi", 1, 0),
      role("eventStore", "stream", 2, 0),
      service("projector", 3, 0),
      role("readModel", "nosql-db", 4, 1),
      service("queryApi", 1, 2),
    ],
    edges: [
      edge("client", "commandApi", "command"),
      edge("commandApi", "eventStore", "append"),
      edge("eventStore", "projector", "stream-events"),
      edge("projector", "readModel", "project"),
      edge("client", "queryApi", "query"),
      edge("queryApi", "readModel", "read"),
    ],
    references: { en: `${AZURE}/event-sourcing`, "pt-BR": `${FIDELIS}/event-sourcing/` },
  },
  {
    id: "transactional-outbox",
    category: "data-consistency",
    nodes: [
      service("service", 0, 1),
      role("database", "relational-db", 1, 1),
      service("relay", 2, 0),
      role("broker", "stream", 3, 1),
      service("consumer", 4, 1),
    ],
    edges: [
      edge("service", "database", "write"),
      edge("relay", "database", "poll-outbox"),
      edge("relay", "broker", "publish"),
      edge("broker", "consumer", "consume"),
    ],
    references: { en: `${AWS_PG}/transactional-outbox.html` },
  },
  {
    id: "saga-orchestration",
    category: "data-consistency",
    nodes: [
      element("client", "person", 0, 1),
      service("orchestrator", 1, 1),
      service("inventory", 2, 0),
      service("payment", 2, 1),
      service("shipping", 2, 2),
      role("stateStore", "nosql-db", 2, 3),
    ],
    edges: [
      edge("client", "orchestrator", "request"),
      edge("orchestrator", "inventory", "command-compensate"),
      edge("orchestrator", "payment", "command-compensate"),
      edge("orchestrator", "shipping", "command-compensate"),
      edge("orchestrator", "stateStore", "persist-state"),
    ],
    references: { en: `${AZURE}/saga`, "pt-BR": `${FIDELIS}/saga-pattern/` },
  },
  {
    id: "saga-choreography",
    category: "data-consistency",
    nodes: [
      service("orders", 0, 1),
      role("bus", "event-bus", 1, 1),
      service("payment", 2, 0),
      service("inventory", 2, 1),
      service("shipping", 2, 2),
    ],
    edges: [
      edge("orders", "bus", "emit-event"),
      edge("bus", "payment", "deliver"),
      edge("bus", "inventory", "deliver"),
      edge("bus", "shipping", "deliver"),
      edge("payment", "bus", "emit-event"),
      edge("inventory", "bus", "emit-event"),
    ],
    references: { en: `${AZURE}/choreography`, "pt-BR": `${FIDELIS}/saga-pattern/` },
  },
  {
    id: "cache-aside",
    category: "data-consistency",
    nodes: [
      service("app", 0, 1),
      role("cache", "cache", 1, 0),
      role("database", "relational-db", 1, 2),
    ],
    edges: [edge("app", "cache", "read-or-populate"), edge("app", "database", "read-on-miss")],
    references: { en: `${AZURE}/cache-aside`, "pt-BR": `${FIDELIS}/caching/` },
  },
  {
    id: "cache-write-through-behind",
    category: "data-consistency",
    nodes: [
      service("app", 0, 0),
      role("cache", "cache", 1, 0),
      role("database", "relational-db", 2, 0),
    ],
    edges: [edge("app", "cache", "write"), edge("cache", "database", "persist")],
    references: { en: CACHING_EN, "pt-BR": `${FIDELIS}/caching/` },
  },
  {
    id: "materialized-view",
    category: "data-consistency",
    nodes: [
      role("ordersDb", "relational-db", 0, 0),
      role("customersDb", "nosql-db", 0, 2),
      service("viewBuilder", 1, 1),
      role("view", "nosql-db", 2, 1),
      service("queryApi", 3, 1),
    ],
    edges: [
      edge("ordersDb", "viewBuilder", "change-events"),
      edge("customersDb", "viewBuilder", "change-events"),
      edge("viewBuilder", "view", "project"),
      edge("queryApi", "view", "read"),
    ],
    references: { en: `${AZURE}/materialized-view`, "pt-BR": `${AZURE_PT}/materialized-view` },
  },
  {
    id: "data-replication",
    category: "data-consistency",
    nodes: [
      service("app", 0, 1),
      role("primary", "relational-db", 1, 1),
      role("replica1", "relational-db", 2, 0),
      role("replica2", "relational-db", 2, 2),
    ],
    edges: [
      edge("app", "primary", "write"),
      edge("primary", "replica1", "replicate"),
      edge("primary", "replica2", "replicate"),
      edge("app", "replica1", "read"),
      edge("app", "replica2", "read"),
    ],
    references: {
      en: "https://martinfowler.com/articles/patterns-of-distributed-systems/leader-follower.html",
      "pt-BR": `${FIDELIS}/replicacao/`,
    },
  },
  {
    id: "sharding",
    category: "data-consistency",
    nodes: [
      service("app", 0, 1),
      service("router", 1, 1),
      role("shardA", "relational-db", 2, 0),
      role("shardB", "relational-db", 2, 1),
      role("shardC", "relational-db", 2, 2),
    ],
    edges: [
      edge("app", "router", "read-write"),
      edge("router", "shardA", "route-by-key"),
      edge("router", "shardB", "route-by-key"),
      edge("router", "shardC", "route-by-key"),
    ],
    references: { en: `${AZURE}/sharding`, "pt-BR": `${FIDELIS}/sharding/` },
  },
];

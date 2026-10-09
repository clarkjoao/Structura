import { boundary, edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const FIDELIS = "https://fidelissauro.dev";
const AWS_DR =
  "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html";

/** Two regions, each an app and its database, behind a global router. */
function twoRegions(): PatternTemplate["nodes"] {
  return [
    element("users", "person", 0, 1),
    role("router", "dns", 1, 1),
    boundary("regionA", 2, 0),
    service("appA", 0, 0, "regionA"),
    role("dbA", "relational-db", 1, 0, "regionA"),
    boundary("regionB", 2, 2),
    service("appB", 0, 0, "regionB"),
    role("dbB", "relational-db", 1, 0, "regionB"),
  ];
}

export const RESILIENCE_PATTERNS: PatternTemplate[] = [
  {
    id: "bulkhead",
    category: "resilience",
    nodes: [
      element("client", "person", 0, 1),
      service("router", 1, 1),
      boundary("criticalPool", 2, 0),
      service("criticalWorker", 0, 0, "criticalPool"),
      boundary("batchPool", 2, 2),
      service("batchWorker", 0, 0, "batchPool"),
      role("database", "relational-db", 4, 1),
    ],
    edges: [
      edge("client", "router", "request"),
      edge("router", "criticalWorker", "route-critical"),
      edge("router", "batchWorker", "route-batch"),
      edge("criticalWorker", "database", "read-write"),
      edge("batchWorker", "database", "read-write"),
    ],
    references: { en: `${AZURE}/bulkhead`, "pt-BR": `${FIDELIS}/bulkheads/` },
  },
  {
    id: "multi-region-active-passive",
    category: "resilience",
    nodes: twoRegions(),
    edges: [
      edge("users", "router", "resolve"),
      edge("router", "appA", "live-traffic"),
      edge("router", "appB", "failover"),
      edge("appA", "dbA", "read-write"),
      edge("appB", "dbB", "read"),
      edge("dbA", "dbB", "replicate"),
    ],
    references: { en: AWS_DR, "pt-BR": `${FIDELIS}/single-point-of-failure` },
  },
  {
    id: "multi-region-active-active",
    category: "resilience",
    nodes: twoRegions(),
    edges: [
      edge("users", "router", "resolve"),
      edge("router", "appA", "route"),
      edge("router", "appB", "route"),
      edge("appA", "dbA", "read-write"),
      edge("appB", "dbB", "read-write"),
      edge("dbA", "dbB", "replicate"),
    ],
    references: { en: `${AZURE}/geodes`, "pt-BR": `${FIDELIS}/single-point-of-failure` },
  },
];

import { boundary, edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const FIDELIS = "https://fidelissauro.dev";

export const DEPLOYMENT_SCALE_PATTERNS: PatternTemplate[] = [
  {
    id: "blue-green-deployment",
    category: "deployment-scale",
    nodes: [
      element("users", "person", 0, 1),
      role("balancer", "load-balancer", 1, 1),
      service("blue", 2, 0),
      service("green", 2, 2),
      role("database", "relational-db", 3, 1),
    ],
    edges: [
      edge("users", "balancer", "request"),
      edge("balancer", "blue", "live-traffic"),
      edge("balancer", "green", "switch-on-release"),
      edge("blue", "database", "read-write"),
      edge("green", "database", "read-write"),
    ],
    references: {
      en: "https://martinfowler.com/bliki/BlueGreenDeployment.html",
      "pt-BR": `${FIDELIS}/deployment-strategies/`,
    },
  },
  {
    id: "canary-release",
    category: "deployment-scale",
    nodes: [
      element("users", "person", 0, 1),
      role("balancer", "load-balancer", 1, 1),
      service("stable", 2, 0),
      service("canary", 2, 2),
      role("monitoring", "monitoring", 3, 1),
    ],
    edges: [
      edge("users", "balancer", "request"),
      edge("balancer", "stable", "majority-traffic"),
      edge("balancer", "canary", "canary-traffic"),
      edge("stable", "monitoring", "metrics"),
      edge("canary", "monitoring", "metrics"),
    ],
    references: {
      en: "https://martinfowler.com/bliki/CanaryRelease.html",
      "pt-BR": `${FIDELIS}/deployment-strategies/`,
    },
  },
  {
    id: "cell-based",
    category: "deployment-scale",
    nodes: [
      element("users", "person", 0, 1),
      service("cellRouter", 1, 1),
      boundary("cell1", 2, 0),
      service("app1", 0, 0, "cell1"),
      role("db1", "relational-db", 1, 0, "cell1"),
      boundary("cell2", 2, 2),
      service("app2", 0, 0, "cell2"),
      role("db2", "relational-db", 1, 0, "cell2"),
    ],
    edges: [
      edge("users", "cellRouter", "request"),
      edge("cellRouter", "app1", "route-by-tenant"),
      edge("cellRouter", "app2", "route-by-tenant"),
      edge("app1", "db1", "read-write"),
      edge("app2", "db2", "read-write"),
    ],
    references: {
      en: "https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/what-is-a-cell-based-architecture.html",
      "pt-BR": `${FIDELIS}/cell-based`,
    },
  },
];

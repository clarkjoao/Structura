import { edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";
const FIDELIS = "https://fidelissauro.dev";

export const API_EDGE_PATTERNS: PatternTemplate[] = [
  {
    id: "api-gateway",
    category: "api-edge",
    nodes: [
      element("client", "person", 0, 1),
      role("gateway", "api-gateway", 1, 1),
      service("orders", 2, 0),
      service("catalog", 2, 1),
      service("users", 2, 2),
    ],
    edges: [
      edge("client", "gateway", "request"),
      edge("gateway", "orders", "route"),
      edge("gateway", "catalog", "route"),
      edge("gateway", "users", "route"),
    ],
    references: { en: `${AZURE}/gateway-routing`, "pt-BR": `${FIDELIS}/api-gateway/` },
  },
  {
    id: "backends-for-frontends",
    category: "api-edge",
    nodes: [
      element("web", "person", 0, 0),
      element("mobile", "person", 0, 2),
      service("webBff", 1, 0),
      service("mobileBff", 1, 2),
      service("orders", 2, 0),
      service("catalog", 2, 2),
    ],
    edges: [
      edge("web", "webBff", "request"),
      edge("mobile", "mobileBff", "request"),
      edge("webBff", "orders", "call"),
      edge("webBff", "catalog", "call"),
      edge("mobileBff", "orders", "call"),
      edge("mobileBff", "catalog", "call"),
    ],
    references: { en: `${AZURE}/backends-for-frontends`, "pt-BR": `${FIDELIS}/bffs/` },
  },
  {
    id: "gateway-aggregation",
    category: "api-edge",
    nodes: [
      element("client", "person", 0, 1),
      role("gateway", "api-gateway", 1, 1),
      service("orders", 2, 0),
      service("profile", 2, 1),
      service("recommendations", 2, 2),
    ],
    edges: [
      edge("client", "gateway", "request"),
      edge("gateway", "orders", "call"),
      edge("gateway", "profile", "call"),
      edge("gateway", "recommendations", "call"),
    ],
    references: {
      en: `${AZURE}/gateway-aggregation`,
      "pt-BR": `${AZURE_PT}/gateway-aggregation`,
    },
  },
  {
    id: "static-content-hosting",
    category: "api-edge",
    nodes: [
      element("user", "person", 0, 1),
      role("cdn", "cdn", 1, 0),
      role("storage", "object-storage", 2, 0),
      service("app", 1, 2),
      role("database", "relational-db", 2, 2),
    ],
    edges: [
      edge("user", "cdn", "serve-static"),
      edge("cdn", "storage", "origin-fetch"),
      edge("user", "app", "request"),
      edge("app", "database", "read-write"),
    ],
    references: {
      en: `${AZURE}/static-content-hosting`,
      "pt-BR": `${AZURE_PT}/static-content-hosting`,
    },
  },
  {
    id: "load-balancer-reverse-proxy",
    category: "api-edge",
    nodes: [
      element("client", "person", 0, 1),
      role("balancer", "load-balancer", 1, 1),
      service("instance1", 2, 0),
      service("instance2", 2, 1),
      service("instance3", 2, 2),
    ],
    edges: [
      edge("client", "balancer", "request"),
      edge("balancer", "instance1", "forward"),
      edge("balancer", "instance2", "forward"),
      edge("balancer", "instance3", "forward"),
    ],
    references: {
      en: "https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/load-balancing-overview",
      "pt-BR": `${FIDELIS}/load-balancing/`,
    },
  },
];

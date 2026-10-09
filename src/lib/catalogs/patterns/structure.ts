import { boundary, edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";
const FIDELIS = "https://fidelissauro.dev";
const AWS_PG = "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns";

export const STRUCTURE_PATTERNS: PatternTemplate[] = [
  {
    id: "sidecar",
    category: "structure",
    nodes: [
      service("caller", 0, 0),
      boundary("pod", 1, 0),
      service("app", 0, 0, "pod"),
      service("sidecar", 1, 0, "pod"),
      role("monitoring", "monitoring", 4, 0),
    ],
    edges: [
      edge("caller", "app", "request"),
      edge("app", "sidecar", "localhost"),
      edge("sidecar", "monitoring", "telemetry"),
    ],
    references: { en: `${AZURE}/sidecar`, "pt-BR": `${AZURE_PT}/sidecar` },
  },
  {
    id: "ambassador",
    category: "structure",
    nodes: [service("app", 0, 0), service("ambassador", 1, 0), element("remote", "system", 2, 0)],
    edges: [edge("app", "ambassador", "localhost"), edge("ambassador", "remote", "proxy")],
    references: { en: `${AZURE}/ambassador`, "pt-BR": `${AZURE_PT}/ambassador` },
  },
  {
    id: "service-mesh",
    category: "structure",
    nodes: [
      boundary("podA", 0, 0),
      service("serviceA", 0, 0, "podA"),
      service("proxyA", 1, 0, "podA"),
      boundary("podB", 3, 0),
      service("proxyB", 0, 0, "podB"),
      service("serviceB", 1, 0, "podB"),
      service("controlPlane", 1, 2),
    ],
    edges: [
      edge("serviceA", "proxyA", "localhost"),
      edge("proxyA", "proxyB", "mtls"),
      edge("proxyB", "serviceB", "localhost"),
      edge("controlPlane", "proxyA", "configure"),
      edge("controlPlane", "proxyB", "configure"),
    ],
    references: {
      en: "https://learn.microsoft.com/en-us/azure/aks/servicemesh-about",
      "pt-BR": `${FIDELIS}/service-mesh/`,
    },
  },
  {
    id: "hexagonal",
    category: "structure",
    nodes: [
      service("restAdapter", 0, 0),
      service("consumerAdapter", 0, 2),
      boundary("core", 1, 1),
      service("domain", 0, 0, "core"),
      service("repositoryAdapter", 3, 0),
      service("messagingAdapter", 3, 2),
      role("database", "relational-db", 4, 0),
      role("broker", "topic", 4, 2),
    ],
    edges: [
      edge("restAdapter", "domain", "call-port"),
      edge("consumerAdapter", "domain", "call-port"),
      edge("domain", "repositoryAdapter", "call-port"),
      edge("domain", "messagingAdapter", "call-port"),
      edge("repositoryAdapter", "database", "read-write"),
      edge("messagingAdapter", "broker", "publish"),
    ],
    references: { en: `${AWS_PG}/hexagonal-architecture.html` },
  },
  {
    id: "serverless-api",
    category: "structure",
    nodes: [
      element("client", "person", 0, 1),
      role("gateway", "api-gateway", 1, 1),
      role("function", "serverless", 2, 1),
      role("table", "nosql-db", 3, 0),
      role("topic", "topic", 3, 2),
    ],
    edges: [
      edge("client", "gateway", "request"),
      edge("gateway", "function", "invoke"),
      edge("function", "table", "read-write"),
      edge("function", "topic", "publish"),
    ],
    references: {
      en: "https://learn.microsoft.com/en-us/azure/architecture/web-apps/serverless/architectures/web-app",
    },
  },
  {
    id: "observability-pipeline",
    category: "structure",
    nodes: [
      service("serviceA", 0, 0),
      service("serviceB", 0, 2),
      service("collector", 1, 1),
      role("metrics", "monitoring", 2, 0),
      role("logs", "monitoring", 2, 1),
      role("traces", "monitoring", 2, 2),
    ],
    edges: [
      edge("serviceA", "collector", "telemetry"),
      edge("serviceB", "collector", "telemetry"),
      edge("collector", "metrics", "forward"),
      edge("collector", "logs", "forward"),
      edge("collector", "traces", "forward"),
    ],
    references: {
      en: "https://opentelemetry.io/docs/collector/",
      "pt-BR": `${FIDELIS}/observabilidade`,
    },
  },
];

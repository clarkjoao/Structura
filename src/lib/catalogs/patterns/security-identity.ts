import { edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";

export const SECURITY_IDENTITY_PATTERNS: PatternTemplate[] = [
  {
    id: "federated-identity",
    category: "security-identity",
    nodes: [element("user", "person", 0, 1), role("idp", "identity", 1, 0), service("app", 2, 1)],
    edges: [
      edge("user", "idp", "sign-in"),
      edge("idp", "app", "issue-token"),
      edge("user", "app", "request"),
    ],
    references: {
      en: `${AZURE}/federated-identity`,
      "pt-BR": `${AZURE_PT}/federated-identity`,
    },
  },
  {
    id: "valet-key",
    category: "security-identity",
    nodes: [
      element("client", "person", 0, 1),
      service("app", 1, 0),
      role("storage", "object-storage", 1, 2),
    ],
    edges: [edge("client", "app", "request-key"), edge("client", "storage", "upload-direct")],
    references: { en: `${AZURE}/valet-key`, "pt-BR": `${AZURE_PT}/valet-key` },
  },
  {
    id: "policy-enforcement-point",
    category: "security-identity",
    nodes: [
      element("client", "person", 0, 1),
      role("gateway", "api-gateway", 1, 1),
      service("pdp", 2, 0),
      role("policyStore", "object-storage", 3, 0),
      service("service", 2, 2),
      role("database", "relational-db", 3, 2),
    ],
    edges: [
      edge("client", "gateway", "request"),
      edge("gateway", "pdp", "check-policy"),
      edge("pdp", "policyStore", "load-policies"),
      edge("gateway", "service", "forward-if-allowed"),
      edge("service", "database", "read-write"),
    ],
    references: {
      en: "https://www.openpolicyagent.org/docs/latest/philosophy/",
    },
  },
];

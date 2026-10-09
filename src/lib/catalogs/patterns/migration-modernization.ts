import { edge, element, role, service } from "./build";
import type { PatternTemplate } from "./types";

const AZURE = "https://learn.microsoft.com/en-us/azure/architecture/patterns";
const AZURE_PT = "https://learn.microsoft.com/pt-br/azure/architecture/patterns";

export const MIGRATION_MODERNIZATION_PATTERNS: PatternTemplate[] = [
  {
    id: "strangler-fig",
    category: "migration-modernization",
    nodes: [
      element("client", "person", 0, 1),
      role("facade", "api-gateway", 1, 1),
      element("legacy", "system", 2, 0),
      service("newService", 2, 2),
      role("newDb", "relational-db", 3, 2),
    ],
    edges: [
      edge("client", "facade", "request"),
      edge("facade", "legacy", "route-legacy"),
      edge("facade", "newService", "route-migrated"),
      edge("newService", "newDb", "read-write"),
    ],
    references: { en: `${AZURE}/strangler-fig`, "pt-BR": `${AZURE_PT}/strangler-fig` },
  },
  {
    id: "anti-corruption-layer",
    category: "migration-modernization",
    nodes: [service("newService", 0, 0), service("acl", 1, 0), element("legacy", "system", 2, 0)],
    edges: [edge("newService", "acl", "call"), edge("acl", "legacy", "translate")],
    references: {
      en: `${AZURE}/anti-corruption-layer`,
      "pt-BR": `${AZURE_PT}/anti-corruption-layer`,
    },
  },
];

import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/catalogs/aws";
import { PATTERNS, PATTERN_CATEGORIES } from "@/lib/catalogs/patterns";

export interface ComponentTypeDefinition {
  nodeType: string;
  displayName: string;
  description: string;
  awsService?: string;
  requiredFields?: string[];
  example?: string;
}

export const STRUCTURAL_TYPES: ComponentTypeDefinition[] = [
  {
    nodeType: "panel",
    displayName: "Panel / Group",
    description:
      "A visual grouping container. Use for bounded contexts, domains, or any logical grouping of nodes. Supports swimlane layout.",
    example: '{ "nodeType": "panel", "name": "Payment Domain", "parentId": null }',
  },
  {
    nodeType: "note",
    displayName: "Note",
    description:
      "A free-text annotation or documentation block. Use for comments, ADRs, or design notes.",
    example: '{ "nodeType": "note", "name": "", "parentId": null }',
  },
  {
    nodeType: "api-group",
    displayName: "API Group",
    description:
      "Represents a REST/gRPC/GraphQL/WebSocket API surface. Use when defining a service API contract. Must have a basePath and protocol.",
    requiredFields: ["serviceName", "basePath", "protocol"],
    example: '{ "nodeType": "api-group", "name": "User API", "parentId": "service-node-id" }',
  },
  {
    nodeType: "endpoint",
    displayName: "API Endpoint",
    description:
      "A single HTTP or event endpoint. Must be a child of an api-group node. Requires method (GET/POST/PUT/PATCH/DELETE/EVENT) and path.",
    requiredFields: ["method", "path"],
    example: '{ "nodeType": "endpoint", "name": "Get Users", "parentId": "api-group-node-id" }',
  },
  {
    nodeType: "db-table",
    displayName: "Database Table",
    description: "Represents a relational database table with columns. Use for data modeling.",
    example: '{ "nodeType": "db-table", "name": "users", "parentId": null }',
  },
  {
    nodeType: "json-viewer",
    displayName: "JSON Viewer",
    description: "Displays a JSON payload or schema. Use for documenting request/response shapes.",
    example: '{ "nodeType": "json-viewer", "name": "User Response", "parentId": null }',
  },
];

export const C4_TYPES: ComponentTypeDefinition[] = [
  {
    nodeType: "person",
    displayName: "Person / Actor",
    description:
      "A human user or external actor that interacts with the system. Use in C4 context diagrams.",
    example: '{ "nodeType": "person", "name": "Customer", "parentId": null }',
  },
  {
    nodeType: "system",
    displayName: "Software System",
    description:
      "A top-level software system. Use for external systems or the system being described at context level.",
    example: '{ "nodeType": "system", "name": "Payment System", "parentId": null }',
  },
  {
    nodeType: "container",
    displayName: "Container",
    description:
      "A deployable unit: web app, microservice, database, mobile app, etc. Use at C4 container level.",
    example: '{ "nodeType": "container", "name": "BFF Service", "parentId": null }',
  },
  {
    nodeType: "component",
    displayName: "Component",
    description: "A module or component inside a container. Use at C4 component level.",
    example: '{ "nodeType": "component", "name": "AuthController", "parentId": "container-id" }',
  },
];

function getAwsServiceDescription(serviceId: string, categoryName: string): string {
  if (serviceId === "api-gateway") {
    return "AWS managed API Gateway. Use for REST/HTTP/WebSocket API management and routing.";
  }
  if (serviceId === "elb") {
    return "AWS load balancer. Use for distributing traffic across services.";
  }
  if (serviceId === "rds") {
    return "AWS managed relational database. Use for PostgreSQL, MySQL, SQL Server.";
  }
  if (serviceId === "aurora") {
    return "AWS managed relational database (Aurora). Use for high-performance MySQL/PostgreSQL-compatible clusters.";
  }
  if (serviceId === "s3") {
    return "AWS object storage. Use for blobs, file storage, and static assets.";
  }
  if (serviceId === "lambda") {
    return "Serverless compute function. Use for event-driven workloads.";
  }
  if (serviceId === "sqs") {
    return "Managed message queue. Use for async decoupling and buffering.";
  }
  if (serviceId === "sns") {
    return "Managed pub/sub notifications. Use for fan-out events.";
  }
  if (serviceId === "eventbridge") {
    return "Managed event bus. Use for routing domain events.";
  }
  if (serviceId === "ecs" || serviceId === "ecs-2") {
    return "Container orchestration. Use for running containerized services.";
  }
  if (serviceId === "eks" || serviceId === "eks-2") {
    return "Managed Kubernetes. Use for running containerized services on Kubernetes.";
  }
  if (serviceId === "cloudfront") {
    return "CDN and edge caching. Use to serve content globally with low latency.";
  }
  if (serviceId === "vpc") {
    return "Virtual private network. Use to isolate and connect AWS resources.";
  }
  if (serviceId === "dynamodb") {
    return "Managed NoSQL database. Use for key-value / document workloads.";
  }
  if (serviceId === "elasticache") {
    return "Managed in-memory cache. Use for Redis/Memcached caching.";
  }
  if (serviceId === "cognito") {
    return "Managed user identity. Use for auth, user pools, and federation.";
  }
  if (serviceId === "iam") {
    return "Identity and access management. Use for roles, policies, and permissions.";
  }
  return `AWS ${categoryName} service.`;
}

export const AWS_TYPES: ComponentTypeDefinition[] = AWS_CATEGORIES.flatMap((category) =>
  category.services.map((service) => ({
    nodeType: category.id as AwsCategoryId,
    awsService: service.id,
    displayName: service.name,
    description: getAwsServiceDescription(service.id, category.name),
    example: JSON.stringify({
      nodeType: category.id,
      awsService: service.id,
      name: service.name,
      parentId: null,
    }),
  })),
);

export const ALL_COMPONENT_TYPES: ComponentTypeDefinition[] = [
  ...STRUCTURAL_TYPES,
  ...C4_TYPES,
  ...AWS_TYPES,
];

function formatTypeDef(def: ComponentTypeDefinition): string {
  const lines = [
    `nodeType: "${def.nodeType}" - ${def.displayName}`,
    `  Use when: ${def.description}`,
  ];
  if (def.awsService) {
    lines.push(`  awsService: "${def.awsService}"`);
  }
  if (def.requiredFields && def.requiredFields.length > 0) {
    lines.push(`  Required fields: ${def.requiredFields.join(", ")}`);
  }
  if (def.example) {
    lines.push(`  Example: ${def.example}`);
  }
  return lines.join("\n");
}

export function buildComponentTypeCatalog(): string {
  const sections: string[] = [
    "## Available Component Types",
    "",
    "You MUST use the exact nodeType string when calling add_node.",
    "Never invent nodeType values.",
    "",
    "### Structural & Canvas Types",
  ];

  for (const definition of STRUCTURAL_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push("### C4 Architecture Types");
  for (const definition of C4_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push(buildAwsCatalogCompact());

  return sections.join("\n");
}

export function buildAwsCatalogCompact(): string {
  const lines: string[] = [
    "### AWS Service Types",
    "",
    "Use awsService in add_node parameters. nodeType must match the category prefix.",
    "",
  ];

  for (const category of AWS_CATEGORIES) {
    const serviceIds = category.services.map((s) => s.id).join(", ");
    lines.push(`${category.id.replace("aws-", "").toUpperCase()}: ${serviceIds}`);
  }

  return lines.join("\n");
}

export function buildPatternCatalogCompact(): string {
  const lines: string[] = [
    "",
    "### Architectural Patterns",
    "",
    "Use insert_pattern tool with the pattern ID.",
    "",
  ];

  for (const category of PATTERN_CATEGORIES) {
    const patternIds = PATTERNS.filter((p) => p.category === category)
      .map((p) => p.id)
      .join(", ");
    lines.push(`${category.toUpperCase()}: ${patternIds}`);
  }

  return lines.join("\n");
}

export function isValidNodeType(nodeType: string): boolean {
  return ALL_COMPONENT_TYPES.some((definition) => definition.nodeType === nodeType);
}

export function buildPatternCatalog(): string {
  const lines: string[] = [
    "",
    "### Architectural Patterns",
    "",
    "These are reusable architectural templates you can insert into the diagram. Use the insert_pattern tool.",
    "",
  ];

  for (const category of PATTERN_CATEGORIES) {
    const patterns = PATTERNS.filter((p) => p.category === category);
    lines.push(`${category.toUpperCase()}:`);
    for (const p of patterns) {
      const shortDesc =
        p.description.length > 120 ? p.description.slice(0, 117) + "..." : p.description;
      lines.push(`  - ${p.id}: ${shortDesc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function isValidPatternId(patternId: string): boolean {
  return PATTERNS.some((p) => p.id === patternId);
}

export function getPatternById(patternId: string) {
  return PATTERNS.find((p) => p.id === patternId);
}

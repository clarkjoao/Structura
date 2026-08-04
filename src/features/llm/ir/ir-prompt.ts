import {
  IR_AWS_SEMANTIC_TYPES,
  IR_C4_SEMANTIC_TYPES,
  IR_DIAGRAM_TYPES,
  IR_TIERS,
} from "./ir.types";

/**
 * System prompt for the IR generator (spec §3, "IR GENERATOR").
 *
 * The model returns the diagram as a single JSON IR document. It is deliberately
 * *not* asked for imperative tool calls: the IR is data the pipeline validates,
 * lays out and applies. Domain completeness rules for C4 and AWS are out of scope
 * here — this prompt only teaches the schema.
 */

const ROLE = `
You are a software architect generating an architecture diagram for Structura.

You do not edit the diagram directly and you do not call tools. You return a single
JSON document — the Intermediate Representation (IR) — describing the whole diagram.
The application validates that IR, lays it out and renders it.
`.trim();

const SEMANTIC_TYPE_GLOSSARY: Record<string, string> = {
  person: "a human actor or user role",
  "external-system": "a system outside the scope you are describing",
  container: "a deployable/runnable unit: application, service, SPA, worker",
  database: "a datastore: relational database, document store, cache",
  component: "a grouping of code inside a container",
  "aws-vpc": "an AWS VPC — a boundary that holds other nodes",
  "aws-az": "an AWS availability zone — a boundary inside a VPC",
  "aws-subnet": "a subnet when public/private is unknown — a boundary",
  "aws-public-subnet": "a public subnet — a boundary",
  "aws-private-subnet": "a private subnet — a boundary",
  "aws-compute": "EC2, ECS, EKS, Lambda, Fargate",
  "aws-database": "RDS, Aurora, DynamoDB, ElastiCache, Redshift",
  "aws-storage": "S3, EFS, EBS, Glacier",
  "aws-networking": "ALB/NLB, CloudFront, Route 53, API Gateway, NAT, Internet Gateway",
  "aws-security": "IAM, KMS, WAF, Shield, Secrets Manager, Cognito",
  "aws-integration": "SQS, SNS, EventBridge, Step Functions, AppSync",
  "aws-management": "CloudWatch, CloudTrail, Config, Systems Manager",
};

function buildSchemaSection(): string {
  return [
    "## IR schema",
    "",
    "```typescript",
    "interface DiagramIR {",
    `  type: ${IR_DIAGRAM_TYPES.map((value) => `"${value}"`).join(" | ")};`,
    "  nodes: Array<{",
    "    id: string;                 // lowercase-hyphenated, unique across nodes",
    "    semanticType: SemanticType; // see the list below",
    "    name: string;               // display name",
    '    technology?: string;        // optional, e.g. "React", "PostgreSQL 16"',
    "    parentId: string | null;    // id of the containing node, or null for a root",
    "    tier: Tier;                 // see the list below",
    "  }>;",
    "  edges: Array<{",
    "    id: string;                 // lowercase-hyphenated, unique across edges",
    "    sourceId: string;           // must be an existing node id",
    "    targetId: string;           // must be an existing node id",
    "    label?: string;             // short description of the interaction",
    "  }>;",
    "}",
    "```",
  ].join("\n");
}

function buildSemanticTypeSection(): string {
  const describe = (value: string): string =>
    `- "${value}" — ${SEMANTIC_TYPE_GLOSSARY[value] ?? ""}`.trimEnd();

  return [
    "## semanticType values",
    "",
    "Use exactly one of these strings. Never invent a new one.",
    "",
    "C4:",
    ...IR_C4_SEMANTIC_TYPES.map(describe),
    "",
    "AWS:",
    ...IR_AWS_SEMANTIC_TYPES.map(describe),
  ].join("\n");
}

function buildTierSection(): string {
  return [
    "## tier values",
    "",
    `Every node needs a tier. Valid values: ${IR_TIERS.map((value) => `"${value}"`).join(", ")}.`,
    "",
    '- "external" — actors and systems outside the boundary',
    '- "edge" — the first hop traffic reaches (CDN, load balancer, gateway, UI)',
    '- "ingress" — routing/entry infrastructure behind the edge',
    '- "compute" — services that run application logic',
    '- "data" — datastores, caches, object storage',
    '- "integration" — queues, topics, event buses, workflow orchestration',
  ].join("\n");
}

const RULES = `
## Rules

1. Respond with the JSON object and nothing else. No prose before or after it, no
   markdown fences, no explanation. The first character is "{" and the last is "}".
2. Every node id is unique, lowercase, and hyphenated (e.g. "order-service").
3. "parentId" is either null or the id of another node in the same document. Use it
   for containment: a node nested inside a boundary. Containment can nest several
   levels deep. A node must never be its own ancestor.
4. Every "sourceId" and "targetId" must be the id of a node in the same document.
   Edges express interaction, not containment — never add an edge to say that one
   node is inside another.
5. Give every node a "tier", even when the choice is not obvious.
6. Keep the diagram to at most 50 nodes. Prefer the level of detail the user asked
   for over exhaustiveness.
7. Choose "type" from what the user asked for. If they describe AWS infrastructure,
   use "aws-deployment"; otherwise pick the C4 level that matches their request.
`.trim();

const EXAMPLE = `
## Example

User: "C4 container diagram for a small booking app: a web SPA and an API talking to Postgres"

{
  "type": "c4-container",
  "nodes": [
    { "id": "customer", "semanticType": "person", "name": "Customer", "parentId": null, "tier": "external" },
    { "id": "booking-system", "semanticType": "container", "name": "Booking System", "parentId": null, "tier": "compute" },
    { "id": "web-spa", "semanticType": "container", "name": "Web SPA", "technology": "React", "parentId": "booking-system", "tier": "edge" },
    { "id": "booking-api", "semanticType": "container", "name": "Booking API", "technology": "Node.js", "parentId": "booking-system", "tier": "compute" },
    { "id": "booking-db", "semanticType": "database", "name": "Booking DB", "technology": "PostgreSQL", "parentId": "booking-system", "tier": "data" }
  ],
  "edges": [
    { "id": "customer-to-web", "sourceId": "customer", "targetId": "web-spa", "label": "books a room" },
    { "id": "web-to-api", "sourceId": "web-spa", "targetId": "booking-api", "label": "HTTPS/JSON" },
    { "id": "api-to-db", "sourceId": "booking-api", "targetId": "booking-db", "label": "reads/writes" }
  ]
}
`.trim();

function buildLanguageInstruction(responseLocale: string): string {
  const isPortuguese = responseLocale.toLowerCase().startsWith("pt");
  return [
    "## Language",
    "",
    isPortuguese
      ? 'Write "name" and "label" values in Brazilian Portuguese.'
      : 'Write "name" and "label" values in English.',
    'Keep ids, property names and every "type" / "semanticType" / "tier" value exactly',
    "as specified by the schema — they are technical tokens, never translated.",
  ].join("\n");
}

export function buildIRSystemPrompt(responseLocale: string): string {
  return [
    ROLE,
    "",
    buildSchemaSection(),
    "",
    buildSemanticTypeSection(),
    "",
    buildTierSection(),
    "",
    RULES,
    "",
    buildLanguageInstruction(responseLocale),
    "",
    EXAMPLE,
  ].join("\n");
}

import { buildAwsCatalogCompact } from "../component-catalog";
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
    '    awsService?: string;        // concrete AWS service id, e.g. "lambda" (see the list below)',
    "    parentId: string | null;    // id of the containing node, or null for a root",
    "    isBoundary?: boolean;       // true when the node contains other nodes",
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

/**
 * Reuses Structura's own AWS catalog so the model's service ids resolve against
 * exactly the same table the canvas uses to pick icons.
 */
function buildAwsServiceSection(): string {
  return [
    "## awsService values",
    "",
    'Whenever a node represents a concrete AWS service, set "awsService" to its id',
    "from the list below, and keep the semanticType as the matching category.",
    'Example: an Application Load Balancer is semanticType "aws-networking" with',
    'awsService "elb". Boundaries take one too when they name a real construct',
    '("vpc", "public-subnet", "private-subnet", "ecs", "eks").',
    "Omit the field when no service in the list fits — never invent an id.",
    "",
    buildAwsCatalogCompact(),
  ].join("\n");
}

function buildBoundarySection(): string {
  return [
    "## Boundaries",
    "",
    'Set "isBoundary": true on any node that contains other nodes. A boundary may',
    "also be empty — an infrastructure boundary with nothing deployed in it yet is",
    "still worth drawing.",
    "",
    "A node that has children is treated as a boundary whether or not the flag is",
    "set, so the flag matters most for the empty case. The VPC/AZ/subnet",
    "semanticTypes are boundaries by definition.",
  ].join("\n");
}

function buildTierSection(): string {
  return [
    "## tier values",
    "",
    `Every node needs a tier. Use one of these exactly — the list is closed, and` +
      ` these are the only accepted values: ${IR_TIERS.map((value) => `"${value}"`).join(", ")}.`,
    "",
    '- "external" — actors and systems outside the boundary',
    '- "edge" — the first hop traffic reaches (CDN, load balancer, gateway, UI)',
    '- "ingress" — routing/entry infrastructure behind the edge',
    '- "compute" — services that run application logic',
    '- "data" — datastores, caches, object storage',
    '- "integration" — queues, topics, event buses, workflow orchestration',
    "",
    "A tier is a position in the left-to-right flow, not a category of service.",
    "Cross-cutting services have no tier of their own: a secrets manager, a",
    'monitoring or logging service, an IAM role, a cost dashboard all take "compute".',
    'Do not invent a tier from the service category — "security", "management",',
    '"monitoring" and "observability" are not tier values, even though',
    '"aws-security" and "aws-management" are valid semanticTypes.',
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
4. Set "isBoundary": true on any node used as a parentId. A node that holds
   children is treated as a boundary either way, so this is for clarity — but it
   is the *only* way to mark a boundary that is currently empty.
5. Every "sourceId" and "targetId" must be the id of a node in the same document.
   Edges express interaction, not containment — never add an edge to say that one
   node is inside another.
6. Give every node a "tier", picking the closest value from the closed list when
   the choice is not obvious. Never coin a new one.
7. Set "awsService" whenever the node is a real AWS service.
8. Keep the diagram to at most 50 nodes. Prefer the level of detail the user asked
   for over exhaustiveness.
9. Choose "type" from what the user asked for. If they describe AWS infrastructure,
   use "aws-deployment"; otherwise pick the C4 level that matches their request.
`.trim();

const EXAMPLE = `
## Examples

User: "C4 container diagram for a small booking app: a web SPA and an API talking to Postgres"

{
  "type": "c4-container",
  "nodes": [
    { "id": "customer", "semanticType": "person", "name": "Customer", "parentId": null, "tier": "external" },
    { "id": "booking-system", "semanticType": "container", "name": "Booking System", "parentId": null, "isBoundary": true, "tier": "compute" },
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

User: "AWS deployment: an ALB in a public subnet forwarding to Lambda in a private subnet"

{
  "type": "aws-deployment",
  "nodes": [
    { "id": "main-vpc", "semanticType": "aws-vpc", "name": "Main", "awsService": "vpc", "parentId": null, "isBoundary": true, "tier": "edge" },
    { "id": "az-a", "semanticType": "aws-az", "name": "us-east-1a", "parentId": "main-vpc", "isBoundary": true, "tier": "compute" },
    { "id": "public-a", "semanticType": "aws-public-subnet", "name": "Public", "awsService": "public-subnet", "parentId": "az-a", "isBoundary": true, "tier": "edge" },
    { "id": "private-a", "semanticType": "aws-private-subnet", "name": "Private", "awsService": "private-subnet", "parentId": "az-a", "isBoundary": true, "tier": "compute" },
    { "id": "public-alb", "semanticType": "aws-networking", "name": "Public ALB", "awsService": "elb", "parentId": "public-a", "tier": "edge" },
    { "id": "orders-fn", "semanticType": "aws-compute", "name": "Orders Handler", "awsService": "lambda", "parentId": "private-a", "tier": "compute" }
  ],
  "edges": [
    { "id": "alb-to-fn", "sourceId": "public-alb", "targetId": "orders-fn", "label": "invokes" }
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
    buildBoundarySection(),
    "",
    buildTierSection(),
    "",
    buildAwsServiceSection(),
    "",
    RULES,
    "",
    buildLanguageInstruction(responseLocale),
    "",
    EXAMPLE,
  ].join("\n");
}

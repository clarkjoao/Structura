import { AWS_CATEGORIES, AWS_CATEGORY_MAP } from "@/lib/catalogs/aws";
import { buildAwsCatalogCompact } from "../component-catalog";
import {
  IR_AWS_SEMANTIC_TYPES,
  IR_C4_SEMANTIC_TYPES,
  IR_DIAGRAM_TYPES,
  IR_TIERS,
  TIER_BY_SEMANTIC_TYPE,
  type SemanticType,
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

/**
 * Hand-written only for the types the AWS catalog does not describe: the C4 five
 * and the boundary types, which are IR concepts rather than catalog categories.
 * Every other `aws-*` semanticType *is* a catalog category id, so its description
 * comes from the catalog itself (`describeSemanticType`) and cannot drift from it.
 */
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
};

/** The bare category word a model is tempted to use as a tier: "aws-security" -> "security". */
function categoryWord(categoryId: string): string {
  return categoryId.replace(/^aws-/, "");
}

/**
 * `Security, Identity & Compliance (iam, cognito, …)` for a semanticType that is
 * an AWS catalog category, so the model can connect a service id to its type.
 */
function awsCategoryHint(semanticType: string, serviceLimit: number): string | undefined {
  const category = AWS_CATEGORY_MAP.get(semanticType);
  if (!category) {
    return undefined;
  }
  const shown = category.services.slice(0, serviceLimit).map((service) => service.id);
  const ellipsis = category.services.length > shown.length ? ", …" : "";
  return `${category.name} (${shown.join(", ")}${ellipsis})`;
}

function describeSemanticType(semanticType: string): string {
  return awsCategoryHint(semanticType, 8) ?? SEMANTIC_TYPE_GLOSSARY[semanticType] ?? "";
}

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
    `- "${value}" — ${describeSemanticType(value)}`.trimEnd();

  return [
    "## semanticType values",
    "",
    "Use exactly one of these strings. Never invent a new one. There is one per AWS",
    'category, so every service in the "awsService" list below has a type to sit in.',
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

/**
 * Where the default tier alone would mislead. Kept short: the model reads this
 * per line, so a note earns its place only when the category genuinely straddles
 * two tiers or is not a step in the request flow at all.
 */
const TIER_NOTE: Partial<Record<SemanticType, string>> = {
  "aws-networking": 'use "edge" when it is the first hop from the internet',
  "aws-analytics": 'use "integration" for the streaming ones, kinesis and msk',
  "aws-security": "cross-cutting — reached from everywhere, no position of its own",
  "aws-management": "cross-cutting — monitoring, logging, cost and governance",
  "aws-developer": "cross-cutting — CI/CD and tracing are not a step in the flow",
  "aws-containers": "registries and clusters; a running container is aws-compute",
  "aws-general": 'grouping constructs — set "isBoundary": true',
};

/**
 * Words models reach for as a tier because the IR taught them as categories.
 * Derived from the catalog so a new AWS category is named the day it lands, minus
 * the two that are legitimately both ("compute", "integration").
 */
function nonTierWords(): string[] {
  const invented = ["monitoring", "observability", "logging", "governance", "identity", "devops"];
  const fromCatalog = AWS_CATEGORIES.map((category) => categoryWord(category.id));
  return [...new Set([...fromCatalog, ...invented])].filter(
    (word) => !(IR_TIERS as readonly string[]).includes(word),
  );
}

/** `- "aws-security" → "compute" (note): Security, Identity & Compliance (iam, …)` */
function buildTierLine(semanticType: SemanticType): string {
  const note = TIER_NOTE[semanticType];
  const hint = awsCategoryHint(semanticType, 5) ?? SEMANTIC_TYPE_GLOSSARY[semanticType] ?? "";
  return [
    `- "${semanticType}" → "${TIER_BY_SEMANTIC_TYPE[semanticType]}"`,
    note ? ` (${note})` : "",
    hint ? `: ${hint}` : "",
  ].join("");
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
    "A tier is a position in the left-to-right flow, not a category of service. The",
    'category is already carried by "semanticType" and "awsService" — never repeat it',
    "here and never coin a tier from it. None of the following is a tier value, even",
    "though each one names a real AWS category and most name a real semanticType:",
    nonTierWords()
      .map((word) => `"${word}"`)
      .join(", ") + ".",
    "",
    "Cross-cutting services have no position in the flow: a secrets manager, an IAM",
    "role, a CloudWatch dashboard, a CI pipeline, a cost report are reached from",
    'everywhere, so they all take "compute".',
    "",
    "### Default tier per semanticType",
    "",
    "Place the node by where it actually sits in the flow you are drawing. When that",
    "is not obvious, take the default for its semanticType. Every AWS category in the",
    '"awsService" list below appears here, so every service has a tier to fall back on:',
    "",
    "C4:",
    ...IR_C4_SEMANTIC_TYPES.map(buildTierLine),
    "",
    "AWS:",
    ...IR_AWS_SEMANTIC_TYPES.map(buildTierLine),
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

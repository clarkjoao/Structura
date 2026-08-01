/**
 * Evaluation cases.
 *
 * Each case is one diagram request, expressed twice: as the IR the new path consumes, and
 * as the sequence of hand-placed tool calls the old path produced. Both are measured with
 * the same metrics, so "it got better" is a number rather than an impression.
 *
 * The legacy placements are representative of what a model does when asked for coordinates:
 * round numbers on a rough grid, uniform spacing, no measurement. They are not strawmen —
 * they are the shape of output that motivated this work.
 */

import type { ArchitectureIr } from "../ir";

/** A node as the old `add_node` tool received it: with coordinates chosen by the model. */
export interface LegacyNode {
  id: string;
  type: string;
  name: string;
  technology?: string;
  description?: string;
  x: number;
  y: number;
}

export interface LegacyEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface EvalCase {
  id: string;
  title: string;
  /** What a user would ask for. */
  request: string;
  ir: ArchitectureIr;
  legacy: { nodes: LegacyNode[]; edges: LegacyEdge[] };
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "c4-context-ecommerce",
    title: "C4 context — e-commerce",
    request: "Draw a C4 context diagram for our e-commerce platform with payment and email.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "E-commerce context",
        primary_path: ["customer", "shop"],
        density_hint: "simple",
      },
      nodes: [
        { id: "customer", type: "person", name: "Customer", tier: "external" },
        { id: "shop", type: "system", name: "E-commerce Platform", tier: "application" },
        { id: "payments", type: "system", name: "Payment Provider", tier: "external" },
        { id: "email", type: "system", name: "Email Service", tier: "external" },
      ],
      connections: [
        { id: "e1", from: "customer", to: "shop", intent: "call", label: "Browses, orders" },
        { id: "e2", from: "shop", to: "payments", intent: "call", label: "Charges" },
        { id: "e3", from: "shop", to: "email", intent: "async-message", label: "Sends receipts" },
      ],
    },
    legacy: {
      nodes: [
        { id: "customer", type: "person", name: "Customer", x: 100, y: 100 },
        { id: "shop", type: "system", name: "E-commerce Platform", x: 400, y: 100 },
        { id: "payments", type: "system", name: "Payment Provider", x: 700, y: 100 },
        { id: "email", type: "system", name: "Email Service", x: 400, y: 300 },
      ],
      edges: [
        { id: "e1", from: "customer", to: "shop", label: "Browses, orders" },
        { id: "e2", from: "shop", to: "payments", label: "Charges" },
        { id: "e3", from: "shop", to: "email", label: "Sends receipts" },
      ],
    },
  },

  {
    id: "c4-container-checkout",
    title: "C4 container — checkout",
    request: "Container diagram for checkout: web app, API, order service, database, cache.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Checkout containers",
        primary_path: ["customer", "web", "api", "orders", "db"],
        density_hint: "medium",
      },
      nodes: [
        { id: "customer", type: "person", name: "Customer", tier: "external" },
        { id: "web", type: "container", name: "Web App", technology: "React", tier: "client" },
        { id: "api", type: "container", name: "API Gateway", technology: "Kong", tier: "gateway" },
        {
          id: "orders",
          type: "container",
          name: "Order Service",
          technology: "Node.js",
          tier: "application",
        },
        {
          id: "db",
          type: "container",
          name: "Order Database",
          technology: "PostgreSQL",
          tier: "data",
        },
        { id: "cache", type: "container", name: "Cache", technology: "Redis", tier: "data" },
      ],
      connections: [
        { id: "e1", from: "customer", to: "web", intent: "call", label: "HTTPS" },
        { id: "e2", from: "web", to: "api", intent: "call", label: "REST" },
        { id: "e3", from: "api", to: "orders", intent: "call", label: "gRPC" },
        { id: "e4", from: "orders", to: "db", intent: "data-flow", label: "SQL" },
        { id: "e5", from: "orders", to: "cache", intent: "data-flow", label: "Reads" },
      ],
    },
    legacy: {
      nodes: [
        { id: "customer", type: "person", name: "Customer", x: 50, y: 200 },
        { id: "web", type: "container", name: "Web App", technology: "React", x: 250, y: 200 },
        { id: "api", type: "container", name: "API Gateway", technology: "Kong", x: 450, y: 200 },
        {
          id: "orders",
          type: "container",
          name: "Order Service",
          technology: "Node.js",
          x: 650,
          y: 200,
        },
        {
          id: "db",
          type: "container",
          name: "Order Database",
          technology: "PostgreSQL",
          x: 850,
          y: 120,
        },
        { id: "cache", type: "container", name: "Cache", technology: "Redis", x: 850, y: 280 },
      ],
      edges: [
        { id: "e1", from: "customer", to: "web", label: "HTTPS" },
        { id: "e2", from: "web", to: "api", label: "REST" },
        { id: "e3", from: "api", to: "orders", label: "gRPC" },
        { id: "e4", from: "orders", to: "db", label: "SQL" },
        { id: "e5", from: "orders", to: "cache", label: "Reads" },
      ],
    },
  },

  {
    id: "aws-request-driven",
    title: "AWS — request-driven API",
    request: "AWS diagram: CloudFront, API Gateway, Lambda, RDS, with CloudWatch and Secrets.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Serverless API",
        cloud: "aws",
        primary_path: ["user", "cdn", "apigw", "lambda", "rds"],
        density_hint: "medium",
      },
      nodes: [
        { id: "user", type: "person", name: "User", tier: "external" },
        {
          id: "cdn",
          type: "aws-networking",
          name: "CloudFront",
          aws_service: "cloudfront",
          tier: "client",
        },
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "lambda",
          type: "aws-compute",
          name: "Checkout Lambda",
          aws_service: "lambda",
          tier: "application",
        },
        { id: "rds", type: "aws-database", name: "RDS", aws_service: "rds", tier: "data" },
        {
          id: "logs",
          type: "aws-management",
          name: "CloudWatch",
          aws_service: "cloudwatch",
          tier: "cross-cutting",
        },
        {
          id: "secrets",
          type: "aws-security",
          name: "Secrets Manager",
          aws_service: "secrets-manager",
          tier: "cross-cutting",
        },
      ],
      connections: [
        { id: "e1", from: "user", to: "cdn", intent: "call", label: "HTTPS" },
        { id: "e2", from: "cdn", to: "apigw", intent: "call" },
        { id: "e3", from: "apigw", to: "lambda", intent: "call" },
        { id: "e4", from: "lambda", to: "rds", intent: "data-flow", label: "SQL" },
        { id: "e5", from: "lambda", to: "logs", intent: "dependency" },
        { id: "e6", from: "lambda", to: "secrets", intent: "dependency" },
      ],
    },
    legacy: {
      nodes: [
        { id: "user", type: "person", name: "User", x: 50, y: 150 },
        { id: "cdn", type: "aws-networking", name: "CloudFront", x: 250, y: 150 },
        { id: "apigw", type: "aws-networking", name: "API Gateway", x: 450, y: 150 },
        { id: "lambda", type: "aws-compute", name: "Checkout Lambda", x: 650, y: 150 },
        { id: "rds", type: "aws-database", name: "RDS", x: 850, y: 150 },
        { id: "logs", type: "aws-management", name: "CloudWatch", x: 650, y: 320 },
        { id: "secrets", type: "aws-security", name: "Secrets Manager", x: 850, y: 320 },
      ],
      edges: [
        { id: "e1", from: "user", to: "cdn", label: "HTTPS" },
        { id: "e2", from: "cdn", to: "apigw" },
        { id: "e3", from: "apigw", to: "lambda" },
        { id: "e4", from: "lambda", to: "rds", label: "SQL" },
        { id: "e5", from: "lambda", to: "logs" },
        { id: "e6", from: "lambda", to: "secrets" },
      ],
    },
  },

  {
    id: "aws-event-driven",
    title: "AWS — event-driven fan-out",
    request: "Event-driven AWS: ingest API publishes to EventBridge, three consumers.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Event fan-out",
        cloud: "aws",
        primary_path: ["client", "ingest", "bus"],
        density_hint: "medium",
      },
      nodes: [
        { id: "client", type: "person", name: "Partner", tier: "external" },
        {
          id: "ingest",
          type: "aws-networking",
          name: "Ingest API",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "bus",
          type: "aws-integration",
          name: "EventBridge",
          aws_service: "eventbridge",
          tier: "application",
        },
        {
          id: "billing",
          type: "aws-compute",
          name: "Billing Worker",
          aws_service: "lambda",
          tier: "backend",
        },
        {
          id: "audit",
          type: "aws-compute",
          name: "Audit Worker",
          aws_service: "lambda",
          tier: "backend",
        },
        {
          id: "notify",
          type: "aws-compute",
          name: "Notify Worker",
          aws_service: "lambda",
          tier: "backend",
        },
        { id: "store", type: "aws-storage", name: "S3 Archive", aws_service: "s3", tier: "data" },
      ],
      connections: [
        { id: "e1", from: "client", to: "ingest", intent: "call" },
        { id: "e2", from: "ingest", to: "bus", intent: "event" },
        { id: "e3", from: "bus", to: "billing", intent: "event" },
        { id: "e4", from: "bus", to: "audit", intent: "event" },
        { id: "e5", from: "bus", to: "notify", intent: "event" },
        { id: "e6", from: "audit", to: "store", intent: "data-flow" },
      ],
    },
    legacy: {
      nodes: [
        { id: "client", type: "person", name: "Partner", x: 50, y: 250 },
        { id: "ingest", type: "aws-networking", name: "Ingest API", x: 250, y: 250 },
        { id: "bus", type: "aws-integration", name: "EventBridge", x: 450, y: 250 },
        { id: "billing", type: "aws-compute", name: "Billing Worker", x: 650, y: 100 },
        { id: "audit", type: "aws-compute", name: "Audit Worker", x: 650, y: 250 },
        { id: "notify", type: "aws-compute", name: "Notify Worker", x: 650, y: 400 },
        { id: "store", type: "aws-storage", name: "S3 Archive", x: 850, y: 250 },
      ],
      edges: [
        { id: "e1", from: "client", to: "ingest" },
        { id: "e2", from: "ingest", to: "bus" },
        { id: "e3", from: "bus", to: "billing" },
        { id: "e4", from: "bus", to: "audit" },
        { id: "e5", from: "bus", to: "notify" },
        { id: "e6", from: "audit", to: "store" },
      ],
    },
  },

  {
    id: "c4-container-boundaries",
    title: "C4 container — with trust boundary",
    request: "Container diagram with an internal VPC boundary around the services.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Bounded checkout",
        primary_path: ["user", "edge", "svc", "store"],
        density_hint: "medium",
      },
      nodes: [
        { id: "user", type: "person", name: "User", tier: "external" },
        { id: "edge", type: "container", name: "Load Balancer", tier: "gateway" },
        {
          id: "svc",
          type: "container",
          name: "App Service",
          technology: "Go",
          tier: "application",
        },
        {
          id: "store",
          type: "container",
          name: "Database",
          technology: "Postgres",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "vpc",
          name: "Production VPC",
          kind: "aws-vpc",
          contains: ["svc", "store"],
        },
      ],
      connections: [
        { id: "e1", from: "user", to: "edge", intent: "call", label: "HTTPS" },
        { id: "e2", from: "edge", to: "svc", intent: "call" },
        { id: "e3", from: "svc", to: "store", intent: "data-flow" },
      ],
    },
    legacy: {
      nodes: [
        { id: "user", type: "person", name: "User", x: 50, y: 200 },
        { id: "edge", type: "container", name: "Load Balancer", x: 250, y: 200 },
        { id: "svc", type: "container", name: "App Service", technology: "Go", x: 450, y: 200 },
        {
          id: "store",
          type: "container",
          name: "Database",
          technology: "Postgres",
          x: 650,
          y: 200,
        },
      ],
      edges: [
        { id: "e1", from: "user", to: "edge", label: "HTTPS" },
        { id: "e2", from: "edge", to: "svc" },
        { id: "e3", from: "svc", to: "store" },
      ],
    },
  },
];

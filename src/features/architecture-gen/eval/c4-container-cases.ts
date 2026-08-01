/**
 * C4 Container and Component reference cases — slice 2.
 *
 * Container diagrams are where the engine earns its keep: a system boundary spanning several
 * columns, containers that must not be confused with the systems around them, and a data tier
 * that fans out. Component diagrams add a second level of nesting.
 *
 * As with the context cases, these are reference *outputs*: they pin what good looks like so
 * a change to the engine or the constants cannot quietly degrade it.
 */

import type { ArchitectureIr } from "../ir";

export interface ContainerCase {
  id: string;
  /** What the user would type. */
  request: string;
  /** Why this case is in the set. */
  covers: string;
  ir: ArchitectureIr;
}

export const C4_CONTAINER_CASES: ContainerCase[] = [
  {
    id: "classic-three-tier",
    request: "Container diagram for our web app: SPA, API, and a Postgres database.",
    covers: "The canonical shape — one flow, one container per tier, nothing clever.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Web app — containers",
        primary_path: ["user", "spa", "api", "db"],
        density_hint: "simple",
      },
      nodes: [
        { id: "user", type: "person", name: "User", tier: "external" },
        { id: "spa", type: "container", name: "Web SPA", technology: "React", tier: "client" },
        { id: "api", type: "container", name: "API", technology: "Node.js", tier: "gateway" },
        {
          id: "db",
          type: "container",
          name: "Database",
          technology: "PostgreSQL",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "spa", intent: "call", label: "Uses" },
        { id: "c2", from: "spa", to: "api", intent: "call", label: "REST" },
        { id: "c3", from: "api", to: "db", intent: "data-flow", label: "SQL" },
      ],
    },
  },

  {
    id: "system-boundary",
    request:
      "Container diagram for the shop platform — draw the system boundary around our own " +
      "containers, with the customer outside it.",
    covers: "A system boundary spanning four columns, with an actor deliberately outside.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Shop — containers",
        primary_path: ["customer", "web", "api", "orders", "db"],
        density_hint: "medium",
      },
      nodes: [
        { id: "customer", type: "person", name: "Customer", tier: "external" },
        { id: "web", type: "container", name: "Web App", technology: "Next.js", tier: "client" },
        { id: "api", type: "container", name: "API Gateway", technology: "Kong", tier: "gateway" },
        {
          id: "orders",
          type: "container",
          name: "Order Service",
          technology: "Go",
          tier: "application",
        },
        {
          id: "db",
          type: "container",
          name: "Order DB",
          technology: "PostgreSQL",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "shop",
          name: "Shop Platform",
          kind: "system",
          contains: ["web", "api", "orders", "db"],
        },
      ],
      connections: [
        { id: "c1", from: "customer", to: "web", intent: "call", label: "Uses" },
        { id: "c2", from: "web", to: "api", intent: "call", label: "REST" },
        { id: "c3", from: "api", to: "orders", intent: "call" },
        { id: "c4", from: "orders", to: "db", intent: "data-flow" },
      ],
    },
  },

  {
    id: "fan-out-to-data",
    request:
      "Container diagram where the order service writes to Postgres, reads from Redis and " +
      "publishes to a queue.",
    covers: "One container fanning out to three stores — edge anchors must not stack.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Orders — containers",
        primary_path: ["api", "orders", "db"],
        density_hint: "medium",
      },
      nodes: [
        { id: "api", type: "container", name: "API", technology: "Kong", tier: "gateway" },
        {
          id: "orders",
          type: "container",
          name: "Order Service",
          technology: "Java",
          tier: "application",
        },
        { id: "db", type: "container", name: "Orders DB", technology: "PostgreSQL", tier: "data" },
        { id: "cache", type: "container", name: "Cache", technology: "Redis", tier: "data" },
        { id: "queue", type: "container", name: "Events", technology: "RabbitMQ", tier: "data" },
      ],
      connections: [
        { id: "c1", from: "api", to: "orders", intent: "call" },
        { id: "c2", from: "orders", to: "db", intent: "data-flow", label: "Writes" },
        { id: "c3", from: "orders", to: "cache", intent: "data-flow", label: "Reads" },
        { id: "c4", from: "orders", to: "queue", intent: "event", label: "Publishes" },
      ],
    },
  },

  {
    id: "two-services-shared-gateway",
    request:
      "Container diagram: a BFF in front of an order service and a catalog service, each " +
      "with its own database.",
    covers: "A branching flow — two application containers, two stores, no interleaving.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Storefront — containers",
        primary_path: ["spa", "bff", "orders", "orderdb"],
        density_hint: "medium",
      },
      nodes: [
        { id: "spa", type: "container", name: "Web SPA", technology: "React", tier: "client" },
        { id: "bff", type: "container", name: "BFF", technology: "Node.js", tier: "gateway" },
        {
          id: "orders",
          type: "container",
          name: "Order Service",
          technology: "Go",
          tier: "application",
        },
        {
          id: "catalog",
          type: "container",
          name: "Catalog Service",
          technology: "Go",
          tier: "application",
        },
        {
          id: "orderdb",
          type: "container",
          name: "Order DB",
          technology: "Postgres",
          tier: "data",
        },
        {
          id: "catalogdb",
          type: "container",
          name: "Catalog DB",
          technology: "Postgres",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "spa", to: "bff", intent: "call", label: "REST" },
        { id: "c2", from: "bff", to: "orders", intent: "call" },
        { id: "c3", from: "bff", to: "catalog", intent: "call" },
        { id: "c4", from: "orders", to: "orderdb", intent: "data-flow" },
        { id: "c5", from: "catalog", to: "catalogdb", intent: "data-flow" },
      ],
    },
  },

  {
    id: "with-observability",
    request:
      "Container diagram for the payments service, with Prometheus and Vault as supporting " +
      "infrastructure.",
    covers: "The cross-cutting band anchored under its consumer, with representative edges.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Payments — containers",
        primary_path: ["api", "payments", "db"],
        density_hint: "medium",
      },
      nodes: [
        { id: "api", type: "container", name: "API", technology: "Envoy", tier: "gateway" },
        {
          id: "payments",
          type: "container",
          name: "Payment Service",
          technology: "Rust",
          tier: "application",
        },
        { id: "db", type: "container", name: "Ledger DB", technology: "Postgres", tier: "data" },
        {
          id: "metrics",
          type: "container",
          name: "Prometheus",
          tier: "cross-cutting",
        },
        { id: "vault", type: "container", name: "Vault", tier: "cross-cutting" },
      ],
      connections: [
        { id: "c1", from: "api", to: "payments", intent: "call" },
        { id: "c2", from: "payments", to: "db", intent: "data-flow" },
        { id: "c3", from: "payments", to: "metrics", intent: "dependency" },
        { id: "c4", from: "payments", to: "vault", intent: "dependency" },
      ],
    },
  },

  {
    id: "nested-vpc",
    request:
      "Container diagram with the production account, a VPC inside it, and a private subnet " +
      "holding the service and database.",
    covers: "Three levels of boundary nesting — account > VPC > subnet.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Production topology",
        primary_path: ["alb", "svc", "db"],
        density_hint: "medium",
      },
      nodes: [
        { id: "alb", type: "container", name: "Load Balancer", tier: "gateway" },
        {
          id: "svc",
          type: "container",
          name: "App Service",
          technology: "Go",
          tier: "application",
        },
        { id: "db", type: "container", name: "Database", technology: "Postgres", tier: "data" },
      ],
      boundaries: [
        { id: "account", name: "Production Account", kind: "aws-account", contains: [] },
        {
          id: "vpc",
          name: "VPC",
          kind: "aws-vpc",
          contains: ["alb"],
          parent_boundary_id: "account",
        },
        {
          id: "subnet",
          name: "Private Subnet",
          kind: "aws-subnet",
          contains: ["svc", "db"],
          parent_boundary_id: "vpc",
        },
      ],
      connections: [
        { id: "c1", from: "alb", to: "svc", intent: "call" },
        { id: "c2", from: "svc", to: "db", intent: "data-flow" },
      ],
    },
  },

  {
    id: "two-systems",
    request: "Container diagram showing our order system and the separate billing system.",
    covers: "Two sibling system boundaries that must not overlap or interleave.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-container",
      meta: {
        title: "Orders and billing",
        primary_path: ["orders-api", "orders-db"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "orders-api",
          type: "container",
          name: "Order API",
          technology: "Go",
          tier: "application",
        },
        {
          id: "orders-db",
          type: "container",
          name: "Order DB",
          technology: "Postgres",
          tier: "data",
        },
        {
          id: "billing-api",
          type: "container",
          name: "Billing API",
          technology: "Java",
          tier: "application",
        },
        {
          id: "billing-db",
          type: "container",
          name: "Billing DB",
          technology: "Oracle",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "orders",
          name: "Order System",
          kind: "system",
          contains: ["orders-api", "orders-db"],
          order_index: 0,
        },
        {
          id: "billing",
          name: "Billing System",
          kind: "system",
          contains: ["billing-api", "billing-db"],
          order_index: 1,
        },
      ],
      connections: [
        { id: "c1", from: "orders-api", to: "orders-db", intent: "data-flow" },
        { id: "c2", from: "billing-api", to: "billing-db", intent: "data-flow" },
        {
          id: "c3",
          from: "orders-api",
          to: "billing-api",
          intent: "async-message",
          label: "Bills",
        },
      ],
    },
  },

  {
    id: "component-simple",
    request: "Component diagram for the order service: controller, domain logic, repository.",
    covers: "The basic component shape — a layered pipeline inside one container.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-component",
      meta: {
        title: "Order Service — components",
        primary_path: ["controller", "domain", "repository"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "controller",
          type: "component",
          name: "Order Controller",
          technology: "Spring MVC",
          tier: "gateway",
        },
        {
          id: "domain",
          type: "component",
          name: "Order Domain",
          technology: "Java",
          tier: "application",
        },
        {
          id: "repository",
          type: "component",
          name: "Order Repository",
          technology: "JPA",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "controller", to: "domain", intent: "call" },
        { id: "c2", from: "domain", to: "repository", intent: "call" },
      ],
    },
  },

  {
    id: "component-with-container-boundary",
    request:
      "Component diagram for the payment service, with the container boundary drawn around " +
      "its components.",
    covers: "A container boundary wrapping components — the standard C4 level-3 frame.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-component",
      meta: {
        title: "Payment Service — components",
        primary_path: ["api", "processor", "gateway-client"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "api",
          type: "component",
          name: "Payment API",
          technology: "FastAPI",
          tier: "gateway",
        },
        {
          id: "processor",
          type: "component",
          name: "Payment Processor",
          technology: "Python",
          tier: "application",
        },
        {
          id: "validator",
          type: "component",
          name: "Fraud Check",
          technology: "Python",
          tier: "application",
        },
        {
          id: "gateway-client",
          type: "component",
          name: "Acquirer Client",
          technology: "httpx",
          tier: "backend",
        },
        {
          id: "store",
          type: "component",
          name: "Payment Store",
          technology: "SQLAlchemy",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "container",
          name: "Payment Service",
          kind: "container",
          contains: ["api", "processor", "validator", "gateway-client", "store"],
        },
      ],
      connections: [
        { id: "c1", from: "api", to: "processor", intent: "call" },
        { id: "c2", from: "processor", to: "validator", intent: "call" },
        { id: "c3", from: "processor", to: "gateway-client", intent: "call" },
        { id: "c4", from: "processor", to: "store", intent: "data-flow" },
      ],
    },
  },

  {
    id: "component-hexagonal",
    request:
      "Component diagram for our shipping service in hexagonal style: inbound adapters, " +
      "domain core, outbound adapters.",
    covers: "Ports-and-adapters — components at every tier, with the domain in the middle.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-component",
      meta: {
        title: "Shipping Service — components",
        primary_path: ["rest", "domain", "carrier"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "rest",
          type: "component",
          name: "REST Adapter",
          technology: "Ktor",
          tier: "gateway",
        },
        {
          id: "consumer",
          type: "component",
          name: "Event Consumer",
          technology: "Kafka",
          tier: "gateway",
        },
        {
          id: "domain",
          type: "component",
          name: "Shipping Domain",
          technology: "Kotlin",
          tier: "application",
        },
        {
          id: "carrier",
          type: "component",
          name: "Carrier Adapter",
          technology: "Ktor Client",
          tier: "backend",
        },
        {
          id: "persistence",
          type: "component",
          name: "Persistence Adapter",
          technology: "Exposed",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "svc",
          name: "Shipping Service",
          kind: "container",
          contains: ["rest", "consumer", "domain", "carrier", "persistence"],
        },
      ],
      connections: [
        { id: "c1", from: "rest", to: "domain", intent: "call" },
        { id: "c2", from: "consumer", to: "domain", intent: "async-message" },
        { id: "c3", from: "domain", to: "carrier", intent: "call" },
        { id: "c4", from: "domain", to: "persistence", intent: "data-flow" },
      ],
    },
  },
];

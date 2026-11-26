import { PanelKind } from "@/features/diagram/enums";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import { fromDiagram } from "./fromDiagram";
import type { LayoutGraph } from "./contract";

/**
 * The four reference diagrams the layout configuration is measured against.
 *
 * These are hand-written documents matching the shapes the product owner
 * reviewed (C4 e-commerce, AWS ECS Fargate, C4 Context healthcare, AWS
 * microservices) — the originals of the reviewed generations were not kept, so
 * these are reconstructions, not captures. They are what the numbers in the
 * spec's readability metric refer to, so changing one invalidates the baseline.
 *
 * They are persisted `Diagram`s (converted once from the retired generation
 * format, ids and sizes unchanged). `layoutReadability.baseline.test.ts`
 * checks each one structurally before it is measured, so a malformed fixture
 * fails loudly rather than skewing a number.
 */

const c4Ecommerce: Diagram = {
  id: "C4 e-commerce",
  name: "C4 e-commerce",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: {
    components: {
      customer: {
        id: "customer",
        name: "Customer",
        description: "",
        parentId: null,
        type: "person",
      },
      "ops-staff": {
        id: "ops-staff",
        name: "Operations Staff",
        description: "",
        parentId: null,
        type: "person",
      },
      shop: {
        id: "shop",
        name: "E-commerce Platform",
        description: "",
        parentId: null,
        type: "panel",
        panelKind: PanelKind.Default,
        panelColor: "hsl(220 20% 20%)",
      },
      "web-app": {
        id: "web-app",
        name: "Web Storefront",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Next.js",
      },
      "mobile-app": {
        id: "mobile-app",
        name: "Mobile App",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "React Native",
      },
      "api-gateway": {
        id: "api-gateway",
        name: "API Gateway",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Kong",
      },
      "catalog-svc": {
        id: "catalog-svc",
        name: "Catalog Service",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Go",
      },
      "cart-svc": {
        id: "cart-svc",
        name: "Cart Service",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Node.js",
      },
      "order-svc": {
        id: "order-svc",
        name: "Order Service",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Java",
      },
      "admin-svc": {
        id: "admin-svc",
        name: "Admin Backoffice",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Rails",
      },
      "catalog-db": {
        id: "catalog-db",
        name: "Catalog DB",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "PostgreSQL",
      },
      "order-db": {
        id: "order-db",
        name: "Order DB",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "PostgreSQL",
      },
      "cart-cache": {
        id: "cart-cache",
        name: "Cart Cache",
        description: "",
        parentId: "shop",
        type: "container",
        technology: "Redis",
      },
      "payment-gw": {
        id: "payment-gw",
        name: "Payment Gateway",
        description: "",
        parentId: null,
        type: "system",
      },
      shipping: {
        id: "shipping",
        name: "Shipping Provider",
        description: "",
        parentId: null,
        type: "system",
      },
      email: {
        id: "email",
        name: "Email Provider",
        description: "",
        parentId: null,
        type: "system",
      },
    },
    connections: {
      e1: {
        id: "e1",
        sourceId: "customer",
        targetId: "web-app",
        label: "browses",
      },
      e2: {
        id: "e2",
        sourceId: "customer",
        targetId: "mobile-app",
        label: "browses",
      },
      e3: {
        id: "e3",
        sourceId: "ops-staff",
        targetId: "admin-svc",
        label: "manages",
      },
      e4: {
        id: "e4",
        sourceId: "web-app",
        targetId: "api-gateway",
        label: "HTTPS",
      },
      e5: {
        id: "e5",
        sourceId: "mobile-app",
        targetId: "api-gateway",
        label: "HTTPS",
      },
      e6: {
        id: "e6",
        sourceId: "api-gateway",
        targetId: "catalog-svc",
        label: "routes",
      },
      e7: {
        id: "e7",
        sourceId: "api-gateway",
        targetId: "cart-svc",
        label: "routes",
      },
      e8: {
        id: "e8",
        sourceId: "api-gateway",
        targetId: "order-svc",
        label: "routes",
      },
      e9: {
        id: "e9",
        sourceId: "catalog-svc",
        targetId: "catalog-db",
        label: "reads/writes",
      },
      e10: {
        id: "e10",
        sourceId: "cart-svc",
        targetId: "cart-cache",
        label: "reads/writes",
      },
      e11: {
        id: "e11",
        sourceId: "order-svc",
        targetId: "order-db",
        label: "reads/writes",
      },
      e12: {
        id: "e12",
        sourceId: "order-svc",
        targetId: "payment-gw",
        label: "charges",
      },
      e13: {
        id: "e13",
        sourceId: "order-svc",
        targetId: "shipping",
        label: "books",
      },
      e14: {
        id: "e14",
        sourceId: "order-svc",
        targetId: "email",
        label: "notifies",
      },
      e15: {
        id: "e15",
        sourceId: "admin-svc",
        targetId: "catalog-db",
        label: "reads/writes",
      },
      e16: {
        id: "e16",
        sourceId: "cart-svc",
        targetId: "catalog-svc",
        label: "prices",
      },
    },
    flows: {},
    iconLibrary: {},
  },
  nodeLayouts: {
    customer: {
      elementId: "customer",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "ops-staff": {
      elementId: "ops-staff",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    shop: {
      elementId: "shop",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "web-app": {
      elementId: "web-app",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "mobile-app": {
      elementId: "mobile-app",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "api-gateway": {
      elementId: "api-gateway",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "catalog-svc": {
      elementId: "catalog-svc",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "cart-svc": {
      elementId: "cart-svc",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "order-svc": {
      elementId: "order-svc",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "admin-svc": {
      elementId: "admin-svc",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "catalog-db": {
      elementId: "catalog-db",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "order-db": {
      elementId: "order-db",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "cart-cache": {
      elementId: "cart-cache",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "payment-gw": {
      elementId: "payment-gw",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    shipping: {
      elementId: "shipping",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    email: {
      elementId: "email",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
  },
  edgeLayouts: {},
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

const awsEcsFargate: Diagram = {
  id: "AWS ECS Fargate",
  name: "AWS ECS Fargate",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: {
    components: {
      user: {
        id: "user",
        name: "End User",
        description: "",
        parentId: null,
        type: "person",
      },
      cdn: {
        id: "cdn",
        name: "CloudFront",
        description: "",
        parentId: null,
        type: "aws-networking",
        cloudServiceId: "cloudfront",
      },
      vpc: {
        id: "vpc",
        name: "Production",
        description: "",
        parentId: null,
        type: "panel",
        panelKind: PanelKind.Vpc,
        panelColor: "hsl(220 50% 35%)",
      },
      "az-a": {
        id: "az-a",
        name: "us-east-1a",
        description: "",
        parentId: "vpc",
        type: "panel",
        panelKind: PanelKind.AvailabilityZone,
        panelColor: "hsl(45 60% 45%)",
      },
      "az-b": {
        id: "az-b",
        name: "us-east-1b",
        description: "",
        parentId: "vpc",
        type: "panel",
        panelKind: PanelKind.AvailabilityZone,
        panelColor: "hsl(45 60% 45%)",
      },
      "pub-a": {
        id: "pub-a",
        name: "Public A",
        description: "",
        parentId: "az-a",
        type: "panel",
        panelKind: PanelKind.PublicSubnet,
        panelColor: "hsl(150 50% 35%)",
      },
      "pub-b": {
        id: "pub-b",
        name: "Public B",
        description: "",
        parentId: "az-b",
        type: "panel",
        panelKind: PanelKind.PublicSubnet,
        panelColor: "hsl(150 50% 35%)",
      },
      "priv-a": {
        id: "priv-a",
        name: "Private A",
        description: "",
        parentId: "az-a",
        type: "panel",
        panelKind: PanelKind.PrivateSubnet,
        panelColor: "hsl(0 50% 38%)",
      },
      "priv-b": {
        id: "priv-b",
        name: "Private B",
        description: "",
        parentId: "az-b",
        type: "panel",
        panelKind: PanelKind.PrivateSubnet,
        panelColor: "hsl(0 50% 38%)",
      },
      alb: {
        id: "alb",
        name: "Application Load Balancer",
        description: "",
        parentId: "pub-a",
        type: "aws-networking",
        cloudServiceId: "elb",
      },
      nat: {
        id: "nat",
        name: "NAT Gateway",
        description: "",
        parentId: "pub-b",
        type: "aws-networking",
        cloudServiceId: "vpc",
      },
      "svc-a": {
        id: "svc-a",
        name: "Orders Task",
        description: "",
        parentId: "priv-a",
        type: "aws-compute",
        cloudServiceId: "fargate",
        technology: "Fargate",
      },
      "svc-b": {
        id: "svc-b",
        name: "Orders Task (replica)",
        description: "",
        parentId: "priv-b",
        type: "aws-compute",
        cloudServiceId: "fargate",
        technology: "Fargate",
      },
      "rds-primary": {
        id: "rds-primary",
        name: "Orders DB (primary)",
        description: "",
        parentId: "priv-a",
        type: "aws-database",
        cloudServiceId: "rds",
        technology: "Aurora PostgreSQL",
      },
      "rds-standby": {
        id: "rds-standby",
        name: "Orders DB (standby)",
        description: "",
        parentId: "priv-b",
        type: "aws-database",
        cloudServiceId: "rds",
        technology: "Aurora PostgreSQL",
      },
      s3: {
        id: "s3",
        name: "Assets Bucket",
        description: "",
        parentId: "vpc",
        type: "aws-storage",
        cloudServiceId: "s3",
      },
      secrets: {
        id: "secrets",
        name: "Secrets Manager",
        description: "",
        parentId: "vpc",
        type: "aws-security",
        cloudServiceId: "secrets-manager",
      },
      logs: {
        id: "logs",
        name: "CloudWatch Logs",
        description: "",
        parentId: "vpc",
        type: "aws-management",
        cloudServiceId: "cloudwatch",
      },
    },
    connections: {
      a1: {
        id: "a1",
        sourceId: "user",
        targetId: "cdn",
        label: "HTTPS",
      },
      a2: {
        id: "a2",
        sourceId: "cdn",
        targetId: "alb",
        label: "origin",
      },
      a3: {
        id: "a3",
        sourceId: "cdn",
        targetId: "s3",
        label: "static assets",
      },
      a4: {
        id: "a4",
        sourceId: "alb",
        targetId: "svc-a",
        label: "forwards",
      },
      a5: {
        id: "a5",
        sourceId: "alb",
        targetId: "svc-b",
        label: "forwards",
      },
      a6: {
        id: "a6",
        sourceId: "svc-a",
        targetId: "rds-primary",
        label: "reads/writes",
      },
      a7: {
        id: "a7",
        sourceId: "svc-b",
        targetId: "rds-primary",
        label: "reads/writes",
      },
      a8: {
        id: "a8",
        sourceId: "rds-primary",
        targetId: "rds-standby",
        label: "replicates",
      },
      a9: {
        id: "a9",
        sourceId: "svc-a",
        targetId: "secrets",
        label: "reads",
      },
      a10: {
        id: "a10",
        sourceId: "svc-b",
        targetId: "secrets",
        label: "reads",
      },
      a11: {
        id: "a11",
        sourceId: "svc-a",
        targetId: "logs",
        label: "ships logs",
      },
      a12: {
        id: "a12",
        sourceId: "svc-b",
        targetId: "logs",
        label: "ships logs",
      },
      a13: {
        id: "a13",
        sourceId: "svc-a",
        targetId: "nat",
        label: "egress",
      },
      a14: {
        id: "a14",
        sourceId: "svc-b",
        targetId: "nat",
        label: "egress",
      },
    },
    flows: {},
    iconLibrary: {},
  },
  nodeLayouts: {
    user: {
      elementId: "user",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    cdn: {
      elementId: "cdn",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    vpc: {
      elementId: "vpc",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "az-a": {
      elementId: "az-a",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "az-b": {
      elementId: "az-b",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "pub-a": {
      elementId: "pub-a",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "pub-b": {
      elementId: "pub-b",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "priv-a": {
      elementId: "priv-a",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "priv-b": {
      elementId: "priv-b",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    alb: {
      elementId: "alb",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    nat: {
      elementId: "nat",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "svc-a": {
      elementId: "svc-a",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "svc-b": {
      elementId: "svc-b",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "rds-primary": {
      elementId: "rds-primary",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "rds-standby": {
      elementId: "rds-standby",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    s3: {
      elementId: "s3",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    secrets: {
      elementId: "secrets",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    logs: {
      elementId: "logs",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
  },
  edgeLayouts: {},
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

const c4ContextHealthcare: Diagram = {
  id: "C4 Context healthcare",
  name: "C4 Context healthcare",
  level: "context",
  createdAt: 0,
  updatedAt: 0,
  snapshot: {
    components: {
      patient: {
        id: "patient",
        name: "Patient",
        description: "",
        parentId: null,
        type: "person",
      },
      clinician: {
        id: "clinician",
        name: "Clinician",
        description: "",
        parentId: null,
        type: "person",
      },
      admin: {
        id: "admin",
        name: "Practice Administrator",
        description: "",
        parentId: null,
        type: "person",
      },
      ehr: {
        id: "ehr",
        name: "Care Coordination Platform",
        description: "",
        parentId: null,
        type: "container",
      },
      "hospital-his": {
        id: "hospital-his",
        name: "Hospital HIS",
        description: "",
        parentId: null,
        type: "system",
      },
      lab: {
        id: "lab",
        name: "Laboratory System",
        description: "",
        parentId: null,
        type: "system",
      },
      pharmacy: {
        id: "pharmacy",
        name: "Pharmacy Network",
        description: "",
        parentId: null,
        type: "system",
      },
      insurer: {
        id: "insurer",
        name: "Insurance Clearinghouse",
        description: "",
        parentId: null,
        type: "system",
      },
      identity: {
        id: "identity",
        name: "National Identity Service",
        description: "",
        parentId: null,
        type: "system",
      },
      sms: {
        id: "sms",
        name: "SMS Provider",
        description: "",
        parentId: null,
        type: "system",
      },
    },
    connections: {
      h1: {
        id: "h1",
        sourceId: "patient",
        targetId: "ehr",
        label: "books appointments",
      },
      h2: {
        id: "h2",
        sourceId: "clinician",
        targetId: "ehr",
        label: "records care",
      },
      h3: {
        id: "h3",
        sourceId: "admin",
        targetId: "ehr",
        label: "administers",
      },
      h4: {
        id: "h4",
        sourceId: "ehr",
        targetId: "hospital-his",
        label: "HL7 v2",
      },
      h5: {
        id: "h5",
        sourceId: "ehr",
        targetId: "lab",
        label: "orders tests",
      },
      h6: {
        id: "h6",
        sourceId: "lab",
        targetId: "ehr",
        label: "returns results",
      },
      h7: {
        id: "h7",
        sourceId: "ehr",
        targetId: "pharmacy",
        label: "sends prescriptions",
      },
      h8: {
        id: "h8",
        sourceId: "ehr",
        targetId: "insurer",
        label: "submits claims",
      },
      h9: {
        id: "h9",
        sourceId: "ehr",
        targetId: "identity",
        label: "verifies identity",
      },
      h10: {
        id: "h10",
        sourceId: "ehr",
        targetId: "sms",
        label: "sends reminders",
      },
      h11: {
        id: "h11",
        sourceId: "patient",
        targetId: "identity",
        label: "authenticates",
      },
    },
    flows: {},
    iconLibrary: {},
  },
  nodeLayouts: {
    patient: {
      elementId: "patient",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    clinician: {
      elementId: "clinician",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    admin: {
      elementId: "admin",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    ehr: {
      elementId: "ehr",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "hospital-his": {
      elementId: "hospital-his",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    lab: {
      elementId: "lab",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    pharmacy: {
      elementId: "pharmacy",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    insurer: {
      elementId: "insurer",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    identity: {
      elementId: "identity",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    sms: {
      elementId: "sms",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
  },
  edgeLayouts: {},
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

const awsMicroservices: Diagram = {
  id: "AWS microservices",
  name: "AWS microservices",
  level: "container",
  createdAt: 0,
  updatedAt: 0,
  snapshot: {
    components: {
      client: {
        id: "client",
        name: "Client",
        description: "",
        parentId: null,
        type: "person",
      },
      vpc: {
        id: "vpc",
        name: "Microservices",
        description: "",
        parentId: null,
        type: "panel",
        panelKind: PanelKind.Vpc,
        panelColor: "hsl(220 50% 35%)",
      },
      apigw: {
        id: "apigw",
        name: "API Gateway",
        description: "",
        parentId: "vpc",
        type: "aws-networking",
        cloudServiceId: "api-gateway",
      },
      cognito: {
        id: "cognito",
        name: "Cognito",
        description: "",
        parentId: "vpc",
        type: "aws-security",
        cloudServiceId: "cognito",
      },
      priv: {
        id: "priv",
        name: "Private",
        description: "",
        parentId: "vpc",
        type: "panel",
        panelKind: PanelKind.PrivateSubnet,
        panelColor: "hsl(0 50% 38%)",
      },
      "orders-fn": {
        id: "orders-fn",
        name: "Orders",
        description: "",
        parentId: "priv",
        type: "aws-compute",
        cloudServiceId: "lambda",
        technology: "Node.js",
      },
      "billing-fn": {
        id: "billing-fn",
        name: "Billing",
        description: "",
        parentId: "priv",
        type: "aws-compute",
        cloudServiceId: "lambda",
        technology: "Python",
      },
      "inventory-fn": {
        id: "inventory-fn",
        name: "Inventory",
        description: "",
        parentId: "priv",
        type: "aws-compute",
        cloudServiceId: "lambda",
        technology: "Go",
      },
      "notify-fn": {
        id: "notify-fn",
        name: "Notifications",
        description: "",
        parentId: "priv",
        type: "aws-compute",
        cloudServiceId: "lambda",
        technology: "Node.js",
      },
      reporting: {
        id: "reporting",
        name: "Reporting Worker",
        description: "",
        parentId: "priv",
        type: "aws-compute",
        cloudServiceId: "ecs",
        technology: "ECS",
      },
      bus: {
        id: "bus",
        name: "EventBridge",
        description: "",
        parentId: "vpc",
        type: "aws-integration",
        cloudServiceId: "eventbridge",
      },
      queue: {
        id: "queue",
        name: "Billing Queue",
        description: "",
        parentId: "vpc",
        type: "aws-integration",
        cloudServiceId: "sqs",
      },
      topic: {
        id: "topic",
        name: "Notifications Topic",
        description: "",
        parentId: "vpc",
        type: "aws-integration",
        cloudServiceId: "sns",
      },
      "orders-table": {
        id: "orders-table",
        name: "Orders Table",
        description: "",
        parentId: "vpc",
        type: "aws-database",
        cloudServiceId: "dynamodb",
      },
      "inventory-table": {
        id: "inventory-table",
        name: "Inventory Table",
        description: "",
        parentId: "vpc",
        type: "aws-database",
        cloudServiceId: "dynamodb",
      },
      "billing-db": {
        id: "billing-db",
        name: "Billing DB",
        description: "",
        parentId: "vpc",
        type: "aws-database",
        cloudServiceId: "rds",
        technology: "PostgreSQL",
      },
      "reports-bucket": {
        id: "reports-bucket",
        name: "Reports Bucket",
        description: "",
        parentId: "vpc",
        type: "aws-storage",
        cloudServiceId: "s3",
      },
    },
    connections: {
      m1: {
        id: "m1",
        sourceId: "client",
        targetId: "apigw",
        label: "HTTPS",
      },
      m2: {
        id: "m2",
        sourceId: "apigw",
        targetId: "cognito",
        label: "authorizes",
      },
      m3: {
        id: "m3",
        sourceId: "apigw",
        targetId: "orders-fn",
        label: "invokes",
      },
      m4: {
        id: "m4",
        sourceId: "apigw",
        targetId: "inventory-fn",
        label: "invokes",
      },
      m5: {
        id: "m5",
        sourceId: "orders-fn",
        targetId: "orders-table",
        label: "reads/writes",
      },
      m6: {
        id: "m6",
        sourceId: "orders-fn",
        targetId: "bus",
        label: "publishes",
      },
      m7: {
        id: "m7",
        sourceId: "bus",
        targetId: "queue",
        label: "routes",
      },
      m8: {
        id: "m8",
        sourceId: "bus",
        targetId: "topic",
        label: "routes",
      },
      m9: {
        id: "m9",
        sourceId: "queue",
        targetId: "billing-fn",
        label: "triggers",
      },
      m10: {
        id: "m10",
        sourceId: "topic",
        targetId: "notify-fn",
        label: "triggers",
      },
      m11: {
        id: "m11",
        sourceId: "billing-fn",
        targetId: "billing-db",
        label: "reads/writes",
      },
      m12: {
        id: "m12",
        sourceId: "inventory-fn",
        targetId: "inventory-table",
        label: "reads/writes",
      },
      m13: {
        id: "m13",
        sourceId: "inventory-fn",
        targetId: "bus",
        label: "publishes",
      },
      m14: {
        id: "m14",
        sourceId: "reporting",
        targetId: "orders-table",
        label: "scans",
      },
      m15: {
        id: "m15",
        sourceId: "reporting",
        targetId: "billing-db",
        label: "reads",
      },
      m16: {
        id: "m16",
        sourceId: "reporting",
        targetId: "reports-bucket",
        label: "writes",
      },
      m17: {
        id: "m17",
        sourceId: "bus",
        targetId: "reporting",
        label: "schedules",
      },
    },
    flows: {},
    iconLibrary: {},
  },
  nodeLayouts: {
    client: {
      elementId: "client",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    vpc: {
      elementId: "vpc",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    apigw: {
      elementId: "apigw",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    cognito: {
      elementId: "cognito",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    priv: {
      elementId: "priv",
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    },
    "orders-fn": {
      elementId: "orders-fn",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "billing-fn": {
      elementId: "billing-fn",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "inventory-fn": {
      elementId: "inventory-fn",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "notify-fn": {
      elementId: "notify-fn",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    reporting: {
      elementId: "reporting",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    bus: {
      elementId: "bus",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    queue: {
      elementId: "queue",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    topic: {
      elementId: "topic",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "orders-table": {
      elementId: "orders-table",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "inventory-table": {
      elementId: "inventory-table",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "billing-db": {
      elementId: "billing-db",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
    "reports-bucket": {
      elementId: "reports-bucket",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    },
  },
  edgeLayouts: {},
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

export interface ReferenceDiagram {
  name: string;
  diagram: Diagram;
}

export const REFERENCE_DIAGRAMS: ReferenceDiagram[] = [
  { name: "C4 e-commerce", diagram: c4Ecommerce },
  { name: "AWS ECS Fargate", diagram: awsEcsFargate },
  { name: "C4 Context healthcare", diagram: c4ContextHealthcare },
  { name: "AWS microservices", diagram: awsMicroservices },
];

/** The layout graph of a fixture, built the way the auto-layout builds it. */
export function fixtureGraph(diagram: Diagram): LayoutGraph {
  return fromDiagram(
    diagram.snapshot.components,
    Object.values(diagram.snapshot.connections),
    diagram.nodeLayouts,
  );
}

/** Edge id -> label, for sizing the estimated label boxes when measuring. */
export function labelsOf(diagram: Diagram): Map<string, string> {
  return new Map(
    Object.values(diagram.snapshot.connections)
      .filter((connection) => connection.label !== undefined && connection.label !== "")
      .map((connection) => [connection.id, connection.label ?? ""]),
  );
}

/** The connections of a fixture as plain edges, for the readability measures. */
export function edgesOf(
  diagram: Diagram,
): Array<{ id: string; sourceId: string; targetId: string }> {
  return Object.values(diagram.snapshot.connections).map(({ id, sourceId, targetId }) => ({
    id,
    sourceId,
    targetId,
  }));
}

/**
 * Structural problems of a fixture, empty when it is sound: every key matches
 * its id, every parent exists and is a panel, containment has no cycle and
 * every connection joins two components that exist. A malformed fixture fails
 * here, loudly, instead of skewing a measurement.
 */
export function fixtureIssues(diagram: Diagram): string[] {
  const issues: string[] = [];
  const { components, connections } = diagram.snapshot;
  for (const [key, component] of Object.entries(components)) {
    if (component.id !== key) issues.push(`component key ${key} != id ${component.id}`);
    const parentId = component.parentId;
    if (parentId === null || parentId === undefined) continue;
    const parent = components[parentId];
    if (parent === undefined) issues.push(`${key}: parent ${parentId} does not exist`);
    else if (parent.type !== "panel") issues.push(`${key}: parent ${parentId} is not a panel`);
    const seen = new Set<string>([key]);
    let cursor: string | null | undefined = parentId;
    while (cursor !== null && cursor !== undefined) {
      if (seen.has(cursor)) {
        issues.push(`${key}: containment cycle through ${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = components[cursor]?.parentId;
    }
  }
  for (const [key, connection] of Object.entries(connections)) {
    if (connection.id !== key) issues.push(`connection key ${key} != id ${connection.id}`);
    if (components[connection.sourceId] === undefined)
      issues.push(`${key}: source ${connection.sourceId} does not exist`);
    if (components[connection.targetId] === undefined)
      issues.push(`${key}: target ${connection.targetId} does not exist`);
    if (connection.sourceId === connection.targetId) issues.push(`${key}: self-loop`);
  }
  return issues;
}

import type { Diagram, ServiceDefinition} from "@/features/diagram";

function buildSharedServiceRegistry(): Record<string, ServiceDefinition> {
  return {
    "svc-order": {
      id: "svc-order",
      name: "order-service",
      description: "Microserviço de processamento de pedidos",
      repositoryUrl: "https://github.com/acme/order-service",
      technology: ["Java", "Spring Boot", "PostgreSQL"],
      owner: "team-orders",
      tags: ["backend", "core"],
    },
    "svc-gateway": {
      id: "svc-gateway",
      name: "api-gateway",
      description: "Gateway de entrada para roteamento e autenticação",
      repositoryUrl: "https://github.com/acme/api-gateway",
      technology: ["Kong", "Nginx", "Lua"],
      owner: "team-platform",
      tags: ["infra", "gateway"],
    },
    "svc-auth": {
      id: "svc-auth",
      name: "auth-middleware",
      description: "Middleware de autenticação e validação JWT",
      repositoryUrl: "https://github.com/acme/auth-middleware",
      technology: ["Node.js", "Express", "jsonwebtoken"],
      owner: "team-security",
      tags: ["security", "middleware"],
    },
  };
}

function buildSeedDiagrams(): Record<string, Diagram> {
  return {
    "d-context": {
      id: "d-context",
      name: "System Context",
      level: "context",
      domain: "E-commerce",
      updatedAt: "2h atrás",
      snapshot: {
        components: {
          "e-user": {
            id: "e-user",
            name: "Cliente",
            type: "person",
            description: "Usuário final do sistema",
            parentId: null,
          },
          "e-orders": {
            id: "e-orders",
            name: "Sistema de Pedidos",
            type: "system",
            description: "Processa e gerencia pedidos de compra",
            parentId: null,
            linkedDiagramId: "d-orders",
          },
          "e-payments": {
            id: "e-payments",
            name: "Sistema de Pagamento",
            type: "system",
            description: "Processamento de transações financeiras",
            parentId: null,
          },
        },
        connections: {
          "r-1": {
            id: "r-1",
            sourceId: "e-user",
            targetId: "e-orders",
            label: "Faz pedidos via",
          },
          "r-2": {
            id: "r-2",
            sourceId: "e-orders",
            targetId: "e-payments",
            label: "Processa pagamento via",
          },
        },
        flows: {
          "flow-order": {
            id: "flow-order",
            name: "Fluxo de Pedido",
            diagramId: "d-context",
            mermaid:
              "Cliente->>Sistema de Pedidos: Faz pedido\nNote over Sistema de Pedidos: Valida estoque\nSistema de Pedidos->>Sistema de Pagamento: Processa pagamento",
            steps: [
              {
                order: 0,
                componentId: "e-user",
                connectionId: "r-1",
                note: "Cliente faz pedido no sistema",
              },
              {
                order: 1,
                componentId: "e-orders",
                note: "Valida estoque disponível",
              },
              {
                order: 2,
                componentId: "e-payments",
                connectionId: "r-2",
                note: "Envia para processamento de pagamento",
              },
            ],
          },
        },
      },
      nodeLayouts: [
        { elementId: "e-user", x: 400, y: 50 },
        { elementId: "e-orders", x: 200, y: 250 },
        { elementId: "e-payments", x: 600, y: 250 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    "d-orders": {
      id: "d-orders",
      name: "Orders – Containers",
      level: "container",
      domain: "E-commerce",
      updatedAt: "1 dia",
      snapshot: {
        components: {
          "e-gateway": {
            id: "e-gateway",
            name: "API Gateway",
            type: "container",
            description: "Roteamento e autenticação",
            technology: "Kong / Nginx",
            parentId: null,
            serviceId: "svc-gateway",
            linkedDiagramId: "d-gateway",
          },
          "e-order-svc": {
            id: "e-order-svc",
            name: "Order Service",
            type: "container",
            description: "Lógica de negócio de pedidos",
            technology: "Java / Spring Boot",
            parentId: null,
            serviceId: "svc-order",
          },
          "e-db": {
            id: "e-db",
            name: "Database",
            type: "container",
            description: "Armazenamento de pedidos e produtos",
            technology: "PostgreSQL",
            parentId: null,
          },
        },
        connections: {
          "r-3": {
            id: "r-3",
            sourceId: "e-gateway",
            targetId: "e-order-svc",
            label: "Roteia para",
          },
          "r-4": {
            id: "r-4",
            sourceId: "e-order-svc",
            targetId: "e-db",
            label: "Lê e escreve em",
          },
        },
        flows: {},
      },
      nodeLayouts: [
        { elementId: "e-gateway", x: 100, y: 100 },
        { elementId: "e-order-svc", x: 400, y: 100 },
        { elementId: "e-db", x: 400, y: 300 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    "d-gateway": {
      id: "d-gateway",
      name: "Gateway – Components",
      level: "component",
      domain: "E-commerce",
      updatedAt: "3 dias",
      snapshot: {
        components: {
          "e-auth": {
            id: "e-auth",
            name: "Auth Middleware",
            type: "component",
            description: "Validação JWT",
            technology: "Node.js",
            parentId: null,
            serviceId: "svc-auth",
          },
          "e-limiter": {
            id: "e-limiter",
            name: "Rate Limiter",
            type: "component",
            description: "Controle de taxa de requisições",
            technology: "Redis",
            parentId: null,
          },
        },
        connections: {
          "r-5": {
            id: "r-5",
            sourceId: "e-auth",
            targetId: "e-limiter",
            label: "Verifica limite via",
          },
        },
        flows: {},
      },
      nodeLayouts: [
        { elementId: "e-auth", x: 100, y: 100 },
        { elementId: "e-limiter", x: 400, y: 100 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

export const SEED_SERVICE_REGISTRY: Record<string, ServiceDefinition> =
  buildSharedServiceRegistry();
export const SEED_DIAGRAMS: Record<string, Diagram> = buildSeedDiagrams();

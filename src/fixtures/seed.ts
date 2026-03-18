import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";

/* ─────────────────────── Folder ─────────────────────── */

const SEED_FOLDER_ID = "folder-seed-ecommerce";

function buildSeedFolders(): Record<string, Folder> {
  return {
    [SEED_FOLDER_ID]: {
      id: SEED_FOLDER_ID,
      name: "Example - Ecommerce",
      parentId: null,
      domain: "seed",
    },
  };
}

/* ─────────────────────── Service Registry ─────────────────────── */

function buildSharedServiceRegistry(): Record<string, ServiceDefinition> {
  return {
    "svc-order": {
      id: "svc-order",
      name: "order-service",
      description: "Microserviço de processamento e gerenciamento de pedidos",
      repositoryUrl: "https://github.com/acme/order-service",
      technology: ["Java", "Spring Boot", "PostgreSQL"],
      owner: "team-orders",
      tags: ["backend", "core", "domain"],
    },
    "svc-gateway": {
      id: "svc-gateway",
      name: "api-gateway",
      description:
        "Gateway de entrada para roteamento, rate limiting e autenticação",
      repositoryUrl: "https://github.com/acme/api-gateway",
      technology: ["Kong", "Nginx", "Lua"],
      owner: "team-platform",
      tags: ["infra", "gateway"],
    },
    "svc-auth": {
      id: "svc-auth",
      name: "auth-service",
      description: "Serviço de autenticação OAuth2/OIDC e validação JWT",
      repositoryUrl: "https://github.com/acme/auth-service",
      technology: ["Node.js", "Express", "jsonwebtoken", "Redis"],
      owner: "team-security",
      tags: ["security", "auth"],
    },
    "svc-inventory": {
      id: "svc-inventory",
      name: "inventory-service",
      description: "Controle de estoque e reserva de produtos",
      repositoryUrl: "https://github.com/acme/inventory-service",
      technology: ["Go", "gRPC", "DynamoDB"],
      owner: "team-catalog",
      tags: ["backend", "domain"],
    },
    "svc-notification": {
      id: "svc-notification",
      name: "notification-service",
      description: "Envio de notificações por email, SMS e push",
      repositoryUrl: "https://github.com/acme/notification-service",
      technology: ["Python", "FastAPI", "Celery", "Redis"],
      owner: "team-engagement",
      tags: ["backend", "messaging"],
    },
    "svc-payment": {
      id: "svc-payment",
      name: "payment-service",
      description:
        "Processamento de pagamentos e integração com gateways financeiros",
      repositoryUrl: "https://github.com/acme/payment-service",
      technology: ["Java", "Spring Boot", "Stripe SDK"],
      owner: "team-payments",
      tags: ["backend", "financial", "pci"],
    },
    "svc-webapp": {
      id: "svc-webapp",
      name: "web-app",
      description: "Aplicação web SPA do e-commerce",
      repositoryUrl: "https://github.com/acme/web-app",
      technology: ["React", "TypeScript", "Vite"],
      owner: "team-frontend",
      tags: ["frontend", "spa"],
    },
    "svc-bff": {
      id: "svc-bff",
      name: "bff-service",
      description:
        "Backend-for-Frontend agregando chamadas para a SPA",
      repositoryUrl: "https://github.com/acme/bff-service",
      technology: ["Node.js", "NestJS", "GraphQL"],
      owner: "team-frontend",
      tags: ["backend", "aggregation"],
    },
  };
}

/* ─────────────────────── Diagrams ─────────────────────── */

function buildSeedDiagrams(): Record<string, Diagram> {
  return {
    /* ═══════════════════════════════════════════════════════
       C1 — System Context
       ═══════════════════════════════════════════════════════ */
    "d-context": {
      id: "d-context",
      name: "E-commerce – Contexto",
      level: "context",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-02-15T09:00:00.000Z",
      updatedAt: "2026-03-17T14:30:00.000Z",
      snapshot: {
        components: {
          "ctx-customer": {
            id: "ctx-customer",
            name: "Cliente",
            type: "person",
            description:
              "Usuário final que navega pelo catálogo, adiciona produtos ao carrinho e realiza compras.",
            parentId: null,
          },
          "ctx-admin": {
            id: "ctx-admin",
            name: "Administrador",
            type: "person",
            description:
              "Operador interno que gerencia catálogo, pedidos e configurações da plataforma.",
            parentId: null,
          },
          "ctx-ecommerce": {
            id: "ctx-ecommerce",
            name: "Plataforma E-commerce",
            type: "system",
            description:
              "Sistema central que processa pedidos, gerencia catálogo, estoque e pagamentos.",
            parentId: null,
            linkedDiagramId: "d-containers",
          },
          "ctx-payment-gw": {
            id: "ctx-payment-gw",
            name: "Gateway de Pagamento",
            type: "system",
            description:
              "Sistema externo (Stripe/PagSeguro) para processamento de transações financeiras.",
            parentId: null,
            tags: ["externo"],
          },
          "ctx-email": {
            id: "ctx-email",
            name: "Serviço de Email",
            type: "system",
            description:
              "Provedor externo de envio de emails transacionais (SendGrid).",
            parentId: null,
            tags: ["externo"],
          },
          "ctx-erp": {
            id: "ctx-erp",
            name: "ERP Legado",
            type: "system",
            description:
              "Sistema legado de gestão empresarial que mantém dados fiscais e contábeis.",
            parentId: null,
            tags: ["externo", "legado"],
          },
          "ctx-note": {
            id: "ctx-note",
            name: "Notas de Contexto",
            type: "note",
            description:
              "## Decisões\n- Gateway de Pagamento: Stripe como primário, PagSeguro como fallback para PIX.\n- ERP será substituído por módulo interno no Q3 2026.\n\n## Restrições\n- PCI-DSS compliance obrigatório para todos os fluxos de pagamento.\n- Dados de cartão nunca devem trafegar pelos nossos servidores.",
            parentId: null,
          },
        },
        connections: {
          "ctx-r1": {
            id: "ctx-r1",
            sourceId: "ctx-customer",
            targetId: "ctx-ecommerce",
            label: "Navega, busca produtos e faz pedidos",
            intent: "call",
            direction: "unidirectional",
          },
          "ctx-r2": {
            id: "ctx-r2",
            sourceId: "ctx-admin",
            targetId: "ctx-ecommerce",
            label: "Gerencia catálogo e pedidos",
            intent: "call",
            direction: "unidirectional",
          },
          "ctx-r3": {
            id: "ctx-r3",
            sourceId: "ctx-ecommerce",
            targetId: "ctx-payment-gw",
            label: "Processa cobrança",
            technology: "HTTPS / REST",
            intent: "call",
            direction: "unidirectional",
          },
          "ctx-r4": {
            id: "ctx-r4",
            sourceId: "ctx-ecommerce",
            targetId: "ctx-email",
            label: "Dispara emails transacionais",
            technology: "HTTPS / API",
            intent: "async-message",
            direction: "unidirectional",
          },
          "ctx-r5": {
            id: "ctx-r5",
            sourceId: "ctx-ecommerce",
            targetId: "ctx-erp",
            label: "Sincroniza dados fiscais",
            technology: "SFTP / Batch",
            intent: "data-flow",
            direction: "bidirectional",
            style: {
              strokeStyle: "dashed",
              strokeWidth: 2,
              animated: true,
            },
          },
        },
        flows: {
          "flow-purchase": {
            id: "flow-purchase",
            name: "Fluxo de Compra Completo",
            diagramId: "d-context",
            description:
              "Fluxo end-to-end desde a navegação do cliente até a confirmação do pedido.",
            tags: ["core", "happy-path"],
            mermaid:
              "Cliente->>Plataforma E-commerce: Adiciona itens ao carrinho\nNote over Plataforma E-commerce: Valida estoque\nPlataforma E-commerce->>Gateway de Pagamento: Processa cobrança\nGateway de Pagamento-->>Plataforma E-commerce: Confirmação\nPlataforma E-commerce->>Serviço de Email: Envia confirmação\nPlataforma E-commerce->>ERP Legado: Registra venda",
            steps: [
              {
                order: 0,
                componentId: "ctx-customer",
                connectionId: "ctx-r1",
                note: "Cliente adiciona produtos e finaliza o pedido",
              },
              {
                order: 1,
                componentId: "ctx-ecommerce",
                note: "Plataforma valida disponibilidade de estoque",
              },
              {
                order: 2,
                componentId: "ctx-payment-gw",
                connectionId: "ctx-r3",
                note: "Gateway processa cobrança no cartão",
                duration: "~2s",
              },
              {
                order: 3,
                componentId: "ctx-ecommerce",
                note: "Recebe confirmação de pagamento",
              },
              {
                order: 4,
                componentId: "ctx-email",
                connectionId: "ctx-r4",
                note: "Envia email de confirmação ao cliente",
              },
              {
                order: 5,
                componentId: "ctx-erp",
                connectionId: "ctx-r5",
                note: "Sincroniza registro fiscal com o ERP",
              },
            ],
          },
        },
      },
      nodeLayouts: {
        "ctx-customer": { elementId: "ctx-customer", x: 200, y: 50 },
        "ctx-admin": { elementId: "ctx-admin", x: 900, y: 50 },
        "ctx-ecommerce": { elementId: "ctx-ecommerce", x: 550, y: 400 },
        "ctx-payment-gw": { elementId: "ctx-payment-gw", x: 50, y: 800 },
        "ctx-email": { elementId: "ctx-email", x: 550, y: 800 },
        "ctx-erp": { elementId: "ctx-erp", x: 1050, y: 800 },
        "ctx-note": {
          elementId: "ctx-note",
          x: 1350,
          y: 50,
          width: 336,
          height: 475,
        },
      },
      viewport: { x: 0, y: 0, zoom: 0.55 },
    },

    /* ═══════════════════════════════════════════════════════
       C2 — Container Diagram
       ═══════════════════════════════════════════════════════ */
    "d-containers": {
      id: "d-containers",
      name: "E-commerce – Containers",
      level: "container",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-03-17T11:00:00.000Z",
      snapshot: {
        components: {
          /* ── Frontend tier ── */
          "ct-panel-frontend": {
            id: "ct-panel-frontend",
            name: "Frontend Tier",
            type: "panel",
            description: "Camada de apresentação",
            parentId: null,
            panelKind: "default",
            panelColor: "#e3f2fd",
            panelOpacity: 0.3,
            borderStyle: "solid",
          },
          "ct-webapp": {
            id: "ct-webapp",
            name: "Web App (SPA)",
            type: "container",
            description:
              "Aplicação React SPA servida via CDN. Responsável pela experiência do usuário.",
            technology: "React / TypeScript / Vite",
            parentId: "ct-panel-frontend",
            serviceId: "svc-webapp",
          },
          "ct-bff": {
            id: "ct-bff",
            name: "BFF (GraphQL)",
            type: "container",
            description:
              "Backend-for-Frontend que agrega chamadas dos microserviços para a SPA.",
            technology: "Node.js / NestJS / GraphQL",
            parentId: "ct-panel-frontend",
            serviceId: "svc-bff",
            linkedDiagramId: "d-bff-components",
          },

          /* ── API Gateway ── */
          "ct-gateway": {
            id: "ct-gateway",
            name: "API Gateway",
            type: "container",
            description:
              "Roteamento, autenticação, rate limiting e load balancing.",
            technology: "Kong / Nginx",
            parentId: null,
            serviceId: "svc-gateway",
            linkedDiagramId: "d-gateway-components",
          },

          /* ── Backend services panel ── */
          "ct-panel-backend": {
            id: "ct-panel-backend",
            name: "Backend Microservices",
            type: "panel",
            description: "Domínio de negócio",
            parentId: null,
            panelKind: "default",
            panelColor: "#fff3e0",
            panelOpacity: 0.3,
            borderStyle: "dashed",
          },
          "ct-order-svc": {
            id: "ct-order-svc",
            name: "Order Service",
            type: "container",
            description:
              "CRUD de pedidos, máquina de estados do pedido, cálculo de frete e impostos.",
            technology: "Java / Spring Boot",
            parentId: "ct-panel-backend",
            serviceId: "svc-order",
          },
          "ct-inventory-svc": {
            id: "ct-inventory-svc",
            name: "Inventory Service",
            type: "container",
            description:
              "Controle de estoque, reservas temporárias e notificação de reposição.",
            technology: "Go / gRPC",
            parentId: "ct-panel-backend",
            serviceId: "svc-inventory",
          },
          "ct-payment-svc": {
            id: "ct-payment-svc",
            name: "Payment Service",
            type: "container",
            description:
              "Orquestração de pagamentos, retry com idempotência, integração com Stripe.",
            technology: "Java / Spring Boot",
            parentId: "ct-panel-backend",
            serviceId: "svc-payment",
          },
          "ct-auth-svc": {
            id: "ct-auth-svc",
            name: "Auth Service",
            type: "container",
            description:
              "Autenticação OAuth2, emissão e validação de tokens JWT, gerenciamento de sessões.",
            technology: "Node.js / Express",
            parentId: "ct-panel-backend",
            serviceId: "svc-auth",
          },
          "ct-notification-svc": {
            id: "ct-notification-svc",
            name: "Notification Service",
            type: "container",
            description:
              "Envio assíncrono de notificações por email, SMS e push notifications.",
            technology: "Python / FastAPI / Celery",
            parentId: "ct-panel-backend",
            serviceId: "svc-notification",
          },

          /* ── Data tier panel ── */
          "ct-panel-data": {
            id: "ct-panel-data",
            name: "Data Tier",
            type: "panel",
            description: "Armazenamento e mensageria",
            parentId: null,
            panelKind: "default",
            panelColor: "#f3e5f5",
            panelOpacity: 0.25,
            borderStyle: "solid",
          },
          "ct-postgres": {
            id: "ct-postgres",
            name: "PostgreSQL",
            type: "container",
            description:
              "Banco relacional principal para pedidos, usuários e catálogo.",
            technology: "PostgreSQL 16",
            parentId: "ct-panel-data",
          },
          "ct-dynamodb": {
            id: "ct-dynamodb",
            name: "DynamoDB",
            type: "container",
            description:
              "Armazenamento NoSQL para inventário com baixa latência.",
            technology: "AWS DynamoDB",
            parentId: "ct-panel-data",
          },
          "ct-redis": {
            id: "ct-redis",
            name: "Redis",
            type: "container",
            description:
              "Cache distribuído para sessões, rate limiting e carrinhos temporários.",
            technology: "Redis 7 (ElastiCache)",
            parentId: "ct-panel-data",
          },
          "ct-kafka": {
            id: "ct-kafka",
            name: "Kafka",
            type: "container",
            description:
              "Broker de eventos para comunicação assíncrona entre serviços.",
            technology: "Apache Kafka (MSK)",
            parentId: "ct-panel-data",
          },
        },
        connections: {
          "ct-r1": {
            id: "ct-r1",
            sourceId: "ct-webapp",
            targetId: "ct-bff",
            label: "Queries e mutations",
            technology: "GraphQL / HTTPS",
            intent: "call",
          },
          "ct-r2": {
            id: "ct-r2",
            sourceId: "ct-bff",
            targetId: "ct-gateway",
            label: "Proxy de APIs",
            technology: "HTTPS / REST",
            intent: "call",
          },
          "ct-r3": {
            id: "ct-r3",
            sourceId: "ct-gateway",
            targetId: "ct-auth-svc",
            label: "Valida token",
            technology: "gRPC",
            intent: "call",
          },
          "ct-r4": {
            id: "ct-r4",
            sourceId: "ct-gateway",
            targetId: "ct-order-svc",
            label: "Roteia pedidos",
            technology: "HTTPS / REST",
            intent: "call",
          },
          "ct-r5": {
            id: "ct-r5",
            sourceId: "ct-gateway",
            targetId: "ct-inventory-svc",
            label: "Roteia consultas de estoque",
            technology: "gRPC",
            intent: "call",
          },
          "ct-r6": {
            id: "ct-r6",
            sourceId: "ct-order-svc",
            targetId: "ct-payment-svc",
            label: "Solicita cobrança",
            technology: "HTTPS / REST",
            intent: "call",
          },
          "ct-r7": {
            id: "ct-r7",
            sourceId: "ct-order-svc",
            targetId: "ct-inventory-svc",
            label: "Reserva estoque",
            technology: "gRPC",
            intent: "call",
          },
          "ct-r8": {
            id: "ct-r8",
            sourceId: "ct-order-svc",
            targetId: "ct-kafka",
            label: "Publica OrderCreated",
            technology: "Kafka Producer",
            intent: "event",
            style: { animated: true },
          },
          "ct-r9": {
            id: "ct-r9",
            sourceId: "ct-kafka",
            targetId: "ct-notification-svc",
            label: "Consome eventos de pedido",
            technology: "Kafka Consumer",
            intent: "event",
            style: { animated: true },
          },
          "ct-r10": {
            id: "ct-r10",
            sourceId: "ct-order-svc",
            targetId: "ct-postgres",
            label: "Persiste pedidos",
            technology: "JDBC",
            intent: "data-flow",
          },
          "ct-r11": {
            id: "ct-r11",
            sourceId: "ct-auth-svc",
            targetId: "ct-postgres",
            label: "Lê/escreve usuários",
            technology: "JDBC",
            intent: "data-flow",
          },
          "ct-r12": {
            id: "ct-r12",
            sourceId: "ct-inventory-svc",
            targetId: "ct-dynamodb",
            label: "Lê/escreve estoque",
            technology: "AWS SDK",
            intent: "data-flow",
          },
          "ct-r13": {
            id: "ct-r13",
            sourceId: "ct-auth-svc",
            targetId: "ct-redis",
            label: "Cache de sessões",
            technology: "ioredis",
            intent: "data-flow",
          },
          "ct-r14": {
            id: "ct-r14",
            sourceId: "ct-gateway",
            targetId: "ct-redis",
            label: "Rate limiting counters",
            technology: "Redis Protocol",
            intent: "data-flow",
          },
        },
        flows: {
          "flow-create-order": {
            id: "flow-create-order",
            name: "Criação de Pedido",
            diagramId: "d-containers",
            description:
              "Fluxo completo de criação de um pedido, desde a SPA até a persistência e notificação.",
            tags: ["core", "happy-path"],
            mermaid:
              "Web App->>BFF: mutation createOrder\nBFF->>API Gateway: POST /orders\nAPI Gateway->>Auth Service: validateToken\nAPI Gateway->>Order Service: POST /orders\nOrder Service->>Inventory Service: reserveStock\nOrder Service->>Payment Service: processPayment\nOrder Service->>PostgreSQL: persist order\nOrder Service->>Kafka: publish OrderCreated\nKafka->>Notification Service: consume OrderCreated\nNotification Service->>Cliente: email de confirmação",
            steps: [
              {
                order: 0,
                componentId: "ct-webapp",
                connectionId: "ct-r1",
                note: "Usuário clica em 'Finalizar Pedido' na SPA",
              },
              {
                order: 1,
                componentId: "ct-bff",
                connectionId: "ct-r2",
                note: "BFF transforma a mutation GraphQL em chamada REST",
              },
              {
                order: 2,
                componentId: "ct-gateway",
                connectionId: "ct-r3",
                note: "Gateway valida JWT com o Auth Service",
                duration: "~50ms",
              },
              {
                order: 3,
                componentId: "ct-gateway",
                connectionId: "ct-r4",
                note: "Gateway roteia para o Order Service",
              },
              {
                order: 4,
                componentId: "ct-order-svc",
                connectionId: "ct-r7",
                note: "Order Service reserva estoque via gRPC",
                duration: "~100ms",
              },
              {
                order: 5,
                componentId: "ct-order-svc",
                connectionId: "ct-r6",
                note: "Order Service solicita cobrança ao Payment Service",
                duration: "~2s",
              },
              {
                order: 6,
                componentId: "ct-order-svc",
                connectionId: "ct-r10",
                note: "Persiste pedido com status CONFIRMED",
              },
              {
                order: 7,
                componentId: "ct-order-svc",
                connectionId: "ct-r8",
                note: "Publica evento OrderCreated no Kafka",
              },
              {
                order: 8,
                componentId: "ct-notification-svc",
                connectionId: "ct-r9",
                note: "Consome evento e envia email de confirmação",
              },
            ],
          },
        },
      },
      nodeLayouts: {
        // Frontend tier
        "ct-panel-frontend": {
          elementId: "ct-panel-frontend",
          x: 100,
          y: 50,
          width: 900,
          height: 300,
        },
        "ct-webapp": { elementId: "ct-webapp", x: 150, y: 130 },
        "ct-bff": { elementId: "ct-bff", x: 600, y: 130 },
        // Gateway
        "ct-gateway": { elementId: "ct-gateway", x: 450, y: 500 },
        // Backend panel
        "ct-panel-backend": {
          elementId: "ct-panel-backend",
          x: 50,
          y: 750,
          width: 1800,
          height: 300,
        },
        "ct-auth-svc": { elementId: "ct-auth-svc", x: 100, y: 830 },
        "ct-order-svc": { elementId: "ct-order-svc", x: 450, y: 830 },
        "ct-inventory-svc": {
          elementId: "ct-inventory-svc",
          x: 800,
          y: 830,
        },
        "ct-payment-svc": { elementId: "ct-payment-svc", x: 1150, y: 830 },
        "ct-notification-svc": {
          elementId: "ct-notification-svc",
          x: 1500,
          y: 830,
        },
        // Data tier panel
        "ct-panel-data": {
          elementId: "ct-panel-data",
          x: 50,
          y: 1200,
          width: 1800,
          height: 300,
        },
        "ct-postgres": { elementId: "ct-postgres", x: 100, y: 1280 },
        "ct-dynamodb": { elementId: "ct-dynamodb", x: 500, y: 1280 },
        "ct-redis": { elementId: "ct-redis", x: 900, y: 1280 },
        "ct-kafka": { elementId: "ct-kafka", x: 1300, y: 1280 },
      },
      viewport: { x: 0, y: 0, zoom: 0.45 },
    },

    /* ═══════════════════════════════════════════════════════
       C2 — AWS Infrastructure
       ═══════════════════════════════════════════════════════ */
    "d-aws-infra": {
      id: "d-aws-infra",
      name: "Infraestrutura AWS",
      level: "container",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-03-08T14:00:00.000Z",
      updatedAt: "2026-03-17T15:00:00.000Z",
      snapshot: {
        components: {
          /* ── VPC ── */
          "aws-vpc": {
            id: "aws-vpc",
            name: "Production VPC",
            type: "panel",
            description: "VPC principal em us-east-1 (10.0.0.0/16)",
            parentId: null,
            panelKind: "vpc",
            panelColor: "#e8f5e9",
            panelOpacity: 0.2,
            borderStyle: "solid",
          },

          /* ── Load Balancer & NAT (inside VPC) ── */
          "aws-alb": {
            id: "aws-alb",
            name: "Application Load Balancer",
            type: "aws-networking",
            awsService: "Elastic Load Balancing",
            description:
              "ALB com TLS termination e path-based routing para os serviços.",
            technology: "ALB",
            parentId: "aws-vpc",
          },
          "aws-nat": {
            id: "aws-nat",
            name: "NAT Gateway",
            type: "aws-networking",
            awsService: "VPC",
            description:
              "NAT Gateway para saída de internet das subnets privadas.",
            technology: "NAT Gateway",
            parentId: "aws-vpc",
          },

          /* ── EKS Cluster (inside VPC) ── */
          "aws-eks": {
            id: "aws-eks",
            name: "EKS Cluster",
            type: "panel",
            description:
              "Kubernetes cluster gerenciado rodando os microserviços.",
            parentId: "aws-vpc",
            panelKind: "eks-cluster",
            panelColor: "#e3f2fd",
            panelOpacity: 0.3,
            borderStyle: "solid",
          },
          "aws-order-pod": {
            id: "aws-order-pod",
            name: "Order Service Pods",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description: "3 réplicas do Order Service (HPA: 3-10 pods)",
            technology: "Kubernetes / Docker",
            parentId: "aws-eks",
          },
          "aws-inventory-pod": {
            id: "aws-inventory-pod",
            name: "Inventory Service Pods",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description: "2 réplicas do Inventory Service (HPA: 2-6 pods)",
            technology: "Kubernetes / Docker",
            parentId: "aws-eks",
          },
          "aws-payment-pod": {
            id: "aws-payment-pod",
            name: "Payment Service Pods",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description: "2 réplicas do Payment Service (HPA: 2-8 pods)",
            technology: "Kubernetes / Docker",
            parentId: "aws-eks",
          },

          /* ── Data stores (inside VPC) ── */
          "aws-rds": {
            id: "aws-rds",
            name: "RDS PostgreSQL",
            type: "aws-database",
            awsService: "Amazon RDS",
            description:
              "Multi-AZ PostgreSQL 16 com read replica para queries analíticas.",
            technology: "RDS / PostgreSQL 16",
            parentId: "aws-vpc",
          },
          "aws-dynamo": {
            id: "aws-dynamo",
            name: "DynamoDB",
            type: "aws-database",
            awsService: "Amazon DynamoDB",
            description:
              "Tabela de inventário com on-demand capacity e DAX cache.",
            technology: "DynamoDB / DAX",
            parentId: "aws-vpc",
          },
          "aws-elasticache": {
            id: "aws-elasticache",
            name: "ElastiCache Redis",
            type: "aws-database",
            awsService: "Amazon ElastiCache",
            description:
              "Redis 7 cluster mode para sessões, cache e rate limiting.",
            technology: "ElastiCache / Redis 7",
            parentId: "aws-vpc",
          },

          /* ── Messaging (inside VPC) ── */
          "aws-msk": {
            id: "aws-msk",
            name: "MSK (Kafka)",
            type: "aws-integration",
            awsService: "Amazon MSK",
            description:
              "Kafka managed para eventos entre microserviços (3 brokers, 7 dias retenção).",
            technology: "MSK / Kafka 3.5",
            parentId: "aws-vpc",
          },

          /* ── External services ── */
          "aws-cloudwatch": {
            id: "aws-cloudwatch",
            name: "CloudWatch",
            type: "aws-management",
            awsService: "Amazon CloudWatch",
            description:
              "Métricas, logs e alarmes. Dashboards de latência e error rate.",
            technology: "CloudWatch",
            parentId: null,
          },
          "aws-s3": {
            id: "aws-s3",
            name: "S3 (Assets)",
            type: "aws-storage",
            awsService: "Amazon S3",
            description:
              "Bucket para assets estáticos da SPA e imagens de produtos (+ CloudFront).",
            technology: "S3 / CloudFront",
            parentId: null,
          },

          /* ── Note ── */
          "aws-note": {
            id: "aws-note",
            name: "Notas de Infra",
            type: "note",
            description:
              "## Custos estimados\n- EKS: ~$350/mês (3 m5.large)\n- RDS: ~$280/mês (db.r6g.large multi-AZ)\n- MSK: ~$200/mês (kafka.m5.large x3)\n\n## TODO\n- Migrar para Graviton instances no próximo quarter\n- Avaliar Karpenter para autoscaling de nodes",
            parentId: null,
          },
        },
        connections: {
          "aws-r1": {
            id: "aws-r1",
            sourceId: "aws-alb",
            targetId: "aws-order-pod",
            label: "Roteia /api/orders",
            intent: "call",
          },
          "aws-r2": {
            id: "aws-r2",
            sourceId: "aws-alb",
            targetId: "aws-inventory-pod",
            label: "Roteia /api/inventory",
            intent: "call",
          },
          "aws-r3": {
            id: "aws-r3",
            sourceId: "aws-order-pod",
            targetId: "aws-payment-pod",
            label: "Solicita pagamento",
            intent: "call",
          },
          "aws-r4": {
            id: "aws-r4",
            sourceId: "aws-order-pod",
            targetId: "aws-rds",
            label: "JDBC",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "aws-r5": {
            id: "aws-r5",
            sourceId: "aws-inventory-pod",
            targetId: "aws-dynamo",
            label: "AWS SDK",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "aws-r6": {
            id: "aws-r6",
            sourceId: "aws-order-pod",
            targetId: "aws-elasticache",
            label: "Cache / Sessions",
            intent: "data-flow",
          },
          "aws-r7": {
            id: "aws-r7",
            sourceId: "aws-order-pod",
            targetId: "aws-msk",
            label: "Produce events",
            intent: "event",
            style: { animated: true },
          },
          "aws-r8": {
            id: "aws-r8",
            sourceId: "aws-order-pod",
            targetId: "aws-cloudwatch",
            label: "Logs e métricas",
            intent: "async-message",
            style: { strokeStyle: "dashed", animated: true },
          },
          "aws-r9": {
            id: "aws-r9",
            sourceId: "aws-order-pod",
            targetId: "aws-nat",
            label: "Internet egress",
            intent: "dependency",
            direction: "unidirectional",
          },
        },
        flows: {},
      },
      nodeLayouts: {
        "aws-vpc": {
          elementId: "aws-vpc",
          x: 50,
          y: 30,
          width: 2200,
          height: 1800,
        },
        "aws-alb": { elementId: "aws-alb", x: 200, y: 120 },
        "aws-nat": { elementId: "aws-nat", x: 1400, y: 120 },
        "aws-eks": {
          elementId: "aws-eks",
          x: 100,
          y: 400,
          width: 1500,
          height: 300,
        },
        "aws-order-pod": { elementId: "aws-order-pod", x: 150, y: 500 },
        "aws-inventory-pod": {
          elementId: "aws-inventory-pod",
          x: 650,
          y: 500,
        },
        "aws-payment-pod": { elementId: "aws-payment-pod", x: 1150, y: 500 },
        "aws-rds": { elementId: "aws-rds", x: 150, y: 950 },
        "aws-dynamo": { elementId: "aws-dynamo", x: 600, y: 950 },
        "aws-elasticache": { elementId: "aws-elasticache", x: 1050, y: 950 },
        "aws-msk": { elementId: "aws-msk", x: 1500, y: 950 },
        "aws-cloudwatch": { elementId: "aws-cloudwatch", x: 2500, y: 400 },
        "aws-s3": { elementId: "aws-s3", x: 2500, y: 100 },
        "aws-note": {
          elementId: "aws-note",
          x: 2500,
          y: 900,
          width: 336,
          height: 475,
        },
      },
      viewport: { x: 0, y: 0, zoom: 0.35 },
    },

    /* ═══════════════════════════════════════════════════════
       C3 — Gateway Components
       ═══════════════════════════════════════════════════════ */
    "d-gateway-components": {
      id: "d-gateway-components",
      name: "API Gateway – Componentes",
      level: "component",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-16T16:00:00.000Z",
      snapshot: {
        components: {
          "gw-auth-plugin": {
            id: "gw-auth-plugin",
            name: "Auth Plugin",
            type: "component",
            description:
              "Plugin do Kong que intercepta requisições, extrai o JWT do header e valida via Auth Service.",
            technology: "Lua / Kong Plugin",
            parentId: null,
            serviceId: "svc-gateway",
          },
          "gw-rate-limiter": {
            id: "gw-rate-limiter",
            name: "Rate Limiter",
            type: "component",
            description:
              "Controle de taxa usando sliding window com Redis. Limites por IP e por API key.",
            technology: "Lua / Redis",
            parentId: null,
          },
          "gw-router": {
            id: "gw-router",
            name: "Router",
            type: "component",
            description:
              "Roteamento baseado em path prefix e headers. Suporta canary releases com weights.",
            technology: "Kong / Nginx",
            parentId: null,
          },
          "gw-cors": {
            id: "gw-cors",
            name: "CORS Handler",
            type: "component",
            description:
              "Plugin de CORS com whitelist de origens e suporte a preflight caching.",
            technology: "Lua / Kong Plugin",
            parentId: null,
          },
          "gw-logger": {
            id: "gw-logger",
            name: "Request Logger",
            type: "component",
            description:
              "Log estruturado de todas as requisições para observabilidade. Envia para CloudWatch.",
            technology: "Lua / CloudWatch",
            parentId: null,
          },
          "gw-transformer": {
            id: "gw-transformer",
            name: "Response Transformer",
            type: "component",
            description:
              "Remove headers internos, adiciona security headers (HSTS, CSP) e compressão gzip.",
            technology: "Lua / Kong Plugin",
            parentId: null,
          },
        },
        connections: {
          "gw-r1": {
            id: "gw-r1",
            sourceId: "gw-cors",
            targetId: "gw-auth-plugin",
            label: "Passa request validado (CORS OK)",
            intent: "call",
          },
          "gw-r2": {
            id: "gw-r2",
            sourceId: "gw-auth-plugin",
            targetId: "gw-rate-limiter",
            label: "Request autenticado",
            intent: "call",
          },
          "gw-r3": {
            id: "gw-r3",
            sourceId: "gw-rate-limiter",
            targetId: "gw-router",
            label: "Request permitido (dentro do limite)",
            intent: "call",
          },
          "gw-r4": {
            id: "gw-r4",
            sourceId: "gw-router",
            targetId: "gw-transformer",
            label: "Response do upstream",
            intent: "call",
            direction: "reverse",
          },
          "gw-r5": {
            id: "gw-r5",
            sourceId: "gw-router",
            targetId: "gw-logger",
            label: "Registra request/response",
            intent: "async-message",
            style: { strokeStyle: "dashed", animated: true },
          },
        },
        flows: {
          "flow-gw-pipeline": {
            id: "flow-gw-pipeline",
            name: "Pipeline de Request",
            diagramId: "d-gateway-components",
            description:
              "Fluxo de uma requisição HTTP passando por todos os plugins do gateway.",
            tags: ["infra", "pipeline"],
            mermaid:
              "CORS->>Auth Plugin: preflight OK\nAuth Plugin->>Rate Limiter: JWT válido\nRate Limiter->>Router: dentro do limite\nRouter->>Upstream: proxy\nRouter->>Request Logger: log async\nRouter->>Response Transformer: response",
            steps: [
              {
                order: 0,
                componentId: "gw-cors",
                connectionId: "gw-r1",
                note: "CORS valida origem e método",
                duration: "~1ms",
              },
              {
                order: 1,
                componentId: "gw-auth-plugin",
                connectionId: "gw-r2",
                note: "Valida JWT e extrai claims",
                duration: "~5ms",
              },
              {
                order: 2,
                componentId: "gw-rate-limiter",
                connectionId: "gw-r3",
                note: "Verifica sliding window no Redis",
                duration: "~2ms",
              },
              {
                order: 3,
                componentId: "gw-router",
                note: "Roteia para o upstream service",
                duration: "~1ms",
              },
              {
                order: 4,
                componentId: "gw-logger",
                connectionId: "gw-r5",
                note: "Log assíncrono enviado ao CloudWatch",
              },
              {
                order: 5,
                componentId: "gw-transformer",
                connectionId: "gw-r4",
                note: "Adiciona security headers e compressão",
              },
            ],
          },
        },
      },
      nodeLayouts: {
        "gw-cors": { elementId: "gw-cors", x: 100, y: 80 },
        "gw-auth-plugin": { elementId: "gw-auth-plugin", x: 550, y: 80 },
        "gw-rate-limiter": { elementId: "gw-rate-limiter", x: 1000, y: 80 },
        "gw-router": { elementId: "gw-router", x: 550, y: 450 },
        "gw-logger": { elementId: "gw-logger", x: 100, y: 800 },
        "gw-transformer": { elementId: "gw-transformer", x: 1000, y: 800 },
      },
      viewport: { x: 0, y: 0, zoom: 0.55 },
    },

    /* ═══════════════════════════════════════════════════════
       C3 — BFF Components
       ═══════════════════════════════════════════════════════ */
    "d-bff-components": {
      id: "d-bff-components",
      name: "BFF – Componentes",
      level: "component",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-03-05T08:00:00.000Z",
      updatedAt: "2026-03-17T09:00:00.000Z",
      snapshot: {
        components: {
          "bff-gql-server": {
            id: "bff-gql-server",
            name: "GraphQL Server",
            type: "component",
            description:
              "Apollo Server com schema-first approach. Resolve queries e mutations via DataLoaders.",
            technology: "NestJS / Apollo Server",
            parentId: null,
            serviceId: "svc-bff",
          },
          "bff-auth-guard": {
            id: "bff-auth-guard",
            name: "Auth Guard",
            type: "component",
            description:
              "NestJS Guard que extrai e valida o JWT antes de resolver queries protegidas.",
            technology: "NestJS / Passport",
            parentId: null,
          },
          "bff-order-resolver": {
            id: "bff-order-resolver",
            name: "Order Resolver",
            type: "component",
            description:
              "Resolver GraphQL para queries e mutations de pedidos. Agrega dados de múltiplos serviços.",
            technology: "NestJS / GraphQL",
            parentId: null,
          },
          "bff-catalog-resolver": {
            id: "bff-catalog-resolver",
            name: "Catalog Resolver",
            type: "component",
            description:
              "Resolver para listagem de produtos, busca e detalhes. Usa DataLoader para N+1.",
            technology: "NestJS / GraphQL",
            parentId: null,
          },
          "bff-cache": {
            id: "bff-cache",
            name: "Cache Layer",
            type: "component",
            description:
              "Cache em memória (LRU) + Redis para respostas de catálogo com TTL de 5min.",
            technology: "NestJS / CacheManager / Redis",
            parentId: null,
          },
        },
        connections: {
          "bff-r1": {
            id: "bff-r1",
            sourceId: "bff-gql-server",
            targetId: "bff-auth-guard",
            label: "Intercepta requests protegidos",
            intent: "call",
          },
          "bff-r2": {
            id: "bff-r2",
            sourceId: "bff-gql-server",
            targetId: "bff-order-resolver",
            label: "Delega queries de pedido",
            intent: "call",
          },
          "bff-r3": {
            id: "bff-r3",
            sourceId: "bff-gql-server",
            targetId: "bff-catalog-resolver",
            label: "Delega queries de catálogo",
            intent: "call",
          },
          "bff-r4": {
            id: "bff-r4",
            sourceId: "bff-catalog-resolver",
            targetId: "bff-cache",
            label: "Cache hit/miss",
            intent: "data-flow",
            style: { strokeWidth: 2, animated: true },
          },
        },
        flows: {},
      },
      nodeLayouts: {
        "bff-gql-server": { elementId: "bff-gql-server", x: 500, y: 50 },
        "bff-auth-guard": { elementId: "bff-auth-guard", x: 50, y: 450 },
        "bff-order-resolver": {
          elementId: "bff-order-resolver",
          x: 500,
          y: 450,
        },
        "bff-catalog-resolver": {
          elementId: "bff-catalog-resolver",
          x: 950,
          y: 450,
        },
        "bff-cache": { elementId: "bff-cache", x: 950, y: 800 },
      },
      viewport: { x: 0, y: 0, zoom: 0.55 },
    },

    /* ═══════════════════════════════════════════════════════
       C3 — Order Service API
       ═══════════════════════════════════════════════════════ */
    "d-order-api": {
      id: "d-order-api",
      name: "Order Service – API",
      level: "component",
      domain: "seed",
      folderId: SEED_FOLDER_ID,
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z",
      snapshot: {
        components: {
          "api-orders": {
            id: "api-orders",
            name: "Orders API",
            type: "api-group",
            description: "API REST de gerenciamento de pedidos",
            parentId: null,
            serviceName: "order-service",
            basePath: "/api/v1/orders",
            protocol: "REST" as const,
            sla: "99.9% uptime, p99 < 500ms",
          },
          "ep-list-orders": {
            id: "ep-list-orders",
            name: "GET /api/v1/orders",
            type: "endpoint",
            description: "Lista pedidos do usuário com paginação e filtros",
            parentId: "api-orders",
            method: "GET" as const,
            path: "/api/v1/orders",
            endpointDescription:
              "Retorna lista paginada de pedidos. Suporta filtros por status, data e valor.",
            handlers: [
              {
                id: "h-list-1",
                label: "AuthGuard",
                description: "Valida JWT e extrai userId",
              },
              {
                id: "h-list-2",
                label: "PaginationPipe",
                description:
                  "Valida e normaliza parâmetros de paginação (page, limit, sort)",
              },
              {
                id: "h-list-3",
                label: "OrderController.list",
                description: "Busca pedidos no repositório com filtros",
              },
            ],
          },
          "ep-create-order": {
            id: "ep-create-order",
            name: "POST /api/v1/orders",
            type: "endpoint",
            description: "Cria um novo pedido",
            parentId: "api-orders",
            method: "POST" as const,
            path: "/api/v1/orders",
            endpointDescription:
              "Cria um pedido novo. Reserva estoque, processa pagamento e envia evento.",
            handlers: [
              {
                id: "h-create-1",
                label: "AuthGuard",
                description: "Valida JWT",
              },
              {
                id: "h-create-2",
                label: "ValidationPipe",
                description:
                  "Valida body (items, shippingAddress, paymentMethod)",
              },
              {
                id: "h-create-3",
                label: "OrderController.create",
                description: "Orquestra criação do pedido",
                flowId: "flow-create-order-detail",
              },
            ],
          },
          "ep-get-order": {
            id: "ep-get-order",
            name: "GET /api/v1/orders/:id",
            type: "endpoint",
            description: "Retorna detalhes de um pedido específico",
            parentId: "api-orders",
            method: "GET" as const,
            path: "/api/v1/orders/:id",
            endpointDescription:
              "Busca pedido por ID. Inclui itens, status de pagamento e tracking.",
            handlers: [
              {
                id: "h-get-1",
                label: "AuthGuard",
                description: "Valida JWT e verifica ownership",
              },
              {
                id: "h-get-2",
                label: "OrderController.findOne",
                description: "Busca pedido e agrega dados de serviços",
              },
            ],
          },
          "ep-cancel-order": {
            id: "ep-cancel-order",
            name: "PATCH /api/v1/orders/:id/cancel",
            type: "endpoint",
            description: "Cancela um pedido existente",
            parentId: "api-orders",
            method: "PATCH" as const,
            path: "/api/v1/orders/:id/cancel",
            endpointDescription:
              "Cancela o pedido se ainda estiver em status cancelável. Libera estoque e processa reembolso.",
            handlers: [
              {
                id: "h-cancel-1",
                label: "AuthGuard",
                description: "Valida JWT e ownership",
              },
              {
                id: "h-cancel-2",
                label: "OrderController.cancel",
                description:
                  "Executa cancelamento: libera estoque, solicita refund, publica evento",
                flowId: "flow-cancel-order",
              },
            ],
          },
          "ep-order-events": {
            id: "ep-order-events",
            name: "OrderCreated Event",
            type: "endpoint",
            description: "Evento publicado quando um pedido é criado",
            parentId: "api-orders",
            method: "EVENT" as const,
            path: "orders.created",
            endpointDescription:
              "Evento Kafka publicado no tópico 'orders.created' após persistência do pedido.",
            handlers: [
              {
                id: "h-event-1",
                label: "EventPublisher",
                description:
                  "Serializa OrderCreatedEvent e publica no Kafka com garantia at-least-once",
              },
            ],
          },
        },
        connections: {
          "api-r1": {
            id: "api-r1",
            sourceId: "ep-create-order",
            targetId: "ep-order-events",
            label: "Publica após criação",
            intent: "event",
            style: { animated: true },
          },
          "api-r2": {
            id: "api-r2",
            sourceId: "ep-cancel-order",
            targetId: "ep-order-events",
            label: "Publica após cancelamento",
            intent: "event",
            style: { animated: true },
          },
        },
        flows: {
          "flow-create-order-detail": {
            id: "flow-create-order-detail",
            name: "Criação de Pedido (detalhe)",
            diagramId: "d-order-api",
            description:
              "Fluxo detalhado da criação de pedido dentro do Order Service.",
            tags: ["core"],
            mermaid:
              "Client->>POST /orders: request\nPOST /orders->>Inventory: reserveStock\nPOST /orders->>Payment: processPayment\nPOST /orders->>Database: persist\nPOST /orders->>OrderCreated: publish event",
            steps: [
              {
                order: 0,
                componentId: "ep-create-order",
                note: "Recebe request validado pelo AuthGuard e ValidationPipe",
              },
              {
                order: 1,
                componentId: "ep-create-order",
                note: "Chama Inventory Service para reservar estoque",
                duration: "~100ms",
                payload: '{ "items": [{ "sku": "ABC-123", "qty": 2 }] }',
                payloadDirection: "request",
              },
              {
                order: 2,
                componentId: "ep-create-order",
                note: "Chama Payment Service para processar pagamento",
                duration: "~2s",
                payload:
                  '{ "amount": 199.90, "currency": "BRL", "method": "credit_card" }',
                payloadDirection: "request",
              },
              {
                order: 3,
                componentId: "ep-create-order",
                note: "Persiste pedido no PostgreSQL com status CONFIRMED",
              },
              {
                order: 4,
                componentId: "ep-order-events",
                connectionId: "api-r1",
                note: "Publica OrderCreated no Kafka",
                payload:
                  '{ "orderId": "ord-456", "status": "CONFIRMED", "total": 199.90 }',
                payloadDirection: "response",
              },
            ],
          },
          "flow-cancel-order": {
            id: "flow-cancel-order",
            name: "Cancelamento de Pedido",
            diagramId: "d-order-api",
            description:
              "Fluxo de cancelamento com liberação de estoque e reembolso.",
            tags: ["core", "compensation"],
            mermaid:
              "Client->>PATCH /orders/:id/cancel: request\nPATCH cancel->>Inventory: releaseStock\nPATCH cancel->>Payment: refund\nPATCH cancel->>Database: update status\nPATCH cancel->>OrderCancelled: publish event",
            steps: [
              {
                order: 0,
                componentId: "ep-cancel-order",
                note: "Valida que pedido está em status cancelável (CONFIRMED ou PROCESSING)",
              },
              {
                order: 1,
                componentId: "ep-cancel-order",
                note: "Chama Inventory Service para liberar estoque reservado",
                duration: "~80ms",
              },
              {
                order: 2,
                componentId: "ep-cancel-order",
                note: "Solicita reembolso ao Payment Service",
                duration: "~3s",
              },
              {
                order: 3,
                componentId: "ep-cancel-order",
                note: "Atualiza status para CANCELLED no PostgreSQL",
              },
              {
                order: 4,
                componentId: "ep-order-events",
                connectionId: "api-r2",
                note: "Publica OrderCancelled no Kafka",
              },
            ],
          },
        },
      },
      nodeLayouts: {
        "api-orders": {
          elementId: "api-orders",
          x: 50,
          y: 30,
          width: 1200,
          height: 1100,
        },
        "ep-list-orders": { elementId: "ep-list-orders", x: 100, y: 120 },
        "ep-create-order": { elementId: "ep-create-order", x: 100, y: 350 },
        "ep-get-order": { elementId: "ep-get-order", x: 100, y: 580 },
        "ep-cancel-order": { elementId: "ep-cancel-order", x: 100, y: 810 },
        "ep-order-events": { elementId: "ep-order-events", x: 800, y: 450 },
      },
      viewport: { x: 0, y: 0, zoom: 0.5 },
    },
  };
}

/* ─────────────────────── Exports ─────────────────────── */

export const SEED_SERVICE_REGISTRY: Record<string, ServiceDefinition> =
  buildSharedServiceRegistry();
export const SEED_DIAGRAMS: Record<string, Diagram> = buildSeedDiagrams();
export const SEED_FOLDERS: Record<string, Folder> = buildSeedFolders();

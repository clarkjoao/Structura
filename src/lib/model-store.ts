import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type {
  Component,
  Connection,
  ServiceDefinition,
  ModelDraft,
  BluePrintVersion,
  ComponentType,
} from "./model-types";
import { generateId } from "./model-types";

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedDraft(): ModelDraft {
  const components: Record<string, Component> = {
    "e-orders": {
      id: "e-orders",
      name: "Sistema de Pedidos",
      type: "system",
      description: "Processa e gerencia pedidos de compra",
      parentId: null,
      x: 80,
      y: 80,
      width: 800,
      height: 500,
    },
    "e-payments": {
      id: "e-payments",
      name: "Sistema de Pagamento",
      type: "system",
      description: "Processamento de transações financeiras",
      parentId: null,
      x: 1000,
      y: 80,
      width: 800,
      height: 500,
    },
    "e-user": {
      id: "e-user",
      name: "Cliente",
      type: "person",
      description: "Usuário final do sistema",
      parentId: null,
      x: 500,
      y: -120,
    },
    "e-gateway": {
      id: "e-gateway",
      name: "API Gateway",
      type: "container",
      description: "Roteamento e autenticação",
      technology: "Kong / Nginx",
      parentId: "e-orders",
      x: 40,
      y: 80,
    },
    "e-order-svc": {
      id: "e-order-svc",
      name: "Order Service",
      type: "container",
      description: "Lógica de negócio de pedidos",
      technology: "Java / Spring Boot",
      parentId: "e-orders",
      x: 320,
      y: 80,
    },
    "e-db": {
      id: "e-db",
      name: "Database",
      type: "container",
      description: "Armazenamento de pedidos e produtos",
      technology: "PostgreSQL",
      parentId: "e-orders",
      x: 320,
      y: 280,
    },
    "e-auth": {
      id: "e-auth",
      name: "Auth Middleware",
      type: "component",
      description: "Validação JWT",
      technology: "Node.js",
      parentId: "e-payments",
      x: 40,
      y: 80,
    },
    "e-limiter": {
      id: "e-limiter",
      name: "Rate Limiter",
      type: "component",
      description: "Controle de taxa de requisições",
      technology: "Redis",
      parentId: "e-payments",
      x: 320,
      y: 80,
    },
    "e-ctrl": {
      id: "e-ctrl",
      name: "Order Controller",
      type: "component",
      description: "Endpoints REST",
      technology: "Spring MVC",
      parentId: "e-payments",
      x: 40,
      y: 280,
    },
    "e-repo": {
      id: "e-repo",
      name: "Order Repository",
      type: "component",
      description: "Persistência de dados",
      technology: "JPA",
      parentId: "e-payments",
      x: 320,
      y: 280,
    },
  };

  const connections: Record<string, Connection> = {
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
    "r-5": {
      id: "r-5",
      sourceId: "e-auth",
      targetId: "e-limiter",
      label: "Verifica limite via",
    },
    "r-6": {
      id: "r-6",
      sourceId: "e-ctrl",
      targetId: "e-repo",
      label: "Persiste dados via",
    },
  };

  const serviceRegistry: Record<string, ServiceDefinition> = {
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

  components["e-order-svc"].serviceId = "svc-order";
  components["e-gateway"].serviceId = "svc-gateway";
  components["e-auth"].serviceId = "svc-auth";

  return { components, connections, serviceRegistry };
}

const seedVersions: BluePrintVersion[] = [
  {
    id: "ver-6",
    version: "v3.2.1",
    parentId: "ver-5",
    timestamp: "2h atrás",
    author: "maria.dev",
    message: "Adicionado Rate Limiter ao Gateway",
    snapshot: buildSeedDraft(),
  },
  {
    id: "ver-5",
    version: "v3.2.0",
    parentId: "ver-4",
    timestamp: "1 dia",
    author: "joao.arq",
    message: "Refatoração do Order Service",
    snapshot: buildSeedDraft(),
  },
  {
    id: "ver-4",
    version: "v3.1.0",
    parentId: "ver-3",
    timestamp: "3 dias",
    author: "maria.dev",
    message: "Novo container: Database",
    snapshot: buildSeedDraft(),
  },
  {
    id: "ver-3",
    version: "v3.0.0",
    parentId: "ver-2",
    timestamp: "1 sem",
    author: "joao.arq",
    message: "Migração para microservices",
    snapshot: buildSeedDraft(),
  },
  {
    id: "ver-2",
    version: "v2.0.0",
    parentId: "ver-1",
    timestamp: "2 sem",
    author: "maria.dev",
    message: "Adicionado sistema de pagamentos",
    snapshot: buildSeedDraft(),
  },
  {
    id: "ver-1",
    version: "v1.0.0",
    parentId: null,
    timestamp: "1 mês",
    author: "joao.arq",
    message: "Commit inicial do modelo",
    snapshot: buildSeedDraft(),
  },
];

// ── Store interface ────────────────────────────────────────────────────────

interface DiagramState {
  draft: ModelDraft;
  versions: BluePrintVersion[];
}

interface DiagramActions {
  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
  ) => Component;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
  removeComponent: (id: string) => void;

  addConnection: (
    sourceId: string,
    targetId: string,
    label: string,
  ) => Connection;
  updateConnection: (
    id: string,
    patch: Partial<Omit<Connection, "id">>,
  ) => void;
  removeConnection: (id: string) => void;

  updateNodePosition: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  updateNodeSize: (
    elementId: string,
    width: number,
    height: number,
  ) => void;

  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;
  setComponentParent: (childId: string, parentId: string | null) => void;

  addService: (service: Omit<ServiceDefinition, "id">) => ServiceDefinition;
  updateService: (
    id: string,
    patch: Partial<Omit<ServiceDefinition, "id">>,
  ) => void;
  removeService: (id: string) => void;
  linkComponentToService: (
    componentId: string,
    serviceId: string | undefined,
  ) => void;

  commit: (message: string) => void;
}

export type DiagramStore = DiagramState & DiagramActions;

// ── Store ──────────────────────────────────────────────────────────────────

export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => ({
    draft: buildSeedDraft(),
    versions: seedVersions,

    addComponent: (type, name, parentId, position, awsService) => {
      const component: Component = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService ?? undefined,
        x: position?.x ?? 300,
        y: position?.y ?? 300,
      };

      set((state) => {
        state.draft.components[component.id] = component;
      });

      return component;
    },

    updateComponent: (id, patch) => {
      set((state) => {
        Object.assign(state.draft.components[id], patch);
      });
    },

    removeComponent: (id) => {
      set((state) => {
        const toRemove = new Set<string>();
        const collect = (eid: string) => {
          toRemove.add(eid);
          Object.values(state.draft.components)
            .filter((c) => c.parentId === eid)
            .forEach((c) => collect(c.id));
        };
        collect(id);

        toRemove.forEach((eid) => delete state.draft.components[eid]);

        Object.values(state.draft.connections).forEach((conn) => {
          if (toRemove.has(conn.sourceId) || toRemove.has(conn.targetId)) {
            delete state.draft.connections[conn.id];
          }
        });
      });
    },

    addConnection: (sourceId, targetId, label) => {
      const connection: Connection = {
        id: generateId("conn"),
        sourceId,
        targetId,
        label,
      };

      set((state) => {
        state.draft.connections[connection.id] = connection;
      });

      return connection;
    },

    updateConnection: (id, patch) => {
      set((state) => {
        Object.assign(state.draft.connections[id], patch);
      });
    },

    removeConnection: (id) => {
      set((state) => {
        delete state.draft.connections[id];
      });
    },

    updateNodePosition: (elementId, position) => {
      set((state) => {
        const comp = state.draft.components[elementId];
        if (comp) {
          comp.x = position.x;
          comp.y = position.y;
        }
      });
    },

    updateNodeSize: (elementId, width, height) => {
      set((state) => {
        const comp = state.draft.components[elementId];
        if (comp) {
          comp.width = width;
          comp.height = height;
        }
      });
    },

    bringToFront: (elementId) => {
      set((state) => {
        const all = Object.values(state.draft.components);
        const maxZ = Math.max(...all.map((c) => c.zIndex ?? 0));
        const comp = state.draft.components[elementId];
        if (comp) {
          comp.zIndex = maxZ + 1;
        }
      });
    },

    sendToBack: (elementId) => {
      set((state) => {
        const all = Object.values(state.draft.components);
        const minZ = Math.min(...all.map((c) => c.zIndex ?? 0));
        const comp = state.draft.components[elementId];
        if (comp) {
          comp.zIndex = minZ - 1;
        }
      });
    },

    setComponentParent: (childId, parentId) => {
      set((state) => {
        const comp = state.draft.components[childId];
        if (comp) {
          comp.parentId = parentId;
        }
      });
    },

    addService: (service) => {
      const svc: ServiceDefinition = {
        ...service,
        id: generateId("svc"),
      };
      set((state) => {
        state.draft.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id, patch) => {
      set((state) => {
        Object.assign(state.draft.serviceRegistry[id], patch);
      });
    },

    removeService: (id) => {
      set((state) => {
        delete state.draft.serviceRegistry[id];
        Object.values(state.draft.components).forEach((c) => {
          if (c.serviceId === id) {
            c.serviceId = undefined;
          }
        });
      });
    },

    linkComponentToService: (componentId, serviceId) => {
      set((state) => {
        const comp = state.draft.components[componentId];
        if (comp) {
          comp.serviceId = serviceId;
        }
      });
    },

    commit: (message) => {
      const { draft, versions } = get();
      const newVersion: BluePrintVersion = {
        id: generateId("ver"),
        version: `v${versions.length + 1}.0.0`,
        parentId: versions[0]?.id ?? null,
        timestamp: "agora",
        author: "you",
        message,
        snapshot: JSON.parse(JSON.stringify(draft)),
      };

      set((state) => {
        state.versions.unshift(newVersion);
      });
    },
  })),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const useComponents = () => useDiagramStore((s) => s.draft.components);

export const useComponent = (id: string) =>
  useDiagramStore((s) => s.draft.components[id]);

export const useConnections = () => useDiagramStore((s) => s.draft.connections);

export const useVersions = () => useDiagramStore((s) => s.versions);

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.draft.components)),
  );

export const useAllConnections = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.draft.connections)),
  );

export const useServiceRegistry = () =>
  useDiagramStore((s) => s.draft.serviceRegistry);

export const useAllServices = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.draft.serviceRegistry)),
  );

export const useService = (id: string) =>
  useDiagramStore((s) => s.draft.serviceRegistry[id]);

export const useComponentChildren = (parentId: string | null) =>
  useDiagramStore(
    useShallow((s) =>
      Object.values(s.draft.components).filter((c) => c.parentId === parentId),
    ),
  );

// ── Action hooks ───────────────────────────────────────────────────────────

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addComponent: s.addComponent,
      updateComponent: s.updateComponent,
      removeComponent: s.removeComponent,
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
      updateNodePosition: s.updateNodePosition,
      updateNodeSize: s.updateNodeSize,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      setComponentParent: s.setComponentParent,
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
      commit: s.commit,
    })),
  );

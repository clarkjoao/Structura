import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { defaultStorage } from "@/infrastructure/persistence";
import type {
  Component,
  Connection,
  Flow,
  FlowStep,
  Diagram,
  Folder,
  ComponentType,
  Level,
  ModelDraft,
  ViewNodeLayout,
} from "../model/diagram.types";
import { generateId } from "../model/diagram.utils";
import { parseMermaidToSteps } from "../model/diagram.service";
import type { ServiceDefinition } from "@/features/registry";

// ── Seed data ──────────────────────────────────────────────────────────────

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
  const registry = buildSharedServiceRegistry();

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
        serviceRegistry: registry,
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
        serviceRegistry: registry,
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
        serviceRegistry: registry,
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

// ── Store interface ────────────────────────────────────────────────────────

interface DiagramSnapshot {
  diagramId: string;
  snapshot: ModelDraft;
  nodeLayouts: ViewNodeLayout[];
  timestamp: number;
}

interface AppState {
  diagrams: Record<string, Diagram>;
  folders: Record<string, Folder>;
  activeDiagramId: string | null;
  past: DiagramSnapshot[];
  future: DiagramSnapshot[];
  _lastUndoRedoAt: number;
}

interface AppActions {
  addDiagram: (name: string, level: Level, domain?: string, folderId?: string | null) => Diagram;
  openDiagram: (id: string) => void;
  deleteDiagram: (id: string) => void;
  addFolder: (name: string, parentId: string | null, domain?: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveDiagram: (diagramId: string, folderId: string | null) => void;

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

  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;

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
  linkComponentToDiagram: (
    componentId: string,
    diagramId: string | undefined,
  ) => void;
  setParent: (childId: string, parentId: string | null) => void;

  addFlow: (diagramId: string, name: string, mermaid: string, steps?: FlowStep[]) => Flow;
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => void;
  removeFlow: (id: string) => void;

  insertPattern: (
    template: import("@/lib/patterns-catalog").PatternTemplate,
    position: { x: number; y: number },
  ) => void;

  undo: () => void;
  redo: () => void;
}

export type DiagramStore = AppState & AppActions;

// ── helpers ────────────────────────────────────────────────────────────────

function activeDiagram(state: AppState): Diagram {
  return state.diagrams[state.activeDiagramId!];
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function pushHistory(state: AppState) {
  const d = activeDiagram(state);
  if (!d) return;
  if (Date.now() - state._lastUndoRedoAt < 500) return;
  const last = state.past[state.past.length - 1];
  if (last?.diagramId === d.id && Date.now() - last.timestamp < 1000) return;
  state.past.push({
    diagramId: d.id,
    timestamp: Date.now(),
    snapshot: deepClone(d.snapshot),
    nodeLayouts: deepClone(d.nodeLayouts),
  });
  if (state.past.length > 50) state.past.shift();
  state.future = [];
}

// ── Store ──────────────────────────────────────────────────────────────────

const PERSIST_KEY = "diagram-store";

export const useDiagramStore = create<DiagramStore>()(
  persist(
    immer((set, get) => ({
      diagrams: buildSeedDiagrams(),
      folders: {},
      activeDiagramId: null,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,

    addDiagram: (name, level, domain, folderId) => {
      const diagram: Diagram = {
        id: generateId("d"),
        name,
        level,
        domain: domain || undefined,
        updatedAt: "agora",
        snapshot: {
          components: {},
          connections: {},
          serviceRegistry: {},
          flows: {},
        },
        nodeLayouts: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        folderId: folderId ?? undefined,
      };
      set((state) => {
        state.diagrams[diagram.id] = diagram;
      });
      return diagram;
    },

    addFolder: (name, parentId, domain) => {
      const folder: Folder = {
        id: generateId("folder"),
        name,
        parentId,
        domain: domain || undefined,
      };
      set((state) => {
        state.folders[folder.id] = folder;
      });
      return folder;
    },

    renameFolder: (id, name) => {
      set((state) => {
        const f = state.folders[id];
        if (f) f.name = name;
      });
    },

    deleteFolder: (id) => {
      set((state) => {
        const hasChildren = Object.values(state.folders).some((f) => f.parentId === id);
        const hasDiagrams = Object.values(state.diagrams).some((d) => d.folderId === id);
        if (hasChildren || hasDiagrams) return;
        delete state.folders[id];
      });
    },

    moveDiagram: (diagramId, folderId) => {
      set((state) => {
        const d = state.diagrams[diagramId];
        if (d) d.folderId = folderId ?? undefined;
      });
    },

    openDiagram: (id) => {
      set((state) => {
        state.activeDiagramId = id;
      });
    },

    deleteDiagram: (id) => {
      set((state) => {
        delete state.diagrams[id];
        if (state.activeDiagramId === id) state.activeDiagramId = null;
      });
    },

    addComponent: (type, name, parentId, position, awsService) => {
      const component: Component = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService ?? undefined,
        ...(type === "panel" ? { width: 600, height: 400 } : {}),
        ...(type === "note" ? { panelColor: "hsl(48 96% 53%)" } : {}),
      };
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        d.snapshot.components[component.id] = component;
        d.nodeLayouts.push({
          elementId: component.id,
          x: position?.x ?? 300,
          y: position?.y ?? 300,
          ...(type === "panel" ? { zIndex: -1 } : {}),
        });
        d.updatedAt = "agora";
      });
      return component;
    },

    updateComponent: (id, patch) => {
      const isDimensionOnly = Object.keys(patch).every(
        (k) => k === "width" || k === "height",
      );
      set((state) => {
        if (!isDimensionOnly) pushHistory(state);
        const d = activeDiagram(state);
        Object.assign(d.snapshot.components[id], patch);
        d.updatedAt = "agora";
      });
    },

    removeComponent: (id) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const toRemove = new Set<string>();
        const collect = (eid: string) => {
          toRemove.add(eid);
          Object.values(d.snapshot.components)
            .filter((c) => c.parentId === eid)
            .forEach((c) => collect(c.id));
        };
        collect(id);
        toRemove.forEach((eid) => delete d.snapshot.components[eid]);
        Object.values(d.snapshot.connections).forEach((conn) => {
          if (toRemove.has(conn.sourceId) || toRemove.has(conn.targetId))
            delete d.snapshot.connections[conn.id];
        });
        d.nodeLayouts = d.nodeLayouts.filter(
          (nl) => !toRemove.has(nl.elementId),
        );
        d.updatedAt = "agora";
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
        pushHistory(state);
        const d = activeDiagram(state);
        d.snapshot.connections[connection.id] = connection;
        d.updatedAt = "agora";
      });
      return connection;
    },

    updateConnection: (id, patch) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        Object.assign(d.snapshot.connections[id], patch);
        d.updatedAt = "agora";
      });
    },
    removeConnection: (id) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        delete d.snapshot.connections[id];
        d.updatedAt = "agora";
      });
    },

    updateNodeLayout: (elementId, position) => {
      set((state) => {
        const d = activeDiagram(state);
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) {
          layout.x = position.x;
          layout.y = position.y;
        }
      });
    },

    updateViewport: (viewport) => {
      set((state) => {
        activeDiagram(state).viewport = viewport;
      });
    },

    bringToFront: (elementId) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const maxZ = Math.max(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = maxZ + 1;
      });
    },

    sendToBack: (elementId) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const minZ = Math.min(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = minZ - 1;
      });
    },

    addService: (service) => {
      const svc: ServiceDefinition = { ...service, id: generateId("svc") };
      set((state) => {
        const d = activeDiagram(state);
        if (!d.snapshot.serviceRegistry) d.snapshot.serviceRegistry = {};
        d.snapshot.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id, patch) => {
      set((state) => {
        const svc = activeDiagram(state).snapshot.serviceRegistry?.[id];
        if (svc) Object.assign(svc, patch);
      });
    },

    removeService: (id) => {
      set((state) => {
        const d = activeDiagram(state);
        delete d.snapshot.serviceRegistry[id];
        Object.values(d.snapshot.components).forEach((c) => {
          if (c.serviceId === id) c.serviceId = undefined;
        });
      });
    },

    linkComponentToService: (componentId, serviceId) => {
      set((state) => {
        const comp = activeDiagram(state).snapshot.components[componentId];
        if (comp) comp.serviceId = serviceId;
      });
    },

    linkComponentToDiagram: (componentId, diagramId) => {
      set((state) => {
        const comp = activeDiagram(state).snapshot.components[componentId];
        if (comp) comp.linkedDiagramId = diagramId;
      });
    },

    setParent: (childId, parentId) => {
      set((state) => {
        pushHistory(state);
        const comp = activeDiagram(state).snapshot.components[childId];
        if (comp) comp.parentId = parentId;
      });
    },

    addFlow: (diagramId, name, mermaid, precomputedSteps) => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");
      const steps =
        precomputedSteps ??
        parseMermaidToSteps(
          mermaid,
          d.snapshot.components,
          d.snapshot.connections,
        );
      const flow: Flow = {
        id: generateId("flow"),
        name,
        mermaid,
        steps,
        diagramId,
      };
      set((state) => {
        state.diagrams[diagramId].snapshot.flows[flow.id] = flow;
      });
      return flow;
    },

    updateFlow: (id, patch) => {
      set((state) => {
        const d = activeDiagram(state);
        const flow = d.snapshot.flows[id];
        if (!flow) return;
        Object.assign(flow, patch);
        if (patch.mermaid !== undefined && patch.steps === undefined) {
          flow.steps = parseMermaidToSteps(
            patch.mermaid ?? flow.mermaid,
            d.snapshot.components,
            d.snapshot.connections,
          );
        }
      });
    },

    removeFlow: (id) => {
      set((state) => {
        delete activeDiagram(state).snapshot.flows[id];
      });
    },

    insertPattern: (template, position) => {
      const GRID_X = 220;
      const ids: string[] = template.components.map(() => generateId("el"));
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        template.components.forEach((c, i) => {
          const comp: Component = {
            id: ids[i],
            name: c.name,
            type: c.type,
            description: c.description ?? "",
            parentId: null,
            awsService: c.awsService ?? undefined,
          };
          d.snapshot.components[comp.id] = comp;
          d.nodeLayouts.push({
            elementId: comp.id,
            x: position.x + i * GRID_X,
            y: position.y,
          });
        });
        template.connections.forEach((conn) => {
          const connId = generateId("conn");
          d.snapshot.connections[connId] = {
            id: connId,
            sourceId: ids[conn.fromIndex],
            targetId: ids[conn.toIndex],
            label: conn.label,
          };
        });
        d.updatedAt = "agora";
      });
    },

    undo: () => {
      set((state) => {
        const entry = state.past.pop();
        if (!entry) return;
        const d = state.diagrams[entry.diagramId];
        if (!d) return;
        state.future.push({
          diagramId: d.id,
          snapshot: deepClone(d.snapshot),
          nodeLayouts: deepClone(d.nodeLayouts),
          timestamp: Date.now(),
        });
        d.snapshot = entry.snapshot;
        d.nodeLayouts = entry.nodeLayouts;
        state._lastUndoRedoAt = Date.now();
      });
    },

    redo: () => {
      set((state) => {
        const entry = state.future.pop();
        if (!entry) return;
        const d = state.diagrams[entry.diagramId];
        if (!d) return;
        state.past.push({
          diagramId: d.id,
          snapshot: deepClone(d.snapshot),
          nodeLayouts: deepClone(d.nodeLayouts),
          timestamp: Date.now(),
        });
        d.snapshot = entry.snapshot;
        d.nodeLayouts = entry.nodeLayouts;
        state._lastUndoRedoAt = Date.now();
      });
    },
  })),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => defaultStorage),
      merge: (persistedState, currentState) => {
        const state = {
          ...currentState,
          ...(persistedState && (persistedState as Partial<DiagramStore>)),
        };
        // Migrate: ensure every rehydrated diagram snapshot has serviceRegistry
        Object.values(state.diagrams ?? {}).forEach((d) => {
          if (!d.snapshot.serviceRegistry) d.snapshot.serviceRegistry = {};
        });
        if (!state.folders) state.folders = {};
        return state;
      },
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const useDiagrams = () => useDiagramStore((s) => s.diagrams);
export const useAllDiagrams = () =>
  useDiagramStore(useShallow((s) => Object.values(s.diagrams)));
export const useFolders = () => useDiagramStore((s) => s.folders);
export const useAllFolders = () =>
  useDiagramStore(useShallow((s) => Object.values(s.folders)));
export const useActiveDiagramId = () =>
  useDiagramStore((s) => s.activeDiagramId);

export const useActiveDiagram = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId] : null,
  );

export const useComponents = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.components : {},
  );

export const useComponent = (id: string) =>
  useDiagramStore((s) =>
    s.activeDiagramId
      ? s.diagrams[s.activeDiagramId].snapshot.components[id]
      : undefined,
  );

export const useConnections = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.connections : {},
  );

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(d.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(d.snapshot.components).filter((c) =>
        visibleIds.has(c.id),
      );
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(d.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(d.snapshot.connections).filter(
        (conn) =>
          visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );

export const useCanNavigateInto = (_elementId: string) => false;

export const useServiceRegistry = () =>
  useDiagramStore((s) =>
    s.activeDiagramId
      ? (s.diagrams[s.activeDiagramId].snapshot.serviceRegistry ?? {})
      : {},
  );

export const useAllServices = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(
        s.diagrams[s.activeDiagramId].snapshot.serviceRegistry ?? {},
      );
    }),
  );

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.components);
    }),
  );

export const useAllConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.connections);
    }),
  );

export const useFlows = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.flows);
    }),
  );

// ── Action hooks ───────────────────────────────────────────────────────────

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addDiagram: s.addDiagram,
      openDiagram: s.openDiagram,
      deleteDiagram: s.deleteDiagram,
      addFolder: s.addFolder,
      renameFolder: s.renameFolder,
      deleteFolder: s.deleteFolder,
      moveDiagram: s.moveDiagram,
      addComponent: s.addComponent,
      updateComponent: s.updateComponent,
      removeComponent: s.removeComponent,
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
      updateNodeLayout: s.updateNodeLayout,
      updateViewport: s.updateViewport,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
      linkComponentToDiagram: s.linkComponentToDiagram,
      setParent: s.setParent,
      addFlow: s.addFlow,
      updateFlow: s.updateFlow,
      removeFlow: s.removeFlow,
      insertPattern: s.insertPattern,
      undo: s.undo,
      redo: s.redo,
    })),
  );

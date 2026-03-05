import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type {
  Component,
  Connection,
  ServiceDefinition,
  EmbeddedDiagram,
  Flow,
  FlowStep,
  Diagram,
  ModelDraft,
  ComponentType,
  Level,
} from "./model-types";
import { generateId } from "./model-types";

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
                componentId: "e-orders",
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
      embeddedDiagrams: [],
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
      embeddedDiagrams: [],
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
      embeddedDiagrams: [],
    },
  };
}

// ── Store interface ────────────────────────────────────────────────────────

interface AppState {
  diagrams: Record<string, Diagram>;
  activeDiagramId: string | null;
  _undoStack: string[];
  _redoStack: string[];
}

interface AppActions {
  addDiagram: (name: string, level: Level, domain?: string) => Diagram;
  openDiagram: (id: string) => void;
  deleteDiagram: (id: string) => void;

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

  embedDiagram: (
    originComponentId: string,
    diagramId: string,
    position: { x: number; y: number },
  ) => void;
  detachEmbed: (embedId: string) => void;

  addFlow: (diagramId: string, name: string, mermaid: string) => Flow;
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => void;
  removeFlow: (id: string) => void;

  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

export type DiagramStore = AppState & AppActions;

// ── helpers ────────────────────────────────────────────────────────────────

function activeDiagram(state: AppState): Diagram {
  return state.diagrams[state.activeDiagramId!];
}

function parseMermaidToSteps(
  mermaid: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): FlowStep[] {
  const steps: FlowStep[] = [];
  const compByName = new Map<string, string>();
  for (const c of Object.values(components)) {
    compByName.set(c.name.toLowerCase(), c.id);
  }

  const lines = mermaid
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let order = 0;

  for (const line of lines) {
    const noteMatch = line.match(/^Note\s+over\s+([^:]+):\s*(.+)$/i);
    if (noteMatch) {
      const name = noteMatch[1].trim().toLowerCase();
      const note = noteMatch[2].trim();
      const compId = compByName.get(name);
      steps.push({ order: order++, componentId: compId, note });
      continue;
    }

    const arrowMatch = line.match(/^(.+?)\s*->>?\s*(.+?):\s*(.+)$/);
    if (arrowMatch) {
      const srcName = arrowMatch[1].trim().toLowerCase();
      const tgtName = arrowMatch[2].trim().toLowerCase();
      const label = arrowMatch[3].trim();
      const srcId = compByName.get(srcName);
      const tgtId = compByName.get(tgtName);

      let connId: string | undefined;
      if (srcId && tgtId) {
        const conn = Object.values(connections).find(
          (c) => c.sourceId === srcId && c.targetId === tgtId,
        );
        connId = conn?.id;
      }

      steps.push({
        order: order++,
        componentId: srcId,
        connectionId: connId,
        note: label,
      });
      continue;
    }
  }

  return steps;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => ({
    diagrams: buildSeedDiagrams(),
    activeDiagramId: null,
    _undoStack: [],
    _redoStack: [],

    // ── Diagram CRUD ───────────────────────────────────

    addDiagram: (name, level, domain) => {
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
        embeddedDiagrams: [],
      };
      set((state) => {
        state.diagrams[diagram.id] = diagram;
      });
      return diagram;
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

    // ── Component ops (operate on active diagram's snapshot) ─────

    addComponent: (type, name, parentId, position, awsService) => {
      const component: Component = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService ?? undefined,
        ...(type === "panel" ? { width: 600, height: 400 } : {}),
      };
      set((state) => {
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
      set((state) => {
        const d = activeDiagram(state);
        Object.assign(d.snapshot.components[id], patch);
        d.updatedAt = "agora";
      });
    },

    removeComponent: (id) => {
      set((state) => {
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

    // ── Connection ops ────────────────────────────────────

    addConnection: (sourceId, targetId, label) => {
      const connection: Connection = {
        id: generateId("conn"),
        sourceId,
        targetId,
        label,
      };
      set((state) => {
        const d = activeDiagram(state);
        d.snapshot.connections[connection.id] = connection;
        d.updatedAt = "agora";
      });
      return connection;
    },

    updateConnection: (id, patch) => {
      set((state) => {
        const d = activeDiagram(state);
        Object.assign(d.snapshot.connections[id], patch);
        d.updatedAt = "agora";
      });
    },
    removeConnection: (id) => {
      set((state) => {
        const d = activeDiagram(state);
        delete d.snapshot.connections[id];
        d.updatedAt = "agora";
      });
    },

    // ── Layout ops ────────────────────────────────────────

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

    // ── Z-order ───────────────────────────────────────────

    bringToFront: (elementId) => {
      set((state) => {
        const d = activeDiagram(state);
        const maxZ = Math.max(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = maxZ + 1;
      });
    },

    sendToBack: (elementId) => {
      set((state) => {
        const d = activeDiagram(state);
        const minZ = Math.min(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = minZ - 1;
      });
    },

    // ── Service registry ops ──────────────────────────────

    addService: (service) => {
      const svc: ServiceDefinition = { ...service, id: generateId("svc") };
      set((state) => {
        activeDiagram(state).snapshot.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id, patch) => {
      set((state) => {
        Object.assign(activeDiagram(state).snapshot.serviceRegistry[id], patch);
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
        const comp = activeDiagram(state).snapshot.components[childId];
        if (comp) comp.parentId = parentId;
      });
    },

    embedDiagram: (originComponentId, diagramId, position) => {
      set((state) => {
        const d = activeDiagram(state);
        const already = d.embeddedDiagrams.find(
          (e) =>
            e.diagramId === diagramId &&
            e.originComponentId === originComponentId,
        );
        if (already) return;
        d.embeddedDiagrams.push({
          id: generateId("emb"),
          diagramId,
          originComponentId,
          x: position.x,
          y: position.y,
          width: 650,
          height: 450,
        });
      });
    },

    detachEmbed: (embedId) => {
      set((state) => {
        const d = activeDiagram(state);
        d.embeddedDiagrams = d.embeddedDiagrams.filter((e) => e.id !== embedId);
      });
    },

    addFlow: (diagramId, name, mermaid) => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");
      const steps = parseMermaidToSteps(
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
        if (patch.mermaid !== undefined) {
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

    pushUndo: () => {
      const { activeDiagramId, diagrams } = get();
      if (!activeDiagramId) return;
      const snap = JSON.stringify(diagrams[activeDiagramId]);
      set((state) => {
        state._undoStack.push(snap);
        if (state._undoStack.length > 50) state._undoStack.shift();
        state._redoStack = [];
      });
    },

    undo: () => {
      const { _undoStack, activeDiagramId, diagrams } = get();
      if (!activeDiagramId || _undoStack.length === 0) return;
      const currentSnap = JSON.stringify(diagrams[activeDiagramId]);
      set((state) => {
        const prev = state._undoStack.pop()!;
        state._redoStack.push(currentSnap);
        state.diagrams[activeDiagramId] = JSON.parse(prev);
      });
    },

    redo: () => {
      const { _redoStack, activeDiagramId, diagrams } = get();
      if (!activeDiagramId || _redoStack.length === 0) return;
      const currentSnap = JSON.stringify(diagrams[activeDiagramId]);
      set((state) => {
        const next = state._redoStack.pop()!;
        state._undoStack.push(currentSnap);
        state.diagrams[activeDiagramId] = JSON.parse(next);
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
  })),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const useDiagrams = () => useDiagramStore((s) => s.diagrams);
export const useAllDiagrams = () =>
  useDiagramStore(useShallow((s) => Object.values(s.diagrams)));
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
      ? s.diagrams[s.activeDiagramId].snapshot.serviceRegistry
      : {},
  );

export const useAllServices = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(
        s.diagrams[s.activeDiagramId].snapshot.serviceRegistry,
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
      embedDiagram: s.embedDiagram,
      detachEmbed: s.detachEmbed,
      addFlow: s.addFlow,
      updateFlow: s.updateFlow,
      removeFlow: s.removeFlow,
      pushUndo: s.pushUndo,
      undo: s.undo,
      redo: s.redo,
    })),
  );

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type {
  Component,
  Connection,
  BluePrintView,
  ModelDraft,
  BluePrintVersion,
  ComponentType,
  Level,
} from "./model-types";
import { generateId } from "./model-types";

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedDraft(): ModelDraft {
  const components: Record<string, Component> = {
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
    },
    "e-payments": {
      id: "e-payments",
      name: "Sistema de Pagamento",
      type: "system",
      description: "Processamento de transações financeiras",
      parentId: null,
    },
    "e-gateway": {
      id: "e-gateway",
      name: "API Gateway",
      type: "container",
      description: "Roteamento e autenticação",
      technology: "Kong / Nginx",
      parentId: "e-orders",
    },
    "e-order-svc": {
      id: "e-order-svc",
      name: "Order Service",
      type: "container",
      description: "Lógica de negócio de pedidos",
      technology: "Java / Spring Boot",
      parentId: "e-orders",
    },
    "e-db": {
      id: "e-db",
      name: "Database",
      type: "container",
      description: "Armazenamento de pedidos e produtos",
      technology: "PostgreSQL",
      parentId: "e-orders",
    },
    "e-auth": {
      id: "e-auth",
      name: "Auth Middleware",
      type: "component",
      description: "Validação JWT",
      technology: "Node.js",
      parentId: "e-gateway",
    },
    "e-limiter": {
      id: "e-limiter",
      name: "Rate Limiter",
      type: "component",
      description: "Controle de taxa de requisições",
      technology: "Redis",
      parentId: "e-gateway",
    },
    "e-ctrl": {
      id: "e-ctrl",
      name: "Order Controller",
      type: "component",
      description: "Endpoints REST",
      technology: "Spring MVC",
      parentId: "e-order-svc",
    },
    "e-repo": {
      id: "e-repo",
      name: "Order Repository",
      type: "component",
      description: "Persistência de dados",
      technology: "JPA",
      parentId: "e-order-svc",
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

  const bluePrintViews: Record<string, BluePrintView> = {
    "v-context": {
      id: "v-context",
      name: "System Context",
      level: "context",
      rootElementId: null,
      nodeLayouts: [
        { elementId: "e-user", x: 400, y: 50 },
        { elementId: "e-orders", x: 200, y: 250 },
        { elementId: "e-payments", x: 600, y: 250 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    "v-orders-containers": {
      id: "v-orders-containers",
      name: "Orders – Containers",
      level: "container",
      rootElementId: "e-orders",
      nodeLayouts: [
        { elementId: "e-orders", x: 50, y: 50, width: 700, height: 400 },
        { elementId: "e-gateway", x: 40, y: 60 },
        { elementId: "e-order-svc", x: 300, y: 60 },
        { elementId: "e-db", x: 300, y: 240 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    "v-gateway-components": {
      id: "v-gateway-components",
      name: "Gateway – Components",
      level: "component",
      rootElementId: "e-gateway",
      nodeLayouts: [
        { elementId: "e-auth", x: 100, y: 100 },
        { elementId: "e-limiter", x: 400, y: 100 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };

  return {
    components,
    connections,
    bluePrintViews,
    activeBluePrintViewId: "v-context",
  };
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
  // Component operations
  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
  ) => Component;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
  removeComponent: (id: string) => void;

  // Connection operations
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

  // View / layout operations
  setActiveBluePrintView: (viewId: string) => void;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  updateNodeSize: (
    elementId: string,
    width: number,
    height: number,
  ) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  navigateInto: (elementId: string) => void;
  navigateUp: () => void;

  // Z-order operations
  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;

  // Version operations
  commit: (message: string) => void;
}

export type DiagramStore = DiagramState & DiagramActions;

// ── Store ──────────────────────────────────────────────────────────────────

export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => ({
    draft: buildSeedDraft(),
    versions: seedVersions,

    // ── Component ops ────────────────────────────────────

    addComponent: (type, name, parentId, position, awsService) => {
      const component: Component = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService ?? undefined,
      };

      set((state) => {
        state.draft.components[component.id] = component;
        state.draft.bluePrintViews[
          state.draft.activeBluePrintViewId
        ].nodeLayouts.push({
          elementId: component.id,
          x: position?.x ?? 300,
          y: position?.y ?? 300,
        });
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
        // Collect component and all descendants
        const toRemove = new Set<string>();
        const collect = (eid: string) => {
          toRemove.add(eid);
          Object.values(state.draft.components)
            .filter((c) => c.parentId === eid)
            .forEach((c) => collect(c.id));
        };
        collect(id);

        // Remove components
        toRemove.forEach((eid) => delete state.draft.components[eid]);

        // Remove related connections
        Object.values(state.draft.connections).forEach((conn) => {
          if (toRemove.has(conn.sourceId) || toRemove.has(conn.targetId)) {
            delete state.draft.connections[conn.id];
          }
        });

        // Remove from all view layouts
        Object.values(state.draft.bluePrintViews).forEach((view) => {
          view.nodeLayouts = view.nodeLayouts.filter(
            (nl) => !toRemove.has(nl.elementId),
          );
        });
      });
    },

    // ── Connection ops ───────────────────────────────────

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

    // ── View / layout ops ────────────────────────────────

    setActiveBluePrintView: (viewId) => {
      set((state) => {
        state.draft.activeBluePrintViewId = viewId;
      });
    },

    updateNodeLayout: (elementId, position) => {
      set((state) => {
        const layouts =
          state.draft.bluePrintViews[state.draft.activeBluePrintViewId]
            .nodeLayouts;
        const layout = layouts.find((nl) => nl.elementId === elementId);
        if (layout) {
          layout.x = position.x;
          layout.y = position.y;
        }
      });
    },

    updateNodeSize: (elementId, width, height) => {
      set((state) => {
        const layouts =
          state.draft.bluePrintViews[state.draft.activeBluePrintViewId]
            .nodeLayouts;
        const layout = layouts.find((nl) => nl.elementId === elementId);
        if (layout) {
          layout.width = width;
          layout.height = height;
        }
      });
    },

    updateViewport: (viewport) => {
      set((state) => {
        state.draft.bluePrintViews[state.draft.activeBluePrintViewId].viewport =
          viewport;
      });
    },

    navigateInto: (elementId) => {
      const { draft } = get();
      const component = draft.components[elementId];
      if (
        !component ||
        (component.type !== "system" && component.type !== "container")
      )
        return;

      const nextLevel: Level =
        component.type === "system" ? "container" : "component";
      const existingView = Object.values(draft.bluePrintViews).find(
        (v) => v.rootElementId === elementId && v.level === nextLevel,
      );

      if (existingView) {
        set((state) => {
          state.draft.activeBluePrintViewId = existingView.id;
        });
        return;
      }

      const children = Object.values(draft.components).filter(
        (c) => c.parentId === elementId,
      );
      const viewId = generateId("view");
      const newView: BluePrintView = {
        id: viewId,
        name: `${component.name} – ${nextLevel === "container" ? "Containers" : "Components"}`,
        level: nextLevel,
        rootElementId: elementId,
        nodeLayouts: children.map((c, i) => ({
          elementId: c.id,
          x: 150 + (i % 3) * 300,
          y: 100 + Math.floor(i / 3) * 200,
        })),
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      set((state) => {
        state.draft.bluePrintViews[viewId] = newView;
        state.draft.activeBluePrintViewId = viewId;
      });
    },

    navigateUp: () => {
      const { draft } = get();
      const view = draft.bluePrintViews[draft.activeBluePrintViewId];
      if (!view.rootElementId) return;

      const current = draft.components[view.rootElementId];
      if (!current) return;

      if (current.parentId) {
        const grandparent = draft.components[current.parentId];
        if (grandparent) {
          const parentView = Object.values(draft.bluePrintViews).find(
            (v) => v.rootElementId === grandparent.id,
          );
          if (parentView) {
            set((state) => {
              state.draft.activeBluePrintViewId = parentView.id;
            });
          }
        }
      } else {
        const contextView = Object.values(draft.bluePrintViews).find(
          (v) => v.rootElementId === null,
        );
        if (contextView) {
          set((state) => {
            state.draft.activeBluePrintViewId = contextView.id;
          });
        }
      }
    },

    // ── Z-order ops ─────────────────────────────────────

    bringToFront: (elementId) => {
      set((state) => {
        const layouts =
          state.draft.bluePrintViews[state.draft.activeBluePrintViewId]
            .nodeLayouts;
        const maxZ = Math.max(...layouts.map((nl) => nl.zIndex ?? 0));
        const layout = layouts.find((nl) => nl.elementId === elementId);
        if (layout) {
          layout.zIndex = maxZ + 1;
        }
      });
    },

    sendToBack: (elementId) => {
      set((state) => {
        const layouts =
          state.draft.bluePrintViews[state.draft.activeBluePrintViewId]
            .nodeLayouts;
        const minZ = Math.min(
          ...layouts.map((nl) => nl.zIndex ?? 0),
        );
        const layout = layouts.find((nl) => nl.elementId === elementId);
        if (layout) {
          layout.zIndex = minZ - 1;
        }
      });
    },

    // ── Version ops ──────────────────────────────────────

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
// Selectors that return objects/arrays use useShallow to prevent infinite
// re-render loops — without it, a new reference is returned every render
// even when the underlying data hasn't changed.

export const useActiveBluePrintView = () =>
  useDiagramStore((s) => s.draft.bluePrintViews[s.draft.activeBluePrintViewId]);

export const useComponents = () => useDiagramStore((s) => s.draft.components);

export const useComponent = (id: string) =>
  useDiagramStore((s) => s.draft.components[id]);

export const useConnections = () => useDiagramStore((s) => s.draft.connections);

export const useVersions = () => useDiagramStore((s) => s.versions);

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      const view = s.draft.bluePrintViews[s.draft.activeBluePrintViewId];
      const visibleIds = new Set(view.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(s.draft.components).filter((c) =>
        visibleIds.has(c.id),
      );
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      const view = s.draft.bluePrintViews[s.draft.activeBluePrintViewId];
      const visibleIds = new Set(view.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(s.draft.connections).filter(
        (conn) =>
          visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );

export const useCanNavigateInto = (elementId: string) =>
  useDiagramStore((s) => {
    const component = s.draft.components[elementId];
    return component?.type === "system" || component?.type === "container";
  });

export const useComponentChildren = (parentId: string | null) =>
  useDiagramStore(
    useShallow((s) =>
      Object.values(s.draft.components).filter((c) => c.parentId === parentId),
    ),
  );

// ── Action hooks ───────────────────────────────────────────────────────────
// useShallow prevents infinite re-renders: without it, the selector returns
// a new object literal on every render, causing Zustand to always trigger
// a re-render even when nothing actually changed.

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addComponent: s.addComponent,
      updateComponent: s.updateComponent,
      removeComponent: s.removeComponent,
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
      setActiveBluePrintView: s.setActiveBluePrintView,
      updateNodeLayout: s.updateNodeLayout,
      updateNodeSize: s.updateNodeSize,
      updateViewport: s.updateViewport,
      navigateInto: s.navigateInto,
      navigateUp: s.navigateUp,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      commit: s.commit,
    })),
  );

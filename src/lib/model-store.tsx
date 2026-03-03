import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
} from "react";
import type {
  ArchElement,
  ArchRelationship,
  ArchView,
  ModelDraft,
  ModelVersion,
  C4ElementType,
  C4Level,
  ViewNodeLayout,
} from "./model-types";
import { generateId } from "./model-types";

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedDraft(): ModelDraft {
  const elements: Record<string, ArchElement> = {
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

  const relationships: Record<string, ArchRelationship> = {
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

  const views: Record<string, ArchView> = {
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
        { elementId: "e-gateway", x: 100, y: 80 },
        { elementId: "e-order-svc", x: 400, y: 80 },
        { elementId: "e-db", x: 400, y: 300 },
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

  return { elements, relationships, views, activeViewId: "v-context" };
}

const seedVersions: ModelVersion[] = [
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

// ── Context interface ──────────────────────────────────────────────────────

interface ModelContextValue {
  // State
  draft: ModelDraft;
  versions: ModelVersion[];
  activeView: ArchView;

  // Element operations
  addElement: (
    type: C4ElementType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
  ) => ArchElement;
  updateElement: (id: string, patch: Partial<Omit<ArchElement, "id">>) => void;
  removeElement: (id: string) => void;

  // Relationship operations
  addRelationship: (
    sourceId: string,
    targetId: string,
    label: string,
  ) => ArchRelationship;
  updateRelationship: (
    id: string,
    patch: Partial<Omit<ArchRelationship, "id">>,
  ) => void;
  removeRelationship: (id: string) => void;

  // View / layout operations
  setActiveView: (viewId: string) => void;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
  ) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  navigateInto: (elementId: string) => void;
  navigateUp: () => void;
  canNavigateInto: (elementId: string) => boolean;

  // Version operations
  commit: (message: string) => void;

  // Computed helpers
  getElementChildren: (parentId: string | null) => ArchElement[];
  getVisibleElements: () => ArchElement[];
  getVisibleRelationships: () => ArchRelationship[];
}

const ModelContext = createContext<ModelContextValue | null>(null);

export const useModel = () => {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
};

// ── Provider ───────────────────────────────────────────────────────────────

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [draft, setDraft] = useState<ModelDraft>(buildSeedDraft);
  const [versions, setVersions] = useState<ModelVersion[]>(seedVersions);

  const activeView = useMemo(() => draft.views[draft.activeViewId], [draft]);

  // ── Element ops ────────────────────────────────────────

  const addElement = useCallback(
    (
      type: C4ElementType,
      name: string,
      parentId: string | null,
      position?: { x: number; y: number },
      awsService?: string,
    ): ArchElement => {
      const el: ArchElement = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService || undefined,
      };
      setDraft((d) => {
        const newElements = { ...d.elements, [el.id]: el };
        const view = d.views[d.activeViewId];
        const newLayouts = [
          ...view.nodeLayouts,
          { elementId: el.id, x: position?.x ?? 300, y: position?.y ?? 300 },
        ];
        return {
          ...d,
          elements: newElements,
          views: {
            ...d.views,
            [d.activeViewId]: { ...view, nodeLayouts: newLayouts },
          },
        };
      });
      return el;
    },
    [],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<Omit<ArchElement, "id">>) => {
      setDraft((d) => ({
        ...d,
        elements: { ...d.elements, [id]: { ...d.elements[id], ...patch } },
      }));
    },
    [],
  );

  const removeElement = useCallback((id: string) => {
    setDraft((d) => {
      const newElements = { ...d.elements };
      // Remove element and all children recursively
      const toRemove = new Set<string>();
      const collect = (eid: string) => {
        toRemove.add(eid);
        Object.values(newElements)
          .filter((e) => e.parentId === eid)
          .forEach((e) => collect(e.id));
      };
      collect(id);
      toRemove.forEach((eid) => delete newElements[eid]);

      // Remove related relationships
      const newRels = { ...d.relationships };
      Object.values(newRels).forEach((r) => {
        if (toRemove.has(r.sourceId) || toRemove.has(r.targetId))
          delete newRels[r.id];
      });

      // Remove from view layouts
      const newViews = { ...d.views };
      Object.keys(newViews).forEach((vid) => {
        newViews[vid] = {
          ...newViews[vid],
          nodeLayouts: newViews[vid].nodeLayouts.filter(
            (nl) => !toRemove.has(nl.elementId),
          ),
        };
      });

      return {
        ...d,
        elements: newElements,
        relationships: newRels,
        views: newViews,
      };
    });
  }, []);

  // ── Relationship ops ───────────────────────────────────

  const addRelationship = useCallback(
    (sourceId: string, targetId: string, label: string): ArchRelationship => {
      const rel: ArchRelationship = {
        id: generateId("rel"),
        sourceId,
        targetId,
        label,
      };
      setDraft((d) => ({
        ...d,
        relationships: { ...d.relationships, [rel.id]: rel },
      }));
      return rel;
    },
    [],
  );

  const updateRelationship = useCallback(
    (id: string, patch: Partial<Omit<ArchRelationship, "id">>) => {
      setDraft((d) => ({
        ...d,
        relationships: {
          ...d.relationships,
          [id]: { ...d.relationships[id], ...patch },
        },
      }));
    },
    [],
  );

  const removeRelationship = useCallback((id: string) => {
    setDraft((d) => {
      const newRels = { ...d.relationships };
      delete newRels[id];
      return { ...d, relationships: newRels };
    });
  }, []);

  // ── View / layout ops ─────────────────────────────────

  const setActiveView = useCallback((viewId: string) => {
    setDraft((d) => ({ ...d, activeViewId: viewId }));
  }, []);

  const updateNodeLayout = useCallback(
    (elementId: string, position: { x: number; y: number }) => {
      setDraft((d) => {
        const view = d.views[d.activeViewId];
        const newLayouts = view.nodeLayouts.map((nl) =>
          nl.elementId === elementId
            ? { ...nl, x: position.x, y: position.y }
            : nl,
        );
        return {
          ...d,
          views: {
            ...d.views,
            [d.activeViewId]: { ...view, nodeLayouts: newLayouts },
          },
        };
      });
    },
    [],
  );

  const updateViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      setDraft((d) => {
        const view = d.views[d.activeViewId];
        return {
          ...d,
          views: { ...d.views, [d.activeViewId]: { ...view, viewport } },
        };
      });
    },
    [],
  );

  const getElementChildren = useCallback(
    (parentId: string | null) => {
      return Object.values(draft.elements).filter(
        (e) => e.parentId === parentId,
      );
    },
    [draft.elements],
  );

  const canNavigateInto = useCallback(
    (elementId: string) => {
      const el = draft.elements[elementId];
      if (!el) return false;
      // Can navigate into systems (→ containers) or containers (→ components)
      return el.type === "system" || el.type === "container";
    },
    [draft.elements],
  );

  const navigateInto = useCallback(
    (elementId: string) => {
      const el = draft.elements[elementId];
      if (!el) return;

      const nextLevel: C4Level =
        el.type === "system" ? "container" : "component";
      // Find existing view or create one
      const existingView = Object.values(draft.views).find(
        (v) => v.rootElementId === elementId && v.level === nextLevel,
      );

      if (existingView) {
        setDraft((d) => ({ ...d, activeViewId: existingView.id }));
      } else {
        const children = Object.values(draft.elements).filter(
          (e) => e.parentId === elementId,
        );
        const viewId = generateId("view");
        const newView: ArchView = {
          id: viewId,
          name: `${el.name} – ${nextLevel === "container" ? "Containers" : "Components"}`,
          level: nextLevel,
          rootElementId: elementId,
          nodeLayouts: children.map((c, i) => ({
            elementId: c.id,
            x: 150 + (i % 3) * 300,
            y: 100 + Math.floor(i / 3) * 200,
          })),
          viewport: { x: 0, y: 0, zoom: 1 },
        };
        setDraft((d) => ({
          ...d,
          views: { ...d.views, [viewId]: newView },
          activeViewId: viewId,
        }));
      }
    },
    [draft],
  );

  const navigateUp = useCallback(() => {
    const view = draft.views[draft.activeViewId];
    if (!view.rootElementId) return; // already at context level

    const parentEl = draft.elements[view.rootElementId];
    if (!parentEl) return;

    if (parentEl.parentId) {
      // Navigate to the parent's level
      const grandparent = draft.elements[parentEl.parentId];
      if (grandparent) {
        const parentView = Object.values(draft.views).find(
          (v) => v.rootElementId === grandparent.id,
        );
        if (parentView)
          setDraft((d) => ({ ...d, activeViewId: parentView.id }));
      }
    } else {
      // Navigate to context
      const contextView = Object.values(draft.views).find(
        (v) => v.rootElementId === null,
      );
      if (contextView)
        setDraft((d) => ({ ...d, activeViewId: contextView.id }));
    }
  }, [draft]);

  // ── Visible elements / relationships for current view ─

  const getVisibleElements = useCallback(() => {
    const view = draft.views[draft.activeViewId];
    const visibleIds = new Set(view.nodeLayouts.map((nl) => nl.elementId));
    return Object.values(draft.elements).filter((e) => visibleIds.has(e.id));
  }, [draft]);

  const getVisibleRelationships = useCallback(() => {
    const view = draft.views[draft.activeViewId];
    const visibleIds = new Set(view.nodeLayouts.map((nl) => nl.elementId));
    return Object.values(draft.relationships).filter(
      (r) => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId),
    );
  }, [draft]);

  // ── Commit ─────────────────────────────────────────────

  const commit = useCallback(
    (message: string) => {
      const newVersion: ModelVersion = {
        id: generateId("ver"),
        version: `v${versions.length + 1}.0.0`,
        parentId: versions[0]?.id ?? null,
        timestamp: "agora",
        author: "you",
        message,
        snapshot: JSON.parse(JSON.stringify(draft)),
      };
      setVersions((v) => [newVersion, ...v]);
    },
    [draft, versions],
  );

  const value = useMemo<ModelContextValue>(
    () => ({
      draft,
      versions,
      activeView,
      addElement,
      updateElement,
      removeElement,
      addRelationship,
      updateRelationship,
      removeRelationship,
      setActiveView,
      updateNodeLayout,
      updateViewport,
      navigateInto,
      navigateUp,
      canNavigateInto,
      commit,
      getElementChildren,
      getVisibleElements,
      getVisibleRelationships,
    }),
    [
      draft,
      versions,
      activeView,
      addElement,
      updateElement,
      removeElement,
      addRelationship,
      updateRelationship,
      removeRelationship,
      setActiveView,
      updateNodeLayout,
      updateViewport,
      navigateInto,
      navigateUp,
      canNavigateInto,
      commit,
      getElementChildren,
      getVisibleElements,
      getVisibleRelationships,
    ],
  );

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};

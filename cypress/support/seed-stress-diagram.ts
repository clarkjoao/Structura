/**
 * Serialized `diagram-store` payload for Cypress (Zustand persist + merge).
 * Must match `PERSIST_SCHEMA_VERSION` (4) and `LocalStorageAdapter` key prefix.
 */

/** Same as `structura_` + `diagram-store` from LocalStorageAdapter + PERSIST_KEY. */
export const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";

const PERSIST_VERSION = 4;

interface NodeLayout {
  elementId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

interface BaseComponent {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  type: string;
}

interface PanelComponent extends BaseComponent {
  type: "panel";
  panelKind: "default";
  panelColor: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  style?: Record<string, unknown>;
}

export interface SeedResult {
  localStoragePayload: string;
  diagramId: string;
  panelsByLevel: string[][];
  leafNodeIds: string[];
  allComponentIds: string[];
}

let counter = 0;
function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_stress_${counter}`;
}

export function buildStressSeed(options?: {
  targetCount?: number;
  maxDepth?: number;
  panelsPerLevel?: number;
  leavesPerDeepestPanel?: number;
  connectionCount?: number;
}): SeedResult {
  const {
    targetCount = 500,
    maxDepth = 6,
    panelsPerLevel = 10,
    leavesPerDeepestPanel = 5,
    connectionCount = 50,
  } = options ?? {};

  counter = 0;

  const diagramId = genId("diag");
  const components: Record<string, BaseComponent> = {};
  const nodeLayouts: Record<string, NodeLayout> = {};
  const connections: Record<string, Connection> = {};
  const panelsByLevel: string[][] = [];
  const leafNodeIds: string[] = [];
  const allComponentIds: string[] = [];
  let created = 0;

  for (let level = 0; level < maxDepth; level++) {
    const levelPanels: string[] = [];
    for (let i = 0; i < panelsPerLevel && created < targetCount; i++) {
      const parentId =
        level === 0 ? null : panelsByLevel[level - 1]![i % panelsByLevel[level - 1]!.length]!;

      const id = genId("panel");
      const x = (i % 5) * 700 + level * 50;
      const y = Math.floor(i / 5) * 500 + level * 50;

      components[id] = {
        id,
        name: `Panel-L${level}-${i}`,
        description: "",
        parentId,
        type: "panel",
        panelKind: "default",
        panelColor: "#6366f1",
      } as PanelComponent;

      nodeLayouts[id] = {
        elementId: id,
        x: parentId ? 40 + i * 30 : x,
        y: parentId ? 40 + i * 30 : y,
        width: 600,
        height: 400,
      };

      levelPanels.push(id);
      allComponentIds.push(id);
      created += 1;
    }
    panelsByLevel.push(levelPanels);
  }

  const deepestPanels = panelsByLevel[maxDepth - 1] ?? [];
  for (const panelId of deepestPanels) {
    for (let i = 0; i < leavesPerDeepestPanel && created < targetCount; i++) {
      const id = genId("leaf");
      components[id] = {
        id,
        name: `Leaf-${created}`,
        description: "",
        parentId: panelId,
        type: "system",
      };
      nodeLayouts[id] = { elementId: id, x: 40 + i * 200, y: 60 };
      leafNodeIds.push(id);
      allComponentIds.push(id);
      created += 1;
    }
  }

  for (let level = maxDepth - 2; level >= 0 && created < targetCount; level--) {
    for (const panelId of panelsByLevel[level] ?? []) {
      if (created >= targetCount) break;
      const id = genId("mid");
      components[id] = {
        id,
        name: `MidLeaf-${created}`,
        description: "",
        parentId: panelId,
        type: "container",
      };
      nodeLayouts[id] = { elementId: id, x: 40, y: 200 };
      leafNodeIds.push(id);
      allComponentIds.push(id);
      created += 1;
    }
  }

  while (created < targetCount) {
    const id = genId("root");
    components[id] = {
      id,
      name: `RootLeaf-${created}`,
      description: "",
      parentId: null,
      type: "component",
    };
    nodeLayouts[id] = {
      elementId: id,
      x: (created % 20) * 220,
      y: Math.floor(created / 20) * 140,
    };
    leafNodeIds.push(id);
    allComponentIds.push(id);
    created += 1;
  }

  const connLeaves = leafNodeIds.slice(0, Math.min(connectionCount * 2, leafNodeIds.length));
  for (let i = 0; i < connLeaves.length - 1; i += 2) {
    const connId = genId("conn");
    connections[connId] = {
      id: connId,
      sourceId: connLeaves[i]!,
      targetId: connLeaves[i + 1]!,
      label: "uses",
      style: {},
    };
  }

  const diagram = {
    id: diagramId,
    name: "Stress Test — 500 Elements",
    domain: "",
    level: "context" as const,
    description: "Auto-generated stress test with 6-level nested panels",
    snapshot: {
      components,
      connections,
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts,
    edgeLayouts: [],
    viewport: { x: 0, y: 0, zoom: 0.4 },
    scenes: {},
    activeSceneId: undefined,
    compareSceneId: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const payload = {
    state: {
      diagrams: { [diagramId]: diagram },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: diagramId,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: PERSIST_VERSION,
  };

  return {
    localStoragePayload: JSON.stringify(payload),
    diagramId,
    panelsByLevel,
    leafNodeIds,
    allComponentIds,
  };
}

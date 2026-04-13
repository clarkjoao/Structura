import type {
  Component,
  Connection,
  Diagram,
  DiagramModel,
  NodeLayout,
  SceneDiff,
} from "../model/diagram.types";

type SceneDiagram = Diagram | DiagramModel;

export const SCENE_COLOR_PALETTE = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
] as const;

export function nextSceneColor(sceneIndex: number): string {
  return SCENE_COLOR_PALETTE[sceneIndex % SCENE_COLOR_PALETTE.length]!;
}

export function resolveSceneSnapshot(
  diagram: SceneDiagram,
  sceneId: string | null,
): {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
  sceneId: string | null;
} {
  if (!sceneId || !diagram.scenes?.[sceneId]) {
    return {
      components: diagram.snapshot.components,
      connections: diagram.snapshot.connections,
      nodeLayouts: diagram.nodeLayouts,
      sceneId: null,
    };
  }

  const scene = diagram.scenes[sceneId];
  const removedComp = new Set(scene.removedComponentIds);
  const removedConn = new Set(scene.removedConnectionIds);

  const components: Record<string, Component> = {
    ...Object.fromEntries(
      Object.entries(diagram.snapshot.components).filter(([id]) => !removedComp.has(id)),
    ),
    ...scene.addedComponents,
  };

  const connections: Record<string, Connection> = {
    ...Object.fromEntries(
      Object.entries(diagram.snapshot.connections).filter(([id]) => !removedConn.has(id)),
    ),
    ...scene.addedConnections,
  };

  const nodeLayouts: Record<string, NodeLayout> = {
    ...diagram.nodeLayouts,
    ...scene.nodeLayouts,
  };

  return { components, connections, nodeLayouts, sceneId };
}


export function diagramWithResolvedScene<T extends SceneDiagram>(diagram: T): T {
  const active = diagram.activeSceneId ?? null;
  if (!active || !diagram.scenes?.[active]) return diagram;
  const r = resolveSceneSnapshot(diagram, active);
  return {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      components: r.components,
      connections: r.connections,
    },
    nodeLayouts: r.nodeLayouts,
    activeSceneId: undefined,
    compareSceneId: undefined,
    scenes: undefined,
  } as T;
}

export function exportFilenameSlug(diagram: Diagram): string {
  const base = diagram.name.toLowerCase().replace(/\s+/g, "-");
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return base;
  const sceneSlug = diagram.scenes[sid].name.toLowerCase().replace(/\s+/g, "-");
  return `${base}-${sceneSlug}`;
}

export function isComponentAddedInActiveScene(
  diagram: SceneDiagram,
  componentId: string,
): boolean {
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return false;
  return componentId in diagram.scenes[sid].addedComponents;
}

export function isConnectionAddedInActiveScene(
  diagram: SceneDiagram,
  connectionId: string,
): boolean {
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return false;
  return connectionId in diagram.scenes[sid].addedConnections;
}


export function isBaseSnapshotComponent(diagram: SceneDiagram, componentId: string): boolean {
  return componentId in diagram.snapshot.components;
}

export function canMoveNodeInSceneMode(diagram: SceneDiagram, componentId: string): boolean {
  if (isDiagramCompareMode(diagram)) return false;
  if (!diagram.activeSceneId || !diagram.scenes?.[diagram.activeSceneId]) return true;
  return isComponentAddedInActiveScene(diagram, componentId);
}


export function collectBaseDescendantIds(
  baseComponents: Record<string, Component>,
  rootId: string,
): string[] {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of Object.values(baseComponents)) {
      if (c.parentId === id) stack.push(c.id);
    }
  }
  return out;
}

export function baseConnectionsTouchingAny(
  baseConnections: Record<string, Connection>,
  componentIds: Set<string>,
): string[] {
  return Object.values(baseConnections)
    .filter((c) => componentIds.has(c.sourceId) || componentIds.has(c.targetId))
    .map((c) => c.id);
}

export interface CompareSnapshotResult {
  onlyInA: { components: string[]; connections: string[] };
  onlyInB: { components: string[]; connections: string[] };
  inBoth: { components: string[]; connections: string[] };
  onlyInBase: { components: string[]; connections: string[] };
  mergedComponents: Record<string, Component>;
  mergedConnections: Record<string, Connection>;
  mergedLayouts: Record<string, NodeLayout>;
}

export function resolveCompareSnapshot(
  diagram: SceneDiagram,
  sceneAId: string,
  sceneBId: string,
): CompareSnapshotResult {
  const snapA = resolveSceneSnapshot(diagram, sceneAId);
  const snapB = resolveSceneSnapshot(diagram, sceneBId);
  const sceneA = diagram.scenes![sceneAId]!;
  const sceneB = diagram.scenes![sceneBId]!;

  const idsA = new Set(Object.keys(snapA.components));
  const idsB = new Set(Object.keys(snapB.components));
  const onlyInAComp = [...idsA].filter((id) => !idsB.has(id));
  const onlyInBComp = [...idsB].filter((id) => !idsA.has(id));
  const inBothComp = [...idsA].filter((id) => idsB.has(id));

  const connIdsA = new Set(Object.keys(snapA.connections));
  const connIdsB = new Set(Object.keys(snapB.connections));
  const onlyInAConn = [...connIdsA].filter((id) => !connIdsB.has(id));
  const onlyInBConn = [...connIdsB].filter((id) => !connIdsA.has(id));
  const inBothConn = [...connIdsA].filter((id) => connIdsB.has(id));

  const mergedComponents: Record<string, Component> = {
    ...snapB.components,
    ...snapA.components,
  };
  const mergedLayouts: Record<string, NodeLayout> = {
    ...snapB.nodeLayouts,
    ...snapA.nodeLayouts,
  };
  const mergedConnections: Record<string, Connection> = {
    ...snapB.connections,
    ...snapA.connections,
  };

  const baseC = diagram.snapshot.components;
  const baseConn = diagram.snapshot.connections;
  const onlyInBaseComp = Object.keys(mergedComponents).filter(
    (id) =>
      id in baseC &&
      !sceneA.addedComponents[id] &&
      !sceneB.addedComponents[id],
  );
  const onlyInBaseConn = Object.keys(mergedConnections).filter(
    (id) =>
      id in baseConn &&
      !sceneA.addedConnections[id] &&
      !sceneB.addedConnections[id],
  );

  return {
    onlyInA: { components: onlyInAComp, connections: onlyInAConn },
    onlyInB: { components: onlyInBComp, connections: onlyInBConn },
    inBoth: { components: inBothComp, connections: inBothConn },
    onlyInBase: { components: onlyInBaseComp, connections: onlyInBaseConn },
    mergedComponents,
    mergedConnections,
    mergedLayouts,
  };
}


export function resolveCanvasSnapshot(diagram: SceneDiagram): {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
} {
  const a = diagram.activeSceneId ?? null;
  const b = diagram.compareSceneId ?? null;
  if (
    a &&
    b &&
    a !== b &&
    diagram.scenes?.[a] &&
    diagram.scenes?.[b]
  ) {
    const c = resolveCompareSnapshot(diagram, a, b);
    return {
      components: c.mergedComponents,
      connections: c.mergedConnections,
      nodeLayouts: c.mergedLayouts,
    };
  }
  const r = resolveSceneSnapshot(diagram, a);
  return {
    components: r.components,
    connections: r.connections,
    nodeLayouts: r.nodeLayouts,
  };
}

export interface CompareElementVisual {
  opacity: number;
  
  badgeA?: { name: string; color: string };
  badgeB?: { name: string; color: string };
}

export function buildCompareComponentVisuals(
  diagram: SceneDiagram,
  sceneAId: string,
  sceneBId: string,
): Record<string, CompareElementVisual> {
  const snapA = resolveSceneSnapshot(diagram, sceneAId);
  const snapB = resolveSceneSnapshot(diagram, sceneBId);
  const sceneA = diagram.scenes![sceneAId]!;
  const sceneB = diagram.scenes![sceneBId]!;
  const idsA = new Set(Object.keys(snapA.components));
  const idsB = new Set(Object.keys(snapB.components));
  const mergedIds = new Set([...idsA, ...idsB]);
  const out: Record<string, CompareElementVisual> = {};

  const metaA = { name: sceneA.name, color: sceneA.color };
  const metaB = { name: sceneB.name, color: sceneB.color };

  for (const id of mergedIds) {
    const inA = idsA.has(id);
    const inB = idsB.has(id);
    const addedA = !!sceneA.addedComponents[id];
    const addedB = !!sceneB.addedComponents[id];

    if (inA && inB) {
      if (addedA || addedB) {
        out[id] = { opacity: 1, badgeA: metaA, badgeB: metaB };
      } else {
        out[id] = { opacity: 0.25 };
      }
    } else if (inA) {
      out[id] = { opacity: 1, badgeA: metaA };
    } else if (inB) {
      out[id] = { opacity: 0.55, badgeB: metaB };
    } else {
      out[id] = { opacity: 0.25 };
    }
  }

  return out;
}

export function buildCompareConnectionVisuals(
  diagram: SceneDiagram,
  sceneAId: string,
  sceneBId: string,
): Record<string, CompareElementVisual> {
  const snapA = resolveSceneSnapshot(diagram, sceneAId);
  const snapB = resolveSceneSnapshot(diagram, sceneBId);
  const sceneA = diagram.scenes![sceneAId]!;
  const sceneB = diagram.scenes![sceneBId]!;
  const idsA = new Set(Object.keys(snapA.connections));
  const idsB = new Set(Object.keys(snapB.connections));
  const mergedIds = new Set([...idsA, ...idsB]);
  const out: Record<string, CompareElementVisual> = {};

  const metaA = { name: sceneA.name, color: sceneA.color };
  const metaB = { name: sceneB.name, color: sceneB.color };

  for (const id of mergedIds) {
    const inA = idsA.has(id);
    const inB = idsB.has(id);
    const addedA = !!sceneA.addedConnections[id];
    const addedB = !!sceneB.addedConnections[id];

    if (inA && inB) {
      if (addedA || addedB) {
        out[id] = { opacity: 1, badgeA: metaA, badgeB: metaB };
      } else {
        out[id] = { opacity: 0.25 };
      }
    } else if (inA) {
      out[id] = { opacity: 1, badgeA: metaA };
    } else if (inB) {
      out[id] = { opacity: 0.55, badgeB: metaB };
    } else {
      out[id] = { opacity: 0.25 };
    }
  }

  return out;
}

export function isDiagramCompareMode(diagram: SceneDiagram | null | undefined): boolean {
  if (!diagram) return false;
  const a = diagram.activeSceneId ?? null;
  const b = diagram.compareSceneId ?? null;
  return !!(
    a &&
    b &&
    a !== b &&
    diagram.scenes?.[a] &&
    diagram.scenes?.[b]
  );
}

export function sceneHasDiff(scene: SceneDiff): boolean {
  return (
    Object.keys(scene.addedComponents).length > 0 ||
    Object.keys(scene.addedConnections).length > 0 ||
    scene.removedComponentIds.length > 0 ||
    scene.removedConnectionIds.length > 0
  );
}

export interface MergePreview {
  componentsToAdd: Component[];
  connectionsToAdd: Connection[];
  layoutsToAdd: Record<string, NodeLayout>;
  componentIdsToRemove: string[];
  connectionIdsToRemove: string[];
  conflicts: Array<{
    elementId: string;
    elementName: string;
    conflictingSceneId: string;
    conflictingSceneName: string;
    resolution: "merge";
  }>;
}


const MERGE_CONFLICT_BASE_SCENE_ID = "__diagramBase__";
const MERGE_CONFLICT_BASE_SCENE_NAME = "Diagram base";

export function computeMergePreview(diagram: Diagram, sceneId: string): MergePreview {
  const scene = diagram.scenes?.[sceneId];
  if (!scene) {
    throw new Error(`Scene ${sceneId} not found`);
  }

  const otherScenes = Object.values(diagram.scenes ?? {}).filter((s) => s.id !== sceneId);
  const conflicts: MergePreview["conflicts"] = [];

  for (const comp of Object.values(scene.addedComponents)) {
    const existsInBase = Boolean(diagram.snapshot.components[comp.id]);
    const removedByScene = scene.removedComponentIds.includes(comp.id);
    if (existsInBase && !removedByScene) {
      conflicts.push({
        elementId: comp.id,
        elementName: comp.name,
        conflictingSceneId: MERGE_CONFLICT_BASE_SCENE_ID,
        conflictingSceneName: MERGE_CONFLICT_BASE_SCENE_NAME,
        resolution: "merge",
      });
    }
    for (const other of otherScenes) {
      if (other.addedComponents[comp.id]) {
        conflicts.push({
          elementId: comp.id,
          elementName: comp.name,
          conflictingSceneId: other.id,
          conflictingSceneName: other.name,
          resolution: "merge",
        });
      }
    }
  }

  for (const conn of Object.values(scene.addedConnections)) {
    const label = conn.label?.trim() || conn.technology?.trim() || conn.id;
    for (const other of otherScenes) {
      if (other.addedConnections[conn.id]) {
        conflicts.push({
          elementId: conn.id,
          elementName: label,
          conflictingSceneId: other.id,
          conflictingSceneName: other.name,
          resolution: "merge",
        });
      }
    }
  }

  return {
    componentsToAdd: Object.values(scene.addedComponents),
    connectionsToAdd: Object.values(scene.addedConnections),
    layoutsToAdd: { ...scene.nodeLayouts },
    componentIdsToRemove: [...scene.removedComponentIds],
    connectionIdsToRemove: [...scene.removedConnectionIds],
    conflicts,
  };
}

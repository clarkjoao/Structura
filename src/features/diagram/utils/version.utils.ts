import type {
  Component,
  Connection,
  Diagram,
  DiagramModel,
  NodeLayout,
  VersionDiff,
} from "../model/diagram.types";

type VersionDiagram = Diagram | DiagramModel;

export const VERSION_COLOR_PALETTE = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
] as const;

export function nextVersionColor(sceneIndex: number): string {
  return VERSION_COLOR_PALETTE[sceneIndex % VERSION_COLOR_PALETTE.length]!;
}

export function resolveVersionSnapshot(
  diagram: VersionDiagram,
  versionId: string | null,
): {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
  versionId: string | null;
} {
  if (!versionId || !diagram.versions?.[versionId]) {
    return {
      components: diagram.snapshot.components,
      connections: diagram.snapshot.connections,
      nodeLayouts: diagram.nodeLayouts,
      versionId: null,
    };
  }

  const scene = diagram.versions[versionId];
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

  return { components, connections, nodeLayouts, versionId };
}

export function diagramWithResolvedScene<T extends VersionDiagram>(diagram: T): T {
  const active = diagram.activeVersionId ?? null;
  if (!active || !diagram.versions?.[active]) return diagram;
  const r = resolveVersionSnapshot(diagram, active);
  return {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      components: r.components,
      connections: r.connections,
    },
    nodeLayouts: r.nodeLayouts,
    activeVersionId: undefined,
    compareVersionId: undefined,
    versions: undefined,
  } as T;
}

export function exportFilenameSlug(diagram: Diagram): string {
  const base = diagram.name.toLowerCase().replace(/\s+/g, "-");
  const sid = diagram.activeVersionId;
  if (!sid || !diagram.versions?.[sid]) return base;
  const sceneSlug = diagram.versions[sid].name.toLowerCase().replace(/\s+/g, "-");
  return `${base}-${sceneSlug}`;
}

export function isComponentAddedInActiveVersion(
  diagram: VersionDiagram,
  componentId: string,
): boolean {
  const sid = diagram.activeVersionId;
  if (!sid || !diagram.versions?.[sid]) return false;
  return componentId in diagram.versions[sid].addedComponents;
}

export function canMoveNodeInSceneMode(diagram: VersionDiagram, componentId: string): boolean {
  if (isDiagramCompareMode(diagram)) return false;
  if (!diagram.activeVersionId || !diagram.versions?.[diagram.activeVersionId]) return true;
  return isComponentAddedInActiveVersion(diagram, componentId);
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
  diagram: VersionDiagram,
  sceneAId: string,
  sceneBId: string,
): CompareSnapshotResult {
  const snapA = resolveVersionSnapshot(diagram, sceneAId);
  const snapB = resolveVersionSnapshot(diagram, sceneBId);
  const sceneA = diagram.versions![sceneAId]!;
  const sceneB = diagram.versions![sceneBId]!;

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
    (id) => id in baseC && !sceneA.addedComponents[id] && !sceneB.addedComponents[id],
  );
  const onlyInBaseConn = Object.keys(mergedConnections).filter(
    (id) => id in baseConn && !sceneA.addedConnections[id] && !sceneB.addedConnections[id],
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

export function resolveCanvasSnapshot(diagram: VersionDiagram): {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
} {
  const a = diagram.activeVersionId ?? null;
  const b = diagram.compareVersionId ?? null;
  if (a && b && a !== b && diagram.versions?.[a] && diagram.versions?.[b]) {
    const c = resolveCompareSnapshot(diagram, a, b);
    return {
      components: c.mergedComponents,
      connections: c.mergedConnections,
      nodeLayouts: c.mergedLayouts,
    };
  }
  const r = resolveVersionSnapshot(diagram, a);
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
  diagram: VersionDiagram,
  sceneAId: string,
  sceneBId: string,
): Record<string, CompareElementVisual> {
  const snapA = resolveVersionSnapshot(diagram, sceneAId);
  const snapB = resolveVersionSnapshot(diagram, sceneBId);
  const sceneA = diagram.versions![sceneAId]!;
  const sceneB = diagram.versions![sceneBId]!;
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
  diagram: VersionDiagram,
  sceneAId: string,
  sceneBId: string,
): Record<string, CompareElementVisual> {
  const snapA = resolveVersionSnapshot(diagram, sceneAId);
  const snapB = resolveVersionSnapshot(diagram, sceneBId);
  const sceneA = diagram.versions![sceneAId]!;
  const sceneB = diagram.versions![sceneBId]!;
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

export function isDiagramCompareMode(diagram: VersionDiagram | null | undefined): boolean {
  if (!diagram) return false;
  const a = diagram.activeVersionId ?? null;
  const b = diagram.compareVersionId ?? null;
  return !!(a && b && a !== b && diagram.versions?.[a] && diagram.versions?.[b]);
}

export function versionHasDiff(scene: VersionDiff): boolean {
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
    conflictingVersionId: string;
    conflictingVersionName: string;
    resolution: "merge";
  }>;
}

const MERGE_CONFLICT_BASE_VERSION_ID = "__diagramBase__";
const MERGE_CONFLICT_BASE_VERSION_NAME = "Diagram base";

export function computeMergePreview(diagram: Diagram, versionId: string): MergePreview {
  const scene = diagram.versions?.[versionId];
  if (!scene) {
    throw new Error(`Version ${versionId} not found`);
  }

  const otherVersions = Object.values(diagram.versions ?? {}).filter((s) => s.id !== versionId);
  const conflicts: MergePreview["conflicts"] = [];

  for (const comp of Object.values(scene.addedComponents)) {
    const existsInBase = Boolean(diagram.snapshot.components[comp.id]);
    const removedByVersion = scene.removedComponentIds.includes(comp.id);
    if (existsInBase && !removedByVersion) {
      conflicts.push({
        elementId: comp.id,
        elementName: comp.name,
        conflictingVersionId: MERGE_CONFLICT_BASE_VERSION_ID,
        conflictingVersionName: MERGE_CONFLICT_BASE_VERSION_NAME,
        resolution: "merge",
      });
    }
    for (const other of otherVersions) {
      if (other.addedComponents[comp.id]) {
        conflicts.push({
          elementId: comp.id,
          elementName: comp.name,
          conflictingVersionId: other.id,
          conflictingVersionName: other.name,
          resolution: "merge",
        });
      }
    }
  }

  for (const conn of Object.values(scene.addedConnections)) {
    const label = conn.label?.trim() || conn.technology?.trim() || conn.id;
    for (const other of otherVersions) {
      if (other.addedConnections[conn.id]) {
        conflicts.push({
          elementId: conn.id,
          elementName: label,
          conflictingVersionId: other.id,
          conflictingVersionName: other.name,
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

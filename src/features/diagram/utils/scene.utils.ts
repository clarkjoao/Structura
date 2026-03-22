import type { Component, Connection, Diagram, NodeLayout } from "../model/diagram.types";

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
  diagram: Diagram,
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

/** Flattened diagram for export when a scene is active (WYSIWYG). */
export function diagramWithResolvedScene(diagram: Diagram): Diagram {
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
    scenes: undefined,
  };
}

export function exportFilenameSlug(diagram: Diagram): string {
  const base = diagram.name.toLowerCase().replace(/\s+/g, "-");
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return base;
  const sceneSlug = diagram.scenes[sid].name.toLowerCase().replace(/\s+/g, "-");
  return `${base}-${sceneSlug}`;
}

export function isComponentAddedInActiveScene(diagram: Diagram, componentId: string): boolean {
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return false;
  return componentId in diagram.scenes[sid].addedComponents;
}

export function isConnectionAddedInActiveScene(diagram: Diagram, connectionId: string): boolean {
  const sid = diagram.activeSceneId;
  if (!sid || !diagram.scenes?.[sid]) return false;
  return connectionId in diagram.scenes[sid].addedConnections;
}

/** True if the node exists in the base snapshot (may still be hidden by the active scene). */
export function isBaseSnapshotComponent(diagram: Diagram, componentId: string): boolean {
  return componentId in diagram.snapshot.components;
}

export function canMoveNodeInSceneMode(diagram: Diagram, componentId: string): boolean {
  if (!diagram.activeSceneId || !diagram.scenes?.[diagram.activeSceneId]) return true;
  return isComponentAddedInActiveScene(diagram, componentId);
}

/** Collect component id + descendants following parentId within the base snapshot only. */
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

import type {
  Component,
  Connection,
  Diagram,
  DiagramModel,
  NodeLayout,
  VersionDiff,
} from "../model/diagram.types";

import { hashElement, sameContent } from "./element-hash";

type VersionDiagram = Diagram | DiagramModel;

const EMPTY: Readonly<Record<string, never>> = Object.freeze({});

/** The base components a Version replaces, by id (empty when it replaces none). */
export function modifiedComponentsOf(version: VersionDiff): Readonly<Record<string, Component>> {
  return version.modifiedComponents ?? EMPTY;
}

/** The base connections a Version replaces, by id (empty when it replaces none). */
export function modifiedConnectionsOf(version: VersionDiff): Readonly<Record<string, Connection>> {
  return version.modifiedConnections ?? EMPTY;
}

/** Whether the Version replaces the base element with this id (component or connection). */
export function isModifiedInVersion(version: VersionDiff, id: string): boolean {
  return id in modifiedComponentsOf(version) || id in modifiedConnectionsOf(version);
}

export type VersionConflictReason = "base-changed" | "base-removed";

export interface VersionConflict {
  id: string;
  kind: "component" | "connection";
  reason: VersionConflictReason;
}

/**
 * Elements the Version replaced whose base moved on since the copy: the base element now hashes
 * differently from the recorded hash, or is gone. The Version's copy would silently overwrite
 * that change on merge, so merge waits until each one is kept or dropped.
 */
export function versionConflicts(diagram: VersionDiagram, versionId: string): VersionConflict[] {
  const version = diagram.versions?.[versionId];
  if (!version) return [];
  const hashes = version.baseHashes ?? {};
  const out: VersionConflict[] = [];
  const check = (kind: VersionConflict["kind"], ids: string[], base: Record<string, object>) => {
    for (const id of ids) {
      const current = base[id];
      if (!current) out.push({ id, kind, reason: "base-removed" });
      else if (hashes[id] !== undefined && hashes[id] !== hashElement(current)) {
        out.push({ id, kind, reason: "base-changed" });
      }
    }
  };
  check("component", Object.keys(modifiedComponentsOf(version)), diagram.snapshot.components);
  check("connection", Object.keys(modifiedConnectionsOf(version)), diagram.snapshot.connections);
  return out;
}

/** One field of an element that a Version changed. */
export interface FieldChange {
  field: string;
  base: unknown;
  version: unknown;
}

/** What a Version changes against the base, for reading it (the changes view). */
export interface VersionChanges {
  added: { components: ReadonlySet<string>; connections: ReadonlySet<string> };
  /** Replaced elements whose content differs from the base, by id, with the fields that do. */
  changed: ReadonlyMap<string, FieldChange[]>;
  /** Base elements the Version removes (and the base still has). */
  removed: { components: string[]; connections: string[] };
}

/** The fields where `version` differs from `base` (the id never counts). */
function fieldChanges(base: object, version: object): FieldChange[] {
  const a = base as Record<string, unknown>;
  const b = version as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((field) => field !== "id" && !sameContent(a[field], b[field]))
    .sort()
    .map((field) => ({ field, base: a[field], version: b[field] }));
}

const changesCache = new WeakMap<VersionDiff, { base: object; result: VersionChanges }>();

/**
 * What the Version changes against the base: added elements, replaced ones whose content differs
 * (a copy equal to its base, or a moved node, is no change) and base elements it removes.
 * Memoised per Version object and base snapshot.
 */
export function versionChanges(diagram: VersionDiagram, versionId: string): VersionChanges | null {
  const version = diagram.versions?.[versionId];
  if (!version) return null;
  const cached = changesCache.get(version);
  if (cached?.base === diagram.snapshot) return cached.result;
  const changed = new Map<string, FieldChange[]>();
  const compare = (copies: Readonly<Record<string, object>>, base: Record<string, object>) => {
    for (const [id, copy] of Object.entries(copies)) {
      const original = base[id];
      if (!original) continue;
      const fields = fieldChanges(original, copy);
      if (fields.length > 0) changed.set(id, fields);
    }
  };
  compare(modifiedComponentsOf(version), diagram.snapshot.components);
  compare(modifiedConnectionsOf(version), diagram.snapshot.connections);
  const result: VersionChanges = {
    added: {
      components: new Set(Object.keys(version.addedComponents)),
      connections: new Set(Object.keys(version.addedConnections)),
    },
    changed,
    removed: {
      components: version.removedComponentIds.filter((id) => id in diagram.snapshot.components),
      connections: version.removedConnectionIds.filter((id) => id in diagram.snapshot.connections),
    },
  };
  changesCache.set(version, { base: diagram.snapshot, result });
  return result;
}

/**
 * How many changes a Version makes, for the legend: elements added, changed and removed, and the
 * connections it adds, changes or removes, counted apart (as an initiative counts them).
 */
export function countVersionChanges(
  changes: VersionChanges,
  baseConnections: Readonly<Record<string, unknown>>,
): {
  added: number;
  changed: number;
  removed: number;
  connections: number;
} {
  const changedConnections = [...changes.changed.keys()].filter((id) => id in baseConnections);
  return {
    added: changes.added.components.size,
    changed: changes.changed.size - changedConnections.length,
    removed: changes.removed.components.length,
    connections:
      changes.added.connections.size +
      changedConnections.length +
      changes.removed.connections.length,
  };
}

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

  const modifiedComp = modifiedComponentsOf(scene);
  const modifiedConn = modifiedConnectionsOf(scene);
  // A copy stands in for its base element; one whose base is gone stays out until resolved.
  const components: Record<string, Component> = {
    ...Object.fromEntries(
      Object.entries(diagram.snapshot.components)
        .filter(([id]) => !removedComp.has(id))
        .map(([id, c]) => [id, modifiedComp[id] ?? c]),
    ),
    ...scene.addedComponents,
  };

  const connections: Record<string, Connection> = {
    ...Object.fromEntries(
      Object.entries(diagram.snapshot.connections)
        .filter(([id]) => !removedConn.has(id))
        .map(([id, c]) => [id, modifiedConn[id] ?? c]),
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

/**
 * Whether a node can be dragged. Inside a Version every node moves: a base node's new position is
 * a layout override in the Version. Only compare mode, which shows two Versions at once, is fixed.
 */
export function canMoveNodeInSceneMode(diagram: VersionDiagram, _componentId: string): boolean {
  return !isDiagramCompareMode(diagram);
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
    (id) =>
      id in baseC &&
      !sceneA.addedComponents[id] &&
      !sceneB.addedComponents[id] &&
      !isModifiedInVersion(sceneA, id) &&
      !isModifiedInVersion(sceneB, id),
  );
  const onlyInBaseConn = Object.keys(mergedConnections).filter(
    (id) =>
      id in baseConn &&
      !sceneA.addedConnections[id] &&
      !sceneB.addedConnections[id] &&
      !isModifiedInVersion(sceneA, id) &&
      !isModifiedInVersion(sceneB, id),
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
    // A replaced base element is the Version's own change, like an added one.
    const addedA = !!sceneA.addedComponents[id] || id in modifiedComponentsOf(sceneA);
    const addedB = !!sceneB.addedComponents[id] || id in modifiedComponentsOf(sceneB);

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
    const addedA = !!sceneA.addedConnections[id] || id in modifiedConnectionsOf(sceneA);
    const addedB = !!sceneB.addedConnections[id] || id in modifiedConnectionsOf(sceneB);

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

export function isDiagramCompareMode(
  diagram:
    Pick<VersionDiagram, "activeVersionId" | "compareVersionId" | "versions"> | null | undefined,
): boolean {
  if (!diagram) return false;
  const a = diagram.activeVersionId ?? null;
  const b = diagram.compareVersionId ?? null;
  return !!(a && b && a !== b && diagram.versions?.[a] && diagram.versions?.[b]);
}

export function versionHasDiff(scene: VersionDiff): boolean {
  return (
    Object.keys(scene.addedComponents).length > 0 ||
    Object.keys(scene.addedConnections).length > 0 ||
    Object.keys(modifiedComponentsOf(scene)).length > 0 ||
    Object.keys(modifiedConnectionsOf(scene)).length > 0 ||
    scene.removedComponentIds.length > 0 ||
    scene.removedConnectionIds.length > 0
  );
}

export interface MergePreview {
  componentsToAdd: Component[];
  connectionsToAdd: Connection[];
  /** Base components and connections replaced by the Version's copies. */
  componentsToReplace: Component[];
  connectionsToReplace: Connection[];
  /** Conflicts that block the merge (see `versionConflicts`). */
  blocking: VersionConflict[];
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
    componentsToReplace: Object.values(modifiedComponentsOf(scene)).filter(
      (c) => diagram.snapshot.components[c.id] !== undefined,
    ),
    connectionsToReplace: Object.values(modifiedConnectionsOf(scene)).filter(
      (c) => diagram.snapshot.connections[c.id] !== undefined,
    ),
    blocking: versionConflicts(diagram, versionId),
    layoutsToAdd: { ...scene.nodeLayouts },
    componentIdsToRemove: [...scene.removedComponentIds],
    connectionIdsToRemove: [...scene.removedConnectionIds],
    conflicts,
  };
}

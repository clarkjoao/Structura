import type {
  ImporterGraph,
  ImporterGraphComponent,
  ViewBox,
  ViewLayoutResult,
} from "../generated/opscr-mapping";
import { overlayLayouts, parseLayoutFile, serializeLayoutFile } from "../generated/opscr-mapping";
import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "../types/plugin.types";
import type { EdgeSource } from "./patches";

/** Default leaf size when the canvas has not measured one — the mapping's LEAF size. */
const LEAF = { width: 180, height: 80 };

/**
 * What the plugin remembers about a bound diagram, between syncs and sessions: the
 * component and connection it created for every key, and what it last wrote for each
 * element, so a sync only touches what changed.
 */
export interface BindingState {
  ids: Record<string, string>;
  connections: Record<string, string>;
  signatures: Record<string, string>;
  /** What left the binding, by canvas id, so an undo that brings it back restores its text. */
  tombstones?: Tombstones;
}

export interface ElementTombstone {
  key: string;
  signature: string;
  identity: string;
  file: string;
  source: string;
  edges: EdgeSource[];
}

export interface ConnectionTombstone {
  key: string;
  edge: EdgeSource;
}

export interface Tombstones {
  elements: Record<string, ElementTombstone>;
  connections: Record<string, ConnectionTombstone>;
}

export const emptyBinding = (): BindingState => ({ ids: {}, connections: {}, signatures: {} });

/** Everything about an element that, when it changes, must reach the canvas. */
export const signature = (c: ImporterGraphComponent) =>
  JSON.stringify([c.name, c.description, c.technology ?? "", c.cloudServiceId ?? ""]);
/** What cannot be updated in place: changing it means removing and re-adding the element. */
export const identity = (c: ImporterGraphComponent) =>
  JSON.stringify([c.type, c.parentKey ?? null]);

/** Connections are keyed by ends and label, numbered when the same pair repeats. */
export function connectionKeys(graph: ImporterGraph): string[] {
  const seen = new Map<string, number>();
  return graph.connections.map((c) => {
    const base = `${c.source}->${c.target}:${c.label}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/**
 * The layout the reader currently sees, by element key — the canvas's positions and sizes of
 * every element the binding created and the diagram still has. Fed to the stable layout as
 * "previous", so whatever the user dragged stays where they put it.
 */
export function canvasLayout(binding: BindingState, diagram: DiagramSnapshot): ViewLayoutResult {
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const keyOfId = new Map(Object.entries(binding.ids).map(([key, id]) => [id, key]));
  const boxes = new Map<string, ViewBox>();
  const parents = new Map<string, string | null>();
  for (const [key, id] of Object.entries(binding.ids)) {
    const component = byId.get(id);
    if (!component?.position) continue;
    boxes.set(key, {
      x: component.position.x,
      y: component.position.y,
      width: component.size?.width ?? LEAF.width,
      height: component.size?.height ?? LEAF.height,
    });
    // Positions are relative to the canvas parent; one outside the binding has no key.
    parents.set(
      key,
      component.parentId ? (keyOfId.get(component.parentId) ?? `#${component.parentId}`) : null,
    );
  }
  return { boxes, edgeRoutes: new Map(), parents };
}

/**
 * The layout a sync starts from: the sidecar's boxes (`opscr.layout.json`) with the canvas's
 * on top — so elements the canvas does not have yet land where the sidecar put them, and
 * what the reader sees always wins.
 */
export function previousLayout(
  binding: BindingState,
  diagram: DiagramSnapshot,
  sidecar: string | undefined,
): ViewLayoutResult | undefined {
  const fromFile = sidecar ? parseLayoutFile(sidecar) : null;
  return overlayLayouts(fromFile, canvasLayout(binding, diagram));
}

/**
 * Moves that put the canvas where a sidecar says (it changed on disk — a `git pull`, say): every
 * bound element whose box differs. Panels get their size too.
 */
export function sidecarMoves(
  binding: BindingState,
  diagram: DiagramSnapshot,
  sidecar: string,
): NonNullable<PluginDiagramChanges["move"]> {
  const boxes = parseLayoutFile(sidecar)?.boxes;
  if (!boxes) return [];
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const moves: NonNullable<PluginDiagramChanges["move"]> = [];
  for (const [key, id] of Object.entries(binding.ids)) {
    const box = boxes.get(key);
    const component = byId.get(id);
    if (!box || !component?.position) continue;
    const moved =
      Math.abs(component.position.x - box.x) > 0.5 || Math.abs(component.position.y - box.y) > 0.5;
    const resized =
      !!component.size &&
      (Math.abs(component.size.width - box.width) > 0.5 ||
        Math.abs(component.size.height - box.height) > 0.5);
    if (!moved && !resized) continue;
    moves.push({
      id,
      x: box.x,
      y: box.y,
      ...(component.size ? { width: box.width, height: box.height } : {}),
    });
  }
  return moves;
}

/** The sidecar text for what the canvas shows now (bound elements only). */
export const sidecarText = (binding: BindingState, diagram: DiagramSnapshot) =>
  serializeLayoutFile(canvasLayout(binding, diagram).boxes);

/**
 * Elements the binding does not know but the canvas already shows — the diagram was bound
 * before, unbound, and bound again, say: an unbound component with the element's name, type
 * and (adopted or kept) parent is that element. Adopting it keeps the user's arrangement and
 * avoids drawing a duplicate; its fields are then updated like any survivor's.
 */
function adoptUnbound(
  graph: ImporterGraph,
  binding: BindingState,
  diagram: DiagramSnapshot,
  candidates: Map<string, string>,
) {
  const bound = new Set(Object.values(binding.ids));
  const free = diagram.components.filter((c) => !bound.has(c.id));
  if (free.length === 0) return;
  const byKey = new Map(graph.components.map((c) => [c.key, c]));
  const depth = (key: string) => {
    let d = 0;
    for (let k = byKey.get(key)?.parentKey; k !== undefined && d < 64; k = byKey.get(k)?.parentKey)
      d++;
    return d;
  };
  const claimed = new Set<string>();
  // Parents first, so a child can only be adopted inside its adopted parent.
  for (const component of [...graph.components].sort((a, b) => depth(a.key) - depth(b.key))) {
    if (candidates.has(component.key)) continue;
    const parentId =
      component.parentKey === undefined ? null : (candidates.get(component.parentKey) ?? null);
    if (component.parentKey !== undefined && parentId === null) continue;
    const match = free.find(
      (c) =>
        !claimed.has(c.id) &&
        c.label === component.name &&
        c.type === component.type &&
        c.parentId === parentId,
    );
    if (!match) continue;
    claimed.add(match.id);
    candidates.set(component.key, match.id);
  }
}

export interface SyncPlan {
  changes: PluginDiagramChanges;
  /** Whether there is anything to apply (an empty plan pushes no history). */
  empty: boolean;
  /** The binding after `applyChanges` returned `result`. */
  commit(result: PluginDiagramChangesResult): BindingState;
}

/**
 * The changes that make the diagram show `graph`, given what the binding created before and
 * what the diagram holds now. Elements whose id is gone (the user deleted them) come back;
 * survivors are updated in place unless their type or parent changed; panels that grew get
 * their new size; nothing else moves.
 */
export function planSync(
  graph: ImporterGraph,
  binding: BindingState,
  diagram: DiagramSnapshot,
): SyncPlan {
  const live = new Map(diagram.components.map((c) => [c.id, c]));
  const liveConnections = new Set(diagram.connections.map((c) => c.id));
  const wanted = new Map(graph.components.map((c) => [c.key, c]));

  // key → existing id that stays. Removing a component removes its descendants, so an
  // element stays only if every ancestor stays too.
  const candidates = new Map<string, string>();
  for (const [key, id] of Object.entries(binding.ids)) {
    const next = wanted.get(key);
    if (live.has(id) && next && binding.signatures[`${key}#id`] === identity(next)) {
      candidates.set(key, id);
    }
  }
  adoptUnbound(graph, binding, diagram, candidates);
  const kept = new Map<string, string>();
  const staysWithAncestors = (key: string, seen = new Set<string>()): boolean => {
    if (!candidates.has(key) || seen.has(key)) return false;
    seen.add(key);
    const parentKey = wanted.get(key)?.parentKey;
    return parentKey === undefined || staysWithAncestors(parentKey, seen);
  };
  for (const [key, id] of candidates) if (staysWithAncestors(key)) kept.set(key, id);
  const remove = Object.entries(binding.ids)
    .filter(([key, id]) => live.has(id) && !kept.has(key))
    .map(([, id]) => id);

  const changes: Required<
    Pick<PluginDiagramChanges, "remove" | "disconnect" | "update" | "move" | "add" | "connect">
  > = { remove, disconnect: [], update: [], move: [], add: [], connect: [] };

  for (const component of graph.components) {
    const id = kept.get(component.key);
    if (!id) {
      const parentKey = component.parentKey;
      changes.add.push({
        ...component,
        // A parent that stays is addressed by its id; one added in this batch by its key.
        ...(parentKey !== undefined ? { parentKey: kept.get(parentKey) ?? parentKey } : {}),
      });
      continue;
    }
    if (binding.signatures[component.key] !== signature(component)) {
      changes.update.push({
        id,
        name: component.name,
        description: component.description,
        technology: component.technology ?? "",
        cloudServiceId: component.cloudServiceId ?? "",
      });
    }
    const size = live.get(id)?.size;
    if (component.width !== undefined && component.height !== undefined) {
      const grew =
        !size || component.width > size.width + 0.5 || component.height > size.height + 0.5;
      if (grew) {
        const at = live.get(id)?.position ?? { x: component.x, y: component.y };
        changes.move.push({
          id,
          x: at.x,
          y: at.y,
          width: component.width,
          height: component.height,
        });
      }
    }
  }

  const keys = connectionKeys(graph);
  const keepConnections = new Map<string, string>();
  for (const [key, id] of Object.entries(binding.connections)) {
    const [ends] = key.split(":");
    const [source, target] = (ends ?? "").split("->");
    const endsKept =
      source !== undefined && target !== undefined && kept.has(source) && kept.has(target);
    if (liveConnections.has(id) && endsKept && keys.includes(key)) keepConnections.set(key, id);
    else if (liveConnections.has(id)) changes.disconnect.push(id);
  }
  // Unbound canvas connections between the same ends with the same label are this edge.
  const boundConnections = new Set(Object.values(binding.connections));
  const claimedConnections = new Set<string>();
  const added: string[] = [];
  graph.connections.forEach((c, i) => {
    const key = keys[i]!;
    if (keepConnections.has(key)) return;
    const existing = diagram.connections.find(
      (l) =>
        !boundConnections.has(l.id) &&
        !claimedConnections.has(l.id) &&
        l.sourceId === kept.get(c.source) &&
        l.targetId === kept.get(c.target) &&
        l.label === c.label,
    );
    if (existing) {
      claimedConnections.add(existing.id);
      keepConnections.set(key, existing.id);
      return;
    }
    added.push(key);
    changes.connect.push({
      source: kept.get(c.source) ?? c.source,
      target: kept.get(c.target) ?? c.target,
      label: c.label,
    });
  });

  const empty = Object.values(changes).every((list) => list.length === 0);

  return {
    changes,
    empty,
    commit(result) {
      const next: BindingState = {
        ...emptyBinding(),
        ...(binding.tombstones ? { tombstones: binding.tombstones } : {}),
      };
      for (const component of graph.components) {
        const id = kept.get(component.key) ?? result.idsByKey[component.key];
        if (!id) continue;
        next.ids[component.key] = id;
        next.signatures[component.key] = signature(component);
        next.signatures[`${component.key}#id`] = identity(component);
      }
      for (const [key, id] of keepConnections) next.connections[key] = id;
      added.forEach((key, i) => {
        const id = result.connectionIds[i];
        if (id) next.connections[key] = id;
      });
      return next;
    },
  };
}

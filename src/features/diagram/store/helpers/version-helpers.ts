import { current, isDraft, type Draft } from "immer";
import type {
  Component,
  Connection,
  Diagram,
  NodeLayout,
  VersionDiff,
} from "../../model/diagram.types";
import { hashElement } from "../../utils/element-hash";

export function resolveActiveVersion(diagram: Diagram): VersionDiff | null {
  const activeVersionId = diagram.activeVersionId ?? null;
  return activeVersionId && diagram.versions?.[activeVersionId]
    ? diagram.versions[activeVersionId]
    : null;
}

/** Escreve um componente e seu layout no contexto correto (scene ou base). */
export function writeComponentAndLayout(
  d: Diagram,
  scene: VersionDiff | null,
  comp: Component,
  layout: NodeLayout,
): void {
  if (scene) {
    scene.addedComponents[comp.id] = comp;
    scene.nodeLayouts[comp.id] = layout;
  } else {
    d.snapshot.components[comp.id] = comp;
    d.nodeLayouts[comp.id] = layout;
  }
}

/** Returns the component map for the active context (scene or base). */
export function getActiveComponents(
  d: Diagram,
  scene: VersionDiff | null,
): Record<string, Component> {
  return scene ? scene.addedComponents : d.snapshot.components;
}

/** Returns the layout map for the active context (scene or base). */
export function getActiveNodeLayouts(
  d: Diagram,
  scene: VersionDiff | null,
): Record<string, NodeLayout> {
  return scene ? scene.nodeLayouts : d.nodeLayouts;
}

/** Resolves a component by id in the active context, falling back to base. */
export function resolveComponent(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): Component | undefined {
  return scene?.addedComponents[id] ?? scene?.modifiedComponents?.[id] ?? d.snapshot.components[id];
}

/** A detached copy of a stored element (an immer draft is a Proxy, which structuredClone rejects). */
function plain<T extends object>(value: T): T {
  return structuredClone(isDraft(value) ? (current(value as Draft<T>) as T) : value);
}

/**
 * The component an edit should write to, in the active context. Outside a Version: the base.
 * Inside one: what the Version added, its copy of a base component, or — copy-on-write — a new
 * copy of the base component, with the base's hash recorded so a later base change is noticed.
 * `created` says a copy was just made (the edit is structural for history).
 */
export function writableComponent(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): { component: Component; created: boolean } | undefined {
  if (!scene) {
    const base = d.snapshot.components[id];
    return base ? { component: base, created: false } : undefined;
  }
  const own = scene.addedComponents[id] ?? scene.modifiedComponents?.[id];
  if (own) return { component: own, created: false };
  const base = d.snapshot.components[id];
  if (!base) return undefined;
  scene.modifiedComponents ??= {};
  scene.baseHashes ??= {};
  scene.modifiedComponents[id] = plain(base);
  scene.baseHashes[id] ??= hashElement(plain(base));
  return { component: scene.modifiedComponents[id]!, created: true };
}

/** Same as `writableComponent`, for connections. */
export function writableConnection(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): { connection: Connection; created: boolean } | undefined {
  if (!scene) {
    const base = d.snapshot.connections[id];
    return base ? { connection: base, created: false } : undefined;
  }
  const own = scene.addedConnections[id] ?? scene.modifiedConnections?.[id];
  if (own) return { connection: own, created: false };
  const base = d.snapshot.connections[id];
  if (!base) return undefined;
  scene.modifiedConnections ??= {};
  scene.baseHashes ??= {};
  scene.modifiedConnections[id] = plain(base);
  scene.baseHashes[id] ??= hashElement(plain(base));
  return { connection: scene.modifiedConnections[id]!, created: true };
}

/**
 * The layout a move or resize should write to. Inside a Version, a base node gets a layout
 * override in the Version (copied from the base) — a position, not a content change.
 */
export function writableNodeLayout(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): NodeLayout | undefined {
  if (!scene) return d.nodeLayouts[id];
  const own = scene.nodeLayouts[id];
  if (own) return own;
  const base = d.nodeLayouts[id];
  if (!base) return undefined;
  scene.nodeLayouts[id] = plain(base);
  return scene.nodeLayouts[id];
}

/** Resolves a layout by id in the active context, falling back to base. */
export function resolveNodeLayout(
  d: Diagram,
  scene: VersionDiff | null,
  id: string,
): NodeLayout | undefined {
  return scene?.nodeLayouts[id] ?? d.nodeLayouts[id];
}

import { isBuiltInKindId, isContributedKindId } from "@/features/diagram/model/diagram-kind";
import type { DiagramKindDescriptor } from "./kind.types";

/**
 * The diagram-kind registry (ADR-0014).
 *
 * A leaf module: it imports no store and no canvas, so the store, the canvas
 * and the plugin API can all read it without closing an import cycle. Kinds
 * register from `./bootstrap`; with none registered, the editor behaves
 * exactly as it did before kinds existed.
 */

const registry = new Map<string, DiagramKindDescriptor>();
const listeners = new Set<() => void>();
let version = 0;

function fail(id: string, reason: string): never {
  throw new Error(`[diagram-kinds] Cannot register "${id}": ${reason}`);
}

/**
 * Validates and registers a kind. Throws, and leaves the registry unchanged,
 * on a malformed id, a duplicate, or a missing conformance check.
 *
 * `contributed` marks a plugin's kind: its id must be namespaced
 * `<pluginId>:<kind-id>`. A built-in id is plain kebab-case.
 */
export function registerDiagramKind(
  descriptor: DiagramKindDescriptor,
  options: { contributed?: boolean } = {},
): void {
  const id = descriptor?.id;
  const wellFormed = options.contributed ? isContributedKindId(id) : isBuiltInKindId(id);
  if (!wellFormed) {
    fail(
      String(id),
      options.contributed
        ? 'a contributed kind id is "<pluginId>:<kind-id>" in lowercase kebab-case.'
        : 'a built-in kind id is lowercase kebab-case and not "freehand".',
    );
  }
  if (registry.has(id)) fail(id, "a kind with this id is already registered.");
  if (typeof descriptor.conforms !== "function") fail(id, "conforms is required.");
  if (!descriptor.interaction) fail(id, "interaction is required.");
  if (!Array.isArray(descriptor.elements)) fail(id, "elements must be a list (empty for all).");
  const commandIds = new Set<string>();
  for (const command of descriptor.commands ?? []) {
    if (commandIds.has(command.id)) fail(id, `command "${command.id}" is declared twice.`);
    commandIds.add(command.id);
  }

  registry.set(id, descriptor);
  version += 1;
  for (const listener of listeners) listener();
}

/** Removes a kind (a plugin deactivating; tests). Diagrams of that kind become unavailable, not freehand. */
export function unregisterDiagramKind(id: string): void {
  if (!registry.delete(id)) return;
  version += 1;
  for (const listener of listeners) listener();
}

export function getDiagramKind(id: string): DiagramKindDescriptor | undefined {
  return registry.get(id);
}

export function listDiagramKinds(): DiagramKindDescriptor[] {
  return [...registry.values()];
}

/** Bumped on every registration change; memoisation keys on it. */
export function diagramKindsVersion(): number {
  return version;
}

/** For `useSyncExternalStore`; returns unsubscribe. */
export function subscribeDiagramKinds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

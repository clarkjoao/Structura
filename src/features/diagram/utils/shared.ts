import type { Component, SharedMode } from "../model/component.types";
import type { Connection } from "../model/connection.types";
import { isSharedRefComponent } from "../model/component.guards";

/*
 * A shared element: many things use it, and its incoming edges may be drawn
 * as badges, references or a bus. The edges stay in the model; everything
 * that reads meaning — export, the assistant, usage counts, flows — reads the
 * real graph through these.
 */

export const DEFAULT_SHARED_MODE: SharedMode = "edges";
/** From this many consumers, an element is suggested as shared. */
export const SUGGEST_SHARED_AT = 4;

export function sharedMode(component: Component | undefined): SharedMode {
  return component?.shared?.mode ?? DEFAULT_SHARED_MODE;
}

/**
 * The element `id` stands for: a reference's original (following references
 * of references), else itself. A missing original or a loop reads as `id`.
 */
export function resolveShared(id: string, components: Record<string, Component>): string {
  let current = id;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const component = components[current];
    if (!component || !isSharedRefComponent(component)) return current;
    if (!components[component.refOf]) return current;
    current = component.refOf;
  }
  return id;
}

/** The references drawn for `originalId`. */
export function refsOf(originalId: string, components: Record<string, Component>): string[] {
  return Object.values(components)
    .filter((c) => isSharedRefComponent(c) && resolveShared(c.id, components) === originalId)
    .map((c) => c.id);
}

export interface SharedUse {
  /** The consumer, resolved (a reference's original stands for it). */
  consumerId: string;
  connectionId: string;
  /** The protocol, as the edge says it. */
  label: string;
}

/**
 * Who uses `originalId`: every connection into it or into one of its
 * references, from something other than itself.
 */
export function sharedUses(
  originalId: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): SharedUse[] {
  const uses: SharedUse[] = [];
  for (const connection of Object.values(connections)) {
    if (resolveShared(connection.targetId, components) !== originalId) continue;
    const consumerId = resolveShared(connection.sourceId, components);
    if (consumerId === originalId) continue;
    uses.push({ consumerId, connectionId: connection.id, label: connection.label });
  }
  return uses;
}

/** How many distinct things use it: "N usos". */
export function usageCount(
  originalId: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): number {
  return new Set(sharedUses(originalId, components, connections).map((use) => use.consumerId)).size;
}

/** Whether to suggest sharing: drawn with its edges, and used by enough things. Never applied. */
export function suggestsSharing(
  id: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): boolean {
  return (
    sharedMode(components[id]) === "edges" &&
    usageCount(id, components, connections) >= SUGGEST_SHARED_AT
  );
}

/** What is being shown despite the mode: whole originals, or single connections. */
export interface SharedReveal {
  originals?: ReadonlySet<string>;
  connections?: ReadonlySet<string>;
}

/**
 * The connections as drawn: one into a badge-mode element (straight into it,
 * not through a reference) is not drawn, unless it is being revealed. The
 * model keeps it. Unchanged arrays come back as the same array.
 */
export function hideSharedEdges<T extends Connection>(
  connections: readonly T[],
  components: Record<string, Component>,
  reveal: SharedReveal = {},
): T[] {
  let hidden = false;
  const kept = connections.filter((connection) => {
    const target = components[connection.targetId];
    if (sharedMode(target) !== "badge") return true;
    if (reveal.connections?.has(connection.id) || reveal.originals?.has(connection.targetId)) {
      return true;
    }
    hidden = true;
    return false;
  });
  return hidden ? kept : (connections as T[]);
}

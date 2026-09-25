import type { Component, Diagram } from "@/features/diagram";
import { resolveVersionSnapshot } from "@/features/diagram/utils/version.utils";
import { isCompactContainer } from "@/features/elements/containment";
import { ancestorsOf, visibleAncestorOf } from "../core/compactView";

/**
 * What a flow step's element looks like on screen when it may sit inside a
 * compact container. The step keeps pointing at the child — its id never
 * changes — and the reading resolves it here, without expanding anything.
 */
export interface VisibleTarget {
  /** The element drawn for it: itself, or the outermost compact container around it. */
  id: string;
  /** True when the element itself is hidden inside a compact container. */
  hidden: boolean;
  /**
   * Names from the drawn element down to the step's element — `["Pedidos",
   * "shard-2"]` — or just its own name when it is drawn itself.
   */
  path: string[];
}

/** The compact containers among `components`, by the registry's rule. */
export function compactContainerIdsOf(components: Record<string, Component>): Set<string> {
  const ids = new Set<string>();
  for (const component of Object.values(components)) {
    if (isCompactContainer(component)) ids.add(component.id);
  }
  return ids;
}

/** `resolveVisibleTarget` over components already resolved, and their compact ids. */
export function visibleTargetIn(
  components: Record<string, Component>,
  compactIds: ReadonlySet<string>,
  elementId: string,
): VisibleTarget | null {
  const element = components[elementId];
  if (!element) return null;
  const id = visibleAncestorOf(elementId, components, compactIds);
  if (id === elementId) return { id, hidden: false, path: [element.name] };
  const chain = ancestorsOf(elementId, components);
  const upTo = chain.indexOf(id);
  const names = chain
    .slice(0, upTo + 1)
    .reverse()
    .map((ancestorId) => components[ancestorId]?.name ?? "");
  return { id, hidden: true, path: [...names, element.name] };
}

/**
 * The element a reader sees for `elementId` in the scene the diagram has open:
 * the element itself, or — inside compact containers — the outermost compact
 * one, with the path `container › child` for the step card. `null` when the
 * element is not in the scene.
 */
export function resolveVisibleTarget(diagram: Diagram, elementId: string): VisibleTarget | null {
  const { components } = resolveVersionSnapshot(diagram, diagram.activeVersionId ?? null);
  return visibleTargetIn(components, compactContainerIdsOf(components), elementId);
}

/** How a path is said: `Pedidos › shard-2`. */
export function formatTargetPath(path: readonly string[]): string {
  return path.join(" › ");
}

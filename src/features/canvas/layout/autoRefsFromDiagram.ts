// Leaf imports, not the `@/features/diagram` barrel: nothing on the layout path
// should drag the store into its import graph.
import type { Component } from "@/features/diagram/model/component.types";
import type { Connection } from "@/features/diagram/model/connection.types";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { COMPONENT_TYPE_SHARED_REF } from "@/features/diagram/model/component-type-constants";
import { generateId } from "@/features/diagram/utils/generate-id";
import { sharedMode } from "@/features/diagram/utils/shared";
import { canContain } from "@/features/elements/containment";
import { elementDefaultSize, getElement } from "@/features/elements/element.registry";
import { canBeReferenced } from "@/features/elements/referencing";
import type { AutoRefPlanOptions } from "./autoRefs";

const FALLBACK_REF_SIZE = { width: 200, height: 48 };

/**
 * The diagram as the auto-layout plans it: every automatic reference folded
 * back into its original, on both ends of its edges. What the last run drew is
 * not an input to the next one; a reference the user made stays as it is.
 */
export function withoutAutoRefs(
  components: Record<string, Component>,
  connections: readonly Connection[],
): { components: Record<string, Component>; connections: Connection[] } {
  const originalOf = new Map<string, string>();
  for (const component of Object.values(components)) {
    if (isSharedRefComponent(component) && component.auto && components[component.refOf]) {
      originalOf.set(component.id, component.refOf);
    }
  }
  if (originalOf.size === 0) return { components, connections: [...connections] };

  const kept: Record<string, Component> = {};
  for (const [id, component] of Object.entries(components)) {
    if (!originalOf.has(id)) kept[id] = component;
  }
  return {
    components: kept,
    connections: connections
      .map((connection) => ({
        ...connection,
        sourceId: originalOf.get(connection.sourceId) ?? connection.sourceId,
        targetId: originalOf.get(connection.targetId) ?? connection.targetId,
      }))
      .filter((connection) => connection.sourceId !== connection.targetId),
  };
}

/**
 * What the planner needs to know about the diagram. `components` is the
 * diagram as it is, automatic references included, so an existing reference
 * in the same place keeps its id: the layout depends on node order, and a
 * reference that stays put should not move for being renamed.
 */
export function autoRefOptionsFor(components: Record<string, Component>): AutoRefPlanOptions {
  const descriptor = getElement(COMPONENT_TYPE_SHARED_REF);
  const size = descriptor ? elementDefaultSize(descriptor) : FALLBACK_REF_SIZE;
  const existing = Object.values(components).filter(
    (component) => isSharedRefComponent(component) && component.auto,
  );

  return {
    canReference: (id) => {
      const component = components[id];
      if (!component || !canBeReferenced(component)) return false;
      // A badge or a bus is how the user chose to draw it; only plain edges and references split.
      const mode = sharedMode(component);
      return mode === "edges" || mode === "ref";
    },
    refParentFor: (parentId) => {
      let current = parentId;
      while (current) {
        const parent = components[current];
        if (!parent || canContain(parent.type, COMPONENT_TYPE_SHARED_REF)) return current;
        current = parent.parentId ?? null;
      }
      return null;
    },
    refIdFor: (originalId, parentId) => {
      const reused = existing.find(
        (ref) =>
          isSharedRefComponent(ref) &&
          ref.refOf === originalId &&
          (ref.parentId ?? null) === parentId,
      );
      return reused?.id ?? generateId("el");
    },
    refSize: {
      width: size.width ?? FALLBACK_REF_SIZE.width,
      height: size.height ?? FALLBACK_REF_SIZE.height,
    },
  };
}

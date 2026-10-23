import type { Component } from "@/features/diagram/model/component.types";
import { isTextType } from "@/features/diagram/model/component-type-constants";

/**
 * Past this many elements, a whole-diagram arrangement is off during a live
 * session. Arranging rewrites every position and every route in one edit: on a
 * large diagram that is one very large patch for every participant, and it
 * moves whatever a peer is looking at or about to drag. Placing what was just
 * added (the automatic mode) moves only that, and stays on.
 */
export const SESSION_ARRANGE_MAX_ELEMENTS = 50;

/** The elements an arrangement moves: everything but free text, which it leaves alone. */
export function arrangeableElementCount(components: Record<string, Component>): number {
  let count = 0;
  for (const component of Object.values(components)) {
    if (!isTextType(component.type)) count += 1;
  }
  return count;
}

/** Whether a whole-diagram arrangement is off right now. */
export function isArrangeBlockedInSession(
  components: Record<string, Component>,
  inSession: boolean,
): boolean {
  return inSession && arrangeableElementCount(components) > SESSION_ARRANGE_MAX_ELEMENTS;
}

import type { Component } from "../model/component.types";
import { isTextType } from "../model/component-type-constants";

/**
 * How many elements a diagram has, for the counts a person reads on a card or
 * in the workspace totals. Free text is a planning decoration, not part of the
 * architecture, so it is not counted.
 */
export function countComponents(components: Record<string, Component>): number {
  let count = 0;
  for (const component of Object.values(components)) {
    if (!isTextType(component.type)) count++;
  }
  return count;
}

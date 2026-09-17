import type { Component } from "@/features/diagram";
import { isPanelComponent, isApiGroupComponent } from "@/features/diagram";

/**
 * Options for sortComponents.
 *
 * @property resolvedComponents - Map of component id -> component, used to walk the parent chain.
 * @property collapsedPanelIds  - Panel ids whose children are hidden (reserved for future use).
 */
export interface SortComponentsOptions {
  resolvedComponents: Record<string, Component>;
  collapsedPanelIds: ReadonlySet<string>;
}

/**
 * Walk a component's ancestor chain and return its depth (0 = root-level).
 *
 * The depth is the number of direct ancestors in the resolved component tree.
 */
function getDepth(
  comp: Component,
  resolvedComponents: Record<string, Component>,
): number {
  let depth = 0;
  let current = comp;
  while (current.parentId && resolvedComponents[current.parentId]) {
    depth++;
    current = resolvedComponents[current.parentId];
  }
  return depth;
}

/**
 * Sort an array of components for deterministic canvas layout ordering.
 *
 * Sort order:
 *  1. Groups (panels and API groups) before non-groups.
 *  2. Shallowest depth before deepest depth.
 *  3. Stable id order as tiebreaker (localeCompare).
 *
 * This ordering ensures parent nodes appear before children and groups
 * are positioned consistently across renders, which is important for
 * deterministic layout and visual grouping.
 *
 * @param components - Array of components to sort.
 * @param opts       - Sorting options; `resolvedComponents` is required,
 *                     `collapsedPanelIds` is accepted but unused at present.
 * @returns A new sorted array; the input is not mutated.
 */
export function sortComponents(
  components: Component[],
  { resolvedComponents }: SortComponentsOptions,
): Component[] {
  return [...components].sort((a, b) => {
    const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
    const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;

    const aDepth = getDepth(a, resolvedComponents);
    const bDepth = getDepth(b, resolvedComponents);
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.id.localeCompare(b.id);
  });
}

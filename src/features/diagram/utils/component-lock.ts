import type { Component } from "../model/component.types";

export function isAncestorLocked(
  component: Component,
  componentsById: Record<string, Component>,
): boolean {
  let currentParentId = component.parentId;
  const visitedParentIds = new Set<string>();

  while (currentParentId) {
    if (visitedParentIds.has(currentParentId)) return false;
    visitedParentIds.add(currentParentId);

    const parentComponent = componentsById[currentParentId];
    if (!parentComponent) return false;
    if (parentComponent.locked === true) return true;

    currentParentId = parentComponent.parentId;
  }

  return false;
}

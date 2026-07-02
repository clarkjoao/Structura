export function buildChildrenIndex(
  components: Record<string, { parentId?: string | null }>,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const [id, component] of Object.entries(components)) {
    const parentId = component.parentId;
    if (!parentId) continue;
    if (!index.has(parentId)) index.set(parentId, new Set());
    index.get(parentId)!.add(id);
  }
  return index;
}

export function getDescendantIdsFromIndex(
  nodeId: string,
  childrenIndex: Map<string, Set<string>>,
): Set<string> {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const currentNodeId = stack.pop()!;
    const children = childrenIndex.get(currentNodeId);
    if (!children) continue;
    for (const childId of children) {
      if (result.has(childId)) continue;
      result.add(childId);
      stack.push(childId);
    }
  }
  return result;
}

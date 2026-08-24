/**
 * Containment-cycle detection over a child -> parent map.
 *
 * Shared by every importer that derives a hierarchy from a flat document (the
 * LLM IR validator and the ASL validator). It is deliberately free of any
 * domain type: the input is the parent map, the output is the offending chains.
 */

/** Walks parentId chains and reports every containment cycle exactly once. */
export function collectContainmentCycles(parentById: Map<string, string>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();

  for (const startId of parentById.keys()) {
    if (state.has(startId)) continue;

    const path: string[] = [];
    const indexInPath = new Map<string, number>();
    let currentId: string | undefined = startId;

    while (currentId !== undefined && !state.has(currentId)) {
      indexInPath.set(currentId, path.length);
      path.push(currentId);
      state.set(currentId, "visiting");
      currentId = parentById.get(currentId);
    }

    if (currentId !== undefined && state.get(currentId) === "visiting") {
      const cycleStart = indexInPath.get(currentId);
      if (cycleStart !== undefined) {
        cycles.push(path.slice(cycleStart));
      }
    }

    for (const id of path) {
      state.set(id, "done");
    }
  }

  return cycles;
}

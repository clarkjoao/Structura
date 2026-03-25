import type { Diagram } from "../model/diagram.types";

/**
 * Calendar date as DD/MM/YY (local), used for imported diagram display names.
 */
export function formatDiagramImportCalendarDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Uses `preferredId` when no diagram occupies it; otherwise `preferredId-2`, `preferredId-3`, …
 */
export function resolveUniqueDiagramId(
  preferredId: string,
  diagrams: Record<string, Diagram>,
): string {
  if (!diagrams[preferredId]) {
    return preferredId;
  }
  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = `${preferredId}-${suffix}`;
    if (!diagrams[candidate]) {
      return candidate;
    }
  }
  throw new Error("Could not resolve unique diagram id");
}

/**
 * Clone for workspace import: optional new id, display name, and `updatedAt`.
 * When `newId` differs from the source diagram id, resets `createdAt` and rewrites
 * `flow.diagramId` for flows that belonged to the source diagram.
 */
export function cloneDiagramForImportWithId(
  diagram: Diagram,
  newId: string,
  options: { name: string; updatedAt: string },
): Diagram {
  const sourceId = diagram.id;
  const cloned = structuredClone(diagram);
  cloned.id = newId;
  cloned.name = options.name;
  cloned.updatedAt = options.updatedAt;
  if (newId !== sourceId) {
    cloned.createdAt = options.updatedAt;
    for (const flow of Object.values(cloned.snapshot.flows)) {
      if (flow.diagramId === sourceId) {
        flow.diagramId = newId;
      }
    }
  }
  return cloned;
}

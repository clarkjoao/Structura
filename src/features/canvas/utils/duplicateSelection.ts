import type { Node } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { getCachedCanvasSnapshot, isPanelComponent } from "@/features/diagram";
import { getCenterOfNodes, getCopyableIds } from "../hooks/keyboard/helpers";

export interface DuplicateSelectionParams {
  diagram: Diagram | DiagramModel;
  nodes: Node[];
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (
    position?: { x: number; y: number },
    options?: { preserveParentWhenMissing?: boolean },
  ) => string[];
}

/**
 * Full-fidelity duplicate via clipboard (same path as Cmd/Ctrl+D).
 *
 * When every selected node is a child of the same panel, paste keeps that
 * parent even though the panel itself was not copied.
 *
 * @example
 * const newIds = duplicateSelection({ diagram, nodes, copyToClipboard, pasteFromClipboard });
 */
export function duplicateSelection({
  diagram,
  nodes,
  copyToClipboard,
  pasteFromClipboard,
}: DuplicateSelectionParams): string[] {
  const ids = getCopyableIds(diagram, nodes);
  if (ids.length === 0) return [];

  const canvasSnapshot = getCachedCanvasSnapshot(diagram);
  const originalSelectedIds = nodes
    .map((node) => node.id)
    .filter((id) => Boolean(canvasSnapshot.components[id]));
  const originalSelectedComponents = originalSelectedIds
    .map((id) => canvasSnapshot.components[id])
    .filter((component): component is NonNullable<typeof component> => Boolean(component));
  const parentIds = new Set(
    originalSelectedComponents
      .map((component) => component.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );
  const allChildrenOfSamePanel =
    parentIds.size === 1 &&
    originalSelectedComponents.every((component) => component.parentId !== null) &&
    !originalSelectedComponents.some((component) => isPanelComponent(component));

  copyToClipboard(ids);
  const center = getCenterOfNodes(diagram, allChildrenOfSamePanel ? originalSelectedIds : ids);
  return allChildrenOfSamePanel
    ? pasteFromClipboard(center, { preserveParentWhenMissing: true })
    : pasteFromClipboard(center);
}

import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { isPanelComponent, isNoteComponent } from "@/features/diagram";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../constants";

interface UseNodeDragParentingParams {
  diagram: Diagram | null | undefined;
  nodes: Node[];
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  setParent: (childId: string, parentId: string | null) => void;
}

interface UseNodeDragParentingResult {
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  onNodesChange: OnNodesChange;
  onNodeDragStop: (_: unknown, draggedNode: Node) => void;
}

function getPanelDimensions(node: Node): { width: number; height: number } {
  const w = (node.style?.width as number) ?? PANEL_DEFAULT_W;
  const h = (node.style?.height as number) ?? PANEL_DEFAULT_H;
  return { width: w, height: h };
}

function isInsidePanel(node: Node, x: number, y: number): boolean {
  const { width, height } = getPanelDimensions(node);
  return (
    x > node.position.x &&
    y > node.position.y &&
    x < node.position.x + width &&
    y < node.position.y + height
  );
}

function isOutsideParentBounds(
  childPos: { x: number; y: number },
  parent: Node,
): boolean {
  const { width, height } = getPanelDimensions(parent);
  return (
    childPos.x < 0 ||
    childPos.y < 0 ||
    childPos.x > width ||
    childPos.y > height
  );
}

function findPanelContainingPoint(
  nodes: Node[],
  absX: number,
  absY: number,
  excludeParentId?: string | null,
): Node | undefined {
  const panels = nodes.filter(
    (n) => n.type === "panel" && n.id !== excludeParentId,
  );
  return panels.find((p) => isInsidePanel(p, absX, absY));
}

function toAbsolutePosition(
  relativePos: { x: number; y: number },
  parentLayout: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: relativePos.x + parentLayout.x,
    y: relativePos.y + parentLayout.y,
  };
}

function toRelativePosition(
  absPos: { x: number; y: number },
  parentPos: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: absPos.x - parentPos.x,
    y: absPos.y - parentPos.y,
  };
}

export function useNodeDragParenting({
  diagram,
  nodes,
  updateNodeLayout,
  setParent,
}: UseNodeDragParentingParams): UseNodeDragParentingResult {
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(null);
  const [unparentCandidatePanelId, setUnparentCandidatePanelId] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  const handlePositionChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "position" || !change.position) return;

      if (!change.dragging) {
        updateNodeLayout(change.id, change.position);
        return;
      }

      const comp = diagram?.snapshot.components[change.id];
      if (!comp || isPanelComponent(comp) || isNoteComponent(comp)) return;

      let absX = change.position.x;
      let absY = change.position.y;

      if (comp.parentId) {
        const parentNode = nodes.find((n) => n.id === comp.parentId);
        const outside = parentNode
          ? isOutsideParentBounds(change.position, parentNode)
          : false;
        setUnparentCandidatePanelId(outside ? comp.parentId : null);

        const parentLayout = diagram?.nodeLayouts.find(
          (nl) => nl.elementId === comp.parentId,
        );
        if (parentLayout) {
          absX = toAbsolutePosition(change.position, parentLayout).x;
          absY = toAbsolutePosition(change.position, parentLayout).y;
        }
      } else {
        setUnparentCandidatePanelId(null);
      }

      const match = findPanelContainingPoint(nodes, absX, absY, comp.parentId);
      const newTarget = match?.id ?? null;

      if (newTarget !== dragTargetRef.current) {
        dragTargetRef.current = newTarget;
        setDragTargetPanelId(newTarget);
      }
    },
    [diagram, nodes, updateNodeLayout],
  );

  const handleDimensionsChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "dimensions" || !change.dimensions) return;
      const layout = diagram?.nodeLayouts.find((nl) => nl.elementId === change.id);
      if (layout) {
        updateNodeLayout(change.id, { x: layout.x, y: layout.y }, change.dimensions);
      }
    },
    [diagram, updateNodeLayout],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position") handlePositionChange(change);
        if (change.type === "dimensions") handleDimensionsChange(change);
      });
    },
    [handlePositionChange, handleDimensionsChange],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setUnparentCandidatePanelId(null);
      if (draggedNode.type === "panel") return;

      const parent = draggedNode.parentId
        ? nodes.find((n) => n.id === draggedNode.parentId)
        : null;

      if (parent) {
        const outside = isOutsideParentBounds(draggedNode.position, parent);
        if (outside) {
          const absPos = toAbsolutePosition(draggedNode.position, parent.position);
          setParent(draggedNode.id, null);
          updateNodeLayout(draggedNode.id, absPos);
        }
        return;
      }

      const match = findPanelContainingPoint(nodes, draggedNode.position.x, draggedNode.position.y);
      if (match) {
        setParent(draggedNode.id, match.id);
        const relPos = toRelativePosition(draggedNode.position, match.position);
        updateNodeLayout(draggedNode.id, relPos);
      }
    },
    [nodes, setParent, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, onNodesChange, onNodeDragStop };
}

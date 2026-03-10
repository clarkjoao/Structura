import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { isPanelComponent, isNoteComponent } from "@/features/diagram";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../constants";

interface UseNodeDragParentingParams {
  diagram: Diagram | null | undefined;
  updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => void;
  setParent: (childId: string, parentId: string | null) => void;
}

interface UseNodeDragParentingResult {
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  nodesRef: React.MutableRefObject<Node[]>;
  onNodesChange: OnNodesChange;
  onNodeDragStop: (_: unknown, draggedNode: Node) => void;
}

function getPanelBounds(diagram: Diagram | null | undefined) {
  if (!diagram) return [];
  return Object.values(diagram.snapshot.components)
    .filter(isPanelComponent)
    .map((c) => {
      const layout = diagram.nodeLayouts.find((nl) => nl.elementId === c.id);
      return {
        id: c.id,
        x: layout?.x ?? 0,
        y: layout?.y ?? 0,
        w: layout?.width ?? PANEL_DEFAULT_W,
        h: layout?.height ?? PANEL_DEFAULT_H,
      };
    });
}

export function useNodeDragParenting({
  diagram,
  updateNodeLayout,
  setParent,
}: UseNodeDragParentingParams): UseNodeDragParentingResult {
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(null);
  const [unparentCandidatePanelId, setUnparentCandidatePanelId] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);
  const draggingNodeIds = useRef(new Set<string>());
  const nodesRef = useRef<Node[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position") {
          if (change.dragging === true) {
            draggingNodeIds.current.add(change.id);
          }
          if (change.position && change.dragging === false && draggingNodeIds.current.has(change.id)) {
            draggingNodeIds.current.delete(change.id);
            updateNodeLayout(change.id, change.position);
          }
        }
        if (change.type === "dimensions" && change.dimensions) {
          const layout = diagram?.nodeLayouts.find((nl) => nl.elementId === change.id);
          if (layout) {
            updateNodeLayout(change.id, { x: layout.x, y: layout.y }, change.dimensions);
          }
        }

        if (
          change.type === "position" &&
          change.dragging === true &&
          change.position
        ) {
          const dragId = change.id;
          const comp = diagram?.snapshot.components[dragId];
          if (!comp || isPanelComponent(comp) || isNoteComponent(comp)) return;

          let absX = change.position.x;
          let absY = change.position.y;

          if (comp.parentId) {
            const parentLayout = diagram?.nodeLayouts.find(
              (nl) => nl.elementId === comp.parentId,
            );
            const pw = parentLayout?.width ?? PANEL_DEFAULT_W;
            const ph = parentLayout?.height ?? PANEL_DEFAULT_H;
            const isOutsideParent =
              change.position.x < 0 ||
              change.position.y < 0 ||
              change.position.x > pw ||
              change.position.y > ph;
            setUnparentCandidatePanelId(isOutsideParent ? comp.parentId : null);

            if (parentLayout) {
              absX += parentLayout.x;
              absY += parentLayout.y;
            }
          } else {
            setUnparentCandidatePanelId(null);
          }

          const panels = getPanelBounds(diagram).filter(
            (p) => p.id !== comp.parentId,
          );
          const match = panels.find(
            (p) =>
              absX > p.x &&
              absY > p.y &&
              absX < p.x + p.w &&
              absY < p.y + p.h,
          );

          const newTarget = match?.id ?? null;
          if (newTarget !== dragTargetRef.current) {
            dragTargetRef.current = newTarget;
            setDragTargetPanelId(newTarget);
          }
        }
      });
    },
    [updateNodeLayout, diagram],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setUnparentCandidatePanelId(null);
      if (draggedNode.type === "panel") return;
      if (draggedNode.parentId) {
        const parentLayout = diagram?.nodeLayouts.find(
          (nl) => nl.elementId === draggedNode.parentId,
        );
        if (parentLayout) {
          const pw = parentLayout.width ?? PANEL_DEFAULT_W;
          const ph = parentLayout.height ?? PANEL_DEFAULT_H;
          const outside =
            draggedNode.position.x < 0 ||
            draggedNode.position.y < 0 ||
            draggedNode.position.x > pw ||
            draggedNode.position.y > ph;
          if (outside) {
            const absX = parentLayout.x + draggedNode.position.x;
            const absY = parentLayout.y + draggedNode.position.y;
            setParent(draggedNode.id, null);
            updateNodeLayout(draggedNode.id, { x: absX, y: absY });
            return;
          }
        }
        return;
      }

      const panels = getPanelBounds(diagram);
      const match = panels.find(
        (p) =>
          draggedNode.position.x > p.x &&
          draggedNode.position.y > p.y &&
          draggedNode.position.x < p.x + p.w &&
          draggedNode.position.y < p.y + p.h,
      );

      if (match) {
        setParent(draggedNode.id, match.id);
        updateNodeLayout(draggedNode.id, {
          x: draggedNode.position.x - match.x,
          y: draggedNode.position.y - match.y,
        });
      }
    },
    [diagram, setParent, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, nodesRef, onNodesChange, onNodeDragStop };
}

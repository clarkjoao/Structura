import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { isPanelComponent, isNoteComponent } from "@/features/diagram";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../constants";

interface UseNodeDragParentingParams {
  diagram: Diagram | null | undefined;
  nodes: Node[];
  updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => void;
  setParent: (childId: string, parentId: string | null) => void;
}

interface UseNodeDragParentingResult {
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  onNodesChange: OnNodesChange;
  onNodeDragStop: (_: unknown, draggedNode: Node) => void;
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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position && !change.dragging)
          updateNodeLayout(change.id, change.position);
        if (change.type === "dimensions" && change.dimensions) {
          const layout = diagram?.nodeLayouts.find((nl) => nl.elementId === change.id);
          if (layout) {
            updateNodeLayout(change.id, { x: layout.x, y: layout.y }, change.dimensions);
          }
        }

        if (
          change.type === "position" &&
          "dragging" in change &&
          change.dragging &&
          change.position
        ) {
          const dragId = change.id;
          const comp = diagram?.snapshot.components[dragId];
          if (!comp || isPanelComponent(comp) || isNoteComponent(comp)) return;

          let absX = change.position.x;
          let absY = change.position.y;

          if (comp.parentId) {
            const parentNode = nodes.find((n) => n.id === comp.parentId);
            const pw = (parentNode?.style?.width as number) ?? PANEL_DEFAULT_W;
            const ph = (parentNode?.style?.height as number) ?? PANEL_DEFAULT_H;
            const isOutsideParent =
              change.position.x < 0 ||
              change.position.y < 0 ||
              change.position.x > pw ||
              change.position.y > ph;
            setUnparentCandidatePanelId(isOutsideParent ? comp.parentId : null);

            const parentLayout = diagram?.nodeLayouts.find(
              (nl) => nl.elementId === comp.parentId,
            );
            if (parentLayout) {
              absX += parentLayout.x;
              absY += parentLayout.y;
            }
          } else {
            setUnparentCandidatePanelId(null);
          }

          const panels = nodes.filter(
            (n) => n.type === "panel" && n.id !== comp.parentId,
          );
          const match = panels.find(
            (p) =>
              absX > p.position.x &&
              absY > p.position.y &&
              absX < p.position.x + ((p.style?.width as number) ?? PANEL_DEFAULT_W) &&
              absY < p.position.y + ((p.style?.height as number) ?? PANEL_DEFAULT_H),
          );

          const newTarget = match?.id ?? null;
          if (newTarget !== dragTargetRef.current) {
            dragTargetRef.current = newTarget;
            setDragTargetPanelId(newTarget);
          }
        }
      });
    },
    [updateNodeLayout, diagram, nodes],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setUnparentCandidatePanelId(null);
      if (draggedNode.type === "panel") return;
      if (draggedNode.parentId) {
        const parent = nodes.find((n) => n.id === draggedNode.parentId);
        if (parent) {
          const pw = (parent.style?.width as number) ?? PANEL_DEFAULT_W;
          const ph = (parent.style?.height as number) ?? PANEL_DEFAULT_H;
          const outside =
            draggedNode.position.x < 0 ||
            draggedNode.position.y < 0 ||
            draggedNode.position.x > pw ||
            draggedNode.position.y > ph;
          if (outside) {
            const absX = parent.position.x + draggedNode.position.x;
            const absY = parent.position.y + draggedNode.position.y;
            setParent(draggedNode.id, null);
            updateNodeLayout(draggedNode.id, { x: absX, y: absY });
            return;
          }
        }
        return;
      }

      const panels = nodes.filter((n) => n.type === "panel");
      const match = panels.find(
        (p) =>
          draggedNode.position.x > p.position.x &&
          draggedNode.position.y > p.position.y &&
          draggedNode.position.x <
            p.position.x + ((p.style?.width as number) ?? PANEL_DEFAULT_W) &&
          draggedNode.position.y <
            p.position.y + ((p.style?.height as number) ?? PANEL_DEFAULT_H),
      );

      if (match) {
        setParent(draggedNode.id, match.id);
        updateNodeLayout(draggedNode.id, {
          x: draggedNode.position.x - match.position.x,
          y: draggedNode.position.y - match.position.y,
        });
      }
    },
    [nodes, setParent, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, onNodesChange, onNodeDragStop };
}

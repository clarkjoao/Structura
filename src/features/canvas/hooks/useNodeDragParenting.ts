import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import type { Component } from "@/features/diagram";
import {
  isNoteComponent,
  isEndpointComponent,
  isEndpointType,
  isReactFlowParentPanelType,
} from "@/features/diagram";
import {
  isOutsideParentBounds,
  findPanelContainingPoint,
  resolveAbsolutePosition,
} from "../models/panelParenting";
import { resolveCanvasSnapshot, canMoveNodeInSceneMode } from "@/features/diagram";
import { toast } from "sonner";
import i18n from "@/infrastructure/i18n";

/** Collect all descendant ids of a panel (recursive). */
function getDescendantIds(panelId: string, components: Record<string, Component>): Set<string> {
  const out = new Set<string>();
  const stack = [panelId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const c of Object.values(components)) {
      if (c.parentId === id) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

interface UseNodeDragParentingParams {
  diagram: Diagram | null | undefined;
  nodes: Node[];
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  /**
   * Atomic action: one pushHistory + parentId change + position update in a single
   * store transaction. Provided by the new commitNodeDrag action in components.slice.
   */
  commitNodeDrag: (
    nodeId: string,
    newParentId: string | null,
    newPosition: { x: number; y: number },
  ) => void;
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
  commitNodeDrag,
}: UseNodeDragParentingParams): UseNodeDragParentingResult {
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(null);
  const [unparentCandidatePanelId, setUnparentCandidatePanelId] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  /**
   * Track whether a drag-stop is in progress so handlePositionChange can skip the
   * redundant updateNodeLayout call that ReactFlow fires with dragging=false right
   * before onNodeDragStop.
   */
  const dragStopPendingRef = useRef(false);

  const handlePositionChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "position" || !change.position) return;
      if (!diagram) return;

      const r = resolveCanvasSnapshot(diagram);
      const comp = r.components[change.id];
      if (comp && isEndpointComponent(comp)) return;

      if (!change.dragging) {
        // ReactFlow fires dragging=false immediately before onNodeDragStop.
        // If a drag-stop is incoming, skip this write — onNodeDragStop will
        // handle the final position atomically via commitNodeDrag.
        if (dragStopPendingRef.current) return;

        if (!canMoveNodeInSceneMode(diagram, change.id)) {
          toast.error(i18n.t("scenes.baseMoveBlocked"));
          return;
        }
        updateNodeLayout(change.id, change.position);
        return;
      }

      if (!canMoveNodeInSceneMode(diagram, change.id)) {
        return;
      }

      if (!comp || isNoteComponent(comp) || isEndpointComponent(comp)) return;

      let absX = change.position.x;
      let absY = change.position.y;

      if (comp.parentId) {
        const absolutePosition = resolveAbsolutePosition(
          change.id,
          change.position,
          r.components,
          r.nodeLayouts,
        );
        absX = absolutePosition.x;
        absY = absolutePosition.y;

        const parentNode = nodes.find((n) => n.id === comp.parentId);
        const outside = parentNode
          ? isOutsideParentBounds(change.position, parentNode)
          : false;
        setUnparentCandidatePanelId(outside ? comp.parentId : null);
      } else {
        setUnparentCandidatePanelId(null);
      }

      const match = findPanelContainingPoint(
        nodes,
        absX,
        absY,
        comp.parentId,
        r.nodeLayouts,
        r.components,
      );
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
      if (!diagram) return;
      if (!canMoveNodeInSceneMode(diagram, change.id)) {
        toast.error(i18n.t("scenes.baseMoveBlocked"));
        return;
      }
      const r = resolveCanvasSnapshot(diagram);
      const layout = r.nodeLayouts[change.id];
      if (layout) {
        updateNodeLayout(change.id, { x: layout.x, y: layout.y }, change.dimensions);
      }
    },
    [diagram, updateNodeLayout],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Signal that a drag stop is about to fire so handlePositionChange skips
      // the redundant dragging=false write on the same batch.
      const hasDragStop = changes.some(
        (c) => c.type === "position" && !c.dragging,
      );
      if (hasDragStop) {
        dragStopPendingRef.current = true;
        // Clear after React has processed — the real commit happens in onNodeDragStop
        requestAnimationFrame(() => {
          dragStopPendingRef.current = false;
        });
      }

      changes.forEach((change) => {
        if (change.type === "position") handlePositionChange(change);
        if (change.type === "dimensions") handleDimensionsChange(change);
      });
    },
    [handlePositionChange, handleDimensionsChange],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setDragTargetPanelId(null);
      dragTargetRef.current = null;
      setUnparentCandidatePanelId(null);

      const nodeType = typeof draggedNode.type === "string" ? draggedNode.type : "";
      if (isEndpointType(nodeType)) return;
      if (!diagram) return;

      const r = resolveCanvasSnapshot(diagram);
      if (!canMoveNodeInSceneMode(diagram, draggedNode.id)) return;
      const components = r.components;
      const draggedAbsPos = draggedNode.parentId
        ? resolveAbsolutePosition(
            draggedNode.id,
            draggedNode.position,
            components,
            r.nodeLayouts,
          )
        : draggedNode.position;
      const absX = draggedAbsPos.x;
      const absY = draggedAbsPos.y;

      const persistOtherSelectedNodes = () => {
        const otherSelectedNodes = nodes.filter(
          (node) =>
            node.selected &&
            node.id !== draggedNode.id &&
            !node.parentId,
        );

        for (const node of otherSelectedNodes) {
          const otherType = typeof node.type === "string" ? node.type : "";
          if (isEndpointType(otherType)) continue;
          if (!canMoveNodeInSceneMode(diagram, node.id)) continue;
          updateNodeLayout(node.id, node.position);
        }
      };
      const persistSelectedChildren = () => {
        const selectedChildren = nodes.filter(
          (node) =>
            node.selected &&
            node.id !== draggedNode.id &&
            !!node.parentId,
        );

        for (const childNode of selectedChildren) {
          const childType = typeof childNode.type === "string" ? childNode.type : "";
          if (isEndpointType(childType)) continue;
          if (!canMoveNodeInSceneMode(diagram, childNode.id)) continue;
          updateNodeLayout(childNode.id, childNode.position);
        }
      };

      const isDraggedPanel = isReactFlowParentPanelType(nodeType);

      if (isDraggedPanel) {
        const descendantIds = getDescendantIds(draggedNode.id, components);
        const match = findPanelContainingPoint(
          nodes,
          absX,
          absY,
          undefined,
          r.nodeLayouts,
          components,
        );
        if (match && descendantIds.has(match.id)) {
          if (draggedNode.parentId) {
            commitNodeDrag(draggedNode.id, draggedNode.parentId, draggedNode.position);
          } else {
            commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
          }
          persistOtherSelectedNodes();
          persistSelectedChildren();
          return;
        }
      }

      const parent = draggedNode.parentId
        ? nodes.find((n) => n.id === draggedNode.parentId)
        : null;

      if (parent) {
        // Node already has a parent — check if it dragged outside
        const outside = isOutsideParentBounds(draggedNode.position, parent);
        if (outside) {
          // Unparent: convert relative → absolute and commit atomically
          commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
        } else {
          // Node remains parented — commit relative position atomically
          commitNodeDrag(draggedNode.id, draggedNode.parentId, draggedNode.position);
        }
        persistOtherSelectedNodes();
        persistSelectedChildren();
        return;
      }

      // Node has no parent — check if dropped onto a panel
      const match = findPanelContainingPoint(
        nodes,
        absX,
        absY,
        undefined,
        r.nodeLayouts,
        components,
      );
      if (match) {
        const matchAbsPos = resolveAbsolutePosition(
          match.id,
          match.position,
          components,
          r.nodeLayouts,
        );

        const relPos = {
          x: absX - matchAbsPos.x,
          y: absY - matchAbsPos.y,
        };
        commitNodeDrag(draggedNode.id, match.id, relPos);
      } else {
        // Plain move — no parent change, just commit the position with history
        commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
      }

      persistOtherSelectedNodes();
      persistSelectedChildren();
    },
    [diagram, nodes, commitNodeDrag, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, onNodesChange, onNodeDragStop };
}

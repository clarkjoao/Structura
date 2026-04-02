import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import {
  isNoteComponent,
  isEndpointComponent,
  isEndpointType,
  isReactFlowParentPanelType,
  buildChildrenIndex,
  getDescendantIdsFromIndex,
  isAncestorLocked,
} from "@/features/diagram";
import {
  isOutsideParentBounds,
  findPanelContainingPoint,
  resolveAbsolutePosition,
} from "../models/panelParenting";
import { getCachedCanvasSnapshot, canMoveNodeInSceneMode } from "@/features/diagram";
import { toast } from "sonner";
import i18n from "@/infrastructure/i18n";

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
   * Track node ids that are currently dragging and ids with a pending drag-stop
   * position event. This keeps keyboard nudges (dragging=false without prior
   * dragging=true) persisted while still skipping the redundant drag-stop write.
   */
  const draggingNodeIdsRef = useRef(new Set<string>());
  const dragStopPendingNodeIdsRef = useRef(new Set<string>());
  const lockToastShownRef = useRef(false);
  const lockToastTimeoutRef = useRef<number | null>(null);

  const handlePositionChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "position" || !change.position) return;
      if (!diagram) return;

      const r = getCachedCanvasSnapshot(diagram);
      const comp = r.components[change.id];
      if (comp && isEndpointComponent(comp)) return;

      if (!change.dragging) {
        // ReactFlow fires dragging=false immediately before onNodeDragStop.
        // If a drag-stop is incoming, skip this write — onNodeDragStop will
        // handle the final position atomically via commitNodeDrag.
        if (dragStopPendingNodeIdsRef.current.has(change.id)) {
          dragStopPendingNodeIdsRef.current.delete(change.id);
          return;
        }

        if (!canMoveNodeInSceneMode(diagram, change.id)) {
          toast.error(i18n.t("scenes.baseMoveBlocked"));
          return;
        }
        if (comp && (comp.locked === true || isAncestorLocked(comp, r.components))) {
          if (!lockToastShownRef.current) {
            lockToastShownRef.current = true;
            toast.error(i18n.t("elementPanel.lockedDragBlocked"));
            if (lockToastTimeoutRef.current !== null) {
              window.clearTimeout(lockToastTimeoutRef.current);
            }
            lockToastTimeoutRef.current = window.setTimeout(() => {
              lockToastShownRef.current = false;
              lockToastTimeoutRef.current = null;
            }, 1500);
          }
          return;
        }
        updateNodeLayout(change.id, change.position);
        return;
      }

      if (!canMoveNodeInSceneMode(diagram, change.id)) {
        return;
      }

      if (comp && (comp.locked === true || isAncestorLocked(comp, r.components))) {
        if (!lockToastShownRef.current) {
          lockToastShownRef.current = true;
          toast.error(i18n.t("elementPanel.lockedDragBlocked"));
          if (lockToastTimeoutRef.current !== null) {
            window.clearTimeout(lockToastTimeoutRef.current);
          }
          lockToastTimeoutRef.current = window.setTimeout(() => {
            lockToastShownRef.current = false;
            lockToastTimeoutRef.current = null;
          }, 1500);
        }
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
      const r = getCachedCanvasSnapshot(diagram);
      const layout = r.nodeLayouts[change.id];
      if (layout) {
        updateNodeLayout(change.id, { x: layout.x, y: layout.y }, change.dimensions);
      }
    },
    [diagram, updateNodeLayout],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type !== "position") continue;
        if (!change.dragging && draggingNodeIdsRef.current.has(change.id)) {
          dragStopPendingNodeIdsRef.current.add(change.id);
        }
      }

      changes.forEach((change) => {
        if (change.type === "position") handlePositionChange(change);
        if (change.type === "dimensions") handleDimensionsChange(change);
      });

      for (const change of changes) {
        if (change.type !== "position") continue;
        if (change.dragging) {
          draggingNodeIdsRef.current.add(change.id);
        } else {
          draggingNodeIdsRef.current.delete(change.id);
        }
      }
    },
    [handlePositionChange, handleDimensionsChange],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setDragTargetPanelId(null);
      dragTargetRef.current = null;
      setUnparentCandidatePanelId(null);

      const nodeType = typeof draggedNode.type === "string" ? draggedNode.type : "";
      draggingNodeIdsRef.current.delete(draggedNode.id);
      dragStopPendingNodeIdsRef.current.delete(draggedNode.id);
      if (isEndpointType(nodeType)) return;
      if (!diagram) return;

      const r = getCachedCanvasSnapshot(diagram);
      if (!canMoveNodeInSceneMode(diagram, draggedNode.id)) return;
      const draggedComponent = r.components[draggedNode.id];
      if (
        draggedComponent &&
        (draggedComponent.locked === true || isAncestorLocked(draggedComponent, r.components))
      ) {
        return;
      }
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
          const otherComponent = components[node.id];
          if (otherComponent && (otherComponent.locked === true || isAncestorLocked(otherComponent, components))) {
            continue;
          }
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
          const childComponent = components[childNode.id];
          if (childComponent && (childComponent.locked === true || isAncestorLocked(childComponent, components))) {
            continue;
          }
          updateNodeLayout(childNode.id, childNode.position);
        }
      };

      const isDraggedPanel = isReactFlowParentPanelType(nodeType);

      if (isDraggedPanel) {
        const childrenIndex = buildChildrenIndex(components);
        const descendantIds = getDescendantIdsFromIndex(
          draggedNode.id,
          childrenIndex,
        );
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

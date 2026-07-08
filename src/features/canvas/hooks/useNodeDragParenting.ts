import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, OnNodesChange, NodeChange } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
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
  resolveAbsolutePositionFromNodes,
  getPanelDimensions,
} from "../models/panelParenting";
import { getCachedCanvasSnapshot, canMoveNodeInSceneMode } from "@/features/diagram";
import { getNodeType } from "../utils/node-type-utils";
import { toast } from "sonner";
import i18n from "@/infrastructure/i18n";

interface UseNodeDragParentingParams {
  diagram: Diagram | DiagramModel | null | undefined;
  nodes: Node[];
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;

  commitNodeDrag: (
    nodeId: string,
    newParentId: string | null,
    newPosition: { x: number; y: number },
  ) => void;

  batchCommitNodeDrag: (
    entries: Array<{
      nodeId: string;
      newParentId: string | null;
      newPosition: { x: number; y: number };
    }>,
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
  batchCommitNodeDrag,
}: UseNodeDragParentingParams): UseNodeDragParentingResult {
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(null);
  const [unparentCandidatePanelId, setUnparentCandidatePanelId] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  const draggingNodeIdsRef = useRef(new Set<string>());
  const dragStopPendingNodeIdsRef = useRef(new Set<string>());
  const lockToastShownRef = useRef(false);
  const lockToastTimeoutRef = useRef<number | null>(null);

  const dragTargetRafRef = useRef<number | null>(null);

  const pendingLayoutUpdatesRef = useRef(new Map<string, { width: number; height: number }>());
  const layoutUpdateRafRef = useRef<number | null>(null);

  const flushPendingLayoutUpdates = useCallback(() => {
    layoutUpdateRafRef.current = null;
    if (!diagramRef.current) return;
    const pending = pendingLayoutUpdatesRef.current;
    if (pending.size === 0) return;
    const snapshot = getCachedCanvasSnapshot(diagramRef.current);
    const copy = new Map(pending);
    pending.clear();
    for (const [elementId, dimensions] of copy) {
      const layout = snapshot.nodeLayouts[elementId];
      if (!layout) continue;
      updateNodeLayout(elementId, { x: layout.x, y: layout.y }, dimensions);
    }
  }, [updateNodeLayout]);

  useEffect(
    () => () => {
      if (layoutUpdateRafRef.current !== null) {
        cancelAnimationFrame(layoutUpdateRafRef.current);
        layoutUpdateRafRef.current = null;
      }
      flushPendingLayoutUpdates();
    },
    [flushPendingLayoutUpdates],
  );

  /**
   * Flush dimension batches on pointer release so the store catches up before
   * `useLocalNodes` merges — avoids one frame where local resize was released
   * but Zustand still had the previous width/height.
   */
  useEffect(() => {
    const onPointerUp = () => {
      if (layoutUpdateRafRef.current !== null) {
        cancelAnimationFrame(layoutUpdateRafRef.current);
        layoutUpdateRafRef.current = null;
      }
      flushPendingLayoutUpdates();
    };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [flushPendingLayoutUpdates]);

  const handlePositionChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "position" || !change.position) return;
      const activeDiagram = diagramRef.current;
      if (!activeDiagram) return;

      const r = getCachedCanvasSnapshot(activeDiagram);
      const comp = r.components[change.id];
      if (comp && isEndpointComponent(comp)) return;

      if (change.dragging && comp?.parentId && draggingNodeIdsRef.current.has(comp.parentId)) {
        return;
      }

      if (!change.dragging) {
        if (dragStopPendingNodeIdsRef.current.has(change.id)) {
          dragStopPendingNodeIdsRef.current.delete(change.id);
          return;
        }

        if (!canMoveNodeInSceneMode(activeDiagram, change.id)) {
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

      if (!canMoveNodeInSceneMode(activeDiagram, change.id)) {
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
        const parentAbsPos = resolveAbsolutePositionFromNodes(comp.parentId, nodes);
        absX = parentAbsPos.x + change.position.x;
        absY = parentAbsPos.y + change.position.y;

        const parentNode = nodes.find((n) => n.id === comp.parentId);

        const childNode = nodes.find((n) => n.id === change.id);
        const childDims = childNode ? getPanelDimensions(childNode) : undefined;
        const outside = parentNode
          ? isOutsideParentBounds(change.position, parentNode, childDims)
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

        if (dragTargetRafRef.current !== null) {
          cancelAnimationFrame(dragTargetRafRef.current);
        }
        dragTargetRafRef.current = requestAnimationFrame(() => {
          setDragTargetPanelId(newTarget);
          dragTargetRafRef.current = null;
        });
      }
    },
    [nodes, updateNodeLayout],
  );

  const handleDimensionsChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "dimensions" || !change.dimensions) return;
      const activeDiagram = diagramRef.current;
      if (!activeDiagram) return;
      if (!canMoveNodeInSceneMode(activeDiagram, change.id)) {
        toast.error(i18n.t("scenes.baseMoveBlocked"));
        return;
      }
      const r = getCachedCanvasSnapshot(activeDiagram);
      const layout = r.nodeLayouts[change.id];
      if (!layout) return;
      pendingLayoutUpdatesRef.current.set(change.id, change.dimensions);
      if (layoutUpdateRafRef.current === null) {
        layoutUpdateRafRef.current = requestAnimationFrame(() => {
          flushPendingLayoutUpdates();
        });
      }
    },
    [flushPendingLayoutUpdates],
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
      if (dragTargetRafRef.current !== null) {
        cancelAnimationFrame(dragTargetRafRef.current);
        dragTargetRafRef.current = null;
      }
      setDragTargetPanelId(null);
      dragTargetRef.current = null;
      setUnparentCandidatePanelId(null);

      const nodeType = getNodeType(draggedNode);
      draggingNodeIdsRef.current.delete(draggedNode.id);
      dragStopPendingNodeIdsRef.current.delete(draggedNode.id);
      if (isEndpointType(nodeType)) return;
      const activeDiagram = diagramRef.current;
      if (!activeDiagram) return;

      const r = getCachedCanvasSnapshot(activeDiagram);
      if (!canMoveNodeInSceneMode(activeDiagram, draggedNode.id)) return;
      const draggedComponent = r.components[draggedNode.id];
      if (
        draggedComponent &&
        (draggedComponent.locked === true || isAncestorLocked(draggedComponent, r.components))
      ) {
        return;
      }
      const components = r.components;

      const draggedAbsPos = draggedNode.parentId
        ? resolveAbsolutePositionFromNodes(draggedNode.id, nodes)
        : draggedNode.position;
      const absX = draggedAbsPos.x;
      const absY = draggedAbsPos.y;

      const commitSelectedNodesDrag = () => {
        const entries: Array<{
          nodeId: string;
          newParentId: string | null;
          newPosition: { x: number; y: number };
        }> = [];

        const otherSelected = nodes.filter(
          (node) =>
            node.selected && node.id !== draggedNode.id && !isEndpointType(getNodeType(node)),
        );

        for (const node of otherSelected) {
          if (!canMoveNodeInSceneMode(activeDiagram, node.id)) continue;
          const nodeComp = components[node.id];
          if (nodeComp && (nodeComp.locked === true || isAncestorLocked(nodeComp, components)))
            continue;

          const nodeAbsPos = node.parentId
            ? resolveAbsolutePositionFromNodes(node.id, nodes)
            : node.position;

          if (node.parentId) {
            const parentNode = nodes.find((n) => n.id === node.parentId);

            const childDims = getPanelDimensions(node);
            const outside = parentNode
              ? isOutsideParentBounds(node.position, parentNode, childDims)
              : false;
            if (outside) {
              entries.push({
                nodeId: node.id,
                newParentId: null,
                newPosition: { x: nodeAbsPos.x, y: nodeAbsPos.y },
              });
              continue;
            }
          }

          const match = findPanelContainingPoint(
            nodes,
            nodeAbsPos.x,
            nodeAbsPos.y,
            node.parentId,
            r.nodeLayouts,
            components,
          );

          if (match && match.id !== node.parentId) {
            const matchAbsPos = resolveAbsolutePosition(
              match.id,
              match.position,
              components,
              r.nodeLayouts,
            );
            entries.push({
              nodeId: node.id,
              newParentId: match.id,
              newPosition: { x: nodeAbsPos.x - matchAbsPos.x, y: nodeAbsPos.y - matchAbsPos.y },
            });
          } else {
            updateNodeLayout(node.id, node.position);
          }
        }

        if (entries.length > 0) {
          batchCommitNodeDrag(entries);
        }
      };

      const isDraggedPanel = isReactFlowParentPanelType(nodeType);

      if (isDraggedPanel) {
        const childrenIndex = buildChildrenIndex(components);
        const descendantIds = getDescendantIdsFromIndex(draggedNode.id, childrenIndex);
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
            commitNodeDrag(draggedNode.id, draggedNode.parentId ?? null, draggedNode.position);
          } else {
            commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
          }
          commitSelectedNodesDrag();
          return;
        }
      }

      const parent = draggedNode.parentId ? nodes.find((n) => n.id === draggedNode.parentId) : null;

      if (parent) {
        const draggedDims = {
          width: draggedNode.measured?.width ?? 0,
          height: draggedNode.measured?.height ?? 0,
        };
        const outside = isOutsideParentBounds(draggedNode.position, parent, draggedDims);
        if (outside) {
          commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
        } else {
          commitNodeDrag(draggedNode.id, draggedNode.parentId ?? null, draggedNode.position);
        }
        commitSelectedNodesDrag();
        return;
      }

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
        commitNodeDrag(draggedNode.id, null, { x: absX, y: absY });
      }

      commitSelectedNodesDrag();
    },
    [nodes, commitNodeDrag, batchCommitNodeDrag, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, onNodesChange, onNodeDragStop };
}

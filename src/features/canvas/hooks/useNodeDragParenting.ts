import { useCallback, useRef, useState } from "react";
import type { Node, OnNodesChange, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import type { Component } from "@/features/diagram";
import {
  isPanelComponent,
  isNoteComponent,
  isEndpointComponent,
  isEndpointType,
  isReactFlowParentPanelType,
} from "@/features/diagram";
import {
  isOutsideParentBounds,
  findPanelContainingPoint,
  toAbsolutePosition,
} from "../models/panelParenting";
import { resolveSceneSnapshot, canMoveNodeInSceneMode } from "@/features/diagram";
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

  const handlePositionChange = useCallback(
    (change: NodeChange) => {
      if (change.type !== "position" || !change.position) return;
      if (!diagram) return;

      const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      const comp = r.components[change.id];
      if (comp && isEndpointComponent(comp)) return;

      if (!change.dragging) {
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
      if (isPanelComponent(comp)) {
        const hasChildren = Object.values(r.components).some((c) => c.parentId === comp.id);
        if (hasChildren) return;
      }

      let absX = change.position.x;
      let absY = change.position.y;

      if (comp.parentId) {
        const parentNode = nodes.find((n) => n.id === comp.parentId);
        const outside = parentNode
          ? isOutsideParentBounds(change.position, parentNode)
          : false;
        setUnparentCandidatePanelId(outside ? comp.parentId : null);

        const parentLayout = comp.parentId ? r.nodeLayouts[comp.parentId] : undefined;
        if (parentLayout) {
          const abs = toAbsolutePosition(change.position, parentLayout);
          absX = abs.x;
          absY = abs.y;
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
      if (!diagram) return;
      if (!canMoveNodeInSceneMode(diagram, change.id)) {
        toast.error(i18n.t("scenes.baseMoveBlocked"));
        return;
      }
      const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      const layout = r.nodeLayouts[change.id];
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
      const nodeType = typeof draggedNode.type === "string" ? draggedNode.type : "";
      if (isEndpointType(nodeType)) return;

      if (!diagram) return;
      const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      if (!canMoveNodeInSceneMode(diagram, draggedNode.id)) {
        return;
      }
      const components = r.components;
      const isDraggedPanel = isReactFlowParentPanelType(nodeType);
      if (isDraggedPanel) {
        const descendantIds = getDescendantIds(draggedNode.id, components);
        const match = findPanelContainingPoint(nodes, draggedNode.position.x, draggedNode.position.y);
        if (match && descendantIds.has(match.id)) return;
      }

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
        updateNodeLayout(draggedNode.id, {
          x: draggedNode.position.x - match.position.x,
          y: draggedNode.position.y - match.position.y,
        });
      }
    },
    [diagram, nodes, setParent, updateNodeLayout],
  );

  return { dragTargetPanelId, unparentCandidatePanelId, onNodesChange, onNodeDragStop };
}

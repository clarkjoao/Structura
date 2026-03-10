import { useCallback, useRef, useState } from "react";
import type { ReactFlowInstance, Node } from "@xyflow/react";
import { SelectionMode } from "@xyflow/react";

interface UseDragSelectParams {
  reactFlowInstance: ReactFlowInstance;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  selectionMode?: SelectionMode;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  isRecording?: boolean;
}

interface SelectionRect {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useDragSelect({
  reactFlowInstance,
  wrapperRef,
  selectionMode = SelectionMode.Partial,
  setSelectedNodeIds,
  setSelectedNodeId,
  setSelectedEdgeId,
  isRecording,
}: UseDragSelectParams) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isRecording) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      const pane = target.closest(".react-flow__pane");
      const isOnNode = !!target.closest(".react-flow__node");
      const isOnEdge = !!target.closest(".react-flow__edge");
      const isOnHandle = !!target.closest(".react-flow__handle");
      const isOnControls = !!target.closest(".react-flow__controls");
      const isOnPanel = !!target.closest(".react-flow__panel");

      if (!pane || isOnNode || isOnEdge || isOnHandle || isOnControls || isOnPanel) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      dragging.current = false;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [wrapperRef, isRecording],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const dx = curX - startPos.current.x;
      const dy = curY - startPos.current.y;
      if (!dragging.current && Math.hypot(dx, dy) < 3) return;
      dragging.current = true;

      const newRect: SelectionRect = {
        startX: startPos.current.x,
        startY: startPos.current.y,
        x: Math.min(startPos.current.x, curX),
        y: Math.min(startPos.current.y, curY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      setSelectionRect(newRect);

      const flowBounds = { x: newRect.x, y: newRect.y, width: newRect.width, height: newRect.height };
      const topLeft = reactFlowInstance.screenToFlowPosition({ x: flowBounds.x + rect.left, y: flowBounds.y + rect.top });
      const bottomRight = reactFlowInstance.screenToFlowPosition({ x: flowBounds.x + flowBounds.width + rect.left, y: flowBounds.y + flowBounds.height + rect.top });

      const selBox = { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
      const nodes = reactFlowInstance.getNodes();

      const selected = nodes.filter((n: Node) => {
        if (n.hidden) return false;
        const nw = (n.measured?.width ?? n.style?.width as number) ?? 180;
        const nh = (n.measured?.height ?? n.style?.height as number) ?? 80;
        let nx = n.position.x;
        let ny = n.position.y;
        if (n.parentId) {
          const parent = nodes.find((p: Node) => p.id === n.parentId);
          if (parent) { nx += parent.position.x; ny += parent.position.y; }
        }
        if (selectionMode === SelectionMode.Partial) {
          return nx + nw > selBox.x && nx < selBox.x + selBox.width && ny + nh > selBox.y && ny < selBox.y + selBox.height;
        }
        return nx >= selBox.x && ny >= selBox.y && nx + nw <= selBox.x + selBox.width && ny + nh <= selBox.y + selBox.height;
      });

      const ids = new Set(selected.map((n: Node) => n.id));
      setSelectedNodeIds(ids);
      setSelectedNodeId(selected[0]?.id ?? null);
      setSelectedEdgeId(null);
    },
    [reactFlowInstance, wrapperRef, selectionMode, setSelectedNodeIds, setSelectedNodeId, setSelectedEdgeId],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const hadCapture = (e.currentTarget as Element).hasPointerCapture(e.pointerId);
      if (hadCapture) {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      }
      if (!dragging.current) {
        if (hadCapture) {
          setSelectedNodeIds(new Set());
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
        setSelectionRect(null);
        return;
      }
      dragging.current = false;
      setSelectionRect(null);
    },
    [setSelectedNodeIds, setSelectedNodeId, setSelectedEdgeId],
  );

  return { selectionRect, onPointerDown, onPointerMove, onPointerUp };
}

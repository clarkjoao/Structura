/**
 * Shared drag state for draw.io drag-selection parity.
 * When user starts dragging an unselected node while others are selected,
 * we track the selection before the drag so we can merge it later.
 */

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { canMoveNodeInSceneMode } from "@/features/diagram";

/** Minimum drag distance in pixels before drag is considered intentional (draw.io parity). */
const DRAG_THRESHOLD_PX = 3;

/** Refs shared between useLocalNodes and the event handlers for drag-selection parity. */
export const dragSelectionRef = {
  /** Set when a drag gesture starts on an unselected node. */
  selectedBeforeDrag: new Set<string>(),
  /** Set when a drag is in progress. */
  isDragging: false,
};

function filterNodeChangesForSceneMoveLock(
  diagram: Diagram | DiagramModel | null | undefined,
  changes: NodeChange[],
): NodeChange[] {
  if (!diagram) return changes;
  return changes.filter((c) => {
    if (c.type === "position" || c.type === "dimensions") {
      return canMoveNodeInSceneMode(diagram, c.id);
    }
    return true;
  });
}

function isUndoRedoTransition(
  prevDiagram: Diagram | DiagramModel | null | undefined,
  nextDiagram: Diagram | DiagramModel | null | undefined,
): boolean {
  if (!prevDiagram || !nextDiagram) return false;
  if (prevDiagram.id !== nextDiagram.id) return false;
  return prevDiagram.nodeLayouts !== nextDiagram.nodeLayouts;
}

export function useLocalNodes(
  storeNodes: Node[],
  innerOnNodesChange: OnNodesChange,
  localNodesRef: MutableRefObject<Node[]>,
  onSelectionFromChanges?: (selectedIds: string[]) => void,
  diagram?: Diagram | DiagramModel | null,
) {
  const [, setTick] = useState(0);

  /** Tracks drag start positions to enforce minimum drag threshold. */
  const dragStartPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  /** Tracks whether a drag has exceeded the threshold and should be allowed. */
  const dragConfirmedRef = useRef(new Set<string>());
  const draggingNodeIdsRef = useRef(new Set<string>());
  /** While true, NodeResizer updates dimensions in local state before the store catches up — keep local style/size. */
  const resizingNodeIdsRef = useRef(new Set<string>());
  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  const prevDiagramRef = useRef<Diagram | DiagramModel | null | undefined>(undefined);
  /** Detects active diagram switch — must reset locals even when `storeNodes` keeps the same ref (e.g. EMPTY_CANVAS_NODE_LIST). */
  const prevActiveDiagramIdRef = useRef<string | null>(null);
  /** Merged local nodes — held in a ref, not state, so the merge below never schedules a render. */
  const localNodesStateRef = useRef<Node[]>([]);

  const activeDiagramId = diagram?.id ?? null;

  // Derived state, computed during render on purpose. In a layout effect the merge would only land
  // in the refs *after* this render returned, so React Flow would paint the previous nodes — with
  // `selected` now sourced from the store that means the previous selection ring and dim. Ticking a
  // re-render from the effect to compensate is not an option either: `selected` flows store ->
  // local nodes -> React Flow's internal selection -> onSelectionChange -> store, and re-rendering
  // from inside that ring turns any disagreement into "Maximum update depth exceeded". No setState
  // here, so nothing to warn about; the guards below make it idempotent per `storeNodes` identity.
  {
    if (activeDiagramId !== prevActiveDiagramIdRef.current) {
      prevActiveDiagramIdRef.current = activeDiagramId;
      draggingNodeIdsRef.current.clear();
      dragConfirmedRef.current.clear();
      dragStartPositionsRef.current.clear();
      resizingNodeIdsRef.current.clear();
      dragSelectionRef.selectedBeforeDrag.clear();
      dragSelectionRef.isDragging = false;
      localNodesStateRef.current = storeNodes;
      localNodesRef.current = storeNodes;
      prevStoreNodesRef.current = storeNodes;
      prevDiagramRef.current = diagram;
    } else if (storeNodes !== prevStoreNodesRef.current) {
      prevStoreNodesRef.current = storeNodes;

      const undoRedo = isUndoRedoTransition(prevDiagramRef.current, diagram);
      prevDiagramRef.current = diagram;

      const prev = localNodesStateRef.current;

      if (prev.length === 0 || undoRedo) {
        localNodesStateRef.current = storeNodes;
        localNodesRef.current = storeNodes;
      } else if (prev.length !== storeNodes.length) {
        const localMap = new Map(prev.map((n) => [n.id, n]));
        const merged = storeNodes.map((sn) => {
          const ln = localMap.get(sn.id);
          if (!ln) return sn;
          const useRemotePosition =
            sn.parentId !== ln.parentId || !draggingNodeIdsRef.current.has(sn.id);
          const keepLocalDimensions = resizingNodeIdsRef.current.has(sn.id);
          return {
            ...ln,
            data: sn.data,
            style: keepLocalDimensions ? ln.style : sn.style,
            width: keepLocalDimensions ? ln.width : sn.width,
            height: keepLocalDimensions ? ln.height : sn.height,
            hidden: sn.hidden,
            draggable: sn.draggable,
            selectable: sn.selectable,
            focusable: sn.focusable,
            className: sn.className,
            dragHandle: sn.dragHandle,
            zIndex: sn.zIndex,
            connectable: sn.connectable,
            selected: sn.selected,
            type: sn.type,
            position: useRemotePosition ? sn.position : ln.position,
            parentId: sn.parentId,
            extent: sn.extent,
          };
        });
        localNodesStateRef.current = merged;
        localNodesRef.current = merged;
      } else {
        const localMap = new Map(prev.map((n) => [n.id, n]));
        let anyChanged = false;
        const merged = storeNodes.map((sn) => {
          const ln = localMap.get(sn.id);
          if (!ln) {
            anyChanged = true;
            return sn;
          }

          const useRemotePosition =
            sn.parentId !== ln.parentId || !draggingNodeIdsRef.current.has(sn.id);

          const positionToUse = useRemotePosition ? sn.position : ln.position;
          const keepLocalDimensions = resizingNodeIdsRef.current.has(sn.id);
          const styleToUse = keepLocalDimensions ? ln.style : sn.style;
          const widthToUse = keepLocalDimensions ? ln.width : sn.width;
          const heightToUse = keepLocalDimensions ? ln.height : sn.height;

          if (
            ln.data === sn.data &&
            ln.style === styleToUse &&
            ln.width === widthToUse &&
            ln.height === heightToUse &&
            ln.hidden === sn.hidden &&
            ln.draggable === sn.draggable &&
            ln.selectable === sn.selectable &&
            ln.focusable === sn.focusable &&
            ln.className === sn.className &&
            ln.dragHandle === sn.dragHandle &&
            ln.zIndex === sn.zIndex &&
            ln.connectable === sn.connectable &&
            ln.selected === sn.selected &&
            ln.type === sn.type &&
            ln.position === positionToUse &&
            ln.parentId === sn.parentId &&
            ln.extent === sn.extent
          ) {
            return ln;
          }

          anyChanged = true;
          return {
            ...ln,
            data: sn.data,
            style: styleToUse,
            width: widthToUse,
            height: heightToUse,
            hidden: sn.hidden,
            draggable: sn.draggable,
            selectable: sn.selectable,
            focusable: sn.focusable,
            className: sn.className,
            dragHandle: sn.dragHandle,
            zIndex: sn.zIndex,
            connectable: sn.connectable,
            selected: sn.selected,
            type: sn.type,
            position: positionToUse,
            parentId: sn.parentId,
            extent: sn.extent,
          };
        });

        if (anyChanged) {
          localNodesStateRef.current = merged;
          localNodesRef.current = merged;
        }
      }
    }
  }

  /**
   * Enforce drag threshold: after pointerup, if total drag distance is less than threshold,
   * snap the node back to its original position.
   */
  useEffect(() => {
    const handlePointerUp = () => {
      const unconfirmedDrags = Array.from(dragStartPositionsRef.current.entries());
      if (unconfirmedDrags.length === 0) return;

      // These nodes didn't pass the threshold — snap back to start position
      for (const [nodeId, startPos] of unconfirmedDrags) {
        const nodeIndex = localNodesStateRef.current.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) continue;

        const node = localNodesStateRef.current[nodeIndex];
        if (node.position.x === startPos.x && node.position.y === startPos.y) {
          // Already at start position
          continue;
        }

        // Update local state with snap-back position
        const updated = [...localNodesStateRef.current];
        updated[nodeIndex] = { ...node, position: startPos };
        localNodesStateRef.current = updated;
        localNodesRef.current = updated;

        // Trigger re-render
        setTick((tick) => tick + 1);
      }

      // Clear tracking refs
      dragStartPositionsRef.current.clear();
      dragConfirmedRef.current.clear();
      draggingNodeIdsRef.current.clear();
      dragSelectionRef.selectedBeforeDrag.clear();
      dragSelectionRef.isDragging = false;
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  /**
   * If React Flow omits `resizing: false` on the last dimensions event, clear the
   * override set after the gesture so merges use the store again (double rAF: after
   * RF internal updates + parenting layout flush on pointerup).
   */
  useEffect(() => {
    const endResizeGestureFallback = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (resizingNodeIdsRef.current.size === 0) return;
          resizingNodeIdsRef.current.clear();
          setTick((tick) => tick + 1);
        });
      });
    };
    window.addEventListener("pointerup", endResizeGestureFallback);
    window.addEventListener("pointercancel", endResizeGestureFallback);
    return () => {
      window.removeEventListener("pointerup", endResizeGestureFallback);
      window.removeEventListener("pointercancel", endResizeGestureFallback);
    };
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!changes.length) return;

      // Process position changes to enforce drag threshold
      const positionChanges = changes.filter((c) => c.type === "position");
      for (const change of positionChanges) {
        if (change.type !== "position") continue;

        if (change.dragging && !dragConfirmedRef.current.has(change.id)) {
          // Drag is starting — record the start position from local state
          const node = localNodesStateRef.current.find((n) => n.id === change.id);
          if (node && !dragStartPositionsRef.current.has(change.id)) {
            dragStartPositionsRef.current.set(change.id, {
              x: node.position.x,
              y: node.position.y,
            });
          }

          // Draw.io parity: if this node is not selected but others are,
          // track the selection before drag so we can merge it later
          if (!node?.selected && dragSelectionRef.selectedBeforeDrag.size === 0 && !dragSelectionRef.isDragging) {
            const currentSelected = localNodesStateRef.current.filter((n) => n.selected).map((n) => n.id);
            if (currentSelected.length > 0) {
              dragSelectionRef.selectedBeforeDrag = new Set(currentSelected);
              dragSelectionRef.isDragging = true;
            }
          }
        } else if (change.position && !dragConfirmedRef.current.has(change.id)) {
          // Position update before drag is confirmed — check threshold
          const startPos = dragStartPositionsRef.current.get(change.id);
          if (startPos) {
            const dx = Math.abs(change.position.x - startPos.x);
            const dy = Math.abs(change.position.y - startPos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance >= DRAG_THRESHOLD_PX) {
              // Drag confirmed — mark as confirmed and clear start position
              dragConfirmedRef.current.add(change.id);
              dragStartPositionsRef.current.delete(change.id);
            }
          }
        }

        if (!change.dragging) {
          // Drag ended — check if it passed the threshold
          const startPos = dragStartPositionsRef.current.get(change.id);
          const node = localNodesStateRef.current.find((n) => n.id === change.id);

          if (startPos && node && !dragConfirmedRef.current.has(change.id)) {
            // Drag didn't pass threshold — snap back to start position
            const dx = Math.abs(node.position.x - startPos.x);
            const dy = Math.abs(node.position.y - startPos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < DRAG_THRESHOLD_PX) {
              // Snap back
              const nodeIndex = localNodesStateRef.current.findIndex((n) => n.id === change.id);
              if (nodeIndex !== -1) {
                const updated = [...localNodesStateRef.current];
                updated[nodeIndex] = { ...node, position: startPos };
                localNodesStateRef.current = updated;
                localNodesRef.current = updated;
                setTick((tick) => tick + 1);
              }
            }
          }

          // Reset tracking refs
          draggingNodeIdsRef.current.delete(change.id);
          dragConfirmedRef.current.delete(change.id);
          dragStartPositionsRef.current.delete(change.id);
          // Clear drag selection state on drag end
          if (!draggingNodeIdsRef.current.size) {
            dragSelectionRef.selectedBeforeDrag.clear();
            dragSelectionRef.isDragging = false;
          }
        } else {
          draggingNodeIdsRef.current.add(change.id);
        }
      }

      // Block position updates for nodes that haven't passed the drag threshold
      // Note: We still allow the position to update visually, but we track the start position
      // for potential snap-back on pointerup
      const filteredChanges = changes.map((change) => {
        if (change.type === "position" && change.dragging) {
          const wasAlreadyDragging = draggingNodeIdsRef.current.has(change.id);
          const isConfirmed = dragConfirmedRef.current.has(change.id) || wasAlreadyDragging;

          if (!isConfirmed) {
            // Node is trying to move but hasn't passed threshold yet
            // We don't block it visually here - the snap-back will happen on pointerup
          }
        }
        return change;
      });

      // Process dimension changes (resize)
      for (const change of filteredChanges) {
        if (change.type === "dimensions") {
          if (change.resizing === false) {
            resizingNodeIdsRef.current.delete(change.id);
          } else {
            resizingNodeIdsRef.current.add(change.id);
          }
        }
      }

      const sanitizedChanges = filteredChanges.map((change) => {
        if (change.type !== "replace") return change;
        const previousNode = localNodesRef.current.find((node) => node.id === change.item.id);
        const previousData = previousNode?.data as Record<string, unknown> | undefined;
        const nextData = change.item.data as Record<string, unknown> | undefined;
        if (!previousData || !nextData) return change;
        const templateId =
          typeof previousData.templateId === "string" ? previousData.templateId : undefined;
        if (!templateId) return change;
        const keys = new Set([...Object.keys(previousData), ...Object.keys(nextData)]);
        const changedAnyField = [...keys].some((key) => {
          if (key === "templateId") return false;
          return previousData[key] !== nextData[key];
        });
        if (!changedAnyField) return change;
        const nextItemData = { ...nextData };
        delete nextItemData.templateId;
        return {
          ...change,
          item: {
            ...change.item,
            data: nextItemData,
          },
        };
      });
      const hasSelect = filteredChanges.some((c) => c.type === "select");
      innerOnNodesChange(sanitizedChanges);
      const forApply = filterNodeChangesForSceneMoveLock(diagram, sanitizedChanges);

      const updated = applyNodeChanges(forApply, localNodesStateRef.current);
      localNodesStateRef.current = updated;
      localNodesRef.current = updated;

      if (hasSelect && onSelectionFromChanges) {
        const selectedIds = updated.filter((n) => n.selected).map((n) => n.id);
        onSelectionFromChanges(selectedIds);
      }

      setTick((tick) => tick + 1);
    },
    [diagram, innerOnNodesChange, localNodesRef, onSelectionFromChanges],
  );

  return { nodes: localNodesStateRef.current, onNodesChange };
}

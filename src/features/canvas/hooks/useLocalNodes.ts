/**
 * Shared drag state for the pointer funnel.
 *
 * `selectedBeforeDrag` is consulted by `useCanvasEventHandlers.onSelectionChange`
 * to merge a node that was dragged while unselected with the prior selection
 * (decision #3 — drag unselected replaces; we keep the prior set visible until
 * React Flow raises the next selection event). The funnel populates this on
 * pointerdown of an unselected node.
 *
 * The drag-threshold gate that used to live here compared `change.position`,
 * which `snapGrid=[15,15]` had already quantised — so the distance was always
 * 0 or ≥ 15 and the gate never fired. Phase 4 moves threshold measurement to
 * the raw pointer coordinate inside the funnel (`dragThreshold.ts`).
 */

import { useEffect, useRef, useState, useCallback, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { canMoveNodeInSceneMode } from "@/features/diagram";

/** Refs shared between useLocalNodes and the event handlers for drag-selection parity. */
export const dragSelectionRef = {
  /** Set when a drag gesture starts on an unselected node — funnel writes this on pointerdown. */
  selectedBeforeDrag: new Set<string>(),
  /** Set while a drag gesture is in progress; cleared on drag end. */
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
          const useRemotePosition = sn.parentId !== ln.parentId;
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

          const useRemotePosition = sn.parentId !== ln.parentId;

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
   * Drag threshold (Phase 4) moved to `selection/dragThreshold.ts` and the
   * pointer funnel — it must read raw pointer coordinates, BEFORE any snap.
   * The previous implementation here compared `change.position`, which is
   * already snapped to `snapGrid=[15,15]`, so the gate never fired. See the
   * header comment for the regression history.
   *
   * The remaining fallback below ensures stale `resizing` overrides clear if
   * React Flow omits `resizing: false` on the last dimensions event.
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

      // Phase 4: drag-threshold gate moved to `selection/pointerFunnel.ts`.
      // All we do here is capture the prior selection for the unselected-drag
      // merge (decision #3) so `onSelectionChange` can restore it.
      const positionChanges = changes.filter((c) => c.type === "position");
      for (const change of positionChanges) {
        if (change.type !== "position") continue;
        if (!change.dragging) continue;

        const node = localNodesStateRef.current.find((n) => n.id === change.id);
        if (!node) continue;
        if (node.selected) continue;
        if (dragSelectionRef.selectedBeforeDrag.size > 0) continue;
        if (dragSelectionRef.isDragging) continue;

        const currentSelected = localNodesStateRef.current
          .filter((n) => n.selected)
          .map((n) => n.id);
        if (currentSelected.length === 0) continue;
        dragSelectionRef.selectedBeforeDrag = new Set(currentSelected);
        dragSelectionRef.isDragging = true;
      }

      // Process dimension changes (resize)
      for (const change of changes) {
        if (change.type === "dimensions") {
          if (change.resizing === false) {
            resizingNodeIdsRef.current.delete(change.id);
          } else {
            resizingNodeIdsRef.current.add(change.id);
          }
        }
      }

      const sanitizedChanges = changes.map((change) => {
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
      const hasSelect = changes.some((c) => c.type === "select");
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

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { canMoveNodeInSceneMode } from "@/features/diagram";

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
      resizingNodeIdsRef.current.clear();
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

      for (const change of changes) {
        if (change.type === "position") {
          if (change.dragging) {
            draggingNodeIdsRef.current.add(change.id);
          } else {
            draggingNodeIdsRef.current.delete(change.id);
          }
        }
        // Match position/dragging: intermediate dimension events often omit `resizing`
        // (undefined). Only treat `resizing === false` as "resize ended" — otherwise we
        // would delete the id mid-gesture and merge stale store sizes over RF's live node.
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

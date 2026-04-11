import { useRef, useState, useCallback, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { canMoveNodeInSceneMode } from "@/features/diagram";

/** Drop position/dimension updates that the store rejects (e.g. base nodes in an active scene). */
function filterNodeChangesForSceneMoveLock(
  diagram: Diagram | null | undefined,
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

/**
 * Returns true when the diagram's nodeLayouts reference changed but the diagram id
 * did NOT change — this is the fingerprint of an undo/redo operation (Immer replaces
 * snapshot + nodeLayouts on the same Diagram object).
 */
function isUndoRedoTransition(
  prevDiagram: Diagram | null | undefined,
  nextDiagram: Diagram | null | undefined,
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
  diagram?: Diagram | null,
) {
  // Bumped by onNodesChange to re-render after user interactions (drag, select, resize).
  const [, setTick] = useState(0);

  const draggingNodeIdsRef = useRef(new Set<string>());
  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  const prevDiagramRef = useRef<Diagram | null | undefined>(undefined);
  /** Merged local nodes — ref-only to avoid setState during render (infinite update chains). */
  const localNodesStateRef = useRef<Node[]>([]);

  if (storeNodes !== prevStoreNodesRef.current) {
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
        return {
          ...ln,
          data: sn.data,
          style: sn.style,
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
          sn.parentId !== ln.parentId ||
          !draggingNodeIdsRef.current.has(sn.id);

        const positionToUse = useRemotePosition ? sn.position : ln.position;

        if (
          ln.data === sn.data &&
          ln.style === sn.style &&
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
          style: sn.style,
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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!changes.length) return;

      for (const change of changes) {
        if (change.type !== "position") continue;
        if (change.dragging) {
          draggingNodeIdsRef.current.add(change.id);
        } else {
          draggingNodeIdsRef.current.delete(change.id);
        }
      }

      const sanitizedChanges = changes.map((change) => {
        if (change.type !== "replace") return change;
        const previousNode = localNodesRef.current.find(
          (node) => node.id === change.item.id,
        );
        const previousData = previousNode?.data as Record<string, unknown> | undefined;
        const nextData = change.item.data as Record<string, unknown> | undefined;
        if (!previousData || !nextData) return change;
        const templateId =
          typeof previousData.templateId === "string"
            ? previousData.templateId
            : undefined;
        if (!templateId) return change;
        const keys = new Set([
          ...Object.keys(previousData),
          ...Object.keys(nextData),
        ]);
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
        const selectChangeCount = changes.filter((c) => c.type === "select").length;
        if (selectChangeCount >= 2) {
          const selectedIds = updated.filter((n) => n.selected).map((n) => n.id);
          onSelectionFromChanges(selectedIds);
        }
      }

      setTick((tick) => tick + 1);
    },
    [diagram, innerOnNodesChange, localNodesRef, onSelectionFromChanges],
  );

  return { nodes: localNodesStateRef.current, onNodesChange };
}

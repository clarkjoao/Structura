import { useRef, useState, useCallback, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type OnNodesChange } from "@xyflow/react";

/**
 * Manages local ReactFlow node state that stays in sync with store-derived nodes.
 *
 * When `storeNodes` changes (by reference), the hook merges new store data
 * (data, style, hidden, zIndex, etc.) onto existing local nodes so that
 * ReactFlow internals (measured dimensions, drag position) are preserved.
 *
 * Accepts a shared `localNodesRef` so callers that need the ref before this
 * hook runs (e.g. `useNodeDragParenting`) can create it upfront.
 *
 * When changes include multiple "select" changes (e.g. box selection), 
 * `onSelectionFromChanges` is called synchronously so the panel updates in the same tick.
 * Single-node toggles (Cmd+click) are left to onNodeClick/onSelectionChange to avoid overwriting.
 *
 * Returns the merged `nodes` array and an `onNodesChange` handler.
 */
export function useLocalNodes(
  storeNodes: Node[],
  innerOnNodesChange: OnNodesChange,
  localNodesRef: MutableRefObject<Node[]>,
  onSelectionFromChanges?: (selectedIds: string[]) => void,
) {
  const [localNodes, setLocalNodes] = useState<Node[]>([]);

  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  if (storeNodes !== prevStoreNodesRef.current) {
    prevStoreNodesRef.current = storeNodes;
    setLocalNodes((prev) => {
      if (prev.length === 0) {
        localNodesRef.current = storeNodes;
        return storeNodes;
      }
      const localMap = new Map(prev.map((n) => [n.id, n]));
      const merged = storeNodes.map((sn) => {
        const ln = localMap.get(sn.id);
        if (!ln) return sn;
        return {
          ...ln,
          data: sn.data,
          style: sn.style,
          hidden: sn.hidden,
          zIndex: sn.zIndex,
          connectable: sn.connectable,
          selected: sn.selected,
          type: sn.type,
          position: sn.parentId !== ln.parentId ? sn.position : ln.position,
          parentId: sn.parentId,
          extent: sn.extent,
        };
      });
      localNodesRef.current = merged;
      return merged;
    });
  }

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!changes.length) return;
      const hasSelect = changes.some((c) => c.type === "select");
      innerOnNodesChange(changes);
      setLocalNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        localNodesRef.current = updated;
        if (hasSelect && onSelectionFromChanges) {
          const selectChangeCount = changes.filter((c) => c.type === "select").length;
          if (selectChangeCount >= 2) {
            const selectedIds = updated.filter((n) => n.selected).map((n) => n.id);
            onSelectionFromChanges(selectedIds);
          }
        }
        return updated;
      });
    },
    [innerOnNodesChange, localNodesRef, onSelectionFromChanges],
  );

  return { nodes: localNodes, onNodesChange };
}

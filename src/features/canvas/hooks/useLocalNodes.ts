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
 * Returns the merged `nodes` array and an `onNodesChange` handler.
 */
export function useLocalNodes(
  storeNodes: Node[],
  innerOnNodesChange: OnNodesChange,
  localNodesRef: MutableRefObject<Node[]>,
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
      innerOnNodesChange(changes);
      setLocalNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        localNodesRef.current = updated;
        return updated;
      });
    },
    [innerOnNodesChange, localNodesRef],
  );

  return { nodes: localNodes, onNodesChange };
}

import { useRef, useState, useCallback, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { canMoveNodeInSceneMode } from "@/features/diagram";
import { remoteLayoutUpdates } from "@/features/collaboration/useYjsZustandBridge";

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
 *
 * When `diagram` is set, position/dimension changes blocked by {@link canMoveNodeInSceneMode}
 * are not applied to local nodes (the parenting hook still runs for toasts/side effects).
 */
export function useLocalNodes(
  storeNodes: Node[],
  innerOnNodesChange: OnNodesChange,
  localNodesRef: MutableRefObject<Node[]>,
  onSelectionFromChanges?: (selectedIds: string[]) => void,
  diagram?: Diagram | null,
) {
  const [localNodes, setLocalNodes] = useState<Node[]>([]);

  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  if (storeNodes !== prevStoreNodesRef.current) {
    prevStoreNodesRef.current = storeNodes;
    setLocalNodes((prev) => {
      if (prev.length === 0) {
        localNodesRef.current = storeNodes;
        remoteLayoutUpdates.clear();
        return storeNodes;
      }
      const localMap = new Map(prev.map((n) => [n.id, n]));
      const merged = storeNodes.map((sn) => {
        const ln = localMap.get(sn.id);
        if (!ln) return sn;

        const useRemotePosition =
          sn.parentId !== ln.parentId || remoteLayoutUpdates.has(sn.id);

        return {
          ...ln,
          data: sn.data,
          style: sn.style,
          hidden: sn.hidden,
          zIndex: sn.zIndex,
          connectable: sn.connectable,
          selected: sn.selected,
          type: sn.type,
          position: useRemotePosition ? sn.position : ln.position,
          parentId: sn.parentId,
          extent: sn.extent,
        };
      });
      remoteLayoutUpdates.clear();
      localNodesRef.current = merged;
      return merged;
    });
  }

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!changes.length) return;
      const hasSelect = changes.some((c) => c.type === "select");
      innerOnNodesChange(changes);
      const forApply = filterNodeChangesForSceneMoveLock(diagram, changes);
      setLocalNodes((nds) => {
        const updated = applyNodeChanges(forApply, nds);
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
    [diagram, innerOnNodesChange, localNodesRef, onSelectionFromChanges],
  );

  return { nodes: localNodes, onNodesChange };
}

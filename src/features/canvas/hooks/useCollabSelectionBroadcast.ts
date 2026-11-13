import { useEffect } from "react";
import { useCollab } from "@/features/collaboration";

/** Tells the collaboration session which element this user has selected (an edge before a node). */
export function useCollabSelectionBroadcast(
  selectedEdgeId: string | null,
  selectedNodeId: string | null,
): void {
  const { updateSelectedNode } = useCollab();
  const activeCollabElementId = selectedEdgeId ?? selectedNodeId;
  useEffect(() => {
    updateSelectedNode(activeCollabElementId);
  }, [activeCollabElementId, updateSelectedNode]);
}

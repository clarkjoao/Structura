import { useMemo } from "react";
import {
  type Diagram,
  getCachedCanvasSnapshot,
  resolveActiveScene,
  useActiveDiagram,
} from "@/features/diagram";
import { serializeDiagramContext } from "@/features/llm";

export interface DiagramContextResult {
  /** Full diagram serialization for the system prompt */
  diagramText: string;
  /** Currently selected node ids (may be empty) */
  selectedNodeIds: string[];
  /** Node id focused in ElementPanel, if any */
  focusedNodeId: string | null;
}

export function useDiagramContext(params: {
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
}): DiagramContextResult {
  const { selectedNodeIds, selectedNodeId } = params;
  const activeDiagram = useActiveDiagram();

  const diagramText = useMemo(() => {
    if (!activeDiagram) {
      return "Diagram: none\nNodes (0)\nEdges (0)\nProject: none\nDescription: none\nExternal Links (0)";
    }
    const resolvedDiagram = {
      ...activeDiagram,
      snapshot: getCachedCanvasSnapshot(activeDiagram),
    } as unknown as Diagram;

    const activeScene = resolveActiveScene(activeDiagram);

    return serializeDiagramContext(resolvedDiagram, {
      includeMetadata: true,
      includeLinks: true,
      activeScene: activeScene ?? undefined,
    });
  }, [activeDiagram]);

  return useMemo(
    () => ({
      diagramText,
      selectedNodeIds: Array.from(selectedNodeIds),
      focusedNodeId: selectedNodeId,
    }),
    [diagramText, selectedNodeIds, selectedNodeId],
  );
}

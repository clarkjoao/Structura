import { useMemo } from "react";
import {
  type Diagram,
  getCachedCanvasSnapshot,
  resolveActiveScene,
  useActiveDiagramModel,
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
  const activeModel = useActiveDiagramModel();

  const diagramText = useMemo(() => {
    if (!activeModel) {
      return "Diagram: none\nNodes (0)\nEdges (0)\nProject: none\nDescription: none\nExternal Links (0)";
    }
    const activeDiagram: Diagram = {
      ...activeModel,
      viewport: { x: 0, y: 0, zoom: 1 },
    };
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
  }, [activeModel]);

  return useMemo(
    () => ({
      diagramText,
      selectedNodeIds: Array.from(selectedNodeIds),
      focusedNodeId: selectedNodeId,
    }),
    [diagramText, selectedNodeIds, selectedNodeId],
  );
}

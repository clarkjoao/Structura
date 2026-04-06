import { useMemo } from "react";
import { getCachedCanvasSnapshot, useActiveDiagram } from "@/features/diagram";
import { serializeDiagramContext } from "@/features/llm";

export function useDiagramContext(): string {
  const activeDiagram = useActiveDiagram();

  return useMemo(() => {
    if (!activeDiagram) {
      return "Diagram: none\nNodes (0)\nEdges (0)\nProject: none\nDescription: none\nExternal Links (0)";
    }
    const resolvedDiagram = {
      ...activeDiagram,
      snapshot: getCachedCanvasSnapshot(activeDiagram),
    };
    return serializeDiagramContext(resolvedDiagram, {
      includeMetadata: true,
      includeLinks: true,
    });
  }, [activeDiagram]);
}


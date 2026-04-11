import { useMemo } from "react";
import {
  computeImpact,
  getCachedCanvasSnapshot,
  useActiveDiagram,
  type ImpactResult,
} from "@/features/diagram";


export function useImpactAnalysis(nodeId: string | null): ImpactResult | null {
  const diagram = useActiveDiagram();
  const resolved = useMemo(
    () => (diagram ? getCachedCanvasSnapshot(diagram) : null),
    [diagram],
  );

  return useMemo(() => {
    if (!nodeId || !resolved) {
      return null;
    }
    return computeImpact(nodeId, resolved.components, resolved.connections);
  }, [nodeId, resolved]);
}

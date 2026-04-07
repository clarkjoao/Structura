import { useMemo } from "react";
import {
  computeImpact,
  getCachedCanvasSnapshot,
  useActiveDiagram,
  type ImpactResult,
} from "@/features/diagram";

/**
 * Memoized impact of removing the given node from the active diagram snapshot.
 */
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

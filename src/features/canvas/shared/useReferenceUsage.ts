import { useMemo } from "react";
import { getCachedCanvasSnapshot, useDiagramStore } from "@/features/diagram";
import { refsOf, sharedUses } from "@/features/diagram/utils/shared";

export interface ReferenceConsumer {
  id: string;
  name: string;
  protocols: string[];
}

/** An element's references and who uses it, from the active diagram. */
export function useReferenceUsage(originalId: string): {
  refs: string[];
  consumers: ReferenceConsumer[];
  connectionCount: number;
} {
  const snapshot = useDiagramStore((state) => {
    const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    return diagram ? getCachedCanvasSnapshot(diagram) : null;
  });
  return useMemo(() => {
    if (!snapshot) return { refs: [], consumers: [], connectionCount: 0 };
    const { components, connections } = snapshot;
    const uses = sharedUses(originalId, components, connections);
    const byConsumer = new Map<string, Set<string>>();
    for (const use of uses) {
      const protocols = byConsumer.get(use.consumerId) ?? new Set<string>();
      if (use.label.trim()) protocols.add(use.label.trim());
      byConsumer.set(use.consumerId, protocols);
    }
    return {
      refs: refsOf(originalId, components),
      consumers: [...byConsumer.entries()].map(([id, protocols]) => ({
        id,
        name: components[id]?.name ?? id,
        protocols: [...protocols],
      })),
      connectionCount: uses.length,
    };
  }, [snapshot, originalId]);
}

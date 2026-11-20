import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { interactionOf, resolveKindPolicy } from "@/features/diagram-kinds/policy";

/**
 * Whether the active diagram lets an element be referenced (ADR-0014): false
 * while a kind that turns references off is in its own mode.
 */
export function useKindAllowsReferences(): boolean {
  return useDiagramStore((state) => {
    const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    return interactionOf(resolveKindPolicy(diagram)).references !== false;
  });
}

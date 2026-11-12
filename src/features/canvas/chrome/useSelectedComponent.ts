import { useResolvedComponents, type Component } from "@/features/diagram";

/**
 * The component a single selected node stands for, or null when the selection
 * is not exactly one node. What the selection toolbars describe.
 */
export function useSelectedComponent(
  selectedNodeId: string | null,
  selectedCount: number,
): Component | null {
  const resolvedComponents = useResolvedComponents();
  return selectedNodeId && selectedCount === 1
    ? (resolvedComponents[selectedNodeId] ?? null)
    : null;
}

import type { GraphLayout } from "./useBranchGraphLayout";

const V = {
  HP: 12,
  VP: 12,
  NS: 44,
  LW: 32,
  NR: 6,
} as const;

export function getVerticalRecordingNodeCenter(
  layout: GraphLayout,
  nodeId: string,
): { cx: number; cy: number } | null {
  const graphNode = layout.nodes.find((node) => node.id === nodeId);
  if (!graphNode) return null;
  return {
    cx: V.HP + V.NR + graphNode.lane * V.LW,
    cy: V.VP + V.NR + graphNode.seq * V.NS,
  };
}

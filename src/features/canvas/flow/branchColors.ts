export const BRANCH_COLORS = ["#06b6d4", "#f59e0b", "#8b5cf6", "#10b981", "#f43f5e", "#3b82f6"];

export function getBranchColor(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

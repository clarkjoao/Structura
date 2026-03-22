import type { NodeBuildContext } from "./types";

export function sceneBadgePropsForNode(
  ctx: NodeBuildContext,
  compId: string,
): {
  sceneBadge?: { name: string; color: string };
  compareBadges?: { a: { name: string; color: string }; b: { name: string; color: string } };
} {
  const cv = ctx.compareVisualByComponentId?.[compId];
  if (cv) {
    if (cv.badgeA && cv.badgeB) {
      return { compareBadges: { a: cv.badgeA, b: cv.badgeB } };
    }
    if (cv.badgeA) return { sceneBadge: cv.badgeA };
    if (cv.badgeB) return { sceneBadge: cv.badgeB };
    return {};
  }
  const sb = ctx.sceneBadgeByComponentId[compId];
  if (sb) return { sceneBadge: sb };
  return {};
}

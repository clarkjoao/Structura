import type { NodeBuildContext } from "./types";

export type BadgeMeta = { name: string; color: string };

export type NodeBadgeProps =
  | { sceneBadge?: undefined; compareBadges?: undefined }
  | { sceneBadge: BadgeMeta; compareBadges?: undefined }
  | { sceneBadge?: undefined; compareBadges: { a: BadgeMeta; b: BadgeMeta } };

export function sceneBadgePropsForNode(ctx: NodeBuildContext, compId: string): NodeBadgeProps {
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

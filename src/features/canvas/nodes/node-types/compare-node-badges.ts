import type { NodeBuildContext } from "./types";

export type BadgeMeta = { name: string; color: string };

export type NodeBadgeProps =
  | { versionBadge?: undefined; compareBadges?: undefined }
  | { versionBadge: BadgeMeta; compareBadges?: undefined }
  | { versionBadge?: undefined; compareBadges: { a: BadgeMeta; b: BadgeMeta } };

export function versionBadgePropsForNode(ctx: NodeBuildContext, compId: string): NodeBadgeProps {
  const cv = ctx.compareVisualByComponentId?.[compId];
  if (cv) {
    if (cv.badgeA && cv.badgeB) {
      return { compareBadges: { a: cv.badgeA, b: cv.badgeB } };
    }
    if (cv.badgeA) return { versionBadge: cv.badgeA };
    if (cv.badgeB) return { versionBadge: cv.badgeB };
    return {};
  }
  const sb = ctx.versionBadgeByComponentId[compId];
  if (sb) return { versionBadge: sb };
  return {};
}

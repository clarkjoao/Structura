/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

import { CONFIG } from "./constants";
import type { ExportNode } from "./model";

export const DRAWIO_MIN_MARGIN = 80;

const DEFAULT_ROOT_W = CONFIG.minDimensions.c4.width;
const DEFAULT_ROOT_H = CONFIG.minDimensions.c4.height;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/** Container nodes (panels, api-groups) hold parent-relative children. */
export function getContainerIds(nodes: ExportNode[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (n.kind === "panel" || n.kind === "apiGroup") ids.add(n.id);
  }
  return ids;
}

export function isRootExportNode(node: ExportNode | undefined, containerIds: Set<string>): boolean {
  if (!node) return true;
  return !node.parentId || !containerIds.has(node.parentId);
}

/** Extents over root nodes (unknown size = 0 falls back to the C4 default box). */
export function computeBoundingBox(nodes: ExportNode[], containerIds: Set<string>): BoundingBox {
  const roots = nodes.filter((n) => isRootExportNode(n, containerIds));
  const forBbox = roots.length > 0 ? roots : nodes;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of forBbox) {
    const w = n.width > 0 ? n.width : DEFAULT_ROOT_W;
    const h = n.height > 0 ? n.height : DEFAULT_ROOT_H;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

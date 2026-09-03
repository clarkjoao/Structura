/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

import { C4_META, CONFIG } from "./constants";
import type { ExportNode } from "./model";

export const DRAWIO_MIN_MARGIN = 80;

// Minimum vertical gap between two nodes after compensation.
const COMPENSATION_GAP = 10;

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

/** Map from node id → cumulative Y offset applied by the compensation pass. */
export type CompensationOffsets = Map<string, number>;

/**
 * Compute canonical (C4_META) dimensions for a node so the export always uses the
 * draw.io canonical box rather than the React Flow measured size.
 */
export function canonicalDimensions(node: ExportNode): { width: number; height: number } {
  if (node.kind === "c4") {
    const meta = C4_META[node.subtype] ?? C4_META.system;
    return { width: meta.width, height: meta.height };
  }
  return { width: node.width, height: node.height };
}

/**
 * Canonical bounding box in canvas coordinates, using C4_META for C4 nodes so
 * the compensation pass reasons about the canonical export size — not the measured
 * size the canvas happened to render.
 */
function canonicalBbox(
  node: ExportNode,
  offsetY = 0,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const { width, height } = canonicalDimensions(node);
  return {
    minX: node.x,
    minY: node.y + offsetY,
    maxX: node.x + width,
    maxY: node.y + offsetY + height,
  };
}

/** True when two axis-aligned rectangles overlap on both X and Y. */

/**
 * Propagate canonical C4_META sizes by pushing overlapping root nodes apart in Y.
 *
 * Only **root nodes** (not children of a container) are compensated. Children are
 * already in parent-relative coordinates — their overlaps with the container or with
 * sibling children are expected and must not be shifted by the export.
 *
 * Returns a map of node id → extra Y offset to apply after the canvas→drawio
 * shift.  pageHeight must be adjusted externally to accommodate the deepest node.
 */
export function computeCompensationOffsets(
  nodes: ExportNode[],
  containerIds: Set<string>,
): CompensationOffsets {
  // Only root nodes participate in compensation (children use parent-relative coords).
  const roots = nodes.filter((n) => isRootExportNode(n, containerIds));
  const offsets = new Map<string, number>();

  // Sort roots top→bottom, left→right.
  const sorted = [...roots].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  // Accumulate canonical bounding boxes of already-positioned nodes.
  const placed: Array<{ id: string; bbox: ReturnType<typeof canonicalBbox> }> = [];

  for (const node of sorted) {
    const myOffset = offsets.get(node.id) ?? 0;
    const myBbox = canonicalBbox(node, myOffset);

    let maxPush = 0;
    for (const { bbox: other } of placed) {
      // Only nodes whose X ranges intersect can collide.
      if (myBbox.minX >= other.maxX || other.minX >= myBbox.maxX) continue;

      if (myBbox.minY < other.maxY) {
        // Current node is at or above the placed node (their Y ranges overlap).
        // Push the current node down so its TOP ends up at other.bottom + GAP.
        // Push = (other.bottom + GAP) - my.top = other.maxY + GAP - myBbox.minY.
        maxPush = Math.max(maxPush, other.maxY + COMPENSATION_GAP - myBbox.minY);
      } else {
        // Current node is below the placed node.
        // Ensure the gap is at least GAP: push = GAP - actual_gap.
        // actual_gap = my.top - other.bottom = myBbox.minY - other.maxY.
        const gap = myBbox.minY - other.maxY;
        maxPush = Math.max(maxPush, COMPENSATION_GAP - gap);
      }
    }

    if (maxPush > 0) {
      const newOffset = myOffset + maxPush;
      offsets.set(node.id, newOffset);
      // Update bbox for subsequent nodes in this same loop iteration.
      const updated = canonicalBbox(node, newOffset);
      placed.push({ id: node.id, bbox: updated });
    } else {
      placed.push({ id: node.id, bbox: myBbox });
    }
  }

  return offsets;
}

/** The maximum y (bottom edge) of any node after applying compensation offsets. */
export function compensatedMaxY(nodes: ExportNode[], offsets: CompensationOffsets): number {
  let max = 0;
  for (const node of nodes) {
    const offset = offsets.get(node.id) ?? 0;
    const { height } = canonicalDimensions(node);
    max = Math.max(max, node.y + offset + height);
  }
  return max;
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

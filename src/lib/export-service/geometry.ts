import type { Component } from "@/features/diagram";
import type { NodeLayout } from "@/features/diagram";
import { isApiGroupComponent, isPanelComponent } from "@/features/diagram";
import { CONFIG } from "./constants";
import type { GeometryInfo } from "./types";

export const DRAWIO_TARGET_WIDTH = 2400;
export const DRAWIO_TARGET_HEIGHT = 1600;

export const DRAWIO_MIN_MARGIN = 80;

export const DRAWIO_ROOT_MIN_GAP = 40;

const DEFAULT_ROOT_W = CONFIG.minDimensions.c4.width;
const DEFAULT_ROOT_H = CONFIG.minDimensions.c4.height;

export function getContainerIds(components: Record<string, Component>): Set<string> {
  const ids = new Set<string>();
  for (const c of Object.values(components)) {
    if (isPanelComponent(c) || isApiGroupComponent(c)) ids.add(c.id);
  }
  return ids;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function isRootExportNode(c: Component | undefined, containerIds: Set<string>): boolean {
  if (!c) return true;
  return !c.parentId || !containerIds.has(c.parentId);
}

export function computeBoundingBox(
  ids: string[],
  layoutMap: Map<string, NodeLayout>,
  components: Record<string, Component>,
  containerIds: Set<string>,
): BoundingBox {
  const rootIds = ids.filter((id) => {
    const c = components[id];
    return isRootExportNode(c, containerIds);
  });

  const idsForBbox = rootIds.length > 0 ? rootIds : ids;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of idsForBbox) {
    const nl = layoutMap.get(id);
    if (!nl) continue;
    const w = nl.width ?? DEFAULT_ROOT_W;
    const h = nl.height ?? DEFAULT_ROOT_H;
    minX = Math.min(minX, nl.x);
    minY = Math.min(minY, nl.y);
    maxX = Math.max(maxX, nl.x + w);
    maxY = Math.max(maxY, nl.y + h);
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function computeScaleFactor(bbox: BoundingBox, rootNodeCount: number): number {
  if (bbox.width === 0 || bbox.height === 0 || rootNodeCount <= 1) return 1;

  const scaleX = DRAWIO_TARGET_WIDTH / Math.max(bbox.width, 400);
  const scaleY = DRAWIO_TARGET_HEIGHT / Math.max(bbox.height, 300);

  return Math.min(Math.max(Math.min(scaleX, scaleY), 0.8), 2.5);
}

export type RootPosition = { x: number; y: number; width: number; height: number };

export function resolveOverlaps(
  positions: Map<string, RootPosition>,
  minGap: number,
): Map<string, RootPosition> {
  const resolved = new Map(positions);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    const sorted = [...resolved.entries()].sort(([, a], [, b]) =>
      a.y !== b.y ? a.y - b.y : a.x - b.x,
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const idA = sorted[i][0];
        const idB = sorted[j][0];
        const rA = resolved.get(idA)!;
        const rB = resolved.get(idB)!;

        const overlapX = rA.x < rB.x + rB.width + minGap && rB.x < rA.x + rA.width + minGap;
        const overlapY = rA.y < rB.y + rB.height + minGap && rB.y < rA.y + rA.height + minGap;

        if (overlapX && overlapY) {
          const newY = rA.y + rA.height + minGap;
          if (rB.y !== newY) {
            resolved.set(idB, { ...rB, y: newY });
            changed = true;
          }
        }
      }
    }
  }
  return resolved;
}

export function getExportGeometry(layout: NodeLayout | undefined): GeometryInfo {
  if (!layout) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width ?? 0,
    height: layout.height ?? 0,
  };
}

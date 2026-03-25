import type { Point } from "@/features/diagram";
import { getClosestOffsetOnPath, getPointAtOffset } from "./edgeBuilding";

export function clampLabelPosition(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

export function getLabelPointOnPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
  offset: number,
): Point {
  return getPointAtOffset(sourceX, sourceY, targetX, targetY, waypoints, offset);
}

export function getClosestLabelPositionOnPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
  position: Point,
): number {
  return getClosestOffsetOnPath(sourceX, sourceY, targetX, targetY, waypoints, position);
}

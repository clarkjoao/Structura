import type { Point } from "@/features/diagram";

// NOTE: this module holds the legacy orthogonal segment-drag geometry consumed
// by the outgoing CustomEdge/useCustomEdge and is scheduled for deletion once
// the editable-edge core lands. The connection→edge mapper now lives in
// ./data/buildEdges.ts and the editable geometry in ./geometry/.

export function buildOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
): string {
  if (waypoints.length === 0) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }
  const knots: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  let path = `M ${knots[0].x} ${knots[0].y}`;
  for (let index = 1; index < knots.length; index += 1) {
    path += ` H ${knots[index].x} V ${knots[index].y}`;
  }
  return path;
}

export interface Segment {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: "horizontal" | "vertical";
}

export function buildSegments(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
): Segment[] {
  const pts: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

  return pts.slice(0, -1).map((point, index) => {
    const next = pts[index + 1];
    const isHorizontal = Math.abs(point.y - next.y) <= Math.abs(point.x - next.x);
    return {
      index,
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
      orientation: isHorizontal ? "horizontal" : "vertical",
    };
  });
}

export function getPointAtOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
  offset: number,
): Point {
  const pts: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const lengths = pts
    .slice(0, -1)
    .map((point, index) => Math.hypot(pts[index + 1].x - point.x, pts[index + 1].y - point.y));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) {
    return { x: pts[0].x, y: pts[0].y };
  }
  const clampedOffset = Math.max(0, Math.min(1, offset));
  const targetLength = totalLength * clampedOffset;
  let accumulated = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (accumulated + segmentLength >= targetLength) {
      if (segmentLength === 0) {
        return { x: pts[index].x, y: pts[index].y };
      }
      const t = (targetLength - accumulated) / segmentLength;
      return {
        x: pts[index].x + (pts[index + 1].x - pts[index].x) * t,
        y: pts[index].y + (pts[index + 1].y - pts[index].y) * t,
      };
    }
    accumulated += segmentLength;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

export function getClosestOffsetOnPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Point[],
  pos: Point,
): number {
  const pts: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const lengths = pts
    .slice(0, -1)
    .map((point, index) => Math.hypot(pts[index + 1].x - point.x, pts[index + 1].y - point.y));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) {
    return 0.5;
  }
  let bestOffset = 0.5;
  let bestDist = Number.POSITIVE_INFINITY;
  let accumulated = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const dx = pts[index + 1].x - pts[index].x;
    const dy = pts[index + 1].y - pts[index].y;
    const segmentLength = lengths[index];
    if (segmentLength === 0) {
      continue;
    }
    const dot = (pos.x - pts[index].x) * dx + (pos.y - pts[index].y) * dy;
    const t = Math.max(0, Math.min(1, dot / (segmentLength * segmentLength)));
    const projectedX = pts[index].x + t * dx;
    const projectedY = pts[index].y + t * dy;
    const dist = Math.hypot(pos.x - projectedX, pos.y - projectedY);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = (accumulated + t * segmentLength) / totalLength;
    }
    accumulated += segmentLength;
  }
  return bestOffset;
}

export function computeSegmentDrag(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  initialWaypoints: Point[],
  seg: Segment,
  delta: Point,
): Point[] {
  const pts: Point[] = [
    { x: sourceX, y: sourceY },
    ...initialWaypoints.map((point) => ({ x: point.x, y: point.y })),
    { x: targetX, y: targetY },
  ];
  const i = seg.index;
  const j = i + 1;

  if (seg.orientation === "horizontal") {
    const dy = delta.y;

    if (initialWaypoints.length === 0) {
      const newY = sourceY + dy;
      return [
        { x: sourceX, y: newY },
        { x: targetX, y: newY },
      ];
    }

    if (i === 0) {
      const newY = pts[0].y + dy;
      return [
        { x: sourceX, y: newY },
        { x: pts[1].x, y: newY },
        ...initialWaypoints.slice(1).map((point) => ({ ...point })),
      ];
    }

    if (j === pts.length - 1) {
      const lastWaypointIndex = initialWaypoints.length - 1;
      const lastKnotIndex = initialWaypoints.length;
      const newY = pts[lastKnotIndex].y + dy;
      return [
        ...initialWaypoints.slice(0, lastWaypointIndex).map((point) => ({ ...point })),
        { x: pts[lastKnotIndex].x, y: newY },
        { x: targetX, y: newY },
      ];
    }

    const newWaypoints = initialWaypoints.map((point) => ({ ...point }));
    if (i > 0) {
      newWaypoints[i - 1] = { ...newWaypoints[i - 1], y: pts[i].y + dy };
    }
    if (j < pts.length - 1) {
      newWaypoints[j - 1] = { ...newWaypoints[j - 1], y: pts[j].y + dy };
    }
    return newWaypoints;
  }

  const dx = delta.x;

  if (initialWaypoints.length === 0) {
    const newX = sourceX + dx;
    return [
      { x: newX, y: sourceY },
      { x: newX, y: targetY },
    ];
  }

  if (i === 0) {
    const newX = pts[0].x + dx;
    return [
      { x: newX, y: sourceY },
      { x: newX, y: pts[1].y },
      ...initialWaypoints.slice(1).map((point) => ({ ...point })),
    ];
  }

  if (j === pts.length - 1) {
    const lastWaypointIndex = initialWaypoints.length - 1;
    const lastKnotIndex = initialWaypoints.length;
    const newX = pts[lastKnotIndex].x + dx;
    return [
      ...initialWaypoints.slice(0, lastWaypointIndex).map((point) => ({ ...point })),
      { x: newX, y: pts[lastKnotIndex].y },
      { x: newX, y: targetY },
    ];
  }

  const newWaypoints = initialWaypoints.map((point) => ({ ...point }));
  if (i > 0) {
    newWaypoints[i - 1] = { ...newWaypoints[i - 1], x: pts[i].x + dx };
  }
  if (j < pts.length - 1) {
    newWaypoints[j - 1] = { ...newWaypoints[j - 1], x: pts[j].x + dx };
  }
  return newWaypoints;
}

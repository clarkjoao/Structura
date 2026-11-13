import { describe, expect, it } from "vitest";
import {
  measurePolylines,
  segmentCrossesBox,
  segmentsIntersect,
  type ReadabilityBox,
  type ReadabilityPoint,
} from "./layoutReadability";

/**
 * The crossing and edge-through-node counts skip pairs whose bounds are apart.
 * They must count exactly what testing every pair counts: this is that
 * every-pair count, written out, against random orthogonal drawings that also
 * share ends, touch, and run along each other.
 */

interface Edge {
  id: string;
  source: string;
  target: string;
  points: ReadabilityPoint[];
}

function samePoint(a: ReadabilityPoint, b: ReadabilityPoint): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function everyPairCrossings(edges: Edge[]): number {
  let crossings = 0;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i];
      const b = edges[j];
      const sharesNode =
        a.source === b.source ||
        a.source === b.target ||
        a.target === b.source ||
        a.target === b.target;
      let found = false;
      for (let s = 0; s < a.points.length - 1 && !found; s += 1) {
        for (let t = 0; t < b.points.length - 1 && !found; t += 1) {
          if (!segmentsIntersect(a.points[s], a.points[s + 1], b.points[t], b.points[t + 1])) {
            continue;
          }
          if (sharesNode) {
            const ends = [a.points[0], a.points[a.points.length - 1]];
            const otherEnds = [b.points[0], b.points[b.points.length - 1]];
            if (ends.some((e) => otherEnds.some((o) => samePoint(e, o)))) continue;
          }
          found = true;
        }
      }
      if (found) crossings += 1;
    }
  }
  return crossings;
}

function everyPairOverlaps(edges: Edge[], boxes: Map<string, ReadabilityBox>): number {
  let overlaps = 0;
  for (const edge of edges) {
    for (const [nodeId, box] of boxes) {
      if (nodeId === "root" || nodeId === edge.source || nodeId === edge.target) continue;
      for (let i = 0; i < edge.points.length - 1; i += 1) {
        if (segmentCrossesBox(edge.points[i], edge.points[i + 1], box)) {
          overlaps += 1;
          break;
        }
      }
    }
  }
  return overlaps;
}

/** A small deterministic generator, so a failure is reproducible. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function drawing(seed: number) {
  const next = random(seed);
  // A coarse grid makes shared ends, touching corners and collinear runs common.
  const grid = (span: number) => Math.round(next() * span) * 20;
  const boxes = new Map<string, ReadabilityBox>([
    ["root", { x: 0, y: 0, width: 2000, height: 2000 }],
  ]);
  const nodeIds: string[] = [];
  for (let n = 0; n < 30; n += 1) {
    const id = `n${n}`;
    nodeIds.push(id);
    boxes.set(id, { x: grid(80), y: grid(80), width: 40 + grid(4), height: 20 + grid(3) });
  }
  const edges: Edge[] = [];
  for (let e = 0; e < 60; e += 1) {
    const points: ReadabilityPoint[] = [{ x: grid(80), y: grid(80) }];
    const bends = 1 + Math.floor(next() * 4);
    for (let b = 0; b < bends; b += 1) {
      const last = points[points.length - 1];
      points.push(b % 2 === 0 ? { x: grid(80), y: last.y } : { x: last.x, y: grid(80) });
    }
    edges.push({
      id: `e${e}`,
      source: nodeIds[Math.floor(next() * nodeIds.length)],
      target: nodeIds[Math.floor(next() * nodeIds.length)],
      points,
    });
  }
  // Two edges that share an end and run along each other.
  edges.push({
    id: "along-a",
    source: "n0",
    target: "n1",
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ],
  });
  edges.push({
    id: "along-b",
    source: "n0",
    target: "n2",
    points: [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ],
  });
  return { boxes, edges };
}

describe("crossing and overlap counts skip only pairs that cannot count", () => {
  it("count what testing every pair counts", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { boxes, edges } = drawing(seed);
      const parentOf = new Map<string, string | null>(
        [...boxes.keys()].map((id) => [id, id === "root" ? null : "root"]),
      );
      const report = measurePolylines({
        boxes,
        parentOf,
        edges,
        rootId: "root",
        width: 2000,
        height: 2000,
      });
      expect(report.edgeCrossings, `seed ${seed}`).toBe(everyPairCrossings(edges));
      expect(report.edgeNodeOverlaps, `seed ${seed}`).toBe(everyPairOverlaps(edges, boxes));
    }
  });
});

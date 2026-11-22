import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindOverlay } from "../kind.types";
import { LANE_HEADER } from "./guided.geometry";
import { experienceOf, isPainPoint, readGuided } from "./guided.model";
import { guidedPhases } from "./guided.phases";

/** The header band's depth, with and without the emotion curve, and its gap to the lanes. */
const BAND_DEPTH = 36;
const BAND_DEPTH_WITH_CURVE = 96;
const BAND_GAP = 12;

/**
 * The guided overlay (spec guided-journey-phases): the phases as segments of a
 * header band beside the lanes, separators between them, and the emotion curve
 * along the main path. Null when there is neither a phase nor a score.
 */
export function guidedOverlay(diagram: DiagramModel): KindOverlay | null {
  const reading = readGuided(diagram);
  if (reading.lanes.length === 0) return null;
  const { nodeLayouts } = getCachedCanvasSnapshot(diagram);
  const vertical = diagram.direction === "TB";
  const along = (box: { x: number; y: number }) => (vertical ? box.y : box.x);
  const across = (box: { x: number; y: number }) => (vertical ? box.x : box.y);
  const length = (box: { width?: number; height?: number }) =>
    (vertical ? box.height : box.width) ?? 0;
  const depthOf = (box: { width?: number; height?: number }) =>
    (vertical ? box.width : box.height) ?? 0;

  // The lanes' frame: across from the first lane's near edge to the last one's far edge.
  const laneBoxes = reading.lanes.flatMap((lane) => {
    const box = nodeLayouts[lane.id];
    return box ? [box] : [];
  });
  if (laneBoxes.length === 0) return null;
  const acrossStart = Math.min(...laneBoxes.map(across));
  const acrossEnd = Math.max(...laneBoxes.map((b) => across(b) + depthOf(b)));
  const alongStart = Math.min(...laneBoxes.map(along)) + LANE_HEADER;
  const alongEnd = Math.max(...laneBoxes.map((b) => along(b) + length(b)));

  /** A step's span along the axis, in absolute coordinates. */
  const span = (id: string): { from: number; to: number } | null => {
    const box = nodeLayouts[id];
    const lane = nodeLayouts[reading.laneOf.get(id) ?? ""];
    if (!box || !lane) return null;
    const from = along(lane) + along(box);
    return { from, to: from + length(box) };
  };

  // The emotion curve: the main path (each decision's first exit), scored steps only.
  const curve: KindOverlay["curve"] = [];
  const seen = new Set<string>();
  let at: string | undefined = reading.starts[0]?.id;
  while (at && !seen.has(at)) {
    seen.add(at);
    const score = experienceOf(reading.steps.get(at)!);
    const s = span(at);
    if (score !== null && s) {
      curve.push({
        id: at,
        along: (s.from + s.to) / 2,
        value: (score - 1) / 4,
        tone: isPainPoint(score) ? "danger" : score === 3 ? "neutral" : "success",
      });
    }
    at = reading.outgoing.get(at)?.[0]?.targetId;
  }

  const { phases, phaseOf } = guidedPhases(reading);
  if (phases.length === 0 && curve.length === 0) return null;

  // Each phase group's extent along the axis; group -1 is the steps before the first start.
  const extent = new Map<number, { from: number; to: number }>();
  for (const id of reading.steps.keys()) {
    const s = span(id);
    if (!s) continue;
    const group = phaseOf.get(id) ?? -1;
    const known = extent.get(group);
    extent.set(
      group,
      known ? { from: Math.min(known.from, s.from), to: Math.max(known.to, s.to) } : s,
    );
  }
  const boundaries: number[] = [];
  const segments: KindOverlay["segments"] = [];
  phases.forEach((phase, index) => {
    const own = extent.get(index);
    const before = [...extent.entries()]
      .filter(([group]) => group < index)
      .reduce<number | null>((max, [, e]) => (max === null ? e.to : Math.max(max, e.to)), null);
    const from =
      before !== null && own
        ? (before + own.from) / 2
        : index === 0
          ? alongStart
          : (own?.from ?? alongStart);
    if (before !== null) boundaries.push(from);
    segments.push({
      id: phase.startId,
      label: phase.name,
      from,
      to: alongEnd,
      selects: phase.startId,
    });
    if (index > 0) segments[index - 1]!.to = from;
  });

  const depth = curve.length > 0 ? BAND_DEPTH_WITH_CURVE : BAND_DEPTH;
  return {
    axis: vertical ? "y" : "x",
    at: acrossStart - BAND_GAP - depth,
    depth,
    segments,
    separators: boundaries.map((b) => ({ along: b, from: acrossStart, to: acrossEnd })),
    curve,
  };
}

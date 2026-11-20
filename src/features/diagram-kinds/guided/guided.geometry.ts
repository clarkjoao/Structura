import type { FlowNodeShape } from "@/features/diagram/model/component.types";

/**
 * The guided layout's measures. A lane is a band across the reading axis with
 * its header at the start (left of a horizontal lane, top of a vertical one);
 * steps sit in columns along the axis.
 */

/** The swimlane header's depth (`SwimlaneNode`'s `SWIMLANE_HEADER`). */
export const LANE_HEADER = 44;
/** Space between the header and the first column, and after the last. */
export const LANE_INSET = 40;
/** Space above and below a lane's steps, across the axis. */
export const LANE_PADDING = 32;
/** A lane is never thinner than this, so an empty lane stays a target. */
export const LANE_MIN_DEPTH = 160;
/** A lane is never shorter than this along the axis. */
export const LANE_MIN_LENGTH = 800;
/** Default gaps (normal density): between columns, between steps stacked in one column. */
export const COLUMN_GAP = 72;
export const STACK_GAP = 32;

/** Step sizes, as `FLOW_SHAPE_DEFAULT_SIZE` declares them for the journey shapes. */
const STEP_SIZE: Partial<Record<FlowNodeShape, { width: number; height: number }>> = {
  rectangle: { width: 220, height: 80 },
  subroutine: { width: 220, height: 96 },
  diamond: { width: 180, height: 112 },
  cylinder: { width: 150, height: 108 },
  start: { width: 56, height: 56 },
  end: { width: 56, height: 56 },
  document: { width: 220, height: 78 },
  event: { width: 210, height: 60 },
};

export function stepSize(shape: FlowNodeShape): { width: number; height: number } {
  return STEP_SIZE[shape] ?? { width: 220, height: 80 };
}

/** Lane accents, in lane order: a guided map reads the same whoever draws it. */
const LANE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#64748b"] as const;

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length]!;
}

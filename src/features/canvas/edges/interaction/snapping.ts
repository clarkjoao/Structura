import { useCallback } from "react";
import { useStoreApi } from "@xyflow/react";
import { GRID_SIZE } from "../../canvas.constants";
import {
  alignmentExtent,
  buildAlignmentTargets,
  boxFromInternalNode,
  findAlignment,
  type AlignmentTargets,
  type NodeBox,
} from "../geometry/alignment";
import { snapToGrid } from "../geometry/orthogonal";

/** A guide line drawn while a drag is snapped, in flow coordinates. */
export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  position: number;
  from: number;
  to: number;
  kind: "grid" | "align";
}

/** Screen-space pull distance for magnetic alignment (converted to flow units). */
const ALIGN_THRESHOLD_PX = 6;
const GRID_THRESHOLD = GRID_SIZE / 2;
/** Half-length of a grid guide tick drawn around the handle. */
const GRID_GUIDE_REACH = 40;

export interface SnapSession {
  targets: AlignmentTargets;
  alignThreshold: number;
}

export interface AxisSnap {
  value: number;
  guide: SnapGuide | null;
}

/**
 * Resolve one axis of a drag: magnetic alignment to node lines first, then an
 * optional grid snap. `perp` is the handle's coordinate on the other axis, used
 * to extend the guide so it reaches the handle. Returns the snapped value and
 * any guide to render.
 */
export function resolveAxis(
  axis: "x" | "y",
  raw: number,
  perp: number,
  session: SnapSession,
  useGrid: boolean,
): AxisSnap {
  const orientation = axis === "x" ? "vertical" : "horizontal";
  const lines = axis === "x" ? session.targets.xs : session.targets.ys;
  const match = findAlignment(raw, lines, session.alignThreshold);
  if (match) {
    const { from, to } = alignmentExtent(match, perp);
    return {
      value: match.pos,
      guide: { orientation, position: match.pos, from, to, kind: "align" },
    };
  }
  if (useGrid) {
    const snapped =
      axis === "x"
        ? snapToGrid({ x: raw, y: 0 }, GRID_SIZE, GRID_THRESHOLD).x
        : snapToGrid({ x: 0, y: raw }, GRID_SIZE, GRID_THRESHOLD).y;
    if (snapped !== raw) {
      return {
        value: snapped,
        guide: {
          orientation,
          position: snapped,
          from: perp - GRID_GUIDE_REACH,
          to: perp + GRID_GUIDE_REACH,
          kind: "grid",
        },
      };
    }
    return { value: snapped, guide: null };
  }
  return { value: raw, guide: null };
}

/** Captures node alignment targets imperatively at drag start (no subscription). */
export function useEdgeSnapping() {
  const storeApi = useStoreApi();
  const capture = useCallback((): SnapSession => {
    const { nodeLookup, transform } = storeApi.getState();
    const zoom = transform[2] || 1;
    const boxes: NodeBox[] = [];
    nodeLookup.forEach((node) => {
      boxes.push(boxFromInternalNode(node.internals.positionAbsolute, node.measured));
    });
    return { targets: buildAlignmentTargets(boxes), alignThreshold: ALIGN_THRESHOLD_PX / zoom };
  }, [storeApi]);
  return { capture };
}

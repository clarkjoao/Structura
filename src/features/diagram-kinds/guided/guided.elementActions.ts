import type { KindCommandContext, KindElementAction } from "../kind.types";
import {
  guidedAddLane,
  guidedMoveLane,
  guidedMoveStepToLane,
  guidedRemoveLane,
  guidedSetVisibilityLine,
} from "./guided.edits";
import { readGuided, visibilityLaneOf } from "./guided.model";

/**
 * The guided actions on one element: a step moves to another lane; a lane is
 * added after, moved, or removed. The inspector and the context menu both show
 * these, so a lane change never needs a drag.
 */
export function guidedElementActions(
  ctx: KindCommandContext,
  targetId: string,
): KindElementAction[] {
  const reading = readGuided(ctx.diagram);
  const laneOfStep = reading.laneOf.get(targetId);
  if (laneOfStep) {
    return reading.lanes
      .filter((lane) => lane.id !== laneOfStep)
      .map((lane) => ({
        id: `guided.moveTo.${lane.id}`,
        group: "moveTo",
        label: { text: lane.name },
        run: () => guidedMoveStepToLane(ctx.diagram, reading, targetId, lane.id),
      }));
  }
  const index = reading.lanes.findIndex((lane) => lane.id === targetId);
  if (index < 0) return [];
  // A top-to-bottom diagram stands its lanes side by side: they move left and right.
  const across =
    ctx.diagram.direction === "TB" ? ["moveLeft", "moveRight"] : ["moveUp", "moveDown"];
  const actions: KindElementAction[] = [
    {
      id: "guided.lane.add",
      group: "lane",
      glyph: "add",
      label: { key: "diagramKinds.guided.lanes.add" },
      run: () => ({
        edit: guidedAddLane(ctx.diagram, ctx.t("diagramKinds.guided.lanes.newLane"), targetId),
        select: "new-lane",
      }),
    },
  ];
  if (index > 0) {
    actions.push({
      id: "guided.lane.up",
      group: "lane",
      glyph: "before",
      label: { key: `diagramKinds.guided.lanes.${across[0]}` },
      run: () => ({ edit: guidedMoveLane(ctx.diagram, targetId, -1), select: targetId }),
    });
  }
  if (index < reading.lanes.length - 1) {
    actions.push({
      id: "guided.lane.down",
      group: "lane",
      glyph: "after",
      label: { key: `diagramKinds.guided.lanes.${across[1]}` },
      run: () => ({ edit: guidedMoveLane(ctx.diagram, targetId, 1), select: targetId }),
    });
  }
  // The line of visibility (spec guided-journey-blueprint): before this lane, or no longer.
  const line = visibilityLaneOf(ctx.diagram, reading);
  if (line === targetId) {
    actions.push({
      id: "guided.lane.visibility",
      group: "lane",
      glyph: "visibilityOff",
      label: { key: "diagramKinds.guided.blueprint.removeLine" },
      run: () => ({ edit: guidedSetVisibilityLine(ctx.diagram, null), select: targetId }),
    });
  } else if (index > 0) {
    actions.push({
      id: "guided.lane.visibility",
      group: "lane",
      glyph: "visibility",
      label: {
        key:
          ctx.diagram.direction === "TB"
            ? "diagramKinds.guided.blueprint.lineLeft"
            : "diagramKinds.guided.blueprint.lineAbove",
      },
      run: () => ({ edit: guidedSetVisibilityLine(ctx.diagram, targetId), select: targetId }),
    });
  }
  if (reading.lanes.length > 1) {
    actions.push({
      id: "guided.lane.remove",
      group: "lane",
      danger: true,
      glyph: "remove",
      label: { key: "diagramKinds.guided.lanes.remove" },
      run: () => {
        const edit = guidedRemoveLane(ctx.diagram, targetId);
        return "refused" in edit ? edit : { edit };
      },
    });
  }
  return actions;
}

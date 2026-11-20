import type { KindCommandContext, KindElementAction } from "../kind.types";
import {
  guidedAddLane,
  guidedMoveLane,
  guidedMoveStepToLane,
  guidedRemoveLane,
} from "./guided.edits";
import { readGuided } from "./guided.model";

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
  const actions: KindElementAction[] = [
    {
      id: "guided.lane.add",
      group: "lane",
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
      label: { key: "diagramKinds.guided.lanes.moveUp" },
      run: () => ({ edit: guidedMoveLane(ctx.diagram, targetId, -1), select: targetId }),
    });
  }
  if (index < reading.lanes.length - 1) {
    actions.push({
      id: "guided.lane.down",
      group: "lane",
      label: { key: "diagramKinds.guided.lanes.moveDown" },
      run: () => ({ edit: guidedMoveLane(ctx.diagram, targetId, 1), select: targetId }),
    });
  }
  if (reading.lanes.length > 1) {
    actions.push({
      id: "guided.lane.remove",
      group: "lane",
      danger: true,
      label: { key: "diagramKinds.guided.lanes.remove" },
      run: () => {
        const edit = guidedRemoveLane(ctx.diagram, targetId);
        return "refused" in edit ? edit : { edit };
      },
    });
  }
  return actions;
}

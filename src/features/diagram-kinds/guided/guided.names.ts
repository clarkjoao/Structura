import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import type { KindCommandContext, KindCommandOutcome, KindText } from "../kind.types";
import { mergeKindEdits } from "../kindEditMerge";
import { guidedChangeShape, guidedMoveStepToLane } from "./guided.edits";
import { isGuidedDecision, isGuidedEnd, readGuided } from "./guided.model";
import { parseOutlineLine } from "./guided.outline.parse";

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * A step's name as typed on the canvas, read with the outline's shortcuts (spec
 * guided-direct-editing): `? ` makes it a decision, `! ` an end, and `Lane: ` moves it
 * to an existing lane. Escapes (`\?`, `\!`, `\:`) keep the characters. Null when the
 * text uses none of them: the name is stored as typed.
 */
export function guidedNameCommit(
  ctx: KindCommandContext,
  stepId: string,
  text: string,
): KindCommandOutcome | { refused: KindText } | null {
  const reading = readGuided(ctx.diagram);
  const step = reading.steps.get(stepId);
  if (!step || !/[?!:\\]/.test(text)) return null;
  const parsed = parseOutlineLine(text);
  if (!parsed) return null;
  const { item } = parsed;
  // Only an existing lane is a lane: "Reunião: kickoff" stays a name.
  const lane = parsed.lane
    ? reading.lanes.find((candidate) => nameKey(candidate.name) === nameKey(parsed.lane!))
    : undefined;
  if (parsed.lane && (!lane || parsed.participants?.length)) return null;

  const parts: KindEdit[] = [];
  const name = item.name || (item.kind === "end" ? step.name : "");
  if (name && name !== step.name) parts.push({ update: [{ id: stepId, name }] });
  const currentKind = isGuidedDecision(step) ? "decision" : isGuidedEnd(step) ? "end" : "step";
  if (item.kind !== currentKind && item.kind !== "step") {
    const shaped = guidedChangeShape(
      ctx.diagram,
      stepId,
      item.kind === "decision" ? "diamond" : "end",
    );
    if ("refused" in shaped) return shaped;
    parts.push(shaped.edit);
  }
  if (lane && lane.id !== reading.laneOf.get(stepId)) {
    const moved = guidedMoveStepToLane(ctx.diagram, reading, stepId, lane.id);
    if ("refused" in moved) return moved;
    parts.push(moved.edit);
  }
  if (parts.length === 0) return text.trim() === step.name ? null : { edit: {}, select: stepId };
  return { edit: mergeKindEdits(reading.components, parts), select: stepId };
}

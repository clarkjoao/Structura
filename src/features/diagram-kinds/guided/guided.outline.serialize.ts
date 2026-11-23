import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindContext, KindTextBase } from "../kind.types";
import {
  experienceOf,
  isGuidedDecision,
  isGuidedEnd,
  participantsOf,
  readGuided,
  visibilityLaneOf,
} from "./guided.model";
import { phaseStartOf } from "./guided.phases";
import { escapeOutlineLane, escapeOutlineText } from "./guided.outline.parse";

const INDENT = "  ";

/**
 * Writes a guided journey as an outline (spec guided-journey-outline). The lanes
 * are declared first, in order; the sequence follows from the start step, each
 * decision's exits indented under it, and a step reached again is a jump. The
 * outline added to a new guided diagram gives the same journey back.
 */
export function serializeGuidedOutline(diagram: DiagramModel, ctx: KindContext): string {
  return writeGuidedOutline(diagram, ctx).text;
}

/** The outline with a `{#sN}` handle on every step line ("Copy as… Text with ids"). */
export function serializeGuidedOutlineWithIds(diagram: DiagramModel, ctx: KindContext): string {
  return writeGuidedOutline(diagram, ctx, { handles: true }).text;
}

/**
 * The outline and what it stands for (spec guided-journey-text-sync): each line's
 * step (null for lanes, phases, jumps and comments), the handle given to each step
 * in reading order, and the connections the text writes — the only ones a text
 * edit may change.
 */
export function writeGuidedOutline(
  diagram: DiagramModel,
  ctx: KindContext,
  options: { handles?: boolean } = {},
): KindTextBase {
  const reading = readGuided(diagram);
  const lines: string[] = [];
  const lineIds: (string | null)[] = [];
  const handles: Record<string, string> = {};
  const writtenConnections: string[] = [];
  const push = (line: string, id: string | null = null) => {
    lines.push(line);
    lineIds.push(id);
  };
  const laneName = new Map(reading.lanes.map((lane) => [lane.id, lane.name]));
  // `---` before the first backstage lane: the line of visibility (spec guided-journey-blueprint).
  const backstage = visibilityLaneOf(diagram, reading);
  for (const lane of reading.lanes) {
    if (lane.id === backstage) push("---");
    push(`${escapeOutlineLane(lane.name)}:`);
  }
  let currentLane: string | undefined = reading.lanes[reading.lanes.length - 1]?.id;

  const start = reading.starts[0];
  const written = new Set<string>();
  const nameOf = (id: string) => escapeOutlineText(reading.steps.get(id)?.name ?? "");

  /** From `id` on: the first line under an exit (`label`), the rest one level deeper. */
  const emit = (firstId: string, indent: string, label: string | null) => {
    let id = firstId;
    let prefix = label === null ? "" : label ? `${escapeOutlineText(label)} -> ` : "-> ";
    let ind = indent;
    for (;;) {
      if (written.has(id)) {
        push(`${ind}${prefix || "-> "}@${nameOf(id)}`);
        return;
      }
      written.add(id);
      const step = reading.steps.get(id)!;
      const lane = reading.laneOf.get(id);
      // The lane where it changes, and always with the step's participants.
      const others = participantsOf(step, laneName.get(lane!));
      const lanePrefix =
        lane !== currentLane || others.length > 0
          ? `${[laneName.get(lane!) ?? "", ...others].map(escapeOutlineLane).join(", ")}: `
          : "";
      currentLane = lane;
      const marker = isGuidedDecision(step) ? "? " : isGuidedEnd(step) ? "! " : "";
      const score = experienceOf(step);
      const phase = phaseStartOf(step);
      // A phase heading sits on its own line, at the indentation of what it starts.
      if (phase) push(`${ind}## ${phase.replace(/\\/g, "\\\\")}`);
      const handle = `s${Object.keys(handles).length + 1}`;
      handles[handle] = id;
      push(
        `${ind}${prefix}${lanePrefix}${marker}${nameOf(id)}${score ? ` [${score}]` : ""}${
          options.handles ? ` {#${handle}}` : ""
        }`,
        id,
      );
      const exits = reading.outgoing.get(id) ?? [];
      const underExit = prefix !== "";
      // What follows an exit's first line goes one level deeper than the exit.
      if (underExit) ind += INDENT;
      prefix = "";
      if (isGuidedEnd(step)) return;
      if (isGuidedDecision(step)) {
        const exitIndent = underExit ? ind : ind + INDENT;
        for (const exit of exits) {
          writtenConnections.push(exit.id);
          emit(exit.targetId, exitIndent, exit.label);
        }
        return;
      }
      const next = exits[0];
      if (!next) return;
      writtenConnections.push(next.id);
      id = next.targetId;
    }
  };

  if (start) {
    written.add(start.id);
    const startLane = reading.laneOf.get(start.id);
    // The start step is not written (an outline is added after the start); its lane is current.
    if (startLane !== currentLane) push(`${escapeOutlineLane(laneName.get(startLane!) ?? "")}:`);
    currentLane = startLane;
    const first = reading.outgoing.get(start.id)?.[0];
    if (first) {
      writtenConnections.push(first.id);
      emit(first.targetId, "", null);
    }
  }

  const omittedSteps = [...reading.steps.keys()].filter((id) => !written.has(id)).length;
  const totalConnections = [...reading.outgoing.values()].reduce((n, list) => n + list.length, 0);
  const omittedConnections = totalConnections - writtenConnections.length;
  if (omittedSteps > 0)
    push(`# ${ctx.t("diagramKinds.guided.outline.omittedSteps", { count: omittedSteps })}`);
  else if (omittedConnections > 0)
    push(
      `# ${ctx.t("diagramKinds.guided.outline.omittedConnections", { count: omittedConnections })}`,
    );
  return { text: `${lines.join("\n")}\n`, lineIds, handles, writtenConnections };
}

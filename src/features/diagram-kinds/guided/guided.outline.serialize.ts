import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindContext } from "../kind.types";
import { experienceOf, isGuidedDecision, isGuidedEnd, readGuided } from "./guided.model";
import { escapeOutlineText } from "./guided.outline.parse";

const INDENT = "  ";

/**
 * Writes a guided journey as an outline (spec guided-journey-outline). The lanes
 * are declared first, in order; the sequence follows from the start step, each
 * decision's exits indented under it, and a step reached again is a jump. The
 * outline added to a new guided diagram gives the same journey back.
 */
export function serializeGuidedOutline(diagram: DiagramModel, ctx: KindContext): string {
  const reading = readGuided(diagram);
  const lines: string[] = [];
  const laneName = new Map(reading.lanes.map((lane) => [lane.id, lane.name]));
  for (const lane of reading.lanes) lines.push(`${escapeOutlineText(lane.name)}:`);
  let currentLane: string | undefined = reading.lanes[reading.lanes.length - 1]?.id;

  const start = reading.starts[0];
  const written = new Set<string>();
  let writtenConnections = 0;
  const nameOf = (id: string) => escapeOutlineText(reading.steps.get(id)?.name ?? "");

  /** From `id` on: the first line under an exit (`label`), the rest one level deeper. */
  const emit = (firstId: string, indent: string, label: string | null) => {
    let id = firstId;
    let prefix = label === null ? "" : label ? `${escapeOutlineText(label)} -> ` : "-> ";
    let ind = indent;
    for (;;) {
      if (written.has(id)) {
        lines.push(`${ind}${prefix || "-> "}@${nameOf(id)}`);
        return;
      }
      written.add(id);
      const step = reading.steps.get(id)!;
      const lane = reading.laneOf.get(id);
      const lanePrefix =
        lane !== currentLane ? `${escapeOutlineText(laneName.get(lane!) ?? "")}: ` : "";
      currentLane = lane;
      const marker = isGuidedDecision(step) ? "? " : isGuidedEnd(step) ? "! " : "";
      const score = experienceOf(step);
      lines.push(`${ind}${prefix}${lanePrefix}${marker}${nameOf(id)}${score ? ` [${score}]` : ""}`);
      const exits = reading.outgoing.get(id) ?? [];
      const underExit = prefix !== "";
      // What follows an exit's first line goes one level deeper than the exit.
      if (underExit) ind += INDENT;
      prefix = "";
      if (isGuidedEnd(step)) return;
      if (isGuidedDecision(step)) {
        const exitIndent = underExit ? ind : ind + INDENT;
        for (const exit of exits) {
          writtenConnections += 1;
          emit(exit.targetId, exitIndent, exit.label);
        }
        return;
      }
      const next = exits[0];
      if (!next) return;
      writtenConnections += 1;
      id = next.targetId;
    }
  };

  if (start) {
    written.add(start.id);
    const startLane = reading.laneOf.get(start.id);
    // The start step is not written (an outline is added after the start); its lane is current.
    if (startLane !== currentLane)
      lines.push(`${escapeOutlineText(laneName.get(startLane!) ?? "")}:`);
    currentLane = startLane;
    const first = reading.outgoing.get(start.id)?.[0];
    if (first) {
      writtenConnections += 1;
      emit(first.targetId, "", null);
    }
  }

  const omittedSteps = [...reading.steps.keys()].filter((id) => !written.has(id)).length;
  const totalConnections = [...reading.outgoing.values()].reduce((n, list) => n + list.length, 0);
  const omittedConnections = totalConnections - writtenConnections;
  if (omittedSteps > 0)
    lines.push(`# ${ctx.t("diagramKinds.guided.outline.omittedSteps", { count: omittedSteps })}`);
  else if (omittedConnections > 0)
    lines.push(
      `# ${ctx.t("diagramKinds.guided.outline.omittedConnections", { count: omittedConnections })}`,
    );
  return `${lines.join("\n")}\n`;
}

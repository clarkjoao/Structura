import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindContext } from "../kind.types";
import {
  isGuidedDecision,
  isGuidedEnd,
  participantsOf,
  readGuided,
  readingOrder,
} from "./guided.model";
import { guidedPhases } from "./guided.phases";

/** Markdown text: characters that would start markup are escaped. */
const md = (text: string) => text.replace(/([\\`*_[\]#|<>])/g, "\\$1").trim();

/**
 * The journey as a Markdown document (spec guided-journey-sharing): one section per
 * phase in reading order, each step with its lane and participants, each decision
 * with its labelled exits; a way back to an earlier step is written as such.
 */
export function serializeGuidedDocument(diagram: DiagramModel, ctx: KindContext): string {
  const reading = readGuided(diagram);
  const order = readingOrder(reading).filter((id) => reading.steps.get(id)?.flowShape !== "start");
  const position = new Map(order.map((id, index) => [id, index]));
  const { phases, phaseOf } = guidedPhases(reading);
  const laneName = new Map(reading.lanes.map((lane) => [lane.id, lane.name]));
  const nameOf = (id: string) => reading.steps.get(id)?.name ?? "";

  const lines: string[] = [`# ${md(diagram.name)}`, ""];
  let current: number | undefined | null = null;
  for (const id of order) {
    const phase = phaseOf.get(id);
    if (phase !== current) {
      if (current !== null) lines.push("");
      lines.push(
        `## ${md(phase === undefined ? ctx.t("diagramKinds.guided.document.beforePhases") : phases[phase]!.name)}`,
        "",
      );
      current = phase;
    }
    const step = reading.steps.get(id)!;
    const lane = laneName.get(reading.laneOf.get(id) ?? "") ?? "";
    const others = participantsOf(step, lane);
    const who = [lane, ...others].filter(Boolean).map(md).join(", ");
    const marker = isGuidedDecision(step)
      ? `${ctx.t("diagramKinds.guided.document.decision")}: `
      : isGuidedEnd(step)
        ? `${ctx.t("diagramKinds.guided.document.end")}: `
        : "";
    lines.push(`- ${marker}**${md(step.name)}**${who ? ` — ${who}` : ""}`);
    const exits = reading.outgoing.get(id) ?? [];
    const branches = isGuidedDecision(step) || exits.length > 1;
    for (const exit of exits) {
      const back = (position.get(exit.targetId) ?? Infinity) <= (position.get(id) ?? -1);
      const target = back
        ? ctx.t("diagramKinds.guided.document.backTo", { name: md(nameOf(exit.targetId)) })
        : md(nameOf(exit.targetId));
      // A plain sequence needs no line; a branch or a way back does.
      if (!branches && !back) continue;
      const label = exit.label?.trim();
      lines.push(`  - ${label ? `${md(label)} → ` : "→ "}${target}`);
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

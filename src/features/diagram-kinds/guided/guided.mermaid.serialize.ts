import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindContext } from "../kind.types";
import {
  isGuidedDecision,
  isGuidedEnd,
  participantsOf,
  readGuided,
  readingOrder,
  visibilityLaneOf,
} from "./guided.model";
import { guidedPhases, phaseStartOf } from "./guided.phases";

/**
 * A guided journey written as Mermaid (spec guided-mermaid-interchange). The
 * swimlane form keeps everything and reads back to the same journey; the
 * journey form keeps the main path, as Mermaid's `journey` has no branches.
 */

/** A label as Mermaid reads it back: quoted when it holds syntax. */
function label(text: string): string {
  const clean = text.replace(/"/g, "'").replace(/\s+/g, " ").trim();
  return /[[\](){}|<>;%@&#:]/.test(clean) || clean === "" ? `"${clean}"` : clean;
}

function node(id: string, name: string, shape: FlowNodeShape): string {
  const text = label(name);
  switch (shape) {
    case "diamond":
      return `${id}{${text}}`;
    case "cylinder":
      return `${id}[(${text})]`;
    case "subroutine":
      return `${id}[[${text}]]`;
    case "start":
      return `${id}((${text}))`;
    case "end":
      return `${id}(((${text})))`;
    case "document":
      return `${id}@{ shape: doc, label: "${text.replace(/^"|"$/g, "")}" }`;
    case "event":
      return `${id}@{ shape: event, label: "${text.replace(/^"|"$/g, "")}" }`;
    default:
      return `${id}[${text}]`;
  }
}

export function serializeMermaidSwimlane(diagram: DiagramModel, ctx: KindContext): string {
  const reading = readGuided(diagram);
  const order = readingOrder(reading);
  const idOf = new Map(order.map((stepId, index) => [stepId, `s${index + 1}`]));
  const lines = [
    `%% ${ctx.t("diagramKinds.guided.mermaid.exportedFrom", { name: diagram.name })}`,
    `swimlane-beta ${diagram.direction === "TB" ? "TB" : "LR"}`,
  ];
  reading.lanes.forEach((lane, index) => {
    lines.push(`  subgraph lane${index + 1} [${label(lane.name)}]`);
    for (const stepId of order) {
      if (reading.laneOf.get(stepId) !== lane.id) continue;
      const step = reading.steps.get(stepId)!;
      lines.push(`    ${node(idOf.get(stepId)!, step.name, step.flowShape)}`);
    }
    lines.push("  end");
  });
  lines.push("");
  for (const stepId of order) {
    for (const exit of reading.outgoing.get(stepId) ?? []) {
      const text = exit.label?.trim();
      lines.push(
        `  ${idOf.get(stepId)} -->${text ? `|${text.replace(/\|/g, "/")}|` : ""} ${idOf.get(exit.targetId)}`,
      );
    }
  }
  // Mermaid has no phase starts: Structura keeps them in a comment it reads back.
  const phased = order.flatMap((stepId) => {
    const phase = phaseStartOf(reading.steps.get(stepId)!);
    return phase ? [`${idOf.get(stepId)}=${phase.replace(/[,=\n]/g, " ").trim()}`] : [];
  });
  if (phased.length > 0) lines.push(`  %% phases: ${phased.join(", ")}`);
  // Participants and the line of visibility, likewise (spec guided-journey-blueprint).
  const laneNameOf = (stepId: string) =>
    reading.lanes.find((lane) => lane.id === reading.laneOf.get(stepId))?.name;
  const shared = order.flatMap((stepId) => {
    const names = participantsOf(reading.steps.get(stepId)!, laneNameOf(stepId));
    const clean = names.map((n) => n.replace(/[,=|\n]/g, " ").trim()).filter(Boolean);
    return clean.length > 0 ? [`${idOf.get(stepId)}=${clean.join("|")}`] : [];
  });
  if (shared.length > 0) lines.push(`  %% participants: ${shared.join(", ")}`);
  const backstage = visibilityLaneOf(diagram, reading);
  const backstageIndex = reading.lanes.findIndex((lane) => lane.id === backstage);
  if (backstageIndex > 0) lines.push(`  %% visibility: lane${backstageIndex + 1}`);
  return `${lines.join("\n")}\n`;
}

/** The main path (each decision's first exit) as a Mermaid journey; an unscored step is a neutral 3. */
export function serializeMermaidJourney(diagram: DiagramModel, ctx: KindContext): string {
  const reading = readGuided(diagram);
  const laneName = new Map(reading.lanes.map((lane) => [lane.id, lane.name]));
  const path: string[] = [];
  const seen = new Set<string>();
  let at: string | undefined = reading.starts[0]?.id;
  while (at && !seen.has(at)) {
    seen.add(at);
    path.push(at);
    at = reading.outgoing.get(at)?.[0]?.targetId;
  }
  const tasks = path.filter((id) => {
    const step = reading.steps.get(id)!;
    return step.flowShape !== "start" && !isGuidedEnd(step);
  });
  const clean = (text: string) => text.replace(/[:\n]/g, " ").replace(/\s+/g, " ").trim();
  const { phases, phaseOf } = guidedPhases(reading);
  const lines = ["journey", `  title ${clean(diagram.name)}`];
  // One section per phase along the path; the diagram's name before the first phase.
  let section: number | undefined | null = null;
  for (const id of tasks) {
    const phase = phaseOf.get(id);
    if (phase !== section) {
      lines.push(`  section ${clean(phase === undefined ? diagram.name : phases[phase]!.name)}`);
      section = phase;
    }
    const step = reading.steps.get(id)!;
    const lane = laneName.get(reading.laneOf.get(id)!) ?? "";
    // The lane is the first actor; the participants follow (spec guided-journey-blueprint).
    const actors = [lane, ...participantsOf(step, lane)]
      .map((name) => clean(name).replace(/,/g, " "))
      .join(", ");
    // Mermaid requires a score; Structura keeps none, so every task is a neutral 3.
    lines.push(`    ${clean(step.name)}: 3: ${actors}`);
  }
  const branches = path.reduce(
    (n, id) =>
      n +
      (isGuidedDecision(reading.steps.get(id)!)
        ? Math.max(0, (reading.outgoing.get(id)?.length ?? 0) - 1)
        : 0),
    0,
  );
  const leftOut = [...reading.steps.keys()].filter((id) => !seen.has(id)).length;
  if (branches > 0 || leftOut > 0)
    lines.push(
      `  %% ${ctx.t("diagramKinds.guided.mermaid.journeyLeftOut", { steps: leftOut, branches })}`,
    );
  return `${lines.join("\n")}\n`;
}

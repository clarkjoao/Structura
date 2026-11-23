import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindMarker } from "../kind.types";
import {
  isGuidedDecision,
  isGuidedEnd,
  participantsOf,
  readGuided,
  readingOrder,
} from "./guided.model";

/**
 * The guided quiet checks (spec: Quiet checks mark what is missing): a
 * decision exit without a label, and a step that ends a path without being an
 * end step; and the participants tags. Never a dialog, never blocking; gone as soon as the cause is.
 */
export function guidedChecks(diagram: DiagramModel): KindMarker[] {
  const reading = readGuided(diagram);
  const markers: KindMarker[] = [];
  // In reading order, so a host walking the markers (the pain points) follows the journey.
  for (const id of readingOrder(reading)) {
    const step = reading.steps.get(id)!;
    const exits = reading.outgoing.get(id) ?? [];
    if (isGuidedDecision(step)) {
      for (const exit of exits) {
        if (!exit.label?.trim()) {
          markers.push({
            code: "unlabelledExit",
            elementId: exit.id,
            onConnection: true,
            message: { key: "diagramKinds.guided.checks.unlabelledExit" },
          });
        }
      }
    }
    // Participants besides the lane (spec guided-journey-blueprint): a tag, never a check.
    const laneName = reading.lanes.find((l) => l.id === reading.laneOf.get(id))?.name;
    const participants = participantsOf(step, laneName);
    if (participants.length > 0) {
      const head =
        participants[0]!.length > 18 ? `${participants[0]!.slice(0, 17)}…` : participants[0]!;
      markers.push({
        code: "participants",
        elementId: id,
        onConnection: false,
        message: { key: "diagramKinds.guided.blueprint.participants" },
        tag: {
          text: `+ ${head}${participants.length > 1 ? ` +${participants.length - 1}` : ""}`,
          title: participants.join(", "),
        },
        marks: false,
      });
    }
    if (exits.length === 0 && !isGuidedEnd(step)) {
      markers.push({
        code: "openEnd",
        elementId: id,
        onConnection: false,
        message: { key: "diagramKinds.guided.checks.openEnd" },
      });
    }
  }
  return markers;
}

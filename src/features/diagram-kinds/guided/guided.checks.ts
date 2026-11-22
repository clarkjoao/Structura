import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindMarker } from "../kind.types";
import {
  EXPERIENCE_FACES,
  experienceOf,
  isGuidedDecision,
  isGuidedEnd,
  isPainPoint,
  readGuided,
  readingOrder,
} from "./guided.model";

/**
 * The guided quiet checks (spec: Quiet checks mark what is missing): a
 * decision exit without a label, and a step that ends a path without being an
 * end step; and the experience badges, pain points outlined. Never a dialog, never blocking; gone as soon as the cause is.
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
    // The experience score (spec guided-journey-experience): a badge; 1–2 is a pain point.
    const score = experienceOf(step);
    if (score !== null) {
      const pain = isPainPoint(score);
      markers.push({
        code: pain ? "painPoint" : "experience",
        elementId: id,
        onConnection: false,
        message: {
          key: pain
            ? "diagramKinds.guided.checks.painPoint"
            : "diagramKinds.guided.checks.experience",
        },
        values: { score },
        badge: {
          text: `${EXPERIENCE_FACES[score - 1]} ${score}`,
          tone: pain ? "danger" : score === 3 ? "neutral" : "success",
        },
        marks: pain,
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

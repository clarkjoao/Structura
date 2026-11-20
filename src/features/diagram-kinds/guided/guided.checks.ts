import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindMarker } from "../kind.types";
import { isGuidedDecision, isGuidedEnd, readGuided } from "./guided.model";

/**
 * The guided quiet checks (spec: Quiet checks mark what is missing): a
 * decision exit without a label, and a step that ends a path without being an
 * end step. Never a dialog, never blocking; gone as soon as the cause is.
 */
export function guidedChecks(diagram: DiagramModel): KindMarker[] {
  const reading = readGuided(diagram);
  const markers: KindMarker[] = [];
  for (const [id, step] of reading.steps) {
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

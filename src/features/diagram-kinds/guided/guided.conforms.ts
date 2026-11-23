import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindContext, KindIssue } from "../kind.types";
import {
  isGuidedAnnotation,
  isGuidedLane,
  isGuidedStart,
  isGuidedStep,
  readGuided,
} from "./guided.model";

const issue = (code: string, elementId: string | null): KindIssue => ({
  code,
  elementId,
  message: { key: `diagramKinds.guided.issues.${code}` },
});

/**
 * Whether a diagram can be guided (spec: Guided conformance). Free text and
 * notes are ignored. Every failure names its element, so the return can list
 * it and select it.
 */
export function guidedConforms(diagram: DiagramModel, ctx: KindContext): KindIssue[] {
  const { components, connections } = getCachedCanvasSnapshot(diagram);
  const issues: KindIssue[] = [];
  const reading = readGuided(diagram);

  if (reading.lanes.length === 0) issues.push(issue("noLane", null));

  for (const component of Object.values(components)) {
    if (isGuidedAnnotation(component)) continue;
    if (!ctx.isElementRegistered(component.type)) {
      issues.push(issue("unknownElement", component.id));
      continue;
    }
    if (isGuidedLane(component)) {
      if (component.parentId !== null) issues.push(issue("nestedLane", component.id));
      continue;
    }
    const parent = component.parentId ? components[component.parentId] : undefined;
    if (!parent || !isGuidedLane(parent)) {
      issues.push(issue("outsideLane", component.id));
      continue;
    }
    if (!isGuidedStep(component)) issues.push(issue("notAStep", component.id));
  }

  const starts = Object.values(components).filter(
    (c) => isGuidedStart(c) && reading.steps.has(c.id),
  );
  if (starts.length === 0) issues.push(issue("noStart", null));
  for (const extra of starts.sort((a, b) => a.id.localeCompare(b.id)).slice(1)) {
    issues.push(issue("extraStart", extra.id));
  }

  for (const connection of Object.values(connections)) {
    const source = components[connection.sourceId];
    const target = components[connection.targetId];
    if (source && isGuidedAnnotation(source)) continue;
    if (target && isGuidedAnnotation(target)) continue;
    if (!reading.steps.has(connection.sourceId) || !reading.steps.has(connection.targetId)) {
      issues.push(issue("connectionNotBetweenSteps", connection.id));
    }
  }
  return issues;
}

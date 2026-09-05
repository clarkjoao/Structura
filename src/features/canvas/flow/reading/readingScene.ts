import { isConditionStep } from "@/features/diagram";
import type { Component, Connection, FlowStep } from "@/features/diagram";
import { componentSwatchColor, componentTechnology } from "../../nodes/componentColor";

/** The element a step happens at, said the way the reading rail says it. */
export interface StepTarget {
  name: string;
  /** The element's technology, when it carries one. */
  detail?: string;
  /** Palette color of the element's category, for the swatch. */
  color: string;
}

/** Already-translated fallbacks, so the heading stays free of React and i18next. */
export interface StepHeadingLabels {
  componentRemoved: string;
  connectionRemoved: string;
  connection: string;
  untitled: string;
}

/**
 * Where the step lands.
 *
 * A step on a node happens *at* that node. A step on a connection happens at
 * the end the payload arrives on — the target for a request, the source for
 * the response coming back — which is what makes "no Antifraude" and then "no
 * Gateway" read as one round trip rather than as the same edge said twice.
 */
export function describeStepTarget(
  step: FlowStep | null | undefined,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): StepTarget | null {
  if (!step) return null;

  if (step.componentId) {
    const component = components[step.componentId];
    return component ? toTarget(component) : null;
  }

  if (step.connectionId) {
    const connection = connections[step.connectionId];
    if (!connection) return null;
    const landsOn =
      step.payloadDirection === "response" ? connection.sourceId : connection.targetId;
    const component = components[landsOn];
    return component ? toTarget(component) : null;
  }

  return null;
}

function toTarget(component: Component): StepTarget {
  return {
    name: component.name,
    detail: componentTechnology(component),
    color: componentSwatchColor(component),
  };
}

/**
 * The one line that names a step in the spine.
 *
 * The author's own heading wins: it is the only thing on the step written for
 * a reader rather than derived from what the step points at. Everything below
 * it is a fallback, in the order a reader would recognise the step by.
 */
export function describeStepHeading(
  step: FlowStep,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
  labels: StepHeadingLabels,
): string {
  if (step.title?.trim()) return step.title.trim();

  // A condition is its question. It sits on a node like any other step, but
  // the node is only where the question is asked — the scene says that on its
  // own line, and a spine row reading "Antifraude" would hide the fork.
  if (isConditionStep(step) && step.conditionLabel?.trim()) return step.conditionLabel.trim();

  if (step.componentId) {
    const component = components[step.componentId];
    return component ? component.name : labels.componentRemoved;
  }

  if (step.connectionId) {
    const connection = connections[step.connectionId];
    if (!connection) return labels.connectionRemoved;
    return connection.label?.trim() || labels.connection;
  }

  if (step.conditionLabel?.trim()) return step.conditionLabel.trim();
  if (step.note?.trim()) return step.note.trim();

  return labels.untitled;
}

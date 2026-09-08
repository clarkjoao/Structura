import type { Connection, FlowStep } from "@/features/diagram";

/**
 * The call a step makes, in the words the diagram already uses for it.
 *
 * A step that points at a connection *is* a call — the label the author gave
 * the edge is what a reader recognises the step by, far more than the node it
 * lands on. The reading rail promotes it to the headline of the scene, so it
 * has to come off the connection every time rather than being stored on the
 * step and drifting out of date.
 */
export interface StepCall {
  /** What the connection is called — `POST /v2/score`, `publish order.paid`. */
  label: string;
  /** Which way the payload runs, when the step says. */
  direction: "request" | "response" | null;
}

/**
 * The call `step` makes, or `null` when it makes none.
 *
 * None means one of three things, and the rail treats them alike: the step
 * points at a node rather than an edge, the connection is no longer in the
 * view — `describeStepElement` is the one that explains that — or the edge was
 * never named and carries no technology either. A step's `handleId` is
 * deliberately not a fallback: it is a port id (`source-0`), so it names a slot
 * on the node and would read as noise where a call is expected.
 */
export function describeStepCall(
  step: FlowStep | null | undefined,
  connections: Record<string, Connection>,
): StepCall | null {
  if (!step?.connectionId) return null;

  const connection = connections[step.connectionId];
  if (!connection) return null;

  const label = connection.label?.trim() || connection.technology?.trim();
  if (!label) return null;

  return { label, direction: step.payloadDirection ?? null };
}

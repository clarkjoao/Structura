import type { ConnectionIntent } from "./connection.types";

export type FlowStepType = "action" | "condition" | "note";

/**
 * What a branch point means: whether the reading takes one way out or all of
 * them.
 *
 * `par` is the odd one — its branches are threads that all happen, so a
 * reading that presents them as a choice is describing a different flow. The
 * other five are all "one way out" and differ only in what the diagram calls
 * the fork, which is why the reading treats them alike.
 *
 * Absent means `alt`, which is what every condition written before this field
 * existed meant, so nothing has to be rewritten for a script to keep reading
 * exactly as it did.
 */
export type FlowConditionKind = "alt" | "opt" | "loop" | "par" | "critical" | "break";

export interface FlowBranch {
  label: string;
  nextId: string;
}

/**
 * What a step does to the reading's running object.
 *
 * Every member is optional and a step carrying none reads exactly as a step
 * written before this existed. The values are example data someone typed, kept
 * as text on purpose: typing them would be the first step towards a schema
 * language, and a flow is documentation of one run, not a program.
 */
export interface FlowStepContext {
  /** Values this step introduces, folded into the running object as it is read. */
  sets?: Record<string, string>;
  /** Keys this step consumes, so the reading can say what it depends on. */
  reads?: string[];
  /**
   * The body this call expects back, as JSON text — the same shape as `payload`,
   * so there is one parser and one failure mode.
   *
   * Only worth writing when it says something the step that closes the frame
   * does not: without it the reading derives the preview from that step's own
   * payload, which can never disagree with itself.
   */
  expects?: string;
}

export interface FlowStep {
  id: string;
  type: FlowStepType;

  next?: string;
  branches?: FlowBranch[];

  /**
   * A short heading the author writes for this step, shown while reading.
   *
   * Optional, like `note`: a script recorded before either existed carries
   * neither, and reading it shows exactly what it showed before. Together they
   * are what turns stepping through a flow into reading one — without them a
   * step says only which component it points at.
   */
  title?: string;
  componentId?: string;
  connectionId?: string;
  description?: string;
  note?: string;
  handleId?: string;
  duration?: string;
  payload?: string;
  payloadDirection?: "request" | "response";
  isAsync?: boolean;
  connectionIntent?: ConnectionIntent;
  context?: FlowStepContext;

  conditionLabel?: string;
  conditionKind?: FlowConditionKind;
}

export interface Flow {
  id: string;
  name: string;
  mermaid: string;
  diagramId: string;
  description?: string;
  tags?: string[];
  entryStepId?: string;
  steps: Record<string, FlowStep>;
}

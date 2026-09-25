import type {
  Component,
  SfnRetry,
  SfnStateComponent,
  SfnStateType,
} from "../model/component.types";
import type { NodeLayout } from "../model/layout.types";
import {
  isSfnMapComponent,
  isSfnParallelComponent,
  isSfnStateComponent,
} from "../model/component.guards";

/*
 * What a state machine shows of its states, derived — never stored: how many
 * states it has, a Parallel's branches, a state's retry badge, a Task's
 * "Service · Action" caption.
 */

export const DEFAULT_SFN_STATE_TYPE: SfnStateType = "Task";
/** ASL's defaults for a retrier's fields. */
export const ASL_RETRY_DEFAULTS = { maxAttempts: 3, backoffRate: 2, intervalSeconds: 1 } as const;

export function sfnStateType(state: SfnStateComponent): SfnStateType {
  return state.stateType ?? DEFAULT_SFN_STATE_TYPE;
}

/** Whether a component is a state of a machine: a state proper, a Parallel or a Map — not the entry marker. */
export function isSfnStep(component: Component): boolean {
  if (isSfnParallelComponent(component) || isSfnMapComponent(component)) return true;
  return isSfnStateComponent(component) && sfnStateType(component) !== "Start";
}

/** The states inside `containerId`, at any depth (a Parallel's branches, a Map's iterator). */
export function sfnStateCount(containerId: string, components: Record<string, Component>): number {
  const children = new Map<string, Component[]>();
  for (const component of Object.values(components)) {
    if (!component.parentId) continue;
    const siblings = children.get(component.parentId) ?? [];
    siblings.push(component);
    children.set(component.parentId, siblings);
  }
  let count = 0;
  const seen = new Set<string>([containerId]);
  const stack = [containerId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of children.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      if (isSfnStep(child)) count += 1;
      stack.push(child.id);
    }
  }
  return count;
}

/**
 * A Parallel's branches: its children grouped into columns — states whose
 * horizontal spans overlap run in one branch. Returned left to right, with
 * the x of the gap between each branch and the next (where the divider goes).
 */
export function parallelBranches(
  parallelId: string,
  components: Record<string, Component>,
  layouts: Record<string, NodeLayout>,
): { branches: string[][]; dividers: number[] } {
  const spans = Object.values(components)
    .filter((c) => c.parentId === parallelId && layouts[c.id])
    .map((c) => ({
      id: c.id,
      x: layouts[c.id].x,
      right: layouts[c.id].x + (layouts[c.id].width ?? 0),
    }))
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const branches: string[][] = [];
  const dividers: number[] = [];
  let right = Number.NEGATIVE_INFINITY;
  for (const span of spans) {
    if (branches.length === 0 || span.x >= right) {
      if (branches.length > 0) dividers.push(Math.round((right + span.x) / 2));
      branches.push([span.id]);
      right = span.right;
    } else {
      branches[branches.length - 1].push(span.id);
      right = Math.max(right, span.right);
    }
  }
  return { branches, dividers };
}

/**
 * The badge a state's retriers earn: "retry 3× · backoff 2", from the first
 * retrier with ASL's defaults filled in, "+N" for the others. None, nothing.
 */
export function retryBadge(retry: readonly SfnRetry[] | undefined): string | null {
  if (!retry || retry.length === 0) return null;
  const [first] = retry;
  const attempts = first.maxAttempts ?? ASL_RETRY_DEFAULTS.maxAttempts;
  const backoff = first.backoffRate ?? ASL_RETRY_DEFAULTS.backoffRate;
  const more = retry.length > 1 ? ` +${retry.length - 1}` : "";
  return `retry ${attempts}× · backoff ${backoff}${more}`;
}

/** A Task's integrated services, by the id stored in `service`: the name shown and draw.io's aws4 icon. */
export const SFN_SERVICES: Readonly<Record<string, { label: string; aws4: string }>> = {
  lambda: { label: "Lambda", aws4: "lambda" },
  dynamodb: { label: "DynamoDB", aws4: "dynamodb" },
  sqs: { label: "SQS", aws4: "sqs" },
  sns: { label: "SNS", aws4: "sns" },
  ecs: { label: "ECS", aws4: "ecs" },
  ses: { label: "SES", aws4: "simple_email_service" },
  s3: { label: "S3", aws4: "s3" },
  glue: { label: "Glue", aws4: "glue" },
  eventbridge: { label: "EventBridge", aws4: "eventbridge" },
  bedrock: { label: "Bedrock", aws4: "bedrock" },
  apigateway: { label: "API Gateway", aws4: "api_gateway" },
  stepfunctions: { label: "Step Functions", aws4: "step_functions" },
};

/** "Lambda · Invoke"; the service as typed when it is not one we know; nothing without one. */
export function taskCaption(state: SfnStateComponent): string | null {
  if (!state.service) return state.action ?? null;
  const service = SFN_SERVICES[state.service]?.label ?? state.service;
  return state.action ? `${service} · ${state.action}` : service;
}

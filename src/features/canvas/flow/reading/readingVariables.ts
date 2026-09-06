import type { Flow, FlowCallStack } from "@/features/diagram";
import { findFrameExit } from "@/features/diagram";

/**
 * The object a step carries, and the one the reading has built up.
 *
 * Two different questions live here and are kept apart on purpose. The payload
 * roots answer *what does this call send, and what comes back* — the contract,
 * which is a property of the step. The running object answers *what is known by
 * now*, which is a property of the walk and exists only while it is being read.
 */

/** Parsed JSON, or null when the payload is prose. Never throws. */
export function parsePayload(payload: string | undefined): unknown | null {
  const text = payload?.trim();
  if (!text) return null;
  // Only object and array bodies are worth a tree; a bare number or a quoted
  // string parses fine and would render as a one-line tree saying nothing.
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** The body a step carries, in whichever form it turned out to be. */
export interface PayloadView {
  /** Parsed when the payload is a JSON object or array. */
  json: unknown | null;
  /** The raw text, always present when there is a payload at all. */
  text: string;
  /** Which way the body is travelling, when the step says. */
  direction: "request" | "response" | null;
}

export function describePayload(flow: Flow, stepId: string | null): PayloadView | null {
  const step = stepId ? flow.steps[stepId] : undefined;
  const text = step?.payload?.trim();
  if (!step || !text) return null;
  return { json: parsePayload(text), text, direction: step.payloadDirection ?? null };
}

/** What the step being read expects to come back. */
export interface ExpectedView {
  /** Absent when the call is one nobody answers. */
  payload: PayloadView | null;
  /** The step the preview was taken from, when it was derived from one. */
  fromStepId: string | null;
  /** True when the author wrote the expectation rather than it being derived. */
  explicit: boolean;
  /** True for a call that returns nothing — said out loud rather than omitted. */
  nothingComesBack: boolean;
}

/**
 * The other half of the contract, at the moment the call is made.
 *
 * Derived before it is a field: the calls are already paired, so the body that
 * comes back is the payload of the step that closes the frame. An explicit
 * `expects` exists only to say something that step does not — and it is having
 * both that makes the comparison below mean anything.
 */
export function describeExpected(
  flow: Flow,
  callStack: FlowCallStack,
  stepId: string | null,
): ExpectedView | null {
  if (!stepId) return null;
  const step = flow.steps[stepId];
  const frameId = callStack.byStep.get(stepId)?.opensFrameId;
  if (!step || !frameId) return null;

  const explicit = step.context?.expects?.trim();
  if (explicit) {
    return {
      payload: { json: parsePayload(explicit), text: explicit, direction: "response" },
      fromStepId: null,
      explicit: true,
      nothingComesBack: false,
    };
  }

  if (callStack.frames.get(frameId)?.detached) {
    return { payload: null, fromStepId: null, explicit: false, nothingComesBack: true };
  }

  const exit = findFrameExit(flow, callStack, stepId, frameId);
  const closesHere = exit && callStack.byStep.get(exit.targetStepId)?.closesFrameId === frameId;
  if (!exit || !closesHere) return null;

  const payload = describePayload(flow, exit.targetStepId);
  if (!payload) return null;
  return { payload, fromStepId: exit.targetStepId, explicit: false, nothingComesBack: false };
}

/** Whether what arrived is what was asked for. Reports; never blocks. */
export interface ContractCheck {
  missing: string[];
  unexpected: string[];
  matches: boolean;
}

function topLevelKeys(json: unknown | null): string[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.keys(json as Record<string, unknown>);
}

/**
 * Compares a declared expectation against the body that actually arrived.
 *
 * Only ever called when the author wrote an `expects`: a derived preview is the
 * response's own payload and could never disagree with itself, so a result here
 * always means someone asserted something.
 */
export function checkContract(
  flow: Flow,
  callStack: FlowCallStack,
  responseStepId: string,
): ContractCheck | null {
  const closes = callStack.byStep.get(responseStepId)?.closesFrameId;
  const opener = closes ? flow.steps[closes] : undefined;
  const expects = opener?.context?.expects?.trim();
  if (!expects) return null;

  const expected = topLevelKeys(parsePayload(expects));
  const arrived = topLevelKeys(describePayload(flow, responseStepId)?.json ?? null);
  if (expected.length === 0) return null;

  const arrivedSet = new Set(arrived);
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !arrivedSet.has(key));
  const unexpected = arrived.filter((key) => !expectedSet.has(key));
  return { missing, unexpected, matches: missing.length === 0 && unexpected.length === 0 };
}

/** One value the reading knows about, and where it came from. */
export interface ContextEntry {
  key: string;
  value: string;
  /** The step that introduced it. */
  fromStepId: string;
  /** The call it was introduced inside, or null on the outermost level. */
  frameId: string | null;
}

export interface ContextGroup {
  /** null for the outermost level, which has no call to name. */
  frameId: string | null;
  entries: ContextEntry[];
}

export interface RunningContext {
  /** Innermost call first, so what is closest to hand reads first. */
  groups: ContextGroup[];
  byKey: Map<string, ContextEntry>;
  /** Keys the step being read consumes that nothing before it introduced. */
  unsetReads: string[];
  /** Keys the step being read consumes, in the order it declares them. */
  reads: string[];
  size: number;
}

const EMPTY_CONTEXT: RunningContext = {
  groups: [],
  byKey: new Map(),
  unsetReads: [],
  reads: [],
  size: 0,
};

/** The call a step sits inside — not the one it makes. */
function enclosingFrameId(callStack: FlowCallStack, stepId: string): string | null {
  const info = callStack.byStep.get(stepId);
  if (!info || info.callDepth === 0) return null;
  return info.openFrameIds[info.callDepth - 1] ?? null;
}

/**
 * What the reading knows, folded from the steps it has walked.
 *
 * Derived rather than mutated, which is what makes going back correct without
 * an undo log: re-folding a shorter path *is* the earlier state. It also means
 * a value can never outlive the walk that produced it.
 *
 * A call taking its locals with it when it ends is the same idea as the depth
 * of a step — the only thing that crosses the boundary is what the closing step
 * itself introduces, and that step is already counted in the caller's frame.
 */
export function buildRunningContext(
  flow: Flow,
  callStack: FlowCallStack,
  path: readonly string[],
): RunningContext {
  if (path.length === 0) return EMPTY_CONTEXT;

  /** frameId (or "" for the outermost level) → key → entry. */
  const byFrame = new Map<string, Map<string, ContextEntry>>();
  const order: string[] = [];

  const drop = (frameId: string) => {
    byFrame.delete(frameId);
    const at = order.indexOf(frameId);
    if (at >= 0) order.splice(at, 1);
  };

  for (const stepId of path) {
    const step = flow.steps[stepId];
    if (!step) continue;

    // Calls that ended before this step take their locals with them.
    for (const entry of callStack.derivedReturnsBefore.get(stepId) ?? []) drop(entry.frameId);

    const info = callStack.byStep.get(stepId);
    if (info?.closesFrameId) drop(info.closesFrameId);

    const sets = step.context?.sets;
    if (!sets) continue;

    const frameId = enclosingFrameId(callStack, stepId);
    const bucketKey = frameId ?? "";
    let bucket = byFrame.get(bucketKey);
    if (!bucket) {
      bucket = new Map();
      byFrame.set(bucketKey, bucket);
      order.push(bucketKey);
    }
    for (const [key, value] of Object.entries(sets)) {
      bucket.set(key, { key, value, fromStepId: stepId, frameId });
    }
  }

  const byKey = new Map<string, ContextEntry>();
  const groups: ContextGroup[] = [];
  // Innermost first: the calls opened last are the ones the reader is in.
  for (const bucketKey of [...order].reverse()) {
    const bucket = byFrame.get(bucketKey);
    if (!bucket || bucket.size === 0) continue;
    groups.push({ frameId: bucketKey === "" ? null : bucketKey, entries: [...bucket.values()] });
    for (const entry of bucket.values()) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  }

  const current = path[path.length - 1];
  const reads = (current ? (flow.steps[current]?.context?.reads ?? []) : []).filter(Boolean);
  const unsetReads = reads.filter((key) => !byKey.has(key));

  return { groups, byKey, unsetReads, reads, size: byKey.size };
}

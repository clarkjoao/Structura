import type { Flow } from "../model/flow.types";
import type { FlowOutline } from "./flow-outline";

/**
 * One call the script has made and not yet been given back.
 *
 * A frame is opened by a step that names a connection and declares itself a
 * request, and closed by the step that answers on the same connection. It is
 * identified by the step that opened it: a step opens at most one call, so the
 * two are the same fact under different names.
 */
export interface CallFrame {
  /** Same value as `openedByStepId`, named apart so call sites read as frames. */
  id: string;
  openedByStepId: string;
  connectionId: string;
  /**
   * A call nobody returns — `isAsync`. It is recorded so the reading can say a
   * call was made, but it never deepens a later step and never joins the
   * breadcrumb: nothing is waiting on it.
   */
  detached: boolean;
}

/** Where one step sits in the calls open around it. */
export interface StepFrameInfo {
  /** How deep the reading is at this step. 0 on the outermost sequence. */
  callDepth: number;
  /** The frame this step opens, or null. */
  opensFrameId: string | null;
  /** The frame this step closes, or null. */
  closesFrameId: string | null;
  /**
   * The calls in play at this step, outermost first — the frames whose callers
   * are waiting, plus the one this step opens. Detached calls are absent.
   */
  openFrameIds: string[];
}

/**
 * A frame that ended without a step to say so.
 *
 * The reading draws a return row for it. Nothing is written to the flow: the
 * row exists for the length of a render, like the step numbers beside it.
 */
export interface DerivedReturn {
  frameId: string;
  /** Drawn immediately before this step. */
  beforeStepId: string;
  callDepth: number;
}

export interface FlowCallStack {
  frames: Map<string, CallFrame>;
  byStep: Map<string, StepFrameInfo>;
  /** Keyed by the step they are drawn before, innermost first. */
  derivedReturnsBefore: Map<string, DerivedReturn[]>;
  /** Responses that answered a call nobody had made. Reported, never guessed at. */
  orphanResponses: string[];
}

/** Where a call ends, and everything the reading passes on the way there. */
export interface FrameExit {
  /** The step the reading lands on. */
  targetStepId: string;
  /**
   * Steps walked through to get there, in reading order, excluding the step
   * started from and the one landed on. They happened; the reader simply did
   * not stop on them, so they belong in the history all the same.
   */
  throughStepIds: string[];
}

const EMPTY_INFO: StepFrameInfo = {
  callDepth: 0,
  opensFrameId: null,
  closesFrameId: null,
  openFrameIds: [],
};

/** What a step at rest looks like: the reading is flat and nothing is owed. */
export function emptyStepFrameInfo(): StepFrameInfo {
  return EMPTY_INFO;
}

/**
 * The calls a script has in the air, step by step.
 *
 * `payloadDirection` has always been a push/pop marker and nothing read it as
 * one: a request opens a call that is still owed a return, and the response on
 * the same connection closes it. This walks the outline's rows — the one
 * traversal that decides what is reachable and in what order — and keeps a
 * stack beside it.
 *
 * A script that declares no directions comes back with every step at depth 0
 * and nothing else set, which is exactly what the reading drew before any of
 * this existed.
 */
export function buildCallStack(flow: Flow, outline: FlowOutline): FlowCallStack {
  const frames = new Map<string, CallFrame>();
  const byStep = new Map<string, StepFrameInfo>();
  const derivedReturnsBefore = new Map<string, DerivedReturn[]>();
  const orphanResponses: string[] = [];

  /**
   * The stack as each condition left it. A branch is a different reading of the
   * same script, not a continuation of its sibling — so entering one restores
   * the calls that were open at the fork, and a frame left open inside one
   * branch cannot deepen the other.
   */
  const stackAtCondition = new Map<string, CallFrame[]>();
  let stack: CallFrame[] = [];

  for (const row of outline.rows) {
    if (row.isBranchHead && row.branch) {
      stack = [...(stackAtCondition.get(row.branch.conditionStepId) ?? [])];
    }

    const step = flow.steps[row.stepId];
    if (!step) continue;

    const connectionId = step.connectionId;
    const direction = step.payloadDirection;

    // Closing first: a response decides the depth of the step that carries it.
    let closesIndex = -1;
    if (connectionId && direction === "response") {
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i]!;
        // A detached call is not owed a return, so it cannot be the one being
        // answered here — this response belongs to nobody.
        if (frame.connectionId === connectionId && !frame.detached) {
          closesIndex = i;
          break;
        }
      }
      if (closesIndex < 0) orphanResponses.push(row.stepId);
    }

    if (closesIndex >= 0) {
      // Everything above the answered call ends here too. Those are the calls
      // whose returns nobody wrote down, and each one is a row the reading
      // draws for itself. Innermost first, the way a stack unwinds.
      const returns: DerivedReturn[] = [];
      for (let i = stack.length - 1; i > closesIndex; i--) {
        returns.push({ frameId: stack[i]!.id, beforeStepId: row.stepId, callDepth: i });
      }
      if (returns.length > 0) derivedReturnsBefore.set(row.stepId, returns);
      stack = stack.slice(0, closesIndex + 1);
    }

    const opens = Boolean(connectionId) && direction === "request";
    let openedFrame: CallFrame | null = null;
    if (opens && connectionId) {
      openedFrame = {
        id: row.stepId,
        openedByStepId: row.stepId,
        connectionId,
        detached: step.isAsync === true,
      };
      frames.set(openedFrame.id, openedFrame);
    }

    /**
     * A call and its return sit on the same row, and the work between them one
     * level in — the shape of a function body. So an opener is placed before
     * its own push, and a response at the index of the call it answers rather
     * than at the top of a stack it is about to shorten.
     */
    const callDepth = closesIndex >= 0 ? closesIndex : stack.length;

    const openFrameIds = stack.map((frame) => frame.id);
    if (openedFrame && !openedFrame.detached) openFrameIds.push(openedFrame.id);

    byStep.set(row.stepId, {
      callDepth,
      opensFrameId: openedFrame ? openedFrame.id : null,
      closesFrameId: closesIndex >= 0 ? stack[closesIndex]!.id : null,
      openFrameIds,
    });

    if (closesIndex >= 0) stack = stack.slice(0, closesIndex);
    if (openedFrame && !openedFrame.detached) stack = [...stack, openedFrame];

    if (row.isBranchPoint) stackAtCondition.set(row.stepId, [...stack]);
  }

  return { frames, byStep, derivedReturnsBefore, orphanResponses };
}

/**
 * Where a call ends, walked forward from a step inside or at it.
 *
 * The walk follows `next` and nothing else. A condition on the way is a choice
 * only the reader can make, so it ends the search rather than guessing a
 * branch — which is why skipping a call that forks is simply not offered.
 */
export function findFrameExit(
  flow: Flow,
  callStack: FlowCallStack,
  fromStepId: string,
  frameId: string,
): FrameExit | null {
  const frame = callStack.frames.get(frameId);
  if (!frame || frame.detached) return null;

  const through: string[] = [];
  const seen = new Set<string>([fromStepId]);
  let cursor = flow.steps[fromStepId]?.next;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const step = flow.steps[cursor];
    if (!step) return null;

    // The call ends before this step, with a return nobody wrote down.
    const returns = callStack.derivedReturnsBefore.get(cursor);
    if (returns?.some((entry) => entry.frameId === frameId)) {
      return { targetStepId: cursor, throughStepIds: through };
    }

    if (callStack.byStep.get(cursor)?.closesFrameId === frameId) {
      return { targetStepId: cursor, throughStepIds: through };
    }

    if (step.branches && step.branches.length > 0) return null;

    through.push(cursor);
    cursor = step.next;
  }

  return null;
}

/** The calls still owed a return once this step has been read. */
export function framesOpenAfter(callStack: FlowCallStack, stepId: string | null): string[] {
  if (!stepId) return [];
  const info = callStack.byStep.get(stepId);
  if (!info) return [];
  // `openFrameIds` already holds the frame the step opens; the one it closes is
  // still in there because the step sits *at* that call, not after it.
  return info.openFrameIds.filter((frameId) => frameId !== info.closesFrameId);
}

/**
 * Which way a click on a connection is travelling, while recording.
 *
 * The recorder does not have to ask. Clicking an edge that the script has
 * already gone down and not yet come back from is the way back — there is no
 * other thing it could be. Everything else is a call going out.
 *
 * This is what lets a recording produce a paired script without anyone
 * declaring a direction by hand.
 */
export function directionForRecordedClick(
  flow: Flow,
  outline: FlowOutline,
  tailStepId: string | null | undefined,
  connectionId: string,
): "request" | "response" {
  if (!tailStepId) return "request";
  const callStack = buildCallStack(flow, outline);
  const open = framesOpenAfter(callStack, tailStepId);
  const answers = open.some(
    (frameId) => callStack.frames.get(frameId)?.connectionId === connectionId,
  );
  return answers ? "response" : "request";
}

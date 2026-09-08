import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { Flow, FlowStep } from "@/features/diagram";
import { FlowModeProvider, useFlowMode } from "./FlowModeContext";
import type { FlowModeState } from "./flowMode.types";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * Skipping a call, and leaving one.
 *
 * The two are different questions on the same step: step over is about the call
 * this step *makes*, step out about the call it is *inside*. On a step that
 * opens a call they must land in different places, which is the case worth
 * guarding — everything else follows from it.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

/** The three-level checkout: s5's call is answered by nobody, s7 answers s2. */
const CHECKOUT = flow({
  s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
  s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
  s3: { connectionId: "c3", payloadDirection: "request", next: "s4" },
  s4: { connectionId: "c3", payloadDirection: "response", next: "s5" },
  s5: { connectionId: "c4", payloadDirection: "request", next: "s7" },
  s7: { connectionId: "c2", payloadDirection: "response", next: "s8" },
  s8: { connectionId: "c5", payloadDirection: "request", isAsync: true, next: "s9" },
  s9: { connectionId: "c1", payloadDirection: "response" },
});

const held: { current: FlowModeState | null } = { current: null };
const api = new Proxy({} as FlowModeState, {
  get: (_t, key) => {
    if (!held.current) throw new Error("the harness has not rendered yet");
    return Reflect.get(held.current, key);
  },
});

function Harness() {
  held.current = useFlowMode();
  return null;
}

/** Starts a reading of `flowToRead` and walks it to `stepId` with plain nexts. */
function reading(flowToRead: Flow, stepId: string) {
  held.current = null;
  render(
    <FlowModeProvider>
      <Harness />
    </FlowModeProvider>,
  );
  act(() => api.play(flowToRead));
  while (api.mode.kind === "playing" && api.mode.currentStepId !== stepId) {
    const before = api.mode.currentStepId;
    act(() => api.goNext());
    if (api.mode.kind === "playing" && api.mode.currentStepId === before) {
      throw new Error(`the reading stalled at ${before}`);
    }
  }
  return () => (api.mode.kind === "playing" ? api.mode : null);
}

describe("stepping over reads a call's result without its interior", () => {
  it("lands on the response that answers the call", () => {
    const read = reading(CHECKOUT, "s2");

    act(() => api.stepOver());

    expect(read()!.currentStepId).toBe("s7");
  });

  it("lands after a call that returns with nobody writing it down", () => {
    const read = reading(CHECKOUT, "s5");

    act(() => api.stepOver());

    expect(read()!.currentStepId).toBe("s7");
  });

  it("offers nothing to skip on a step that opens no call", () => {
    reading(CHECKOUT, "s4");

    expect(api.stepOverTarget).toBeNull();
  });

  it("offers nothing to skip on a call nobody returns", () => {
    reading(CHECKOUT, "s8");

    expect(api.stepOverTarget).toBeNull();
  });

  it("does nothing when there is nothing to skip", () => {
    const read = reading(CHECKOUT, "s4");

    act(() => api.stepOver());

    expect(read()!.currentStepId).toBe("s4");
  });
});

describe("stepping out leaves the call the reader is inside", () => {
  it("leaves the enclosing call, not the one the step makes", () => {
    const read = reading(CHECKOUT, "s2");

    // s2 opens the call to Pagamentos and sits inside the call to the API.
    expect(api.stepOverTarget?.targetStepId).toBe("s7");
    act(() => api.stepOut());

    expect(read()!.currentStepId).toBe("s9");
  });

  it("names the call it would leave", () => {
    reading(CHECKOUT, "s3");

    expect(api.stepOutFrameId).toBe("s2");
  });

  it("offers nothing to leave at the outermost level", () => {
    reading(CHECKOUT, "s1");

    expect(api.stepOutFrameId).toBeNull();
  });

  it("does nothing at the outermost level", () => {
    const read = reading(CHECKOUT, "s1");

    act(() => api.stepOut());

    expect(read()!.currentStepId).toBe("s1");
  });
});

describe("skipping still walks", () => {
  it("puts every step passed over into the history, in order", () => {
    const read = reading(CHECKOUT, "s2");

    act(() => api.stepOver());

    expect(read()!.history).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("retraces the interior a step at a time on the way back", () => {
    const read = reading(CHECKOUT, "s2");
    act(() => api.stepOver());

    act(() => api.goBack());

    expect(read()!.currentStepId).toBe("s5");
  });
});

describe("a script with no directions offers neither control", () => {
  it("has nothing to skip and nothing to leave", () => {
    const flat = flow({
      s1: { componentId: "a", next: "s2" },
      s2: { connectionId: "c1", next: "s3" },
      s3: { componentId: "b" },
    });

    reading(flat, "s2");

    expect(api.stepOverTarget).toBeNull();
    expect(api.stepOutFrameId).toBeNull();
  });
});

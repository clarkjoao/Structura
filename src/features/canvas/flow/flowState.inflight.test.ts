import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildFlowHighlight, EMPTY_FLOW_HIGHLIGHT } from "./flowState";
import { getEdgeOpacity } from "../edges/data/buildEdges";
import {
  OPACITY_FLOW_PLAYBACK_EDGE_DIM,
  OPACITY_FLOW_PLAYBACK_IN_FLIGHT,
  OPACITY_FLOW_PLAYBACK_PARTICIPANT,
} from "../canvas.constants";

/**
 * The stack, on the picture.
 *
 * The rail names the callers still waiting in words. These are the same fact
 * on the canvas: the chain of edges the reader is currently inside stays lit
 * while the rest of the flow recedes, so the diagram says how deep you are
 * without being read.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const NESTED = flow({
  s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
  s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
  s3: { connectionId: "c3", payloadDirection: "request", next: "s4" },
  s4: { connectionId: "c3", payloadDirection: "response", next: "s5" },
  s5: { connectionId: "c2", payloadDirection: "response" },
});

const opacity = (connId: string, highlight: ReturnType<typeof buildFlowHighlight>) =>
  getEdgeOpacity(connId, true, false, highlight, null);

describe("the calls in flight are named on the highlight", () => {
  it("lists every call made and not yet answered", () => {
    const highlight = buildFlowHighlight(NESTED, "s3", ["s1", "s2"]);

    expect([...highlight.openFrameConnIds].sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("drops a call as soon as its answer is read", () => {
    const highlight = buildFlowHighlight(NESTED, "s4", ["s1", "s2", "s3"]);

    expect([...highlight.openFrameConnIds].sort()).toEqual(["c1", "c2"]);
  });

  it("has none to name in a script that declares no directions", () => {
    const flat = flow({ s1: { connectionId: "c1", next: "s2" }, s2: { componentId: "b" } });

    expect(buildFlowHighlight(flat, "s1", []).openFrameConnIds.size).toBe(0);
  });
});

describe("an edge still owed a return stays lit", () => {
  it("sits above the flow's other edges and below the step in hand", () => {
    const highlight = {
      ...buildFlowHighlight(NESTED, "s3", ["s1", "s2"]),
      participantConnIds: new Set(["c1", "c2", "c3", "c9"]),
    };

    expect(opacity("c3", highlight)).toBe(1); // the step in hand
    expect(opacity("c1", highlight)).toBe(OPACITY_FLOW_PLAYBACK_IN_FLIGHT);
    expect(opacity("c2", highlight)).toBe(OPACITY_FLOW_PLAYBACK_IN_FLIGHT);
    expect(opacity("c9", highlight)).toBe(OPACITY_FLOW_PLAYBACK_PARTICIPANT);
    expect(opacity("c-elsewhere", highlight)).toBe(OPACITY_FLOW_PLAYBACK_EDGE_DIM);
  });

  it("recedes to the ordinary flow strength once the call is answered", () => {
    const highlight = {
      ...buildFlowHighlight(NESTED, "s5", ["s1", "s2", "s3", "s4"]),
      participantConnIds: new Set(["c1", "c2", "c3"]),
    };

    expect(opacity("c3", highlight)).toBe(OPACITY_FLOW_PLAYBACK_PARTICIPANT);
    expect(opacity("c1", highlight)).toBe(OPACITY_FLOW_PLAYBACK_IN_FLIGHT);
  });

  it("changes nothing for a reading that has no calls paired", () => {
    const highlight = {
      ...EMPTY_FLOW_HIGHLIGHT,
      activeConnId: "c1",
      participantConnIds: new Set(["c1", "c2"]),
    };

    expect(opacity("c1", highlight)).toBe(1);
    expect(opacity("c2", highlight)).toBe(OPACITY_FLOW_PLAYBACK_PARTICIPANT);
  });
});

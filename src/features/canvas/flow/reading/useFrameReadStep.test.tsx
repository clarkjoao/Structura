import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Flow } from "@/features/diagram";
import { useFrameReadStep } from "./useFrameReadStep";

vi.mock("@xyflow/react", () => ({
  useStore: (select: (state: { width: number; height: number }) => number) =>
    select({ width: 1000, height: 600 }),
  getViewportForBounds: () => ({ x: 0, y: 0, zoom: 1 }),
}));

const flow: Flow = {
  id: "f",
  name: "Call",
  mermaid: "",
  diagramId: "d",
  entryStepId: "s1",
  steps: {
    // "DICT Client calling SPI": names a component and the call it makes.
    s1: { id: "s1", type: "action", componentId: "client", connectionId: "edge" },
    s2: { id: "s2", type: "action", componentId: "client", connectionId: "edge" },
  },
};

function instance() {
  const node = (id: string) => ({ id, hidden: false });
  const nodes: Record<string, { id: string; hidden: boolean }> = {
    client: node("client"),
    spi: node("spi"),
  };
  const getNodesBounds = vi.fn((ids: unknown) => ({
    x: 5000,
    y: 5000,
    width: 100,
    height: 50,
    ids,
  }));
  const setViewport = vi.fn();
  const fake = {
    getNode: (id: string) => nodes[id],
    getEdge: () => ({ id: "edge", source: "client", target: "spi" }),
    getNodesBounds,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport,
  } as unknown as ReactFlowInstance;
  return { fake, getNodesBounds, setViewport };
}

describe("framing a reading step (68c52faf)", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("frames both ends of the call, not only the step's component", () => {
    const { fake, getNodesBounds, setViewport } = instance();

    renderHook(() =>
      useFrameReadStep({ reactFlowInstance: fake, isReading: true, flow, currentStepId: "s1" }),
    );

    const framed = getNodesBounds.mock.calls.map(([ids]) => [...(ids as string[])].sort());
    expect(framed).toContainEqual(["client", "spi"]);
    expect(setViewport).toHaveBeenCalledTimes(1);
  });

  it("focuses where the call arrives, and the source for a response", () => {
    const { fake, getNodesBounds } = instance();
    const response: Flow = {
      ...flow,
      steps: { s1: { ...flow.steps.s1!, payloadDirection: "response" } },
    };

    renderHook(() =>
      useFrameReadStep({
        reactFlowInstance: fake,
        isReading: true,
        flow: response,
        currentStepId: "s1",
      }),
    );
    const request = instance();
    renderHook(() =>
      useFrameReadStep({
        reactFlowInstance: request.fake,
        isReading: true,
        flow,
        currentStepId: "s1",
      }),
    );

    const focusOf = (calls: unknown[][]) =>
      calls.map(([ids]) => ids as string[]).find((ids) => ids.length === 1);
    expect(focusOf(getNodesBounds.mock.calls)).toEqual(["client"]);
    expect(focusOf(request.getNodesBounds.mock.calls)).toEqual(["spi"]);
  });

  it("does nothing when no flow is being read", () => {
    const { fake, setViewport } = instance();

    renderHook(() =>
      useFrameReadStep({ reactFlowInstance: fake, isReading: false, flow, currentStepId: "s1" }),
    );

    expect(setViewport).not.toHaveBeenCalled();
  });
});

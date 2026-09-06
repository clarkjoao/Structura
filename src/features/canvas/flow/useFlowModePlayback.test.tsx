import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Flow } from "@/features/diagram";
import { useFlowModePlayback } from "./useFlowModePlayback";
import type { FlowMode } from "./flowMode.types";

/**
 * Moving between scripts mid-reading.
 *
 * Reading another script used to mean leaving the reading first, because the
 * only way in was `play`, which refuses unless the mode is idle.
 */

function flowOf(id: string, name: string, entryStepId: string): Flow {
  return {
    id,
    name,
    mermaid: "",
    diagramId: "d1",
    entryStepId,
    steps: {
      [entryStepId]: { id: entryStepId, type: "action", next: `${entryStepId}b` },
      [`${entryStepId}b`]: { id: `${entryStepId}b`, type: "action" },
    },
  };
}

const CHECKOUT = flowOf("f-checkout", "Checkout", "s1");
const REFUND = flowOf("f-refund", "Refund", "r1");

function usePlayback(initial: FlowMode = { kind: "idle" }) {
  const [mode, setMode] = useState<FlowMode>(initial);
  return { mode, ...useFlowModePlayback(mode, setMode) };
}

describe("switching script mid-reading", () => {
  it("reads the new script from its first step", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.mode).toEqual({
      kind: "playing",
      flow: REFUND,
      currentStepId: "r1",
      history: [],
      seen: ["r1"],
      pinnedKeys: [],
    });
  });

  it("drops the path walked through the script being left", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());
    expect(result.current.canGoBack).toBe(true);

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.canGoBack).toBe(false);
  });

  it("does nothing when asked for the script already being read", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());

    act(() => result.current.switchFlow(CHECKOUT));

    expect(result.current.mode).toEqual({
      kind: "playing",
      flow: CHECKOUT,
      currentStepId: "s1b",
      history: ["s1"],
      seen: ["s1", "s1b"],
      pinnedKeys: [],
    });
  });

  it("refuses to start a reading from idle, which is what play is for", () => {
    const { result } = renderHook(() => usePlayback());

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.mode).toEqual({ kind: "idle" });
  });

  it("leaves a recording alone", () => {
    const recording: FlowMode = {
      kind: "recording",
      flowId: "f-checkout",
      context: { mode: "trunk" },
      isNewFlow: false,
    };
    const { result } = renderHook(() => usePlayback(recording));

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.mode).toEqual(recording);
  });

  it("lands on a script with no entry step without breaking", () => {
    const empty: Flow = {
      id: "f-empty",
      name: "Empty",
      mermaid: "",
      diagramId: "d1",
      steps: {},
    };
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));

    act(() => result.current.switchFlow(empty));

    expect(result.current.mode).toEqual({
      kind: "playing",
      flow: empty,
      currentStepId: null,
      history: [],
      seen: [],
      pinnedKeys: [],
    });
    expect(result.current.canGoForward).toBe(false);
  });
});

/**
 * Where the reader has been, which is not the path they took to get here.
 *
 * `history` is the path, and going back shortens it — that is what makes the
 * running object time-travel. So it cannot answer "have I already been down
 * there", and at a `par`, where every way out happens, that is the only
 * question worth asking. Found in the running editor: the mark for a thread
 * already read never appeared, because entering a thread and coming back left
 * no trace of ever having entered it.
 */
describe("what the reading remembers after turning back", () => {
  it("keeps the step it turned back from", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());

    act(() => result.current.goBack());

    expect(result.current.mode).toMatchObject({
      currentStepId: "s1",
      history: [],
      seen: ["s1", "s1b"],
      pinnedKeys: [],
    });
  });

  it("records a step once, however often the reader passes through it", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());
    act(() => result.current.goBack());
    act(() => result.current.goNext());

    expect(result.current.mode).toMatchObject({ seen: ["s1", "s1b"] });
  });

  it("starts empty again on another script, since it belongs to the reading", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.goNext());

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.mode).toMatchObject({ seen: ["r1"] });
  });
});

/**
 * The keys a reader is following.
 *
 * They belong to the reading and die with it — the same rule that governs
 * depth, derived returns and the running object itself. Nothing here reaches
 * the flow, which is why switching scripts starts over rather than carrying
 * names that meant something somewhere else.
 */
describe("following a key across a reading", () => {
  it("starts with nothing pinned", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));

    expect(result.current.pinnedKeys).toEqual([]);
  });

  it("pins and unpins the same key", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));

    act(() => result.current.togglePinnedKey("slug"));
    expect(result.current.pinnedKeys).toEqual(["slug"]);

    act(() => result.current.togglePinnedKey("slug"));
    expect(result.current.pinnedKeys).toEqual([]);
  });

  it("keeps them in the order they were pinned", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.togglePinnedKey("slug"));
    act(() => result.current.togglePinnedKey("plano"));

    expect(result.current.pinnedKeys).toEqual(["slug", "plano"]);
  });

  it("survives walking the reading", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.togglePinnedKey("slug"));
    act(() => result.current.goNext());
    act(() => result.current.goBack());

    expect(result.current.pinnedKeys).toEqual(["slug"]);
  });

  it("goes with the script when another one is read", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play(CHECKOUT));
    act(() => result.current.togglePinnedKey("slug"));

    act(() => result.current.switchFlow(REFUND));

    expect(result.current.pinnedKeys).toEqual([]);
  });

  it("pins nothing outside a reading", () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.togglePinnedKey("slug"));

    expect(result.current.pinnedKeys).toEqual([]);
    expect(result.current.mode).toEqual({ kind: "idle" });
  });
});

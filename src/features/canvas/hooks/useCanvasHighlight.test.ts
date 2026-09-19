import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasHighlight } from "./useCanvasHighlight";

describe("useCanvasHighlight", () => {
  it("stores multiple connection ids", () => {
    const { result } = renderHook(() => useCanvasHighlight());

    act(() => result.current.setHighlight(["c1", "c2"], ["a", "b"]));

    expect([...result.current.highlightedConnectionIds].sort()).toEqual(["c1", "c2"]);
    expect([...result.current.highlightedNodeIds].sort()).toEqual(["a", "b"]);
  });

  it("accepts a single connection id string", () => {
    const { result } = renderHook(() => useCanvasHighlight());

    act(() => result.current.setHighlight("c1", ["a", "b"]));

    expect([...result.current.highlightedConnectionIds]).toEqual(["c1"]);
  });

  it("clears both connection and node highlights", () => {
    const { result } = renderHook(() => useCanvasHighlight());
    act(() => result.current.setHighlight(["c1", "c2"], ["a", "b"]));

    act(() => result.current.clearHighlight());

    expect(result.current.highlightedConnectionIds.size).toBe(0);
    expect(result.current.highlightedNodeIds.size).toBe(0);
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTextToolStore } from "./textLayer.store";
import { useTextLayer } from "./useTextLayer";

/**
 * The editor's text layer is its own, local state: on when a session starts,
 * toggled by the toolbar button, and independent of the diagram's saved flag.
 */

beforeEach(() => {
  useTextToolStore.setState({ layerVisible: true });
});

describe("useTextLayer", () => {
  it("starts with the layer on", () => {
    const { result } = renderHook(() => useTextLayer());
    expect(result.current.visible).toBe(true);
  });

  it("toggles, shows and hides the layer", () => {
    const { result } = renderHook(() => useTextLayer());

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);

    act(() => result.current.show());
    expect(result.current.visible).toBe(true);

    act(() => result.current.hide());
    expect(result.current.visible).toBe(false);
  });
});

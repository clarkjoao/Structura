import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOCK_HIDE_DELAY_MS, useDockAutoHide } from "./useDockAutoHide";

describe("useDockAutoHide", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is always visible when auto-hide is off", () => {
    const { result } = renderHook(() => useDockAutoHide(false, false));
    expect(result.current.visible).toBe(true);
  });

  it("hides until hovered, and hides again a moment after the pointer leaves", () => {
    const { result } = renderHook(() => useDockAutoHide(true, false));
    expect(result.current.visible).toBe(false);

    act(() => result.current.pointerHandlers.onPointerEnter());
    expect(result.current.visible).toBe(true);

    act(() => result.current.pointerHandlers.onPointerLeave());
    act(() => vi.advanceTimersByTime(DOCK_HIDE_DELAY_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("stays out when the pointer comes back before the delay (strip → toolbar)", () => {
    const { result } = renderHook(() => useDockAutoHide(true, false));
    act(() => result.current.pointerHandlers.onPointerEnter());
    act(() => result.current.pointerHandlers.onPointerLeave());
    act(() => vi.advanceTimersByTime(DOCK_HIDE_DELAY_MS / 2));
    act(() => result.current.pointerHandlers.onPointerEnter());
    act(() => vi.advanceTimersByTime(DOCK_HIDE_DELAY_MS * 2));
    expect(result.current.visible).toBe(true);
  });

  it("stays out while held by an open menu or the catalog", () => {
    const { result, rerender } = renderHook(({ held }) => useDockAutoHide(true, held), {
      initialProps: { held: true },
    });
    expect(result.current.visible).toBe(true);
    rerender({ held: false });
    expect(result.current.visible).toBe(false);
  });
});

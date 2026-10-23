import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAYOUT_TRANSITION_ATTRIBUTE,
  LAYOUT_TRANSITION_MS,
  startLayoutTransition,
} from "./layoutTransition";

describe("startLayoutTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the wrapper for the length of the transition, then clears it", () => {
    const root = document.createElement("div");

    startLayoutTransition(root);
    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(true);

    vi.advanceTimersByTime(LAYOUT_TRANSITION_MS - 1);
    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(false);
  });

  it("extends the window when a second run starts mid-transition", () => {
    const root = document.createElement("div");

    startLayoutTransition(root);
    vi.advanceTimersByTime(LAYOUT_TRANSITION_MS - 50);
    startLayoutTransition(root);
    vi.advanceTimersByTime(100);

    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(true);
    vi.advanceTimersByTime(LAYOUT_TRANSITION_MS);
    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(false);
  });

  it("ends at once when the returned function runs, as on unmount", () => {
    const root = document.createElement("div");

    const end = startLayoutTransition(root);
    end();

    expect(root.hasAttribute(LAYOUT_TRANSITION_ATTRIBUTE)).toBe(false);
    // The pending timer was cleared with it: nothing left to fire.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing without a wrapper (React Flow not mounted yet)", () => {
    expect(() => startLayoutTransition(null)()).not.toThrow();
  });
});

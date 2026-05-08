import { afterEach, describe, expect, it, vi } from "vitest";
import { isModKeyPressed } from "./helpers";

describe("isModKeyPressed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for ctrlKey=true on Windows platform", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      platform: "Win32",
    });
    const ev = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, metaKey: false });
    expect(isModKeyPressed(ev)).toBe(true);
  });
});

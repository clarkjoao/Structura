import { describe, expect, it } from "vitest";

describe("the editable embed's storage", () => {
  it("is in memory: the app's localStorage is never read or written", async () => {
    const real = window.localStorage;
    real.setItem("structura-user-diagram", "keep me");
    await import("./memory-storage");
    expect(window.localStorage).not.toBe(real);
    expect(window.localStorage.getItem("structura-user-diagram")).toBeNull();
    window.localStorage.setItem("written-by-embed", "x");
    window.localStorage.clear();
    expect(real.getItem("structura-user-diagram")).toBe("keep me");
    expect(real.getItem("written-by-embed")).toBeNull();
    real.removeItem("structura-user-diagram");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useSharedRevealStore } from "./useSharedRevealStore";

describe("showing a shared element's hidden edges", () => {
  beforeEach(() => useSharedRevealStore.getState().clear());

  it("toggles per element, and clears", () => {
    const { toggleOriginal } = useSharedRevealStore.getState();
    toggleOriginal("auth");
    toggleOriginal("db");
    expect([...useSharedRevealStore.getState().originals].sort()).toEqual(["auth", "db"]);
    toggleOriginal("auth");
    expect([...useSharedRevealStore.getState().originals]).toEqual(["db"]);
    useSharedRevealStore.getState().clear();
    expect(useSharedRevealStore.getState().originals.size).toBe(0);
  });
});

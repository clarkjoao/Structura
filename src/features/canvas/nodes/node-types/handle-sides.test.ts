import { describe, expect, it } from "vitest";
import { sidesFromHandles } from "./handle-spec";

describe("sidesFromHandles", () => {
  it("stores nothing for a plain right-to-left edge", () => {
    expect(sidesFromHandles("source-0", "target-0")).toEqual({});
    expect(sidesFromHandles(null, undefined)).toEqual({});
  });

  it("stores the vertical side the edge was drawn from or to", () => {
    expect(sidesFromHandles("source-bottom", "target-0")).toEqual({ sourceSide: "bottom" });
    expect(sidesFromHandles("source-0", "target-top")).toEqual({ targetSide: "top" });
    expect(sidesFromHandles("source-bottom", "target-top")).toEqual({
      sourceSide: "bottom",
      targetSide: "top",
    });
  });
});

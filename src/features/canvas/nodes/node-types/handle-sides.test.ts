import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import { handleSides, isSideAlongHeight } from "./handle-sides";

describe("handleSides", () => {
  it("reads left to right as every diagram does today", () => {
    expect(handleSides("LR")).toEqual({
      input: Position.Left,
      output: Position.Right,
      crossInput: Position.Top,
      crossOutput: Position.Bottom,
    });
  });

  it("turns both axes for top to bottom", () => {
    expect(handleSides("TB")).toEqual({
      input: Position.Top,
      output: Position.Bottom,
      crossInput: Position.Left,
      crossOutput: Position.Right,
    });
  });

  it("tells which sides spread their slots along the height", () => {
    expect(isSideAlongHeight(Position.Left)).toBe(true);
    expect(isSideAlongHeight(Position.Right)).toBe(true);
    expect(isSideAlongHeight(Position.Top)).toBe(false);
    expect(isSideAlongHeight(Position.Bottom)).toBe(false);
  });
});

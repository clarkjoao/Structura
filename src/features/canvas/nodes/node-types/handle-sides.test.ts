import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import { handleSides, isSideAlongHeight, middleOfSideStyle } from "./handle-sides";
import { BOTTOM_SOURCE_HANDLE_ID, sidesFromHandles, TOP_TARGET_HANDLE_ID } from "./handle-spec";

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

describe("sidesFromHandles", () => {
  it("stores the real side of a cross-axis handle for the diagram's direction", () => {
    expect(sidesFromHandles(BOTTOM_SOURCE_HANDLE_ID, TOP_TARGET_HANDLE_ID)).toEqual({
      sourceSide: "bottom",
      targetSide: "top",
    });
    expect(sidesFromHandles(BOTTOM_SOURCE_HANDLE_ID, TOP_TARGET_HANDLE_ID, "TB")).toEqual({
      sourceSide: "right",
      targetSide: "left",
    });
    expect(sidesFromHandles("source-0", "target-0", "TB")).toEqual({});
  });
});

describe("middleOfSideStyle", () => {
  it("centres a marker on its side's border, half outside the node (f7466213)", () => {
    expect(middleOfSideStyle(Position.Right)).toEqual({
      top: "50%",
      right: 0,
      transform: "translate(50%, -50%)",
    });
    expect(middleOfSideStyle(Position.Bottom)).toEqual({
      left: "50%",
      bottom: 0,
      transform: "translate(-50%, 50%)",
    });
    expect(middleOfSideStyle(Position.Left).transform).toBe("translate(-50%, -50%)");
    expect(middleOfSideStyle(Position.Top).transform).toBe("translate(-50%, -50%)");
  });
});

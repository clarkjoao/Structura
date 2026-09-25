import { describe, expect, it } from "vitest";
import { buildFlowchartPickerOptions } from "./buildPickerOptions";

describe("flowchart picker options", () => {
  it("come from the process-node palette variants, in the declared order", () => {
    expect(buildFlowchartPickerOptions().map((option) => option.flowShape)).toEqual([
      "rectangle",
      "rounded",
      "subroutine",
      "stadium",
      "diamond",
      "parallelogram",
      "hexagon",
      "cylinder",
      "document",
      "event",
      "start",
      "end",
      "junction-and",
      "junction-or",
      "annotation",
      "evidence",
    ]);
  });

  it("no longer offer the legacy combined start / end circle", () => {
    expect(buildFlowchartPickerOptions().some((option) => option.flowShape === "circle")).toBe(
      false,
    );
  });

  it("create process nodes", () => {
    for (const option of buildFlowchartPickerOptions()) {
      expect(option.type).toBe("process-node");
    }
  });
});

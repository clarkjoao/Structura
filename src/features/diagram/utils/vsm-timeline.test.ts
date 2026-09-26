import { describe, expect, it } from "vitest";
import { vsmTimelineTotals } from "./vsm-timeline";

const seg = (wait: number, process: number, id = `${wait}-${process}`) => ({ id, wait, process });

describe("vsmTimelineTotals", () => {
  it("is zero for an empty timeline", () => {
    expect(vsmTimelineTotals([])).toEqual({ leadTime: 0, valueAdded: 0 });
  });

  it("sums waits and process times into the lead time, process times alone into value added", () => {
    expect(vsmTimelineTotals([seg(5, 1), seg(3, 2), seg(2, 0.5)])).toEqual({
      leadTime: 13.5,
      valueAdded: 3.5,
    });
  });

  it("does not leak float noise into the totals", () => {
    expect(vsmTimelineTotals([seg(0.1, 0.1), seg(0.2, 0.2)])).toEqual({
      leadTime: 0.6,
      valueAdded: 0.3,
    });
  });

  it("counts a missing, negative or non-numeric value as zero", () => {
    expect(vsmTimelineTotals([seg(Number.NaN, 2), seg(-4, 1), seg(3, Infinity)])).toEqual({
      leadTime: 6,
      valueAdded: 3,
    });
  });
});

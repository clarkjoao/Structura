import { describe, expect, it, vi } from "vitest";
import {
  MAX_PAN_STEPS,
  MAX_WHEEL_STEP_PX,
  applyCpuThrottle,
  bringOnScreen,
  cpuThrottleRate,
  panStepToward,
  type Box,
  type OnScreenDriver,
} from "./onScreen";

const pane: Box = { x: 0, y: 0, width: 1600, height: 1000 };
const centred = (w = 200, h = 100): Box => ({
  x: 800 - w / 2,
  y: 500 - h / 2,
  width: w,
  height: h,
});

describe("panStepToward", () => {
  it("is null once the target sits inside the pane, away from its edges", () => {
    expect(panStepToward(centred(), pane)).toBeNull();
  });

  it("wheels toward an off-screen target, one bounded tick at a time", () => {
    expect(panStepToward({ x: 9000, y: -7000, width: 200, height: 100 }, pane)).toEqual({
      dx: MAX_WHEEL_STEP_PX,
      dy: -MAX_WHEEL_STEP_PX,
    });
    // A short way off (above the top margin): the exact distance from the centre, unclamped.
    expect(panStepToward({ x: 700, y: 50, width: 200, height: 100 }, pane)).toEqual({
      dx: 0,
      dy: 100 - 500,
    });
  });

  it("treats the margin as outside, on every edge", () => {
    const at = (cx: number, cy: number): Box => ({ x: cx - 1, y: cy - 1, width: 2, height: 2 });
    expect(panStepToward(at(160, 500), pane)).not.toBeNull();
    expect(panStepToward(at(1440, 500), pane)).not.toBeNull();
    expect(panStepToward(at(800, 160), pane)).not.toBeNull();
    expect(panStepToward(at(800, 840), pane)).not.toBeNull();
    expect(panStepToward(at(161, 161), pane)).toBeNull();
  });

  it("judges a huge panel by its first 400x300 px, not by its far-away centre", () => {
    const panel: Box = { x: 300, y: 200, width: 20000, height: 40000 };
    expect(panStepToward(panel, pane)).toBeNull();
  });
});

/** A canvas where each wheel tick moves the target by the tick, like the app's wheel pan. */
function fakeCanvas(start: Box, overrides: Partial<OnScreenDriver> = {}) {
  const target = { ...start };
  const ticks: { dx: number; dy: number }[] = [];
  const driver: OnScreenDriver = {
    paneBox: async () => pane,
    targetBox: async () => ({ ...target }),
    wheelAt: async (x, y, dx, dy) => {
      expect([x, y]).toEqual([800, 500]);
      ticks.push({ dx, dy });
      target.x -= dx;
      target.y -= dy;
    },
    wait: async () => {},
    ...overrides,
  };
  return { driver, ticks, target };
}

describe("bringOnScreen", () => {
  it("does nothing for a target already on screen", async () => {
    const { driver, ticks } = fakeCanvas(centred());
    await bringOnScreen(driver, "#n");
    expect(ticks).toEqual([]);
  });

  it("pans a far target into view and stops there", async () => {
    const { driver, ticks, target } = fakeCanvas({ x: 3538, y: 9244, width: 200, height: 100 });
    const wait = vi.spyOn(driver, "wait");
    await bringOnScreen(driver, "#n");
    expect(ticks.length).toBeGreaterThan(1);
    expect(panStepToward(target, pane)).toBeNull();
    expect(wait).toHaveBeenCalledTimes(ticks.length);
    expect(wait).toHaveBeenCalledWith(60);
  });

  it("fails when there is no canvas", async () => {
    const { driver } = fakeCanvas(centred(), { paneBox: async () => null });
    await expect(bringOnScreen(driver, "#n")).rejects.toThrow("canvas not found");
  });

  it("fails when the target is not rendered", async () => {
    const { driver } = fakeCanvas(centred(), { targetBox: async () => null });
    await expect(bringOnScreen(driver, "#gone")).rejects.toThrow("#gone is not rendered");
  });

  it("gives up after a bounded number of ticks when the view does not move", async () => {
    const wheelAt = vi.fn(async () => {});
    const { driver } = fakeCanvas({ x: 9000, y: 9000, width: 10, height: 10 }, { wheelAt });
    await expect(bringOnScreen(driver, "#stuck")).rejects.toThrow(
      "could not bring #stuck on screen",
    );
    expect(wheelAt).toHaveBeenCalledTimes(MAX_PAN_STEPS);
  });
});

describe("CPU throttle", () => {
  it("reads PERF_CPU_THROTTLE as a rate above 1, anything else as none", () => {
    expect(cpuThrottleRate(undefined)).toBe(1);
    expect(cpuThrottleRate("4")).toBe(4);
    expect(cpuThrottleRate("2.5")).toBe(2.5);
    expect(cpuThrottleRate("1")).toBe(1);
    expect(cpuThrottleRate("0.5")).toBe(1);
    expect(cpuThrottleRate("fast")).toBe(1);
  });

  it("opens a CDP session and sets the rate only when throttling", async () => {
    const send = vi.fn(async () => undefined);
    const open = vi.fn(async () => ({ send }));

    expect(await applyCpuThrottle(1, open)).toBe(false);
    expect(open).not.toHaveBeenCalled();

    expect(await applyCpuThrottle(4, open)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("Emulation.setCPUThrottlingRate", { rate: 4 });
  });
});

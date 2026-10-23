import { describe, expect, it } from "vitest";
import {
  LAYOUT_GAP_MAX,
  LAYOUT_GAP_MIN,
  normalizeLayoutSettings,
  sameLayoutSettings,
  type DiagramLayoutSettings,
} from "./layout-settings";

describe("normalizeLayoutSettings", () => {
  it("is undefined for nothing and for the defaults, so an untouched diagram stores nothing", () => {
    expect(normalizeLayoutSettings(undefined)).toBeUndefined();
    expect(normalizeLayoutSettings({})).toBeUndefined();
    expect(normalizeLayoutSettings({ density: "normal" })).toBeUndefined();
  });

  it("keeps a non-default density and the gaps", () => {
    expect(normalizeLayoutSettings({ density: "spacious", layerGap: 300, nodeGap: 90 })).toEqual({
      density: "spacious",
      layerGap: 300,
      nodeGap: 90,
    });
  });

  it("clamps the gaps to the allowed range and rounds them", () => {
    expect(normalizeLayoutSettings({ layerGap: 5, nodeGap: 10_000 })).toEqual({
      layerGap: LAYOUT_GAP_MIN,
      nodeGap: LAYOUT_GAP_MAX,
    });
    expect(normalizeLayoutSettings({ layerGap: 123.6 })).toEqual({ layerGap: 124 });
  });

  it("drops values it does not recognise rather than trusting them", () => {
    const received = {
      density: "huge",
      layerGap: Number.NaN,
      nodeGap: "90",
    } as unknown as DiagramLayoutSettings;
    expect(normalizeLayoutSettings(received)).toBeUndefined();
  });
});

describe("sameLayoutSettings", () => {
  it("treats absent and default as the same arrangement", () => {
    expect(sameLayoutSettings(undefined, { density: "normal" })).toBe(true);
    expect(sameLayoutSettings({ density: "compact" }, { density: "normal" })).toBe(false);
    expect(sameLayoutSettings({ layerGap: 300 }, { layerGap: 300 })).toBe(true);
  });
});

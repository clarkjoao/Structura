import { describe, expect, it } from "vitest";
import {
  isAutomaticLayout,
  LAYOUT_GAP_MAX,
  LAYOUT_GAP_MIN,
  normalizeLayoutSettings,
  REF_MIN_KEEP_DEFAULT,
  REF_NEIGHBOR_COLUMNS_DEFAULT,
  REF_NEIGHBOR_COLUMNS_MAX,
  REF_NEIGHBOR_COLUMNS_MIN,
  referenceRules,
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

describe("layout mode", () => {
  it("drops manual as the default and keeps automatic", () => {
    expect(normalizeLayoutSettings({ mode: "manual" })).toBeUndefined();
    expect(normalizeLayoutSettings({ mode: "automatic", density: "compact" })).toEqual({
      mode: "automatic",
      density: "compact",
    });
  });

  it("drops an unknown mode", () => {
    const received = { mode: "sometimes" } as unknown as DiagramLayoutSettings;
    expect(normalizeLayoutSettings(received)).toBeUndefined();
  });

  it("tells settings apart by mode", () => {
    expect(sameLayoutSettings({ mode: "automatic" }, undefined)).toBe(false);
    expect(sameLayoutSettings({ mode: "manual" }, undefined)).toBe(true);
    expect(isAutomaticLayout({ mode: "automatic" })).toBe(true);
    expect(isAutomaticLayout(undefined)).toBe(false);
  });
});

describe("sameLayoutSettings", () => {
  it("treats absent and default as the same arrangement", () => {
    expect(sameLayoutSettings(undefined, { density: "normal" })).toBe(true);
    expect(sameLayoutSettings({ density: "compact" }, { density: "normal" })).toBe(false);
    expect(sameLayoutSettings({ layerGap: 300 }, { layerGap: 300 })).toBe(true);
  });
});

describe("reference settings", () => {
  it("defaults to references by rules, two columns, one connection kept, forward off", () => {
    expect(referenceRules(undefined)).toEqual({
      mode: "rules",
      neighborColumns: REF_NEIGHBOR_COLUMNS_DEFAULT,
      minKeep: REF_MIN_KEEP_DEFAULT,
      forward: false,
    });
    expect(
      normalizeLayoutSettings({
        references: "rules",
        refNeighborColumns: REF_NEIGHBOR_COLUMNS_DEFAULT,
        refMinKeep: REF_MIN_KEEP_DEFAULT,
        refForward: false,
      }),
    ).toBeUndefined();
  });

  it("keeps a chosen mode and rule, clamped to whole columns in range", () => {
    expect(
      normalizeLayoutSettings({
        references: "auto",
        refNeighborColumns: 99,
        refMinKeep: 2.4,
        refForward: true,
      }),
    ).toEqual({
      references: "auto",
      refNeighborColumns: REF_NEIGHBOR_COLUMNS_MAX,
      refMinKeep: 2,
      refForward: true,
    });
    expect(normalizeLayoutSettings({ references: "off" })).toEqual({ references: "off" });
    expect(normalizeLayoutSettings({ refNeighborColumns: 0 })).toEqual({
      refNeighborColumns: REF_NEIGHBOR_COLUMNS_MIN,
    });
  });

  it("drops reference values it does not recognise", () => {
    // As a file or a collaborator could send it.
    const received: DiagramLayoutSettings = JSON.parse(
      '{"references":"always","refNeighborColumns":"3","refMinKeep":null,"refForward":"yes"}',
    );
    expect(normalizeLayoutSettings(received)).toBeUndefined();
    expect(referenceRules(received).mode).toBe("rules");
  });

  it("tells settings apart by their references", () => {
    expect(sameLayoutSettings({ references: "rules" }, undefined)).toBe(true);
    expect(sameLayoutSettings({ references: "off" }, undefined)).toBe(false);
    expect(sameLayoutSettings({ refNeighborColumns: 3 }, { refNeighborColumns: 4 })).toBe(false);
    expect(sameLayoutSettings({ refForward: true }, {})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARRANGE,
  arrangeChanged,
  arrangeMenu,
  arrangeMessage,
  describeArrange,
  readArrangeSettings,
} from "./arrange";

describe("arrange settings", () => {
  it("defaults to the canvas arrangement and its reference defaults", () => {
    expect(readArrangeSettings(undefined)).toEqual({
      mode: "automatic",
      density: "normal",
      references: "rules",
      refNeighborColumns: 2,
      refMinKeep: 1,
      refForward: true,
    });
  });

  it("keeps what is valid in a saved choice, clamps numbers and drops the rest", () => {
    expect(
      readArrangeSettings({
        mode: "manual",
        density: "dense",
        references: "off",
        refNeighborColumns: 99,
        refMinKeep: 2.6,
        refForward: "no",
      }),
    ).toEqual({
      ...DEFAULT_ARRANGE,
      mode: "manual",
      references: "off",
      refNeighborColumns: 6,
      refMinKeep: 3,
    });
  });

  it("posts the mode apart from the arrangement's settings", () => {
    expect(arrangeMessage(DEFAULT_ARRANGE)).toEqual({
      mode: "automatic",
      settings: {
        density: "normal",
        references: "rules",
        refNeighborColumns: 2,
        refMinKeep: 1,
        refForward: true,
      },
    });
  });

  it("describes the choice for the status bar", () => {
    expect(describeArrange(DEFAULT_ARRANGE)).toBe("Automatic · normal · references: rules");
    expect(describeArrange({ ...DEFAULT_ARRANGE, mode: "manual" })).toBe("Manual");
  });

  it("re-arranges for any automatic change, and only on a mode switch in manual", () => {
    const manual = { ...DEFAULT_ARRANGE, mode: "manual" as const };
    expect(arrangeChanged(DEFAULT_ARRANGE, { ...DEFAULT_ARRANGE, refMinKeep: 2 })).toBe(true);
    expect(arrangeChanged(DEFAULT_ARRANGE, { ...DEFAULT_ARRANGE })).toBe(false);
    expect(arrangeChanged(DEFAULT_ARRANGE, manual)).toBe(true);
    expect(arrangeChanged(manual, { ...manual, density: "compact" })).toBe(false);
  });
});

describe("arrangeMenu", () => {
  const labels = (items: ReturnType<typeof arrangeMenu>) => items.map((i) => i.label);

  it("offers the mode, spacing and references, with the rules' settings under Rules", () => {
    const items = arrangeMenu(DEFAULT_ARRANGE);
    expect(labels(items)).toEqual([
      "Mode",
      "Automatic",
      "Manual",
      "Spacing",
      "Compact",
      "Normal",
      "Spacious",
      "References",
      "Rules",
      "Trial",
      "Off",
      "$(arrow-left) Back-connections stay up to…",
      "$(pin) Connections kept on the original",
      "$(check) Long forward lines too",
    ]);
    expect(items.find((i) => i.label === "Automatic")?.description).toMatch(/^current/);
    expect(items.find((i) => i.label === "Off")?.action).toEqual({
      next: { ...DEFAULT_ARRANGE, references: "off" },
    });
    expect(items.find((i) => i.label.includes("Back-connections"))?.action).toEqual({
      ask: "refNeighborColumns",
      min: 1,
      max: 6,
      default: 2,
    });
    expect(items.find((i) => i.label.includes("forward"))?.action).toEqual({
      next: { ...DEFAULT_ARRANGE, refForward: false },
    });
  });

  it("hides the rules' settings under another reference mode, and everything but the mode in manual", () => {
    expect(labels(arrangeMenu({ ...DEFAULT_ARRANGE, references: "auto" }))).not.toContain(
      "$(pin) Connections kept on the original",
    );
    expect(labels(arrangeMenu({ ...DEFAULT_ARRANGE, mode: "manual" }))).toEqual([
      "Mode",
      "Automatic",
      "Manual",
    ]);
  });
});

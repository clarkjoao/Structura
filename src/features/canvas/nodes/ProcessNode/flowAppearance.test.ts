import { describe, expect, it } from "vitest";
import { FLOW_DEFAULT_ACCENT, flowPalette, resolveFlowAppearance } from "./flowAppearance";

describe("resolveFlowAppearance", () => {
  it("resolves every part to its default when nothing is stored", () => {
    expect(resolveFlowAppearance({})).toEqual({
      accent: FLOW_DEFAULT_ACCENT,
      fill: "none",
      stroke: "solid",
    });
  });

  it("uses the stored accent, fill and stroke as they are", () => {
    expect(
      resolveFlowAppearance({ customColor: "#1d9eaf", fill: "soft", stroke: "dashed" }),
    ).toEqual({ accent: "#1d9eaf", fill: "soft", stroke: "dashed" });
  });

  it("keeps a legacy nodeColor looking filled: accent, painted solid", () => {
    expect(resolveFlowAppearance({ nodeColor: "#ff0000" })).toEqual({
      accent: "#ff0000",
      fill: "solid",
      stroke: "solid",
    });
  });

  it("lets an explicit accent win over a legacy nodeColor", () => {
    expect(resolveFlowAppearance({ nodeColor: "#ff0000", customColor: "#00ff00" })).toEqual({
      accent: "#00ff00",
      fill: "none",
      stroke: "solid",
    });
  });
});

describe("flowPalette", () => {
  const accent = "hsl(var(--node-system))";

  it("paints the plain body with theme tokens only", () => {
    const palette = flowPalette({ accent, fill: "none", stroke: "solid" }, "");
    expect(palette.surface).toBe("hsl(var(--card))");
    expect(palette.border).toBe("hsl(var(--border))");
    expect(palette.title).toBe("hsl(var(--foreground))");
    expect(palette.icon).toBe(accent);
    expect(palette.solid).toBe(false);
    expect(palette.dashArray).toBeUndefined();
  });

  it("washes the soft body at 8% and borders it at 30%", () => {
    const palette = flowPalette({ accent, fill: "soft", stroke: "solid" }, "");
    expect(palette.surface).toBe(`color-mix(in srgb, ${accent} 8%, hsl(var(--card)))`);
    expect(palette.border).toBe(`color-mix(in srgb, ${accent} 30%, transparent)`);
  });

  it("fills the solid body with the accent and writes on it in the contrast colour", () => {
    const palette = flowPalette({ accent, fill: "solid", stroke: "solid" }, "#0a0a0a");
    expect(palette.surface).toBe(accent);
    expect(palette.title).toBe("#0a0a0a");
    expect(palette.icon).toBe("#0a0a0a");
    expect(palette.solid).toBe(true);
  });

  it("dashes the outline when the stroke is dashed", () => {
    const palette = flowPalette({ accent, fill: "none", stroke: "dashed" }, "");
    expect(palette.borderStyle).toBe("dashed");
    expect(palette.dashArray).toBeDefined();
  });
});

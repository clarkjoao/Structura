import { describe, expect, it } from "vitest";
import {
  accentTextColor,
  contrastLabelColor,
  tintOver,
  contrastRatio,
  parseCssColorToRgb,
  relativeLuminance,
  rgbToHex,
} from "./labelContrast";

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };
const DARK_LABEL = parseCssColorToRgb("#0a0a0a")!;
const LIGHT_LABEL = parseCssColorToRgb("#ffffff")!;

describe("parseCssColorToRgb", () => {
  it("parses hex and rgb forms", () => {
    expect(parseCssColorToRgb("#000")).toEqual(BLACK);
    expect(parseCssColorToRgb("#ffffff")).toEqual(WHITE);
    expect(parseCssColorToRgb("rgb(190, 169, 221)")).toEqual({ r: 190, g: 169, b: 221 });
    expect(parseCssColorToRgb("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("returns null for invalid input", () => {
    expect(parseCssColorToRgb("not-a-color")).toBeNull();
    expect(parseCssColorToRgb("#gg0000")).toBeNull();
    expect(parseCssColorToRgb("transparent")).toBeNull();
  });
});

describe("contrastLabelColor", () => {
  it("uses light text on opaque black", () => {
    const label = contrastLabelColor("#000000", 100);
    expect(label).toBe("#ffffff");
    expect(contrastRatio(LIGHT_LABEL, BLACK)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses dark text on opaque white", () => {
    const label = contrastLabelColor("#ffffff", 100);
    expect(label).toBe("#0a0a0a");
    expect(contrastRatio(DARK_LABEL, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("meets AA against mid-gray boundary", () => {
    const mid = "#808080";
    const label = contrastLabelColor(mid, 100);
    const bg = parseCssColorToRgb(mid)!;
    const fg = parseCssColorToRgb(label)!;
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("meets AA for saturated yellow and blue", () => {
    for (const color of ["#ffff00", "#0000ff", "hsl(60 100% 50%)", "hsl(240 100% 50%)"]) {
      const label = contrastLabelColor(color, 100);
      const bg = parseCssColorToRgb(color)!;
      const fg = parseCssColorToRgb(label)!;
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("falls back to dark label for invalid input", () => {
    expect(contrastLabelColor("not-a-color", 50)).toBe("#0a0a0a");
  });

  it("discards alpha from rgba and still contrasts the RGB channels", () => {
    const label = contrastLabelColor("rgba(0, 0, 0, 0.2)", 100);
    expect(label).toBe("#ffffff");
  });

  it("at low opacity blends toward white so dark text wins", () => {
    const label = contrastLabelColor("#0000ff", 9);
    expect(label).toBe("#0a0a0a");
    const effective = {
      r: Math.round(0 + (255 - 0) * (1 - 0.09)),
      g: Math.round(0 + (255 - 0) * (1 - 0.09)),
      b: Math.round(255 + (255 - 255) * (1 - 0.09)),
    };
    const fg = parseCssColorToRgb(label)!;
    expect(contrastRatio(fg, effective)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("relativeLuminance / rgbToHex", () => {
  it("orders black below white", () => {
    expect(relativeLuminance(BLACK)).toBeLessThan(relativeLuminance(WHITE));
  });

  it("round-trips rgb to hex", () => {
    expect(rgbToHex({ r: 190, g: 169, b: 221 })).toBe("#bea9dd");
  });

  it("over a dark backdrop, a faint fill gets a light label", () => {
    const backdrop = "hsl(231 15% 12%)";
    const label = contrastLabelColor("#0000ff", 9, backdrop);
    expect(label).toBe("#ffffff");
  });

  it("keeps white as the default backdrop", () => {
    expect(contrastLabelColor("#0000ff", 9)).toBe(contrastLabelColor("#0000ff", 9, "#ffffff"));
  });

  it("falls back to white when the backdrop cannot be parsed", () => {
    expect(contrastLabelColor("#0000ff", 9, "")).toBe("#0a0a0a");
  });
});

describe("accentTextColor", () => {
  const ratio = (a: string, b: string) =>
    contrastRatio(parseCssColorToRgb(a)!, parseCssColorToRgb(b)!);

  it("reads at 4.5:1 on a light header while staying the accent's hue", () => {
    const bg = "#fef5e6";
    const text = accentTextColor("#f59f0a", bg);
    expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5);
    const rgb = parseCssColorToRgb(text)!;
    // Still amber-ish: red above blue, not the plain near-black fallback.
    expect(rgb.r).toBeGreaterThan(rgb.b);
    expect(text).not.toBe("#0a0a0a");
  });

  it("lightens instead on a dark header", () => {
    const bg = "#1f2230";
    const text = accentTextColor("#6231c4", bg);
    expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(parseCssColorToRgb(text)!)).toBeGreaterThan(
      relativeLuminance(parseCssColorToRgb("#6231c4")!),
    );
  });

  it("keeps a colour that already reads", () => {
    expect(accentTextColor("#1d67c9", "#ffffff")).toBe("#1d67c9");
  });
});

describe("tintOver", () => {
  it("mixes the colour over the backdrop by the percentage", () => {
    expect(tintOver("#000000", 50, "#ffffff")).toBe("#808080");
    expect(tintOver("#ff0000", 0, "#ffffff")).toBe("#ffffff");
  });
});

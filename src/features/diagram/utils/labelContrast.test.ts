import { describe, expect, it } from "vitest";
import {
  contrastLabelColor,
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
});

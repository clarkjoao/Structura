import { describe, expect, it, vi } from "vitest";
import {
  buildSvgCanvasImport,
  isSvgFile,
  prepareImportedSvgMarkup,
  readSvgDisplaySize,
  svgNodeNameFromFile,
} from "./importSvgToCanvas";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("isSvgFile / svgNodeNameFromFile", () => {
  it("recognises svg by type or extension", () => {
    expect(isSvgFile(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }))).toBe(true);
    expect(isSvgFile(new File(["<svg/>"], "logo.SVG", { type: "" }))).toBe(true);
    expect(isSvgFile(new File(["x"], "a.png", { type: "image/png" }))).toBe(false);
  });

  it("strips the extension for the node name", () => {
    expect(svgNodeNameFromFile(new File([""], "brand-mark.svg"))).toBe("brand-mark");
  });
});

describe("readSvgDisplaySize", () => {
  it("scales tiny icons up to at least CardNode size", () => {
    // 16×16 → grow by max(180/16, 80/16) = 11.25 → 180×180
    expect(readSvgDisplaySize('<svg viewBox="0 0 16 16"></svg>')).toEqual({
      width: 180,
      height: 180,
    });
  });

  it("keeps aspect ratio when growing a wide viewBox", () => {
    // 40×10 → grow by max(180/40, 80/10) = 8 → 320×80
    expect(readSvgDisplaySize('<svg viewBox="0 0 40 10"></svg>')).toEqual({
      width: 320,
      height: 80,
    });
  });

  it("leaves mid-size artwork alone when already above CardNode", () => {
    expect(readSvgDisplaySize('<svg viewBox="0 0 240 120"></svg>')).toEqual({
      width: 240,
      height: 120,
    });
  });

  it("caps oversized viewBoxes", () => {
    const size = readSvgDisplaySize('<svg viewBox="0 0 2000 1000"></svg>');
    expect(size.width).toBe(800);
    expect(size.height).toBe(400);
  });
});

describe("prepareImportedSvgMarkup + buildSvgCanvasImport", () => {
  it("builds a canvas svg component from clean markup", () => {
    const raw = '<meta><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>';
    const clean = prepareImportedSvgMarkup(raw, (key) => key);
    expect(clean).toContain("<svg");
    expect(clean).not.toContain("<meta");

    const { component, layout } = buildSvgCanvasImport(clean!, { x: 12, y: 34 }, "logo");
    expect(component.type).toBe("svg");
    expect(component.name).toBe("logo");
    expect(component.svgContent).toBe(clean);
    expect(layout).toMatchObject({ x: 12, y: 34, elementId: component.id });
  });

  it("rejects non-svg markup", () => {
    expect(prepareImportedSvgMarkup("<div>nope</div>", (key) => key)).toBeNull();
  });
});

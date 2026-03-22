import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";

describe("sanitizeSvg", () => {
  it("accepts SVG with XML declaration and DOCTYPE (typical exported files)", () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result).toContain("<circle");
  });

  it("keeps a valid SVG structure and normalizes root dimensions", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result).toContain("circle");
    expect(result).toContain('fill="red"');
    expect(result).toMatch(/width="100%"/);
    expect(result).toMatch(/height="100%"/);
  });

  it("removes script elements", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result!.toLowerCase()).not.toContain("<script");
  });

  it("removes onclick from nested elements", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="1" height="1"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result).not.toContain("onclick");
  });

  it("returns null for non-SVG strings", () => {
    expect(sanitizeSvg("<div>hi</div>")).toBeNull();
    expect(sanitizeSvg("")).toBeNull();
    expect(sanitizeSvg("   ")).toBeNull();
    expect(sanitizeSvg("<notsvg></notsvg>")).toBeNull();
  });

  it("removes javascript: href values", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">x</a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result).not.toContain("javascript:");
  });
});

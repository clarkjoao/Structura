import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";

describe("sanitizeSvg", () => {
  it("accepts SVG with XML declaration and DOCTYPE (typical exported files)", () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-
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

  it("keeps data:image hrefs on embedded raster images", () => {
    const dataUri = "data:image/png;base64,abc";
    const input =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">` +
      `<image href="${dataUri}" width="10" height="10"/></svg>`;
    const result = sanitizeSvg(input);
    expect(result).not.toBeNull();
    expect(result).toContain(dataUri);
  });
});

describe("sanitizeSvg hardening", () => {
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  it("removes foreignObject and everything inside it", () => {
    const result = sanitizeSvg(
      wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'),
    );
    expect(result!.toLowerCase()).not.toContain("foreignobject");
  });

  it("removes javascript: hrefs hidden behind control characters", () => {
    const result = sanitizeSvg(wrap('<a href="java&#9;script:alert(1)"><rect/></a>'));
    expect(result!.toLowerCase()).not.toContain("script:");
    expect(result).not.toContain("href");
  });

  it("removes SMIL elements that write into an href", () => {
    const result = sanitizeSvg(
      wrap('<a href="#"><set attributeName="href" to="javascript:alert(1)"/></a>'),
    );
    expect(result!.toLowerCase()).not.toContain("javascript");
  });
});

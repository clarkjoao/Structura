import { describe, expect, it } from "vitest";
import {
  getSafeWalkthroughVisual,
  sanitizeWalkthroughImageSrc,
  stepHasVisualMedia,
} from "../utils/step-media.utils";
import type { WalkthroughStep } from "../types";

describe("sanitizeWalkthroughImageSrc", () => {
  it("allows png/jpeg/webp/gif base64 data URLs", () => {
    const png = "data:image/png;base64,AAAA";
    expect(sanitizeWalkthroughImageSrc(png)).toBe(png);
    expect(sanitizeWalkthroughImageSrc("data:image/jpeg;base64,xxxx")).toBe(
      "data:image/jpeg;base64,xxxx",
    );
  });

  it("rejects non-raster data URLs and schemes", () => {
    expect(sanitizeWalkthroughImageSrc("javascript:alert(1)")).toBeNull();
    expect(sanitizeWalkthroughImageSrc("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeWalkthroughImageSrc("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
    expect(sanitizeWalkthroughImageSrc("https://example.com/x.png")).toBeNull();
  });
});

describe("getSafeWalkthroughVisual", () => {
  it("sanitizes SVG and strips script", () => {
    const step: WalkthroughStep = {
      id: "s1",
      order: 0,
      label: "L",
      diagramId: "d",
      mediaContent: {
        type: "svg",
        data: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
      },
    };
    const visual = getSafeWalkthroughVisual(step);
    expect(visual?.kind).toBe("svg");
    if (visual?.kind === "svg") {
      expect(visual.html.toLowerCase()).not.toContain("<script");
    }
  });

  it("returns null for invalid image src", () => {
    const step: WalkthroughStep = {
      id: "s1",
      order: 0,
      label: "L",
      diagramId: "d",
      mediaContent: { type: "image", data: "javascript:void(0)" },
    };
    expect(getSafeWalkthroughVisual(step)).toBeNull();
    expect(stepHasVisualMedia(step)).toBe(false);
  });
});

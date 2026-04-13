import { describe, expect, it } from "vitest";
import {
  getSafeJourneyVisual,
  sanitizeJourneyImageSrc,
  stepHasVisualMedia,
} from "../utils/step-media.utils";
import type { JourneyStep } from "../types";

describe("sanitizeJourneyImageSrc", () => {
  it("allows png/jpeg/webp/gif base64 data URLs", () => {
    const png = "data:image/png;base64,AAAA";
    expect(sanitizeJourneyImageSrc(png)).toBe(png);
    expect(sanitizeJourneyImageSrc("data:image/jpeg;base64,xxxx")).toBe(
      "data:image/jpeg;base64,xxxx",
    );
  });

  it("rejects non-raster data URLs and schemes", () => {
    expect(sanitizeJourneyImageSrc("javascript:alert(1)")).toBeNull();
    expect(sanitizeJourneyImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(
      sanitizeJourneyImageSrc("data:image/svg+xml;base64,PHN2Zy8+"),
    ).toBeNull();
    expect(sanitizeJourneyImageSrc("https://example.com/x.png")).toBeNull();
  });
});

describe("getSafeJourneyVisual", () => {
  it("sanitizes SVG and strips script", () => {
    const step: JourneyStep = {
      id: "s1",
      order: 0,
      label: "L",
      diagramId: "d",
      mediaContent: {
        type: "svg",
        data: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
      },
    };
    const visual = getSafeJourneyVisual(step);
    expect(visual?.kind).toBe("svg");
    if (visual?.kind === "svg") {
      expect(visual.html.toLowerCase()).not.toContain("<script");
    }
  });

  it("returns null for invalid image src", () => {
    const step: JourneyStep = {
      id: "s1",
      order: 0,
      label: "L",
      diagramId: "d",
      mediaContent: { type: "image", data: "javascript:void(0)" },
    };
    expect(getSafeJourneyVisual(step)).toBeNull();
    expect(stepHasVisualMedia(step)).toBe(false);
  });
});

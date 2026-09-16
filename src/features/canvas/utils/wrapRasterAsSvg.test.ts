import { describe, expect, it } from "vitest";
import { isRasterImageFile, wrapRasterImageAsSvg } from "./wrapRasterAsSvg";

describe("wrapRasterImageAsSvg", () => {
  it("embeds the data URI inside an svg image tag", () => {
    const dataUri = "data:image/png;base64,abc123";
    const markup = wrapRasterImageAsSvg(dataUri, 320, 200);
    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 320 200"');
    expect(markup).toContain(`href="${dataUri}"`);
    expect(markup).toContain(`xlink:href="${dataUri}"`);
    expect(markup).toContain('width="320"');
    expect(markup).toContain('height="200"');
  });

  it("rounds and floors dimensions to at least 1", () => {
    const markup = wrapRasterImageAsSvg("data:image/jpeg;base64,x", 0.4, -2);
    expect(markup).toContain('viewBox="0 0 1 1"');
  });
});

describe("isRasterImageFile", () => {
  it("recognises png and jpeg by type or extension", () => {
    expect(isRasterImageFile(new File([], "a.png", { type: "image/png" }))).toBe(true);
    expect(isRasterImageFile(new File([], "a.JPG", { type: "" }))).toBe(true);
    expect(isRasterImageFile(new File([], "a.jpeg", { type: "image/jpeg" }))).toBe(true);
    expect(isRasterImageFile(new File([], "a.svg", { type: "image/svg+xml" }))).toBe(false);
  });
});

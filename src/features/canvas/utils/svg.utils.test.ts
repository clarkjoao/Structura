import { describe, expect, it } from "vitest";
import { svgHasArtwork } from "./svg.utils";

describe("svgHasArtwork", () => {
  it("is false for nothing, and for an svg with nothing inside it", () => {
    expect(svgHasArtwork("")).toBe(false);
    expect(svgHasArtwork(undefined)).toBe(false);
    expect(
      svgHasArtwork('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>'),
    ).toBe(false);
  });

  it("is true once the svg draws something", () => {
    expect(
      svgHasArtwork('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    ).toBe(true);
  });
});

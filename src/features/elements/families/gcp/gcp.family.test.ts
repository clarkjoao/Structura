import { describe, expect, it } from "vitest";
import { iconResolverForFamily } from "../family-icon-resolvers";
import { gcpElements, gcpFamily } from "./gcp.family";
import { gcpIconDataUri } from "./gcp.export-icons";

describe("gcp family", () => {
  it("produces one descriptor per catalog category", () => {
    expect(gcpElements).toHaveLength(gcpFamily.categories.length);
    expect(gcpElements.every((element) => element.family === "gcp")).toBe(true);
  });

  it("remembers the GCP icon resolver for palette.icon lookups", () => {
    expect(iconResolverForFamily("gcp")).toBe(gcpFamily.icons);
  });

  it("resolves a real catalog SVG to a data URI for export", () => {
    const uri = gcpIconDataUri("cloudrun-512-color-rgb");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(uri!.length).toBeGreaterThan(32);
  });

  it("returns null for an icon name missing from the pack", () => {
    expect(gcpIconDataUri("not-a-real-gcp-icon")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  SIDECAR_SUFFIXES,
  isSidecarFileName,
  sidecarFileName,
  sidecarIdFromFileName,
} from "./sidecarFiles";

describe("isSidecarFileName", () => {
  it("recognises a walkthrough file", () => {
    expect(isSidecarFileName("wt_1.walkthrough.json")).toBe(true);
  });

  it("does not claim a diagram file", () => {
    // Diagram ids are `d-<hex>` and never contain a dot.
    expect(isSidecarFileName("d-9f2c1a4b8e7d6c5f.json")).toBe(false);
  });

  it("does not claim the workspace manifest", () => {
    expect(isSidecarFileName("structura-manifest.json")).toBe(false);
  });

  it("does not claim a diagram someone named by hand with a dot in it", () => {
    // The reason this is a list and not a `/\.[a-z]+\.json$/` pattern.
    expect(isSidecarFileName("my.diagram.json")).toBe(false);
    expect(isSidecarFileName("v1.2.json")).toBe(false);
  });

  it("does not claim a staged write", () => {
    expect(isSidecarFileName("d-abc.json.tmp")).toBe(false);
  });
});

describe("sidecar names carry their id", () => {
  const SUFFIX = ".walkthrough.json";

  it("round-trips an id through the file name", () => {
    const name = sidecarFileName("wt_123", SUFFIX);

    expect(name).toBe("wt_123.walkthrough.json");
    expect(sidecarIdFromFileName(name, SUFFIX)).toBe("wt_123");
  });

  it("reads no id out of a file of another type", () => {
    expect(sidecarIdFromFileName("d-abc.json", SUFFIX)).toBeNull();
  });

  it("reads no id out of a name that is only the suffix", () => {
    expect(sidecarIdFromFileName(".walkthrough.json", SUFFIX)).toBeNull();
  });
});

describe("the registered suffixes", () => {
  it("still promises to skip walkthrough files", () => {
    // Removing this suffix would surface every leftover walkthrough file as a
    // corrupt diagram in the merge dialog, in workspaces the feature already
    // touched. It must outlive the feature.
    expect(SIDECAR_SUFFIXES).toContain(".walkthrough.json");
  });
});

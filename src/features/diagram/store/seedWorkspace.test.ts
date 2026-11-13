import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_DIAGRAMS, SEED_FOLDERS, SEED_SERVICES } from "@/fixtures/seeds";

/** Audit R5: the demo workspace is a lazy chunk, and builds without seeds never ask for it. */
describe("loadSeedWorkspace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("hands over the demo diagrams, folders and services", async () => {
    vi.stubEnv("VITE_DISABLE_SEEDS", "false");
    vi.resetModules();
    const { loadSeedWorkspace } = await import("./seedWorkspace");

    expect(loadSeedWorkspace).toBeTypeOf("function");
    const fresh = await loadSeedWorkspace!();
    expect(fresh.diagrams).toEqual(SEED_DIAGRAMS);
    expect(fresh.folders).toEqual(SEED_FOLDERS);
    expect(fresh.services).toEqual(SEED_SERVICES);
    expect(Object.keys(fresh.diagrams).length).toBeGreaterThan(0);
  });

  it("is absent when the build disables seeds", async () => {
    vi.stubEnv("VITE_DISABLE_SEEDS", "true");
    vi.resetModules();
    const { loadSeedWorkspace } = await import("./seedWorkspace");

    expect(loadSeedWorkspace).toBeUndefined();
  });
});

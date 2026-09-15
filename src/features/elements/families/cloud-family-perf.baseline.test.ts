import { describe, expect, it } from "vitest";
import { cloudRegistry } from "@/features/cloud";
import {
  allCloudFamilies,
  cloudFamilyToProviderAdapter,
} from "@/features/elements/families/cloud-family.registry";

/**
 * Baseline for the family-contract close: `cloudRegistry.allProviders()` is a
 * cached derived view (adapters registered once with the family). Rebuilding
 * adapters on every call would be the costly alternative.
 */
describe("cloud family registry performance baseline", () => {
  it("allProviders stays cheap relative to rebuilding adapters", () => {
    const N = 2000;

    const t0 = performance.now();
    for (let i = 0; i < N; i++) cloudRegistry.allProviders();
    const cachedMs = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < N; i++) allCloudFamilies().map(cloudFamilyToProviderAdapter);
    const rebuildMs = performance.now() - t1;

    // Cached view should be clearly cheaper than rebuilding (order-of-magnitude
    // on a warm run). Soft floor so CI noise does not flake.
    expect(cachedMs).toBeLessThan(rebuildMs);
    expect(cloudRegistry.allProviders().length).toBe(allCloudFamilies().length);
    // eslint-disable-next-line no-console
    console.log(
      `[perf] allProviders×${N}=${cachedMs.toFixed(2)}ms rebuild×${N}=${rebuildMs.toFixed(2)}ms`,
    );
  });
});

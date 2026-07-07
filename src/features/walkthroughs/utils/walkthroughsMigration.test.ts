import { describe, expect, it, beforeEach } from "vitest";
import { migrateWalkthroughsLocalStorageKey } from "./walkthroughsMigration";

const LEGACY_KEY = "structura:journeys";
const CURRENT_KEY = "structura:walkthroughs";

describe("migrateWalkthroughsLocalStorageKey", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is a no-op when neither key is set", () => {
    migrateWalkthroughsLocalStorageKey();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(window.localStorage.getItem(CURRENT_KEY)).toBeNull();
  });

  it("copies a legacy entry to the new key", () => {
    const fixture = JSON.stringify({ state: { walkthroughs: { "wt-1": { id: "wt-1" } } } });
    window.localStorage.setItem(LEGACY_KEY, fixture);
    migrateWalkthroughsLocalStorageKey();
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe(fixture);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("does not overwrite an existing new key (preserves user's data)", () => {
    const legacy = JSON.stringify({ state: { walkthroughs: { "wt-legacy": {} } } });
    const current = JSON.stringify({ state: { walkthroughs: { "wt-current": {} } } });
    window.localStorage.setItem(LEGACY_KEY, legacy);
    window.localStorage.setItem(CURRENT_KEY, current);
    migrateWalkthroughsLocalStorageKey();
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe(current);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("is idempotent: running twice produces the same state", () => {
    const fixture = JSON.stringify({ state: { walkthroughs: { "wt-1": {} } } });
    window.localStorage.setItem(LEGACY_KEY, fixture);
    migrateWalkthroughsLocalStorageKey();
    migrateWalkthroughsLocalStorageKey();
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe(fixture);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { isOriginStorageFull, isQuotaExceededError } from "./storageQuota";

describe("isQuotaExceededError", () => {
  it("recognises the standard name and Firefox's legacy one", () => {
    expect(isQuotaExceededError(new DOMException("full", "QuotaExceededError"))).toBe(true);
    expect(isQuotaExceededError(new DOMException("full", "NS_ERROR_DOM_QUOTA_REACHED"))).toBe(true);
  });

  it("recognises Safari's UnknownError when it talks about the quota", () => {
    expect(
      isQuotaExceededError(new DOMException("Exceeded the storage quota", "UnknownError")),
    ).toBe(true);
    expect(isQuotaExceededError(new DOMException("Database deleted", "UnknownError"))).toBe(false);
  });

  it("looks inside a wrapping error's cause", () => {
    const wrapped = Object.assign(new Error("write failed"), {
      cause: new DOMException("full", "QuotaExceededError"),
    });
    expect(isQuotaExceededError(wrapped)).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isQuotaExceededError(new Error("network"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError("QuotaExceededError")).toBe(false);
  });
});

describe("isOriginStorageFull", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubEstimate(estimate: () => Promise<StorageEstimate>) {
    vi.stubGlobal("navigator", { ...navigator, storage: { estimate } });
  }

  it("is true at 95% of the quota and above", async () => {
    stubEstimate(async () => ({ usage: 96, quota: 100 }));
    expect(await isOriginStorageFull()).toBe(true);
    stubEstimate(async () => ({ usage: 50, quota: 100 }));
    expect(await isOriginStorageFull()).toBe(false);
  });

  it("is false when the browser cannot tell", async () => {
    stubEstimate(async () => {
      throw new Error("unsupported");
    });
    expect(await isOriginStorageFull()).toBe(false);
  });
});

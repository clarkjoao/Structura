import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createZustandStorage,
  kvGetItem,
  kvKeys,
  kvRemoveItem,
  kvSessionGetItem,
  kvSessionSetItem,
  kvSetItem,
  readSecretItem,
  writeSecretItem,
} from "./kvStorage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("kvStorage", () => {
  it("round-trips values and lists keys", () => {
    expect(kvSetItem("kv:a", "1")).toBe(true);
    expect(kvGetItem("kv:a")).toBe("1");
    expect(kvKeys()).toContain("kv:a");
    kvRemoveItem("kv:a");
    expect(kvGetItem("kv:a")).toBeNull();
  });

  it("returns false instead of throwing when the quota is exceeded", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(kvSetItem("kv:a", "1")).toBe(false);
  });

  it("degrades to empty reads and no-op removes when storage throws (private mode)", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(kvGetItem("kv:a")).toBeNull();
    expect(() => kvRemoveItem("kv:a")).not.toThrow();
  });

  it("survives the storage object itself being unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(kvGetItem("kv:a")).toBeNull();
      expect(kvSetItem("kv:a", "1")).toBe(false);
      expect(kvKeys()).toEqual([]);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("keeps session values separate from local ones", () => {
    kvSessionSetItem("kv:s", "x");
    expect(kvSessionGetItem("kv:s")).toBe("x");
    expect(kvGetItem("kv:s")).toBeNull();
  });

  it("secret helpers share the same keys", () => {
    writeSecretItem("kv:token", "t");
    expect(readSecretItem("kv:token")).toBe("t");
    expect(kvGetItem("kv:token")).toBe("t");
  });

  it("createZustandStorage reads, writes and removes through the guarded store", () => {
    const storage = createZustandStorage();
    storage.setItem("kv:z", "{}");
    expect(storage.getItem("kv:z")).toBe("{}");
    storage.removeItem("kv:z");
    expect(storage.getItem("kv:z")).toBeNull();
  });

  it("createZustandStorage setItem does not throw on quota errors", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => createZustandStorage().setItem("kv:z", "{}")).not.toThrow();
  });
});

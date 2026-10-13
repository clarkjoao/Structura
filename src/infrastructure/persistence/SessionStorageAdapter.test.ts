import { afterEach, describe, expect, it } from "vitest";
import { SessionStorageAdapter } from "./SessionStorageAdapter";

afterEach(() => {
  sessionStorage.clear();
});

describe("SessionStorageAdapter", () => {
  it("stores values in sessionStorage under the app prefix", async () => {
    const adapter = new SessionStorageAdapter();
    await adapter.save("mcp-token:github", "secret");
    await adapter.save("obj", { a: 1 });

    expect(sessionStorage.getItem("structura_mcp-token:github")).toBe("secret");
    expect(localStorage.getItem("structura_mcp-token:github")).toBeNull();
    expect(await adapter.load("obj")).toEqual({ a: 1 });
    expect((await adapter.keys()).sort()).toEqual(["mcp-token:github", "obj"]);

    await adapter.delete("obj");
    expect(await adapter.load("obj")).toBeNull();
    expect(await adapter.length()).toBe(1);
  });
});

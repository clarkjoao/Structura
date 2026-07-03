import { describe, expect, it } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { createPluginStorage, deletePluginStorageNamespace } from "./plugin-storage";

describe("plugin storage", () => {
  it("namespaces keys per plugin id (spec scenario)", async () => {
    const port = new InMemoryAdapter();
    const storageA = createPluginStorage("plugin-a", port);
    const storageB = createPluginStorage("plugin-b", port);

    await storageA.set("config", { url: "https://a.example" });
    expect(await storageA.get("config")).toEqual({ url: "https://a.example" });
    expect(await storageB.get("config")).toBeNull();
    expect(await port.load("plugin:plugin-a:config")).toEqual({ url: "https://a.example" });
  });

  it("removes keys and updates the index", async () => {
    const port = new InMemoryAdapter();
    const storage = createPluginStorage("plugin-a", port);
    await storage.set("one", 1);
    await storage.set("two", 2);
    await storage.remove("one");
    expect(await storage.get("one")).toBeNull();
    expect(await port.load<string[]>("plugin:plugin-a:__keys")).toEqual(["two"]);
  });

  it("deletes the whole namespace on uninstall (spec scenario)", async () => {
    const port = new InMemoryAdapter();
    const storage = createPluginStorage("plugin-a", port);
    await storage.set("one", 1);
    await storage.set("two", { nested: true });

    await deletePluginStorageNamespace("plugin-a", port);
    expect(await port.load("plugin:plugin-a:one")).toBeNull();
    expect(await port.load("plugin:plugin-a:two")).toBeNull();
    expect(await port.load("plugin:plugin-a:__keys")).toBeNull();
  });
});

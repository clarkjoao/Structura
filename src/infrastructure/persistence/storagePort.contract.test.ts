import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { IStoragePort } from "./IStoragePort";
import { InMemoryAdapter } from "./InMemoryAdapter";
import { IndexedDbAdapter, WORKSPACE_DB_NAME } from "./IndexedDbAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";

/*
 * Every IStoragePort behaves the same for the calls the workspace makes, so the
 * boot can swap LocalStorageAdapter for IndexedDbAdapter without the store or
 * folder sync noticing.
 */

const adapters: [string, () => Promise<IStoragePort>][] = [
  ["InMemoryAdapter", async () => new InMemoryAdapter()],
  ["LocalStorageAdapter", async () => new LocalStorageAdapter()],
  ["IndexedDbAdapter", () => IndexedDbAdapter.open(new IDBFactory())],
];

describe.each(adapters)("%s (IStoragePort contract)", (_name, create) => {
  let storage: IStoragePort;

  beforeEach(async () => {
    localStorage.clear();
    storage = await create();
  });

  it("returns null for a missing key", async () => {
    expect(await storage.getItem("missing")).toBeNull();
    expect(await storage.load("missing")).toBeNull();
  });

  it("reads back what it wrote", async () => {
    await storage.setItem("diagram-store", '{"state":{}}');
    expect(await storage.getItem("diagram-store")).toBe('{"state":{}}');
  });

  it("overwrites a key", async () => {
    await storage.setItem("k", "one");
    await storage.setItem("k", "two");
    expect(await storage.getItem("k")).toBe("two");
  });

  it("saves objects as JSON and loads them parsed", async () => {
    await storage.save("obj", { a: 1, b: ["x"] });
    expect(await storage.getItem("obj")).toBe('{"a":1,"b":["x"]}');
    expect(await storage.load<{ a: number; b: string[] }>("obj")).toEqual({ a: 1, b: ["x"] });
  });

  it("removes keys through removeItem and delete", async () => {
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");
    await storage.removeItem("a");
    await storage.delete("b");
    expect(await storage.getItem("a")).toBeNull();
    expect(await storage.getItem("b")).toBeNull();
  });

  it("lists its keys without a namespace prefix", async () => {
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");
    expect((await storage.keys()).sort()).toEqual(["a", "b"]);
    expect(await storage.length()).toBe(2);
  });

  it("stores a value larger than localStorage's quota would allow", async () => {
    if (!(storage instanceof IndexedDbAdapter)) return;
    const big = "x".repeat(6 * 1024 * 1024);
    await storage.setItem("diagram-store", big);
    expect((await storage.getItem("diagram-store"))?.length).toBe(big.length);
  });
});

describe("IndexedDbAdapter", () => {
  beforeEach(() => localStorage.clear());

  it("skips ordinary writes while paused but force-saves through the pause", async () => {
    const storage = await IndexedDbAdapter.open(new IDBFactory());
    storage.paused = true;
    await storage.setItem("diagram-store", "ignored");
    expect(await storage.getItem("diagram-store")).toBeNull();
    expect(await storage.forceSave("diagram-store", { v: 1 })).toBe(true);
    expect(await storage.getItem("diagram-store")).toBe('{"v":1}');
  });

  it("stamps each record with when it was written", async () => {
    const storage = await IndexedDbAdapter.open(new IDBFactory(), () => 1234);
    await storage.setItem("diagram-store", "v");
    expect(await storage.getRecord("diagram-store")).toEqual({ value: "v", savedAt: 1234 });
  });

  it("keeps auxiliary timestamps in localStorage, unprefixed", async () => {
    const storage = await IndexedDbAdapter.open(new IDBFactory());
    storage.setAuxiliaryValue("structura:lastSync", "42");
    expect(localStorage.getItem("structura:lastSync")).toBe("42");
    storage.removeAuxiliaryKey("structura:lastSync");
    expect(localStorage.getItem("structura:lastSync")).toBeNull();
  });

  it("lets another connection delete the database and reopens on the next call", async () => {
    const factory = new IDBFactory();
    const storage = await IndexedDbAdapter.open(factory);
    await storage.setItem("k", "before");
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase(WORKSPACE_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked: connection was not released"));
    });
    expect(await storage.getItem("k")).toBeNull();
    await storage.setItem("k", "after");
    expect(await storage.getItem("k")).toBe("after");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { createMemoryFs } from "./__testing__/memoryFileSystem";
import { createSidecarSync, type SidecarSync } from "./createSidecarSync";

const SUFFIX = ".walkthrough.json";

interface Item {
  id: string;
  updatedAt: number;
  title: string;
  folderId?: string | null;
}

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

/**
 * A sync wired to a real adapter over an in-memory workspace, plus the levers a
 * test needs: change an item, delete the files behind the engine's back, and
 * start a second engine against the same workspace the way a reload would.
 */
function harness(initial: Record<string, Item> = {}, workspaceName = "workspace") {
  const fs = createMemoryFs();
  const adapter = new FileSystemAdapter();
  (adapter as unknown as AdapterInternals).handle = fs.rootHandle;
  Object.defineProperty(adapter, "folderName", { get: () => workspaceName });
  Object.defineProperty(adapter, "isConnected", { get: () => true });

  let items: Record<string, Item> = { ...initial };
  const listeners = new Set<() => void>();
  const writeSidecar = vi.spyOn(adapter, "writeSidecar");

  function make(): SidecarSync {
    return createSidecarSync<Item>({
      suffix: SUFFIX,
      host: adapter,
      getItems: () => items,
      replaceItems: (next) => {
        items = next;
      },
      subscribe: (onChange) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
      folderIdOf: (item) => item.folderId ?? null,
      toFile: (item) => ({ kind: "test-item", schemaVersion: 1, item }),
      fromFile: (raw) => {
        if (typeof raw !== "object" || raw === null) return null;
        const envelope = raw as { kind?: unknown; item?: unknown };
        if (envelope.kind !== "test-item") return null;
        return envelope.item as Item;
      },
      debounceMs: 5,
    });
  }

  return {
    adapter,
    fs,
    writeSidecar,
    make,
    items: () => items,
    setItems: (next: Record<string, Item>) => {
      items = next;
      listeners.forEach((l) => l());
    },
    /** Removes the file the way a person with a Finder window would. */
    deleteFileOnDisk: (name: string) => fs.removeAtRoot(name),
  };
}

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  updatedAt: 100,
  title: id,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});

describe("writing", () => {
  it("collapses rapid changes into one write", async () => {
    const h = harness();
    const sync = h.make();

    h.setItems({ a: item("a") });
    h.setItems({ a: item("a", { title: "again" }) });
    h.setItems({ a: item("a", { title: "third" }) });
    await sync.flush();

    expect(h.writeSidecar).toHaveBeenCalledTimes(1);
    sync.stop();
  });

  it("writes nothing when permission has gone", async () => {
    const h = harness({ a: item("a") });
    vi.spyOn(h.adapter, "checkPermission").mockResolvedValue(false);
    const sync = h.make();

    await sync.flush();

    expect(h.writeSidecar).not.toHaveBeenCalled();
    expect(h.fs.hasFile("a.walkthrough.json")).toBe(false);
    sync.stop();
  });

  it("does not rewrite an item that did not change", async () => {
    const h = harness({ a: item("a") });
    const sync = h.make();

    await sync.flush();
    await sync.flush();

    expect(h.writeSidecar).toHaveBeenCalledTimes(1);
    sync.stop();
  });
});

describe("moving between folders", () => {
  it("leaves exactly one file, in the new directory", async () => {
    const h = harness({ a: item("a", { folderId: "payments" }) });
    h.adapter.setFolders({
      payments: { id: "payments", name: "payments", parentId: null } as never,
      auth: { id: "auth", name: "auth", parentId: null } as never,
    });
    const sync = h.make();
    await sync.flush();
    expect(h.fs.hasFile("payments/a.walkthrough.json")).toBe(true);

    h.setItems({ a: item("a", { folderId: "auth", updatedAt: 200 }) });
    await sync.flush();

    expect(h.fs.hasFile("auth/a.walkthrough.json")).toBe(true);
    expect(h.fs.hasFile("payments/a.walkthrough.json")).toBe(false);
    sync.stop();
  });
});

describe("deleting through the app", () => {
  it("removes the file", async () => {
    const h = harness({ a: item("a"), b: item("b") });
    const sync = h.make();
    await sync.flush();

    h.setItems({ b: item("b") });
    await sync.flush();

    expect(h.fs.hasFile("a.walkthrough.json")).toBe(false);
    expect(h.fs.hasFile("b.walkthrough.json")).toBe(true);
    sync.stop();
  });
});

/**
 * The three readings of "is it on disk?", one test each. The third is the one
 * the maintainer asked for: deleting the files has to be a real removal.
 */
describe("hydrate reconciles disk against memory", () => {
  it("on disk → adopts it, keeping the newer of the two", async () => {
    const h = harness({ a: item("a", { updatedAt: 100, title: "local" }) });
    const first = h.make();
    await first.flush();
    first.stop();

    // Something else wrote a newer copy into the same workspace.
    await h.adapter.writeSidecar([], "a.walkthrough.json", {
      kind: "test-item",
      schemaVersion: 1,
      item: { id: "a", updatedAt: 500, title: "from disk" },
    });

    const second = h.make();
    await second.hydrate();

    expect(h.items().a.title).toBe("from disk");
    second.stop();
  });

  it("on disk but older → keeps what is held locally", async () => {
    const h = harness({ a: item("a", { updatedAt: 900, title: "local" }) });
    await h.adapter.writeSidecar([], "a.walkthrough.json", {
      kind: "test-item",
      schemaVersion: 1,
      item: { id: "a", updatedAt: 100, title: "stale" },
    });
    const sync = h.make();

    await sync.hydrate();

    expect(h.items().a.title).toBe("local");
    sync.stop();
  });

  it("absent and never synced here → treated as new, written out", async () => {
    const h = harness({ a: item("a") });
    const sync = h.make();

    await sync.hydrate();

    // Connecting a folder that has never held this item must not read as a
    // deletion — it is content the workspace has not been told about yet.
    expect(h.items().a).toBeDefined();
    expect(h.fs.hasFile("a.walkthrough.json")).toBe(true);
    sync.stop();
  });

  it("absent and previously synced here → the user deleted it, so it goes", async () => {
    const h = harness({ a: item("a"), b: item("b") });
    const first = h.make();
    await first.flush();
    first.stop();

    h.deleteFileOnDisk("a.walkthrough.json");

    const second = h.make();
    await second.hydrate();

    expect(h.items().a).toBeUndefined();
    expect(h.items().b).toBeDefined();
    second.stop();
  });

  it("a deletion marker counts as deleted, not as present", async () => {
    const h = harness({ a: item("a") });
    const first = h.make();
    await first.flush();
    first.stop();

    await h.adapter.writeSidecar([], "a.walkthrough.json", { deleted: true });

    const second = h.make();
    await second.hydrate();

    expect(h.items().a).toBeUndefined();
    second.stop();
  });

  it("an unreadable file counts as present, so nothing is lost to a bad read", async () => {
    const h = harness({ a: item("a") });
    const first = h.make();
    await first.flush();
    first.stop();

    h.fs.seedTemp("a.walkthrough.json", "{ truncated", Date.now());

    const second = h.make();
    await second.hydrate();

    // "I could not read it" is not "it is not there".
    expect(h.items().a).toBeDefined();
    second.stop();
  });

  it("ignores a file of a shape it does not recognise", async () => {
    const h = harness();
    await h.adapter.writeSidecar([], "x.walkthrough.json", { kind: "something-else" });
    const sync = h.make();

    await sync.hydrate();

    expect(h.items().x).toBeUndefined();
    sync.stop();
  });
});

describe("the synced-id record is per workspace", () => {
  it("connecting a different folder does not read as a mass deletion", async () => {
    const h = harness({ a: item("a") }, "workspace-one");
    const first = h.make();
    await first.flush();
    first.stop();

    // Same items, a different folder that has never seen them.
    const other = harness({ a: item("a") }, "workspace-two");
    const second = other.make();
    await second.hydrate();

    expect(other.items().a).toBeDefined();
    expect(other.fs.hasFile("a.walkthrough.json")).toBe(true);
    second.stop();
  });
});

describe("the removability guarantee", () => {
  it("rm of the files removes the items, and nothing writes them back", async () => {
    const h = harness({ a: item("a"), b: item("b"), c: item("c") });
    const first = h.make();
    await first.flush();
    expect(h.fs.listNames().filter((n) => n.endsWith(SUFFIX))).toHaveLength(3);
    first.stop();

    // The whole point: someone deletes the files outside the application.
    for (const name of ["a", "b", "c"]) h.deleteFileOnDisk(`${name}.walkthrough.json`);

    const second = h.make();
    await second.hydrate();

    expect(h.items()).toEqual({});
    // hydrate() ends in a flush; if the reconciliation were wrong, this is
    // where the files would reappear.
    expect(h.fs.listNames().filter((n) => n.endsWith(SUFFIX))).toHaveLength(0);

    await second.flush();
    expect(h.fs.listNames().filter((n) => n.endsWith(SUFFIX))).toHaveLength(0);
    second.stop();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileSystemAdapter } from "@/infrastructure/persistence/FileSystemAdapter";
import { createMemoryFs } from "@/infrastructure/persistence/__testing__/memoryFileSystem";
import { useWalkthroughStore } from "../store/walkthrough.store";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { WALKTHROUGH_FILE_KIND, toWalkthroughFile } from "../model/walkthroughFile";
import {
  flushWalkthroughFileSync,
  startWalkthroughFileSync,
  stopWalkthroughFileSync,
} from "./walkthroughFileSync";

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

let fs: ReturnType<typeof createMemoryFs>;

function connectWorkspace(name = "workspace") {
  fs = createMemoryFs();
  (fileSystemAdapter as unknown as AdapterInternals).handle = fs.rootHandle;
  vi.spyOn(fileSystemAdapter, "isConnected", "get").mockReturnValue(true);
  vi.spyOn(fileSystemAdapter, "folderName", "get").mockReturnValue(name);
  fileSystemAdapter.setFolders({
    payments: { id: "payments", name: "payments", parentId: null } as never,
    auth: { id: "auth", name: "auth", parentId: null } as never,
  });
}

function disconnectWorkspace() {
  vi.spyOn(fileSystemAdapter, "isConnected", "get").mockReturnValue(false);
}

function wt(id: string, over: Partial<WalkthroughPresentation> = {}): WalkthroughPresentation {
  return {
    id,
    title: id,
    steps: [],
    createdAt: 0,
    updatedAt: 100,
    folderId: null,
    ...over,
  };
}

function seedStore(presentations: WalkthroughPresentation[]) {
  useWalkthroughStore.setState({
    presentations: Object.fromEntries(presentations.map((p) => [p.id, p])),
    hydrated: true,
  });
}

const listed = () => Object.keys(useWalkthroughStore.getState().presentations).sort();
const walkthroughFiles = () => fs.listNames().filter((n) => n.endsWith(".walkthrough.json"));

beforeEach(() => {
  localStorage.clear();
  useWalkthroughStore.setState({ presentations: {}, hydrated: false });
});

afterEach(() => {
  stopWalkthroughFileSync();
  vi.restoreAllMocks();
});

describe("a walkthrough lands beside the diagrams of its folder", () => {
  it("writes into the folder's directory", async () => {
    connectWorkspace();
    seedStore([wt("wt_1", { folderId: "payments" })]);

    await startWalkthroughFileSync();

    expect(fs.hasFile("payments/wt_1.walkthrough.json")).toBe(true);
  });

  it("writes at the root when it belongs to no folder", async () => {
    connectWorkspace();
    seedStore([wt("wt_1")]);

    await startWalkthroughFileSync();

    expect(fs.hasFile("wt_1.walkthrough.json")).toBe(true);
  });

  it("writes a file that names itself a walkthrough", async () => {
    connectWorkspace();
    seedStore([wt("wt_1", { title: "Tour", description: "why" })]);

    await startWalkthroughFileSync();

    const raw = JSON.parse(fs.readFile("wt_1.walkthrough.json") ?? "{}") as {
      kind?: string;
      walkthrough?: { title?: string; description?: string };
    };
    expect(raw.kind).toBe(WALKTHROUGH_FILE_KIND);
    expect(raw.walkthrough?.title).toBe("Tour");
    expect(raw.walkthrough?.description).toBe("why");
  });

  it("follows the walkthrough when it is filed into another folder", async () => {
    connectWorkspace();
    seedStore([wt("wt_1", { folderId: "payments" })]);
    await startWalkthroughFileSync();

    await useWalkthroughStore.getState().save(wt("wt_1", { folderId: "auth" }));
    await flushWalkthroughFileSync();

    expect(fs.hasFile("auth/wt_1.walkthrough.json")).toBe(true);
    expect(fs.hasFile("payments/wt_1.walkthrough.json")).toBe(false);
  });
});

describe("deleting", () => {
  it("removes the file when the walkthrough is deleted in the app", async () => {
    connectWorkspace();
    seedStore([wt("wt_1"), wt("wt_2")]);
    await startWalkthroughFileSync();

    await useWalkthroughStore.getState().delete("wt_1");
    await flushWalkthroughFileSync();

    expect(fs.hasFile("wt_1.walkthrough.json")).toBe(false);
    expect(fs.hasFile("wt_2.walkthrough.json")).toBe(true);
  });
});

describe("reading back from the folder", () => {
  it("picks up a walkthrough placed on disk out of band", async () => {
    connectWorkspace();
    await fileSystemAdapter.writeSidecar(
      [],
      "wt_external.walkthrough.json",
      toWalkthroughFile(wt("wt_external", { title: "From a teammate" })),
    );
    seedStore([]);

    await startWalkthroughFileSync();

    expect(listed()).toEqual(["wt_external"]);
    expect(useWalkthroughStore.getState().presentations.wt_external.title).toBe("From a teammate");
  });

  it("keeps the newer of the two when both sides have it", async () => {
    connectWorkspace();
    await fileSystemAdapter.writeSidecar(
      [],
      "wt_1.walkthrough.json",
      toWalkthroughFile(wt("wt_1", { title: "newer", updatedAt: 999 })),
    );
    seedStore([wt("wt_1", { title: "older", updatedAt: 1 })]);

    await startWalkthroughFileSync();

    expect(useWalkthroughStore.getState().presentations.wt_1.title).toBe("newer");
  });
});

describe("removability", () => {
  it("deleting the files on disk removes them from the library, for good", async () => {
    connectWorkspace();
    seedStore([wt("wt_1"), wt("wt_2")]);
    await startWalkthroughFileSync();
    expect(walkthroughFiles()).toHaveLength(2);
    stopWalkthroughFileSync();

    // Someone clears the walkthroughs out of the folder by hand.
    fs.removeAtRoot("wt_1.walkthrough.json");
    fs.removeAtRoot("wt_2.walkthrough.json");

    await startWalkthroughFileSync();

    expect(listed()).toEqual([]);
    expect(walkthroughFiles()).toHaveLength(0);
  });

  it("leaves the diagrams untouched when the walkthroughs are cleared out", async () => {
    connectWorkspace();
    await fileSystemAdapter.writeDiagram({
      id: "d-1",
      name: "Keep me",
      level: "context",
      createdAt: 0,
      updatedAt: 0,
      snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
      nodeLayouts: {},
      edgeLayouts: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    } as never);
    seedStore([wt("wt_1")]);
    await startWalkthroughFileSync();
    stopWalkthroughFileSync();

    fs.removeAtRoot("wt_1.walkthrough.json");
    await startWalkthroughFileSync();

    expect(fs.hasFile("d-1.json")).toBe(true);
    const scan = await fileSystemAdapter.scanWorkspace();
    expect(scan.valid.map((d) => d.id)).toEqual(["d-1"]);
    expect(scan.invalid).toEqual([]);
  });

  it("does not read a folder that has never held these as a deletion", async () => {
    connectWorkspace("workspace-one");
    seedStore([wt("wt_1")]);
    await startWalkthroughFileSync();
    stopWalkthroughFileSync();

    // A different folder entirely, with none of them in it.
    connectWorkspace("workspace-two");
    await startWalkthroughFileSync();

    expect(listed()).toEqual(["wt_1"]);
    expect(fs.hasFile("wt_1.walkthrough.json")).toBe(true);
  });
});

describe("the folder is a mirror, not a replacement", () => {
  it("does nothing at all with no folder connected", async () => {
    disconnectWorkspace();
    seedStore([wt("wt_1")]);

    await startWalkthroughFileSync();

    expect(listed()).toEqual(["wt_1"]);
  });

  it("leaves the library intact when the folder goes away", async () => {
    connectWorkspace();
    seedStore([wt("wt_1")]);
    await startWalkthroughFileSync();

    stopWalkthroughFileSync();
    disconnectWorkspace();

    expect(listed()).toEqual(["wt_1"]);
  });

  it("keeps local storage holding every walkthrough while connected", async () => {
    connectWorkspace();
    seedStore([wt("wt_1")]);
    await startWalkthroughFileSync();

    await useWalkthroughStore.getState().save(wt("wt_2"));
    await flushWalkthroughFileSync();

    // LocalStorageAdapter namespaces its keys with `structura_`.
    const raw = localStorage.getItem("structura_walkthrough_presentations");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["wt_1", "wt_2"]);
  });
});

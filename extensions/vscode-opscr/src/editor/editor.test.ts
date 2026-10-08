import { describe, expect, it, vi } from "vitest";
import { FolderTexts, type FolderIO } from "./folder-texts";
import {
  EDITOR_APPLIED,
  EDITOR_APPLY,
  EDITOR_READY,
  EDITOR_SNAPSHOT,
  WebviewDiagram,
} from "./webview-diagram";

function memoryFolder(files: Record<string, string>) {
  const io: FolderIO & { documents: Map<string, string>; disk: Map<string, string> } = {
    documents: new Map(),
    disk: new Map(Object.entries(files)),
    list: async () => [...io.disk.keys()],
    read: async (name) => io.documents.get(name) ?? io.disk.get(name),
    writeDocument: vi.fn(async (name: string, text: string) => void io.documents.set(name, text)),
    writeDisk: vi.fn(async (name: string, text: string) => void io.disk.set(name, text)),
  };
  return io;
}
const tracked = (name: string) => name.endsWith(".opscr.yaml") || name === "opscr.layout.json";

describe("FolderTexts", () => {
  it("loads tracked files, with an empty sidecar when there is none", async () => {
    const texts = new FolderTexts(
      memoryFolder({ "a.opscr.yaml": "a", "notes.md": "x" }),
      tracked,
      "opscr.layout.json",
    );
    await texts.load();
    expect(texts.get()).toEqual([
      { name: "a.opscr.yaml", text: "a" },
      { name: "opscr.layout.json", text: "" },
    ]);
  });

  it("writes manifests as document edits and the sidecar to disk, skipping unchanged text", async () => {
    const io = memoryFolder({ "a.opscr.yaml": "a" });
    const texts = new FolderTexts(io, tracked, "opscr.layout.json");
    await texts.load();
    await texts.set([
      { name: "a.opscr.yaml", text: "a2" },
      { name: "opscr.layout.json", text: "{}" },
      { name: "new.opscr.yaml", text: "n" },
    ]);
    await texts.set([{ name: "a.opscr.yaml", text: "a2" }]);
    expect(io.writeDocument).toHaveBeenCalledTimes(2);
    expect(io.documents.get("a.opscr.yaml")).toBe("a2");
    expect(io.disk.get("opscr.layout.json")).toBe("{}");
  });

  it("tells news from the echo of its own writes", async () => {
    const texts = new FolderTexts(
      memoryFolder({ "a.opscr.yaml": "a" }),
      tracked,
      "opscr.layout.json",
    );
    await texts.load();
    await texts.set([{ name: "a.opscr.yaml", text: "a2" }]);
    expect(texts.update("a.opscr.yaml", "a2")).toBe(false);
    expect(texts.update("a.opscr.yaml", "typed")).toBe(true);
    expect(texts.update("notes.md", "x")).toBe(false);
    expect(texts.update("a.opscr.yaml", undefined)).toBe(true);
    expect(texts.get().map((f) => f.name)).toEqual(["opscr.layout.json"]);
  });
});

describe("WebviewDiagram", () => {
  it("sends changes and resolves them with the answer, taking its snapshot", async () => {
    const sent: unknown[] = [];
    const diagram = new WebviewDiagram((m) => sent.push(m));
    const applied = diagram.apply({ remove: ["x"] });
    expect(sent).toEqual([{ type: EDITOR_APPLY, requestId: 1, changes: { remove: ["x"] } }]);
    const snapshot = { id: "d", name: "d", description: null, components: [], connections: [] };
    expect(
      diagram.receive({
        type: EDITOR_APPLIED,
        requestId: 1,
        result: { idsByKey: { k: "c1" }, connectionIds: [] },
        diagram: snapshot,
      }),
    ).toBe("applied");
    expect(await applied).toEqual({ idsByKey: { k: "c1" }, connectionIds: [] });
    expect(diagram.get()).toBe(snapshot);
  });

  it("follows snapshots, and a reload drops pending requests", async () => {
    const diagram = new WebviewDiagram(() => {});
    const snapshot = { id: "d", name: "d", description: null, components: [], connections: [] };
    expect(diagram.receive({ type: EDITOR_SNAPSHOT, diagram: snapshot })).toBe("snapshot");
    expect(diagram.get()).toBe(snapshot);
    const pending = diagram.apply({});
    expect(diagram.receive({ type: EDITOR_READY })).toBe("ready");
    expect(await pending).toEqual({ idsByKey: {}, connectionIds: [] });
    expect(diagram.get()).toBeNull();
    expect(diagram.receive({ type: "other" })).toBeNull();
  });
});

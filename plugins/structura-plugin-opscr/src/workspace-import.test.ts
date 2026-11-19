/**
 * The workspace importer: one pick sets a whole opscr folder up, and the same folder picked again
 * opens what was made.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { takeHandedOff } from "./pane/handoff";
import type { PluginFolder, StructuraPluginApi } from "./types/plugin.types";
import { createWorkspaceImport, PANE_ID } from "./workspace-import";

const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-shop-product/";
const EXAMPLE = Object.fromEntries(
  git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
    .split("\n")
    .filter((p) => p.startsWith(PREFIX))
    .map((p) => [p.slice(PREFIX.length), git("show", `HEAD:${p}`)]),
);

const folderOf = (name: string, files: Record<string, string>) =>
  ({
    name,
    list: async () => Object.keys(files).filter((f) => !f.includes("/")),
    read: async (file: string) => files[file] ?? "",
  }) as unknown as PluginFolder;

/** The parts of the plugin API the importer uses, over Maps. */
class FakeHost {
  diagrams = new Map<string, { name: string; description?: string; folderId: string | null }>();
  folders = new Map<string, { name: string; parentId: string | null }>();
  storage = new Map<string, unknown>();
  /** Binding id → the folder it remembers. */
  bound = new Map<string, PluginFolder>();
  next: PluginFolder | null = null;
  api = {
    files: {
      isSupported: () => true,
      pick: async (id: string) => {
        if (this.next) this.bound.set(id, this.next);
        return this.next;
      },
      move: async (from: string, to: string) => {
        const folder = this.bound.get(from);
        if (!folder) return false;
        this.bound.delete(from);
        this.bound.set(to, folder);
        return true;
      },
      isSame: async (a: string, b: string) =>
        this.bound.has(a) && this.bound.get(a) === this.bound.get(b),
      forget: async (id: string) => void this.bound.delete(id),
    },
    storage: {
      get: async (key: string) => this.storage.get(key) ?? null,
      set: async (key: string, value: unknown) => void this.storage.set(key, value),
    },
    createFolder: (input: { name: string; parentId?: string | null }) => {
      const id = `f${this.folders.size + 1}`;
      this.folders.set(id, { name: input.name, parentId: input.parentId ?? null });
      return id;
    },
    createDiagram: (input: { name: string; description?: string; folderId?: string | null }) => {
      const id = `d${this.diagrams.size + 1}`;
      this.diagrams.set(id, { ...input, folderId: input.folderId ?? null });
      return id;
    },
    getDiagram: (id: string) => (this.diagrams.has(id) ? { id } : null),
  } as unknown as StructuraPluginApi;
}

let host: FakeHost;
beforeEach(() => {
  host = new FakeHost();
});

describe("opscr workspace importer", () => {
  it("sets the folder up: a workspace folder, its diagram bound, View diagrams on, the pane", async () => {
    const folder = folderOf("web-shop-product", EXAMPLE);
    host.next = folder;
    const result = await createWorkspaceImport(host.api).run({ locale: "en", folderId: "top" });

    expect(result).toEqual({ diagramId: "d1", openPane: PANE_ID });
    expect([...host.folders.values()]).toEqual([{ name: "Web shop", parentId: "top" }]);
    expect(host.diagrams.get("d1")).toMatchObject({ name: "Web shop", folderId: "f1" });
    expect(host.bound.get("d1")).toBe(folder);
    expect(host.bound.has("workspace-import")).toBe(false);
    expect(host.storage.get("binding:d1")).toMatchObject({ folderName: "web-shop-product" });
    expect(host.storage.get("view-diagrams:d1")).toMatchObject({ enabled: true });
    expect(takeHandedOff("d1")).toBe(folder);
  });

  it("opens the diagram it made when the same folder is picked again", async () => {
    const folder = folderOf("web-shop-product", EXAMPLE);
    host.next = folder;
    const importer = createWorkspaceImport(host.api);
    await importer.run({ locale: "en", folderId: null });
    takeHandedOff("d1");

    expect(await importer.run({ locale: "en", folderId: null })).toEqual({
      diagramId: "d1",
      openPane: PANE_ID,
    });
    expect(host.diagrams.size).toBe(1);
    expect(takeHandedOff("d1")).toBe(folder);
  });

  it("does nothing when the pick is cancelled, and refuses a folder without manifests", async () => {
    const importer = createWorkspaceImport(host.api);
    expect(await importer.run({ locale: "en", folderId: null })).toBeNull();

    host.next = folderOf("notes", { "README.md": "# notes" });
    await expect(importer.run({ locale: "pt-BR", folderId: null })).rejects.toThrow(
      /não tem manifestos opscr/,
    );
    expect(host.diagrams.size).toBe(0);
    expect(host.bound.size).toBe(0);
  });
});

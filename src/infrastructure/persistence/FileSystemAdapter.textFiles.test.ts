import { describe, expect, it } from "vitest";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { createMemoryFs } from "./__testing__/memoryFileSystem";

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

const SKILLS = [".structura", "skills"];

function connect(): { adapter: FileSystemAdapter; fs: ReturnType<typeof createMemoryFs> } {
  const fs = createMemoryFs();
  const adapter = new FileSystemAdapter();
  (adapter as unknown as AdapterInternals).handle = fs.rootHandle;
  return { adapter, fs };
}

describe("text files in a workspace subfolder", () => {
  it("lists nothing, and creates nothing, while the folder does not exist", async () => {
    const { adapter, fs } = connect();
    expect(await adapter.listFilesAt(SKILLS)).toEqual([]);
    expect(fs.listNames()).toEqual([]);
  });

  it("writes, lists, reads and deletes text as is", async () => {
    const { adapter, fs } = connect();
    await adapter.writeTextFileAt(SKILLS, "b.md", "---\nname: B\n---\n");
    await adapter.writeTextFileAt(SKILLS, "a.md", "plain text");

    expect(fs.readFile(".structura/skills/a.md")).toBe("plain text");
    expect(await adapter.listFilesAt(SKILLS)).toEqual(["a.md", "b.md"]);
    expect(await adapter.readTextFileAt(SKILLS, "b.md")).toBe("---\nname: B\n---\n");

    await adapter.deleteFileAt(SKILLS, "a.md");
    expect(fs.hasFile(".structura/skills/a.md")).toBe(false);
    // Already gone is not an error.
    await adapter.deleteFileAt(SKILLS, "a.md");
  });

  it("throws when no folder is connected", async () => {
    const adapter = new FileSystemAdapter();
    await expect(adapter.writeTextFileAt(SKILLS, "a.md", "x")).rejects.toThrow();
    await expect(adapter.readTextFileAt(SKILLS, "a.md")).rejects.toThrow();
    expect(await adapter.listFilesAt(SKILLS)).toEqual([]);
  });
});

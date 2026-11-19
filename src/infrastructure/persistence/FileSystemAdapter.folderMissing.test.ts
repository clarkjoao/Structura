import { describe, expect, it, vi } from "vitest";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { createMemoryFs } from "./__testing__/memoryFileSystem";

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

function attachHandle(adapter: FileSystemAdapter, handle: FileSystemDirectoryHandle): void {
  (adapter as unknown as AdapterInternals).handle = handle;
}

/** A folder deleted on disk: the handle keeps its permission, every operation is NotFound. */
function deletedFolder(name: string): FileSystemDirectoryHandle {
  const notFound = () => {
    throw new DOMException("A requested file or directory could not be found", "NotFoundError");
  };
  return {
    kind: "directory",
    name,
    queryPermission: async () => "granted",
    entries: () => ({ next: async () => notFound() }),
    getDirectoryHandle: async () => notFound(),
    getFileHandle: async () => notFound(),
  } as unknown as FileSystemDirectoryHandle;
}

describe("FileSystemAdapter — the connected folder is gone from disk", () => {
  it("keeps the connection while the folder is there", async () => {
    const adapter = new FileSystemAdapter();
    attachHandle(adapter, createMemoryFs().rootHandle);
    expect(await adapter.ensureFolderExists()).toBe(true);
    expect(adapter.isConnected).toBe(true);
  });

  it("drops the connection and reports the folder once it is deleted", async () => {
    const adapter = new FileSystemAdapter();
    const onMissing = vi.fn();
    adapter.setFolderMissingCallback(onMissing);
    attachHandle(adapter, deletedFolder("teste"));

    expect(await adapter.ensureFolderExists()).toBe(false);
    expect(adapter.isConnected).toBe(false);
    expect(adapter.missingFolderName).toBe("teste");
    expect(onMissing).toHaveBeenCalledWith("teste");
  });
});

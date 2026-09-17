import { describe, expect, it, vi } from "vitest";
import {
  ensureFolderPath,
  folderSegmentsFromRelativePath,
  isImportableDiagramFileName,
  type FolderLike,
} from "./import-folder-path";

describe("isImportableDiagramFileName", () => {
  it("accepts diagram json files", () => {
    expect(isImportableDiagramFileName("checkout.json")).toBe(true);
    expect(isImportableDiagramFileName("Acme/API/checkout.JSON")).toBe(true);
  });

  it("rejects manifests, dotfiles, and non-json", () => {
    expect(isImportableDiagramFileName("structura-manifest.json")).toBe(false);
    expect(isImportableDiagramFileName(".hidden.json")).toBe(false);
    expect(isImportableDiagramFileName("notes.md")).toBe(false);
  });
});

describe("folderSegmentsFromRelativePath", () => {
  it("returns parent folders and drops the file name", () => {
    expect(folderSegmentsFromRelativePath("Acme/API/checkout.json")).toEqual(["Acme", "API"]);
  });

  it("returns an empty list for a bare file", () => {
    expect(folderSegmentsFromRelativePath("checkout.json")).toEqual([]);
  });

  it("normalizes backslashes and skips dot segments", () => {
    expect(folderSegmentsFromRelativePath("Acme\\.cache\\API\\x.json")).toEqual(["Acme", "API"]);
  });
});

describe("ensureFolderPath", () => {
  it("reuses an existing folder with the same name under the same parent", () => {
    const folders: Record<string, FolderLike> = {
      f1: { id: "f1", name: "Acme", parentId: null },
    };
    const addFolder = vi.fn();
    const leaf = ensureFolderPath(
      ["Acme", "API"],
      null,
      () => folders,
      (name, parentId) => {
        const folder = { id: `new-${name}`, name, parentId };
        folders[folder.id] = folder;
        addFolder(name, parentId);
        return folder;
      },
    );
    expect(leaf).toBe("new-API");
    expect(addFolder).toHaveBeenCalledTimes(1);
    expect(addFolder).toHaveBeenCalledWith("API", "f1");
  });

  it("returns the base parent when there are no segments", () => {
    expect(ensureFolderPath([], "base", () => ({}), vi.fn())).toBe("base");
    expect(ensureFolderPath([], null, () => ({}), vi.fn())).toBeNull();
  });
});

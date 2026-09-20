import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { Folder } from "@/features/diagram";
import { FolderTree } from "./FolderTree";

vi.mock("@/features/diagram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diagram")>()),
  useDiagramActions: () => ({
    addFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
  }),
}));

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return { id, name, parentId, createdAt: 0, updatedAt: 0 } as Folder;
}

/** parent ─ child ─ grandchild, so a count can be proven to climb two levels. */
const FOLDERS: Record<string, Folder> = {
  parent: folder("parent", "Parent"),
  child: folder("child", "Child", "parent"),
  grandchild: folder("grandchild", "Grandchild", "child"),
  sibling: folder("sibling", "Sibling"),
};

function renderTree(overrides: Partial<React.ComponentProps<typeof FolderTree>> = {}) {
  const props: React.ComponentProps<typeof FolderTree> = {
    folders: FOLDERS,
    selectedFolderId: null,
    onSelectFolder: vi.fn(),
    countFor: () => 0,
    rootCount: 0,
    headerLabel: "Workspace",
    allLabel: "All items",
    ...overrides,
  };
  return { ...render(<FolderTree {...props} />), props };
}

/** The row for a folder, found by its visible name. */
function row(name: string): HTMLElement {
  const label = screen.getByText(name);
  const found = label.closest("div.group");
  if (!found) throw new Error(`no row for folder "${name}"`);
  return found as HTMLElement;
}

describe("FolderTree counts", () => {
  it("counts descendants, so a folder holding nothing itself does not read as empty", () => {
    // Only the grandchild holds anything. Parent and child hold none directly.
    renderTree({ countFor: (id) => (id === "grandchild" ? 2 : 0) });

    expect(within(row("Parent")).getByText("2")).toBeTruthy();
  });

  it("adds a folder's own items to those below it", () => {
    renderTree({ countFor: (id) => (id === "parent" ? 3 : id === "grandchild" ? 2 : 0) });

    expect(within(row("Parent")).getByText("5")).toBeTruthy();
  });

  it("does not leak a sibling's items into a folder's total", () => {
    renderTree({ countFor: (id) => (id === "sibling" ? 7 : 0) });

    expect(within(row("Parent")).queryByText("7")).toBeNull();
    expect(within(row("Sibling")).getByText("7")).toBeTruthy();
  });

  it("shows the host's own tally beside the everything row", () => {
    renderTree({ rootCount: 9, allLabel: "All items" });

    const allRow = screen.getByText("All items").closest("div");
    expect(within(allRow as HTMLElement).getByText("9")).toBeTruthy();
  });

  it("terminates on a parentId cycle instead of blowing the stack", () => {
    const cyclic: Record<string, Folder> = {
      a: folder("a", "A", "b"),
      b: folder("b", "B", "a"),
    };
    expect(() => renderTree({ folders: cyclic, countFor: () => 1 })).not.toThrow();
  });
});

describe("FolderTree filing by drag", () => {
  const MIME = "application/x-structura-test-id";

  function dragProps(onDropItem: (folderId: string | null, itemId: string) => void) {
    return {
      mimeType: MIME,
      dropTargetFolderId: undefined,
      onDragOverFolder: vi.fn(),
      onDragLeave: vi.fn(),
      onDropItem,
    };
  }

  it("reports the dropped item and the folder it landed on", () => {
    const onDropItem = vi.fn();
    renderTree({ drag: dragProps(onDropItem) });

    fireEvent.drop(row("Parent"), {
      dataTransfer: { getData: (type: string) => (type === MIME ? "item-1" : "") },
    });

    expect(onDropItem).toHaveBeenCalledWith("parent", "item-1");
  });

  it("ignores an item carrying a type this tree does not read", () => {
    const onDropItem = vi.fn();
    renderTree({ drag: dragProps(onDropItem) });

    // A card from the *other* library: its id rides on a different mime type.
    fireEvent.drop(row("Parent"), {
      dataTransfer: {
        getData: (type: string) => (type === "application/x-structura-other-id" ? "item-1" : ""),
      },
    });

    expect(onDropItem).not.toHaveBeenCalled();
  });

  it("accepts no drops at all when no drag bundle is given", () => {
    const onDropItem = vi.fn();
    renderTree();

    fireEvent.drop(row("Parent"), {
      dataTransfer: { getData: () => "item-1" },
    });

    expect(onDropItem).not.toHaveBeenCalled();
  });
});

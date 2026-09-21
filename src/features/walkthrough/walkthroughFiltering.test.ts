import { describe, expect, it } from "vitest";
import type { Folder } from "@/features/diagram";
import type { WalkthroughPresentation } from "./model/walkthrough.types";
import { countByFolderId, effectiveFolderId, selectWalkthroughs } from "./walkthroughFiltering";

function folder(id: string, parentId: string | null = null): Folder {
  return { id, name: id, parentId, createdAt: 0, updatedAt: 0 } as Folder;
}

const FOLDERS: Record<string, Folder> = {
  payments: folder("payments"),
  auth: folder("auth"),
};

function wt(id: string, over: Partial<WalkthroughPresentation> = {}): WalkthroughPresentation {
  return {
    id,
    title: id,
    steps: [],
    createdAt: 0,
    updatedAt: 0,
    folderId: null,
    ...over,
  };
}

const NO_FAVORITES: ReadonlySet<string> = new Set();

function select(
  presentations: WalkthroughPresentation[],
  over: Partial<Parameters<typeof selectWalkthroughs>[0]> = {},
) {
  return selectWalkthroughs({
    presentations,
    folders: FOLDERS,
    selectedFolderId: null,
    chip: "all",
    search: "",
    sortKey: "name",
    sortAsc: true,
    favoriteIds: NO_FAVORITES,
    ...over,
  }).map((p) => p.id);
}

describe("searching", () => {
  it("matches a word that appears only in the description", () => {
    const listed = select(
      [
        wt("a", { title: "Onboarding", description: "covers the checkout path" }),
        wt("b", { title: "Billing" }),
      ],
      { search: "checkout" },
    );

    expect(listed).toEqual(["a"]);
  });

  it("matches the title too", () => {
    const listed = select([wt("a", { title: "Checkout" }), wt("b", { title: "Billing" })], {
      search: "checkout",
    });

    expect(listed).toEqual(["a"]);
  });

  it("does not reach outside the selected folder", () => {
    const listed = select(
      [
        wt("inside", { title: "Checkout", folderId: "payments" }),
        wt("outside", { title: "Checkout", folderId: "auth" }),
      ],
      { search: "checkout", selectedFolderId: "payments" },
    );

    expect(listed).toEqual(["inside"]);
  });
});

describe("sorting", () => {
  it("orders by how many scenes each has", () => {
    const listed = select(
      [
        wt("three", { steps: [{}, {}, {}] as WalkthroughPresentation["steps"] }),
        wt("one", { steps: [{}] as WalkthroughPresentation["steps"] }),
        wt("two", { steps: [{}, {}] as WalkthroughPresentation["steps"] }),
      ],
      { sortKey: "sceneCount" },
    );

    expect(listed).toEqual(["one", "two", "three"]);
  });

  it("reverses when the same ordering is asked for descending", () => {
    const listed = select([wt("a", { title: "a" }), wt("b", { title: "b" })], {
      sortKey: "name",
      sortAsc: false,
    });

    expect(listed).toEqual(["b", "a"]);
  });
});

describe("chips", () => {
  it("the recent shelf is the most recently edited first, whatever the sort says", () => {
    const listed = select(
      [wt("old", { title: "a", updatedAt: 1 }), wt("new", { title: "z", updatedAt: 99 })],
      { chip: "recent", sortKey: "name", sortAsc: true },
    );

    expect(listed).toEqual(["new", "old"]);
  });

  it("favorites lists only what was marked", () => {
    const listed = select([wt("a"), wt("b")], {
      chip: "favorites",
      favoriteIds: new Set(["b"]),
    });

    expect(listed).toEqual(["b"]);
  });

  it("a chip still narrows within the selected folder", () => {
    const listed = select(
      [wt("here", { folderId: "payments" }), wt("elsewhere", { folderId: "auth" })],
      {
        chip: "favorites",
        favoriteIds: new Set(["here", "elsewhere"]),
        selectedFolderId: "payments",
      },
    );

    expect(listed).toEqual(["here"]);
  });
});

describe("a folder that no longer exists", () => {
  it("reads as the root rather than hiding the walkthrough", () => {
    expect(effectiveFolderId(wt("a", { folderId: "deleted" }), FOLDERS)).toBeNull();
  });

  it("lists the stranded walkthrough under All", () => {
    const listed = select([wt("stranded", { folderId: "deleted" })], {
      selectedFolderId: null,
    });

    expect(listed).toEqual(["stranded"]);
  });

  it("does not list it under any surviving folder", () => {
    const listed = select([wt("stranded", { folderId: "deleted" })], {
      selectedFolderId: "payments",
    });

    expect(listed).toEqual([]);
  });

  it("does not count it against a surviving folder", () => {
    const counts = countByFolderId([wt("stranded", { folderId: "deleted" })], FOLDERS);

    expect(counts.size).toBe(0);
  });
});

describe("counting", () => {
  it("tallies each folder's own walkthroughs", () => {
    const counts = countByFolderId(
      [
        wt("a", { folderId: "payments" }),
        wt("b", { folderId: "payments" }),
        wt("c", { folderId: "auth" }),
        wt("d"),
      ],
      FOLDERS,
    );

    expect(counts.get("payments")).toBe(2);
    expect(counts.get("auth")).toBe(1);
  });
});

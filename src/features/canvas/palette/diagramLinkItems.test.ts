import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import {
  IMPORTED_GROUP_ID,
  NO_FOLDER_GROUP_ID,
  RECENT_DIAGRAMS,
  buildDiagramLinkSource,
  stripImportedSuffix,
  suggestDiagram,
} from "./diagramLinkItems";

const diagram = (id: string, name: string, extra: Partial<Diagram> = {}): Diagram =>
  ({ id, name, level: "container", createdAt: 0, updatedAt: 0, ...extra }) as Diagram;

const folders: Record<string, Folder> = {
  f1: { id: "f1", name: "Pix", parentId: null },
  f2: { id: "f2", name: "Core", parentId: null },
};

const options = {
  levelLabel: (level: string) => `L:${level}`,
  importedLabel: "Imported",
  noFolderLabel: "No folder",
};

describe("stripImportedSuffix", () => {
  it("takes the stamp off the title and reports it", () => {
    expect(stripImportedSuffix("Checkout - imported 24/10/2026")).toEqual({
      name: "Checkout",
      imported: true,
    });
    expect(stripImportedSuffix("Checkout - importado 24/10/2026")).toEqual({
      name: "Checkout",
      imported: true,
    });
  });

  it("leaves an ordinary title alone, even one with a dash or the word", () => {
    expect(stripImportedSuffix("Imported goods - phase 2").imported).toBe(false);
    expect(stripImportedSuffix("Checkout - v2")).toEqual({
      name: "Checkout - v2",
      imported: false,
    });
  });
});

describe("buildDiagramLinkSource", () => {
  const source = buildDiagramLinkSource(
    [
      diagram("a", "Hub", { folderId: "f1", updatedAt: 5 }),
      diagram("b", "Ledger - imported 01/02/2026", { folderId: "f2", updatedAt: 9 }),
      diagram("c", "Loose", { updatedAt: 1 }),
      diagram("self", "Here", { updatedAt: 99 }),
    ],
    folders,
    { ...options, excludeId: "self" },
  );

  it("leaves out the diagram being edited", () => {
    expect(source.items.map((i) => i.id)).not.toContain("self");
  });

  it("titles carry no import stamp; the stamp becomes quiet metadata", () => {
    const ledger = source.items.find((i) => i.id === "b");
    expect(ledger?.label).toBe("Ledger");
    expect(ledger?.meta).toBe("Imported");
    expect(source.items.find((i) => i.id === "a")?.meta).toBeUndefined();
  });

  it("lists an imported diagram under its folder and under Imported", () => {
    expect(source.items.find((i) => i.id === "b")?.groupIds).toEqual(["f2", IMPORTED_GROUP_ID]);
  });

  it("offers one category per folder in use, then no-folder, then imported", () => {
    expect(source.groups.map((g) => g.id)).toEqual([
      "f2",
      "f1",
      NO_FOLDER_GROUP_ID,
      IMPORTED_GROUP_ID,
    ]);
  });

  it("orders recents by last update, newest first, capped", () => {
    expect(source.recentIds).toEqual(["b", "a", "c"]);
    const many = buildDiagramLinkSource(
      Array.from({ length: RECENT_DIAGRAMS + 4 }, (_, i) =>
        diagram(`d${i}`, `D${i}`, { updatedAt: i }),
      ),
      {},
      options,
    );
    expect(many.recentIds).toHaveLength(RECENT_DIAGRAMS);
  });
});

describe("suggestDiagram", () => {
  const { items } = buildDiagramLinkSource(
    [diagram("a", "Checkout - imported 01/01/2026"), diagram("b", "Billing")],
    {},
    options,
  );

  it("suggests the diagram with the same name, and says why", () => {
    const [suggestion] = suggestDiagram(items, "  checkout ", "Same name");
    expect(suggestion.item.id).toBe("a");
    expect(suggestion.reason).toBe("Same name");
  });

  it("folds accents and case", () => {
    const accented = buildDiagramLinkSource([diagram("x", "Orquestração")], {}, options).items;
    expect(suggestDiagram(accented, "orquestracao", "r")).toHaveLength(1);
  });

  it("suggests nothing for an empty name, not the first diagram", () => {
    expect(suggestDiagram(items, "", "r")).toEqual([]);
    expect(suggestDiagram(items, "   ", "r")).toEqual([]);
  });

  it("does not suggest a partial match", () => {
    expect(suggestDiagram(items, "Check", "r")).toEqual([]);
  });
});

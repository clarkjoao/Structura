import { describe, expect, it } from "vitest";
import { searchCatalog } from "@/features/elements/search";
import { withRecentCatalogEntry, RECENT_CATALOG_ENTRIES_MAX } from "../preferences";
import { buildCanvasCatalogIndex } from "./canvasCatalogIndex";
import {
  ALL_GROUPS,
  browseSections,
  CATALOG_GROUP_PREVIEW,
  cycleGroup,
  moveActive,
  searchSections,
  sectionRows,
} from "./catalogViewModel";

const index = buildCanvasCatalogIndex([], []);

describe("browseSections", () => {
  it("shows recents first, then every non-empty group capped for 'All'", () => {
    const recent = index.entries.slice(0, 2);
    const sections = browseSections(index, recent, ALL_GROUPS);
    expect(sections[0]).toMatchObject({ kind: "recents" });
    expect(sections[0].options.map((option) => option.entry.id)).toEqual(
      recent.map((entry) => entry.id),
    );
    for (const section of sections.slice(1)) {
      expect(section.kind).toBe("grid");
      expect(section.options.length).toBeLessThanOrEqual(CATALOG_GROUP_PREVIEW);
      expect(section.options.length).toBeGreaterThan(0);
    }
    // Services and presets are empty here, so they are not listed under "All".
    expect(sections.map((section) => section.key)).not.toContain("presets");
  });

  it("shows one group in full, without recents, when a chip is picked", () => {
    const sections = browseSections(index, index.entries.slice(0, 1), "aws");
    expect(sections).toHaveLength(1);
    const [aws] = sections;
    expect(aws.kind).toBe("grid");
    expect(aws.options.length).toBe(index.entries.filter((e) => e.groupId === "aws").length);
  });

  it("keeps an empty presets group so its chip can explain how to make one", () => {
    const [presets] = browseSections(index, [], "presets");
    expect(presets).toMatchObject({ kind: "grid", options: [], total: 0 });
  });

  it("gives an entry listed twice (recent and in its group) two distinct option keys", () => {
    const entry = index.entries[0];
    const sections = browseSections(index, [entry], ALL_GROUPS);
    const keys = sections.flatMap((section) => section.options.map((option) => option.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("searchSections", () => {
  it("puts the best hit alone on top, and the rest under their groups", () => {
    const result = searchCatalog(index, "queue");
    const sections = searchSections(index, result, ALL_GROUPS);
    expect(sections[0].kind).toBe("best");
    expect(sections[0].options[0].entry.id).toBe(result.hits[0].entry.id);
    const rest = sections.slice(1).flatMap((section) => section.options);
    expect(rest).toHaveLength(result.hits.length - 1);
    expect(rest.map((option) => option.entry.id)).not.toContain(result.hits[0].entry.id);
  });

  it("filters to the picked chip", () => {
    const result = searchCatalog(index, "queue");
    const sections = searchSections(index, result, "azure");
    const groups = new Set(
      sections.flatMap((section) => section.options.map((option) => option.entry.groupId)),
    );
    expect([...groups]).toEqual(["azure"]);
  });

  it("is empty when nothing matched", () => {
    expect(searchSections(index, searchCatalog(index, "zzzz"), ALL_GROUPS)).toEqual([]);
  });
});

describe("keyboard model", () => {
  const rows = [["a", "b", "c", "d"], ["e", "f"], ["g"]];

  it("moves down and up keeping the column where it can", () => {
    expect(moveActive(rows, "c", "down")).toBe("f");
    expect(moveActive(rows, "f", "down")).toBe("g");
    expect(moveActive(rows, "f", "up")).toBe("b");
    expect(moveActive(rows, "a", "up")).toBe("a");
  });

  it("moves left and right in reading order across rows, stopping at the ends", () => {
    expect(moveActive(rows, "d", "right")).toBe("e");
    expect(moveActive(rows, "e", "left")).toBe("d");
    expect(moveActive(rows, "g", "right")).toBe("g");
  });

  it("starts on the first option when none is active", () => {
    expect(moveActive(rows, null, "down")).toBe("a");
    expect(moveActive([], null, "down")).toBeNull();
  });

  it("chunks grids by four and lists one per row", () => {
    const sections = browseSections(index, [], "flowchart");
    const flowchartRows = sectionRows(sections);
    expect(flowchartRows.every((row) => row.length <= 4)).toBe(true);
    const search = searchSections(index, searchCatalog(index, "queue"), ALL_GROUPS);
    expect(sectionRows(search).every((row) => row.length === 1)).toBe(true);
  });

  it("cycles chips both ways, wrapping", () => {
    expect(cycleGroup(["all", "c4", "aws"], "aws", false)).toBe("all");
    expect(cycleGroup(["all", "c4", "aws"], "all", true)).toBe("aws");
  });
});

describe("recent catalog entries", () => {
  it("moves a reused entry to the front and caps the list", () => {
    let recent: string[] = [];
    for (let i = 0; i < RECENT_CATALOG_ENTRIES_MAX + 3; i += 1) {
      recent = withRecentCatalogEntry(recent, `e${i}`);
    }
    expect(recent).toHaveLength(RECENT_CATALOG_ENTRIES_MAX);
    recent = withRecentCatalogEntry(recent, recent[3]);
    expect(recent[0]).toBe(`e${RECENT_CATALOG_ENTRIES_MAX + 3 - 1 - 3}`);
    expect(new Set(recent).size).toBe(recent.length);
  });
});

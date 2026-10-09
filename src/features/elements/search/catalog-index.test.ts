import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import { offeredElements } from "../element.registry";
import { paletteEntriesForElements } from "../element.palette";
import { allCloudFamilies } from "../families/cloud-family.registry";
import {
  catalogGroupCounts,
  createCatalogIndex,
  registryCatalogEntries,
  searchCatalog,
  type CatalogEntry,
  type CatalogIndex,
} from "./catalog-index";
import { findMatchRanges, fold, foldWithMap, toSourceRange } from "./normalize";

function registryIndex(): CatalogIndex {
  const { groups, entries } = registryCatalogEntries();
  return createCatalogIndex(groups, entries);
}

function serviceIdOf({ entry }: { entry: CatalogEntry }): string | undefined {
  return entry.insert.kind === "element" ? entry.insert.createOptions.serviceId : undefined;
}

describe("fold", () => {
  it("is lowercase and accent-insensitive", () => {
    expect(fold("Decisão")).toBe("decisao");
    expect(fold("ÁÉÍÕÇ")).toBe("aeioc");
  });

  it("maps a folded range back onto the original text", () => {
    const text = foldWithMap("Decisão final");
    const at = text.folded.indexOf("decisao");
    expect(toSourceRange(text, at, at + "decisao".length)).toEqual([0, 7]);
    const fin = text.folded.indexOf("final");
    expect(toSourceRange(text, fin, fin + 5)).toEqual([8, 13]);
  });
});

describe("registryCatalogEntries", () => {
  it("offers every palette entry the registry offers, once", () => {
    const { entries } = registryCatalogEntries();
    const expected = paletteEntriesForElements(offeredElements()).map((entry) => entry.key);
    expect(entries.map((entry) => entry.id).sort()).toEqual([...expected].sort());
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("orders C4, flowchart and canvas first, then the catalog families, then the rest", () => {
    const ids = registryCatalogEntries().groups.map((group) => group.id);
    const families = allCloudFamilies().map((family) => family.paletteCategoryId);
    expect(ids.slice(0, 3)).toEqual(["c4", "flowchart", "canvas"]);
    expect(ids.slice(3, 3 + families.length)).toEqual(families);
    expect(ids).toContain("deploy");
  });

  it("labels every group, never with a raw i18n key", () => {
    for (const group of registryCatalogEntries().groups) {
      expect(group.label, group.id).not.toMatch(/^elementCatalog\.|^elements\./);
      expect(group.label.length, group.id).toBeGreaterThan(0);
    }
  });

  it("creates AWS container services as the panel kind that draws them", () => {
    const vpc = registryCatalogEntries().entries.find((entry) => entry.id === "aws-networking:vpc");
    expect(vpc?.insert).toEqual({
      kind: "element",
      type: "panel",
      createOptions: { panelKind: "vpc" },
    });
  });

  it("derives counts from the entries", () => {
    const index = registryIndex();
    const counts = catalogGroupCounts(index);
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    expect(total).toBe(index.entries.length);
    expect(counts.get("c4")).toBe(4);
  });
});

describe("searchCatalog", () => {
  let index: CatalogIndex;
  const originalLanguage = i18n.language;

  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR");
    index = registryIndex();
  });

  afterAll(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("finds queue services across families from the pt-BR word 'fila'", () => {
    const { hits, countsByGroup } = searchCatalog(index, "fila");
    const services = hits.map(serviceIdOf);
    expect(services).toEqual(expect.arrayContaining(["sqs", "servicebus", "kafka"]));
    // A queue and nothing else beats a queue that is also an event stream.
    expect(services.indexOf("sqs")).toBeLessThan(services.indexOf("msk"));
    for (const hit of hits.filter((candidate) => serviceIdOf(candidate) === "sqs")) {
      expect(hit.matchedOn).toBe("tag");
      expect(hit.matchedText).toBe("fila");
    }
    expect(countsByGroup.get("aws")).toBeGreaterThan(0);
    expect(countsByGroup.get("azure")).toBeGreaterThan(0);
    expect(countsByGroup.get("oss")).toBeGreaterThan(0);
  });

  it("matches the other locale's terms too: 'queue' in a pt-BR session", () => {
    const services = searchCatalog(index, "queue").hits.map(serviceIdOf);
    expect(services).toEqual(expect.arrayContaining(["sqs", "servicebus"]));
  });

  it("finds the flowchart decision with or without the accent", () => {
    for (const query of ["decisão", "decisao", "DECISAO"]) {
      const best = searchCatalog(index, query).hits[0];
      expect(best?.entry.id, query).toBe("process-node:diamond");
      expect(best?.matchedOn, query).toBe("name");
      expect(best?.ranges, query).toEqual([[0, 7]]);
    }
  });

  it("ranks an exact name above a prefix, a prefix above a synonym", () => {
    const postit = searchCatalog(index, "postit").hits;
    expect(postit[0].entry.id).toBe("note");
    expect(postit[0].matchedOn).toBe("synonym");

    const exact = searchCatalog(index, "system").hits[0];
    const prefix = searchCatalog(index, "syst").hits[0];
    const synonym = searchCatalog(index, "sistema").hits[0];
    expect([exact.entry.id, prefix.entry.id, synonym.entry.id]).toEqual([
      "system",
      "system",
      "system",
    ]);
    expect(exact.rank).toBeLessThan(prefix.rank);
    expect(prefix.rank).toBeLessThan(synonym.rank);
    expect(synonym.matchedOn).toBe("synonym");
  });

  it("prefers a word of the name over a match inside a word", () => {
    const hits = searchCatalog(index, "sqs").hits;
    expect(serviceIdOf(hits[0])).toBe("sqs");
    expect(hits[0].matchedOn).toBe("name");
    const { matchedText, ranges } = hits[0];
    expect(matchedText.slice(ranges[0][0], ranges[0][1])).toBe("SQS");
  });

  it("returns nothing for an empty query", () => {
    expect(searchCatalog(index, "   ").hits).toEqual([]);
  });

  it("returns nothing, and no group counts, when nothing matches", () => {
    const result = searchCatalog(index, "zzzz-nothing-zzzz");
    expect(result.hits).toEqual([]);
    expect(result.countsByGroup.size).toBe(0);
  });
});

describe("createCatalogIndex", () => {
  it("takes extra groups and entries beside the registry's, in the order given", () => {
    const base = registryCatalogEntries();
    const preset: CatalogEntry = {
      id: "preset:p1",
      groupId: "presets",
      label: "Fila de pagamentos",
      description: "",
      synonyms: [],
      tags: [],
      icon: base.entries[0].icon,
      insert: { kind: "preset", presetId: "p1" },
    };
    const index = createCatalogIndex(
      [...base.groups, { id: "presets", label: "Presets" }],
      [preset, ...base.entries],
    );
    expect(index.entries[index.entries.length - 1]?.id).toBe("preset:p1");
    expect(searchCatalog(index, "fila de").hits[0].entry.id).toBe("preset:p1");
  });

  it("drops entries whose group is not listed", () => {
    const base = registryCatalogEntries();
    const index = createCatalogIndex(
      base.groups.filter((group) => group.id === "c4"),
      base.entries,
    );
    expect(index.entries.every((entry) => entry.groupId === "c4")).toBe(true);
  });
});

describe("findMatchRanges", () => {
  it("finds every occurrence, accent-insensitive, in source positions", () => {
    expect(findMatchRanges("Fila de filas — FILÁ", "fila")).toEqual([
      [0, 4],
      [8, 12],
      [16, 20],
    ]);
    expect(findMatchRanges("anything", "  ")).toEqual([]);
  });
});

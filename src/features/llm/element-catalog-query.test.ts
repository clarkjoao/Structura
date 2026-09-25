import i18n from "@/infrastructure/i18n";
import { describe, expect, it } from "vitest";
import {
  computeDiagramFamilyMix,
  listElementFamilies,
  searchElements,
} from "./element-catalog-query";
import { applyDiagramPatchAction } from "./apply-diagram-patch";
import { CATALOG_READ_TOOL_NAMES, isWriteTool } from "./tools";
import { buildComponentTypeCatalog, allComponentTypes } from "./component-catalog";
import { buildSystemPrompt } from "./prompt-builder";
import type { Component } from "@/features/diagram/model/component.types";

describe("hierarchical element catalog (F8)", () => {
  it("keeps catalog read tools outside WRITE_TOOL_NAMES", () => {
    for (const name of CATALOG_READ_TOOL_NAMES) {
      expect(isWriteTool(name)).toBe(false);
    }
  });

  it("lists families with categories and diagramFamilyMix", () => {
    const components = {
      a: { id: "a", type: "system", name: "A", description: "", parentId: null },
      b: { id: "b", type: "aws-compute", name: "B", description: "", parentId: null },
      c: {
        id: "c",
        type: "oss-datastore" as Component["type"],
        name: "C",
        description: "",
        parentId: null,
      },
    } as Record<string, Component>;

    const listed = listElementFamilies(components);
    expect(listed.families.some((family) => family.id === "oss")).toBe(true);
    expect(listed.families.some((family) => family.id === "k8s")).toBe(true);
    expect(listed.diagramFamilyMix).toEqual(
      expect.arrayContaining([
        { familyId: "c4", nodes: 1 },
        { familyId: "aws", nodes: 1 },
        { familyId: "oss", nodes: 1 },
      ]),
    );
    expect(computeDiagramFamilyMix(components).length).toBe(3);
  });

  it("search_elements returns elementType + serviceId for Redis", () => {
    const found = searchElements({ query: "redis", familyId: "oss" });
    expect(found.results.some((row) => row.serviceId === "redis")).toBe(true);
    const redis = found.results.find((row) => row.serviceId === "redis")!;
    expect(redis.elementType).toBe("oss-datastore");
  });

  it("applies LIST_ELEMENT_FAMILIES and SEARCH_ELEMENTS as tool results", () => {
    const families = applyDiagramPatchAction({ type: "LIST_ELEMENT_FAMILIES", payload: {} });
    expect(families.toolResult?.type).toBe("LIST_ELEMENT_FAMILIES");
    const search = applyDiagramPatchAction({
      type: "SEARCH_ELEMENTS",
      payload: { query: "kafka" },
    });
    expect(search.toolResult?.type).toBe("SEARCH_ELEMENTS");
    const data = search.toolResult?.data as { results: Array<{ serviceId: string | null }> };
    expect(data.results.some((row) => row.serviceId === "kafka")).toBe(true);
  });

  it("records AFTER hierarchical catalog sizes", () => {
    const catalog = buildComponentTypeCatalog();
    const prompt = buildSystemPrompt("## Diagram\n(empty)", "en");
    const types = allComponentTypes();
    console.log(
      `[perf] AFTER hierarchical catalog: types=${types.length} catalogChars=${catalog.length} catalogLines=${catalog.split("\n").length} promptChars=${prompt.length}`,
    );
    // BEFORE (F7 tip, pre-shrink): types=269 catalogChars=7237 catalogLines=120 promptChars=20381
    // The budget pins the F8 shrink on the vocabulary that existed then. A
    // vocabulary registered since (the VSM family) is meant to reach the
    // catalog — elements are derived, not curated — so its own section is
    // measured apart rather than counted against the old budget.
    const vsmHeading = `### ${i18n.t("elements.families.vsm.label", { lng: "en" })}`;
    const start = catalog.indexOf(vsmHeading);
    expect(start).toBeGreaterThan(-1);
    const end = catalog.indexOf("\n### ", start + vsmHeading.length);
    const withoutVsm = catalog.slice(0, start) + catalog.slice(end === -1 ? catalog.length : end);
    expect(withoutVsm.length).toBeLessThan(7237);
    expect(catalog).not.toContain("CATEGORY:");
    expect(catalog).toContain("search_elements");
    expect(catalog).toContain("list_element_families");
  });
});

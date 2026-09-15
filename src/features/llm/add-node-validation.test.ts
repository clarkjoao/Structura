import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "@/features/diagram/model/component.types";
import {
  collectConfirmedCatalogHits,
  validateAddNodeAgainstConfirmedHits,
  validateAddNodeAgainstRegistry,
} from "./add-node-validation";
import { applyDiagramPatchAction, runCatalogReadActions } from "./apply-diagram-patch";
import { searchElements } from "./element-catalog-query";
import { buildComponentTypeCatalog } from "./component-catalog";

const addComponent = vi.fn(
  (type: string, name: string, _parent: string | null, _pos?: unknown, service?: string) => ({
    id: `el-${type}-${service ?? "none"}`,
    type,
    name,
    cloudServiceId: service,
  }),
);

vi.mock("@/features/diagram", () => ({
  useDiagramStore: {
    getState: () => ({
      activeDiagramId: "d1",
      diagrams: {
        d1: {
          snapshot: { components: {}, connections: {} },
          nodeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
      addComponent,
      removeComponent: vi.fn(),
      updateComponent: vi.fn(),
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      updateConnection: vi.fn(),
      insertPattern: vi.fn(),
      updateNodeLayout: vi.fn(),
      applyAutoLayout: vi.fn(),
    }),
  },
}));

describe("F8b add_node validation", () => {
  beforeEach(() => {
    addComponent.mockClear();
  });

  it("rejects unknown nodeType against the registry", () => {
    const result = validateAddNodeAgainstRegistry("not-a-real-type", "redis");
    expect(result.ok).toBe(false);
  });

  it("rejects serviceId that does not belong to the category", () => {
    const result = validateAddNodeAgainstRegistry("oss-datastore", "kafka");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("kafka");
  });

  it("rejects cloud category without serviceId", () => {
    expect(validateAddNodeAgainstRegistry("oss-datastore").ok).toBe(false);
  });

  it("accepts Redis under oss-datastore", () => {
    expect(validateAddNodeAgainstRegistry("oss-datastore", "redis").ok).toBe(true);
  });

  it("accepts structural types without serviceId", () => {
    expect(validateAddNodeAgainstRegistry("system").ok).toBe(true);
  });

  it("skips ADD_NODE when registry validation fails", () => {
    const applied = applyDiagramPatchAction({
      type: "ADD_NODE",
      payload: {
        nodeType: "oss-datastore" as Component["type"],
        name: "Bad",
        parentId: null,
        awsService: "not-a-service",
      },
    });
    expect(applied.skipped).toBe(true);
    expect(applied.addedNodeId).toBeNull();
    expect(addComponent).not.toHaveBeenCalled();
  });
});

describe("F8b same-turn search_elements gating", () => {
  beforeEach(() => {
    addComponent.mockClear();
  });

  it("runs catalog reads and collects confirmed hits before writes", () => {
    const { confirmedCatalogHits, catalogToolResults } = runCatalogReadActions([
      { type: "SEARCH_ELEMENTS", payload: { query: "redis", familyId: "oss" } },
      {
        type: "ADD_NODE",
        payload: {
          nodeType: "oss-datastore" as Component["type"],
          name: "Cache",
          parentId: null,
          awsService: "redis",
        },
      },
    ]);
    expect(catalogToolResults.some((row) => row.type === "SEARCH_ELEMENTS")).toBe(true);
    expect(confirmedCatalogHits).not.toBeNull();
    expect(
      validateAddNodeAgainstConfirmedHits("oss-datastore", "redis", confirmedCatalogHits!).ok,
    ).toBe(true);
  });

  it("does not apply hallucinated add_node when search_elements is in the same patch", () => {
    const { confirmedCatalogHits } = runCatalogReadActions([
      { type: "SEARCH_ELEMENTS", payload: { query: "redis", familyId: "oss" } },
    ]);
    expect(confirmedCatalogHits).not.toBeNull();

    const hallucinated = applyDiagramPatchAction(
      {
        type: "ADD_NODE",
        payload: {
          nodeType: "aws-compute" as Component["type"],
          name: "Invented",
          parentId: null,
          awsService: "lambda",
        },
      },
      undefined,
      { confirmedCatalogHits: confirmedCatalogHits! },
    );
    expect(hallucinated.skipped).toBe(true);
    expect(hallucinated.addedNodeId).toBeNull();
    expect(addComponent).not.toHaveBeenCalled();
  });

  it("applies add_node when it matches a same-patch search hit", () => {
    const search = searchElements({ query: "redis", familyId: "oss" });
    const hits = collectConfirmedCatalogHits([search]);

    const applied = applyDiagramPatchAction(
      {
        type: "ADD_NODE",
        payload: {
          nodeType: "oss-datastore" as Component["type"],
          name: "Cache",
          parentId: null,
          awsService: "redis",
        },
      },
      undefined,
      { confirmedCatalogHits: hits },
    );
    expect(applied.skipped).toBeFalsy();
    expect(applied.addedNodeId).toBeTruthy();
    expect(addComponent).toHaveBeenCalledWith("oss-datastore", "Cache", null, undefined, "redis");
  });

  it("documents the preferred search-then-add_node prompt contract", () => {
    const catalog = buildComponentTypeCatalog();
    expect(catalog).toContain("Prefer a search-only response first");
    expect(catalog).toContain("unmatched add_node calls are skipped");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "@/features/diagram/model/component.types";
import { validateAddNodeAgainstRegistry } from "./add-node-validation";
import { applyDiagramPatchAction, runCatalogReadActions } from "./apply-diagram-patch";
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

describe("a catalog read in the same patch does not narrow what may be added", () => {
  beforeEach(() => {
    addComponent.mockClear();
  });

  const addNode = (nodeType: string, awsService?: string) =>
    applyDiagramPatchAction({
      type: "ADD_NODE",
      payload: {
        nodeType: nodeType as Component["type"],
        name: "Node",
        parentId: null,
        ...(awsService === undefined ? {} : { awsService }),
      },
    });

  it("still runs catalog reads before writes, so the model sees results in one turn", () => {
    const { catalogToolResults } = runCatalogReadActions([
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
  });

  it("applies an add_node that matches what was searched", () => {
    runCatalogReadActions([
      { type: "SEARCH_ELEMENTS", payload: { query: "redis", familyId: "oss" } },
    ]);

    const applied = addNode("oss-datastore", "redis");

    expect(applied.skipped).toBeFalsy();
    expect(applied.addedNodeId).toBeTruthy();
    expect(addComponent).toHaveBeenCalledWith("oss-datastore", "Node", null, undefined, "redis");
  });

  it("applies a valid add_node unrelated to the search in the same patch", () => {
    // The regression this replaces: searching for Redis used to drop every
    // cloud node that was not in those results, so `lambda` — a registered
    // service the model knew from the prompt catalog — was discarded as a
    // "hallucination". Searching must not cost the model the rest of its work.
    runCatalogReadActions([
      { type: "SEARCH_ELEMENTS", payload: { query: "redis", familyId: "oss" } },
    ]);

    const applied = addNode("aws-compute", "lambda");

    expect(applied.skipped).toBeFalsy();
    expect(applied.addedNodeId).toBeTruthy();
    expect(addComponent).toHaveBeenCalledWith("aws-compute", "Node", null, undefined, "lambda");
  });

  it("still rejects an invented pair, searched or not", () => {
    runCatalogReadActions([
      { type: "SEARCH_ELEMENTS", payload: { query: "redis", familyId: "oss" } },
    ]);
    expect(addNode("aws-compute", "not-a-service").skipped).toBe(true);
    expect(addNode("aws-invented", "lambda").skipped).toBe(true);
    expect(addNode("oss-datastore", "lambda").skipped).toBe(true);

    addComponent.mockClear();
    expect(addNode("aws-compute", "not-a-service").skipped).toBe(true);
    expect(addComponent).not.toHaveBeenCalled();
  });

  it("tells the model to search without threatening to drop unmatched writes", () => {
    const catalog = buildComponentTypeCatalog();
    expect(catalog).toContain("search_elements");
    expect(catalog).not.toContain("unmatched add_node calls are skipped");
  });
});

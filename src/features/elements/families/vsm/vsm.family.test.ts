import { describe, expect, it } from "vitest";
import { buildComponentTypeCatalog, isValidNodeType } from "@/features/llm/component-catalog";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement } from "@/features/elements/element.registry";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import { vsmElements } from "./vsm.family";

const VSM_IDS = vsmElements.map((element) => element.id);

describe("the VSM family", () => {
  it("is registered, every element in the vsm family", () => {
    for (const id of VSM_IDS) {
      expect(getElement(id)?.family, id).toBe("vsm");
    }
  });

  it("reaches the LLM catalog from the registry alone", () => {
    const catalog = buildComponentTypeCatalog();
    for (const id of VSM_IDS) {
      expect(isValidNodeType(id), id).toBe(true);
      expect(catalog, id).toContain(`nodeType: "${id}"`);
    }
  });

  it("gets its own picker tab", () => {
    const ids = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      registry: 0,
      nodeTemplates: 0,
      flowchart: 0,
      byFamily: {},
    }).map((item) => item.id);
    expect(ids).toContain("vsm");
    expect(paletteEntriesForCategory("vsm").length).toBeGreaterThan(0);
  });

  it("wears the flow skin", () => {
    for (const id of VSM_IDS) {
      expect(getElement(id)?.skin, id).toBeDefined();
    }
  });
});

describe("vsm-external", () => {
  const descriptor = getElement("vsm-external")!;
  const base = { id: "x", name: "Acme", description: "", parentId: null };

  it("stores nothing for the default supplier role", () => {
    expect(descriptor.model.createComponent(base, { vsmRole: "supplier" })).not.toHaveProperty(
      "role",
    );
    expect(descriptor.model.createComponent(base, {})).not.toHaveProperty("role");
  });

  it("stores the customer role", () => {
    expect(descriptor.model.createComponent(base, { vsmRole: "customer" })).toMatchObject({
      role: "customer",
    });
  });

  it("is offered as a supplier and a customer", () => {
    const roles = paletteEntriesForCategory("vsm")
      .filter((entry) => entry.type === "vsm-external")
      .map((entry) => entry.createOptions.vsmRole);
    expect(roles.sort()).toEqual(["customer", "supplier"]);
  });
});

describe("vsm-process", () => {
  it("starts with the classic four-row data box, values blank", () => {
    const comp = getElement("vsm-process")!.model.createComponent(
      { id: "p", name: "Stamping", description: "", parentId: null },
      {},
    );
    expect(comp).toMatchObject({ type: "vsm-process" });
    const metrics = (comp as { metrics: Array<{ key: string; value: string }> }).metrics;
    expect(metrics).toHaveLength(4);
    expect(metrics.every((metric) => metric.value === "")).toBe(true);
    expect(metrics[0].key).toBe("C/T");
  });
});

describe("vsm-inventory", () => {
  it("defaults to the amber accent", () => {
    expect(getElement("vsm-inventory")!.skin?.defaultAccent).toBe("hsl(var(--node-person))");
  });
});

/**
 * Production control is not a VSM element: it is a C4 system, placed in the
 * value stream map like any other node. What has to hold is that nothing
 * about the VSM family gets in its way — it connects both ways to a process
 * box, and a map that mixes the two exports.
 */
describe("production control is a C4 system", () => {
  it("connects to and from a process box", async () => {
    const { canBeConnectionSource } = await import("@/features/diagram/model/connection-rules");
    const { buildConnectionCountPerNode, buildEdgeHandleAssignments } =
      await import("@/features/canvas/edges/connectionDerivations");
    const components = {
      pc: { id: "pc", name: "Production control", description: "", parentId: null, type: "system" },
      p: { id: "p", name: "Stamping", description: "", parentId: null, type: "vsm-process" },
    } as unknown as Record<string, import("@/features/diagram").Component>;
    const connections = [
      { id: "down", sourceId: "pc", targetId: "p", label: "schedule" },
      { id: "up", sourceId: "p", targetId: "pc", label: "status" },
    ];
    expect(canBeConnectionSource("system")).toBe(true);
    expect(canBeConnectionSource("vsm-process")).toBe(true);
    const assignments = buildEdgeHandleAssignments(
      connections,
      buildConnectionCountPerNode(connections),
      components,
    );
    expect(assignments.map((a) => [a.sourceHandle, a.targetHandle])).toEqual([
      ["source-0", "target-0"],
      ["source-0", "target-0"],
    ]);
  });
});

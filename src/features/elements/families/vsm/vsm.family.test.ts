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

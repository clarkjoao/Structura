import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Shapes } from "lucide-react";
import "./bootstrap";
import { registerElement, unregisterElement, getElement } from "./element.registry";
import type { ElementDescriptor, ElementTypeId } from "./element.types";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import CardNode from "@/features/canvas/nodes/CardNode";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CardNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { sanitizeComponentType } from "@/features/diagram/model/sanitize-component-type";
import { paletteEntriesForCategory } from "./element.palette";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import { listElementFamilies, searchElements } from "@/features/llm/element-catalog-query";
import { isValidNodeType } from "@/features/llm/component-catalog";
import type { Component } from "@/features/diagram/model/component.types";

/**
 * Acceptance for a **non-cloud** family.
 *
 * `cloud-family-contract.test.ts` registers a fictional *cloud* family and
 * proves the catalog path is closed. That left the other path untested, and it
 * was not closed: `listElementFamilies` and `searchElements` named
 * `"structural"` and `"c4"` as literals, and the picker only grew tabs for
 * `allCloudFamilies()`. A vocabulary registered through `registerElement` —
 * BPMN, UML, ER — rendered on the canvas and was invisible to both the model
 * and the palette.
 *
 * This registers one and walks every surface a real family would need.
 */
const TEST_FAMILY_ID = "__test-structural__";
const TEST_ELEMENT_ID = "__test-structural__-widget" as ElementTypeId;

const testElement: ElementDescriptor = {
  id: TEST_ELEMENT_ID,
  family: TEST_FAMILY_ID,
  // Reuse registered keys so the contract test needs no locale edits; a real
  // family adds its own `elements.<id>.*` entries.
  labelKey: "canvasToolbar.note",
  descriptionKey: "elements.note.description",

  model: {
    createComponent: (base) => ({ ...base, type: TEST_ELEMENT_ID }) as Component,
    defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
    patchableKeys: [],
  },

  canvas: {
    rfType: TEST_ELEMENT_ID,
    component: CardNode,
    handles: SPREAD_HANDLES,
    role: "card",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: true,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },

  palette: {
    categoryId: TEST_FAMILY_ID,
    icon: { kind: "lucide", icon: Shapes },
    accent: { kind: "neutral" },
    searchKeys: ["widget", TEST_FAMILY_ID],
  },

  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base) => ({
        ...base,
        kind: "passthrough",
        name: comp.name,
        originType: comp.type,
        originLabel: "Test Structural Family",
      }),
    },
  },
};

describe("a non-cloud family reaches every surface", () => {
  beforeEach(() => {
    if (!getElement(TEST_ELEMENT_ID)) registerElement(testElement);
  });

  afterEach(() => {
    unregisterElement(TEST_ELEMENT_ID);
  });

  it("registers without touching any enum", () => {
    expect(getElement(TEST_ELEMENT_ID)).toBeDefined();
  });

  it("survives type sanitization instead of degrading to unknown", () => {
    expect(sanitizeComponentType(TEST_ELEMENT_ID)).toBe(TEST_ELEMENT_ID);
  });

  it("appears in the LLM family list without being named in element-catalog-query", () => {
    const families = listElementFamilies().families;
    const entry = families.find((family) => family.id === TEST_FAMILY_ID);

    expect(entry, "the family is missing from list_element_families").toBeDefined();
    expect(entry!.elementCount).toBe(1);
    // No `elements.families.__test-structural__.label` entry exists, so the id
    // stands in — never a raw i18n key in front of the model.
    expect(entry!.label).toBe(TEST_FAMILY_ID);
  });

  it("is reachable through search_elements", () => {
    const hit = searchElements({ query: "widget" }).results.find(
      (row) => row.elementType === TEST_ELEMENT_ID,
    );

    expect(hit, "the element is missing from search_elements").toBeDefined();
    expect(hit!.familyId).toBe(TEST_FAMILY_ID);
    expect(hit!.serviceId).toBeNull();
  });

  it("is accepted as an add_node target", () => {
    expect(isValidNodeType(TEST_ELEMENT_ID)).toBe(true);
  });

  it("gets its own palette tab in the element picker", () => {
    const items = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      flowchart: 0,
      byFamily: {},
      registry: 0,
      nodeTemplates: 0,
    });

    expect(
      items.some((item) => item.id === TEST_FAMILY_ID),
      "the picker grew no tab for the family",
    ).toBe(true);
  });

  it("offers the element inside that tab", () => {
    const entries = paletteEntriesForCategory(TEST_FAMILY_ID);
    expect(entries.map((entry) => entry.type)).toContain(TEST_ELEMENT_ID);
  });

  it("exports through the passthrough floor", () => {
    const descriptor = getElement(TEST_ELEMENT_ID)!;
    const component = descriptor.model.createComponent(
      { id: "el-1", name: "Widget", description: "", parentId: null },
      {},
    );
    const node = descriptor.export.drawio.toExportNode(component, {
      id: "el-1",
      parentId: null,
      x: 0,
      y: 0,
      width: 160,
      height: 80,
    });

    expect(node.kind).toBe("passthrough");
  });
});

describe("prefix recovery is not a hardcoded provider list", () => {
  it("recovers an unknown category to its family's general bucket", () => {
    expect(sanitizeComponentType("aws-nonexistent")).toBe("aws-general");
    expect(sanitizeComponentType("gcp-nonexistent")).toBe("gcp-general");
    expect(sanitizeComponentType("azure-nonexistent")).toBe("azure-general");
  });

  it("gives up when the family registered no general bucket", () => {
    // k8s and oss have none, so there is nothing to recover to — `unknown` is
    // the honest answer rather than a wrong sibling category.
    expect(sanitizeComponentType("k8s-nonexistent")).toBe("unknown");
    expect(sanitizeComponentType("oss-nonexistent")).toBe("unknown");
  });

  it("does not mistake an ordinary hyphenated type for a family prefix", () => {
    expect(sanitizeComponentType("db-table")).toBe("db-table");
    expect(sanitizeComponentType("process-node")).toBe("process-node");
    expect(sanitizeComponentType("not-a-family")).toBe("unknown");
  });
});

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import CardNode from "@/features/canvas/nodes/CardNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CardNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { cloudRegistry } from "@/features/cloud";
import { getElement, isRegisteredElementType } from "@/features/elements/element.registry";
import type { CloudFamilyDefinition } from "./cloud-family.types";
import {
  registerCloudFamily,
  unregisterCloudFamily,
  allCloudFamilies,
  isRegisteredCloudFamily,
} from "./cloud-family.registry";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import {
  allComponentTypes,
  buildComponentTypeCatalog,
  isValidNodeType,
} from "@/features/llm/component-catalog";
import type { Component } from "@/features/diagram/model/component.types";
import type { ElementTypeId, ExportGeometry } from "@/features/elements/element.types";
import { Cloud } from "lucide-react";

/**
 * Acceptance: a disposable family appears in palette nav, LLM catalog, and
 * export (passthrough floor) after touching only this definition +
 * registerCloudFamily — no edits to enums, LLM lists, or export-core.
 */
const TEST_FAMILY_ID = "__test-family__";
const TEST_CATEGORY_ID = "__test-family__-compute" as ElementTypeId;
const TEST_SERVICE_ID = "test-widget";

const testFamily: CloudFamilyDefinition = {
  id: TEST_FAMILY_ID,
  labelKey: "canvasToolbar.gcpServices",
  paletteCategoryId: TEST_FAMILY_ID,
  primaryCategoryIds: [TEST_CATEGORY_ID],
  categories: [
    {
      id: TEST_CATEGORY_ID,
      // Reuse existing keys so the contract test does not need locale edits —
      // production families still add their own `elements.<id>.*` entries.
      labelKey: "elements.gcp.categories.gcp-compute.label",
      descriptionKey: "elements.gcp.categories.gcp-compute.description",
      accent: { kind: "neutral" },
    },
  ],
  services: [
    {
      id: TEST_SERVICE_ID,
      name: "Test Widget",
      iconName: "widget",
      categoryId: TEST_CATEGORY_ID,
    },
  ],
  icons: {
    resolve: () => null,
    Fallback: Cloud,
  },
  card: {
    component: CardNode,
    handles: SPREAD_HANDLES,
    buildData: buildCardNodeData,
    buildStyle: buildCardNodeStyle,
  },
  export: {
    toExportNode: (comp, base) => ({
      ...base,
      kind: "passthrough",
      name: comp.name,
      originType: comp.type,
      originLabel: "Test Family",
    }),
  },
  defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
  patchableKeys: ["cloudServiceId", "technology", "customColor"],
  attachService: (base, categoryId, serviceId) =>
    ({
      ...base,
      type: categoryId,
      cloudServiceId: serviceId,
    }) as Component,
};

describe("cloud family contract (fictional family)", () => {
  beforeEach(() => {
    if (!isRegisteredCloudFamily(TEST_FAMILY_ID)) {
      registerCloudFamily(testFamily);
    }
  });

  afterEach(() => {
    unregisterCloudFamily(TEST_FAMILY_ID);
  });

  it("registers without editing ComponentType / ElementCategory / export-core", () => {
    expect(isRegisteredCloudFamily(TEST_FAMILY_ID)).toBe(true);
    expect(isRegisteredElementType(TEST_CATEGORY_ID)).toBe(true);
    expect(allCloudFamilies().some((family) => family.id === TEST_FAMILY_ID)).toBe(true);
  });

  it("appears in the derived cloudRegistry view", () => {
    const provider = cloudRegistry.forId(TEST_FAMILY_ID);
    expect(provider).toBeDefined();
    expect(provider!.services.map((service) => service.id)).toContain(TEST_SERVICE_ID);
    expect(cloudRegistry.isCloudType(TEST_CATEGORY_ID)).toBe(true);
  });

  it("appears as a palette nav tab from allCloudFamilies()", () => {
    const items = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      flowchart: 0,
      byFamily: { [TEST_FAMILY_ID]: 1 },
      registry: 0,
      nodeTemplates: 0,
    });
    expect(items.some((item) => item.id === TEST_FAMILY_ID)).toBe(true);
  });

  it("appears in the LLM catalog without naming the family in component-catalog.ts", () => {
    expect(isValidNodeType(TEST_CATEGORY_ID)).toBe(true);
    expect(allComponentTypes().some((entry) => entry.nodeType === TEST_CATEGORY_ID)).toBe(true);
    expect(buildComponentTypeCatalog()).toContain(TEST_SERVICE_ID);
  });

  it("exports via the passthrough floor without a native export-core kind", () => {
    const descriptor = getElement(TEST_CATEGORY_ID)!;
    const component = descriptor.model.createComponent(
      { id: "el-1", name: "Widget", description: "", parentId: null },
      { serviceId: TEST_SERVICE_ID },
    );
    const geometry: ExportGeometry = {
      id: "el-1",
      parentId: null,
      x: 0,
      y: 0,
      width: 160,
      height: 80,
    };
    const node = descriptor.export.drawio.toExportNode(component, geometry);
    expect(node.kind).toBe("passthrough");
  });
});

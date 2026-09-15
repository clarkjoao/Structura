import { describe, expect, it } from "vitest";
import { cloudRegistry } from "@/features/cloud";
import { getElement, isRegisteredElementType } from "@/features/elements/element.registry";
import { isValidNodeType } from "@/features/llm/component-catalog";
import { buildCategoryNavItems } from "@/features/canvas/toolbar/element-picker/buildCategoryNav";
import { isRegisteredCloudFamily } from "../cloud-family.registry";
import { k8sElements, k8sFamily } from "./k8s.family";
import { K8S_CATEGORIES, K8S_SERVICE_MAP } from "./k8s.catalog";
import { k8sIconDataUri } from "./k8s.export-icons";

describe("k8s family", () => {
  it("is registered through registerCloudFamily at bootstrap", () => {
    expect(isRegisteredCloudFamily("k8s")).toBe(true);
    expect(cloudRegistry.forId("k8s")?.services.length).toBe(K8S_SERVICE_MAP.size);
  });

  it("materialises one descriptor per category", () => {
    expect(k8sElements).toHaveLength(K8S_CATEGORIES.length);
    expect(k8sElements.every((element) => element.family === "k8s")).toBe(true);
  });

  it("appears in palette nav and LLM catalog without consumer edits", () => {
    for (const category of K8S_CATEGORIES) {
      expect(isRegisteredElementType(category.id)).toBe(true);
      expect(isValidNodeType(category.id)).toBe(true);
    }
    const nav = buildCategoryNavItems((key) => key, {
      all: 0,
      c4: 0,
      canvas: 0,
      flowchart: 0,
      byFamily: { k8s: K8S_SERVICE_MAP.size },
      registry: 0,
      nodeTemplates: 0,
    });
    expect(nav.some((item) => item.id === "k8s")).toBe(true);
  });

  it("exports via the image floor when the SVG is present", () => {
    const compute = getElement("k8s-workloads")!;
    const component = compute.model.createComponent(
      { id: "el-1", name: "api", description: "", parentId: null },
      { serviceId: "deployment" },
    );
    const node = compute.export.drawio.toExportNode(component, {
      id: "el-1",
      parentId: null,
      x: 0,
      y: 0,
      width: 160,
      height: 80,
    });
    expect(node.kind).toBe("image");
    if (node.kind === "image") {
      expect(node.dataUri.startsWith("data:image/svg+xml")).toBe(true);
    }
  });

  it("has a data URI for every catalog icon", () => {
    for (const service of K8S_SERVICE_MAP.values()) {
      expect(k8sIconDataUri(service.iconName), service.iconName).toBeTruthy();
    }
  });

  it("declares the family contract fields", () => {
    expect(k8sFamily.id).toBe("k8s");
    expect(k8sFamily.paletteCategoryId).toBe("k8s");
    expect(k8sFamily.categories.length).toBe(4);
  });
});

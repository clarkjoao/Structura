import { describe, expect, it } from "vitest";
import { cloudRegistry } from "@/features/cloud";
import { getElement, isRegisteredElementType } from "@/features/elements/element.registry";
import { isValidNodeType } from "@/features/llm/component-catalog";
import { isRegisteredCloudFamily } from "../cloud-family.registry";
import { ossElements, ossFamily } from "./oss.family";
import { OSS_CATEGORIES, OSS_SERVICE_MAP } from "./oss.catalog";
import { ossIconDataUri } from "./oss.export-icons";

describe("oss family", () => {
  it("is registered through registerCloudFamily at bootstrap", () => {
    expect(isRegisteredCloudFamily("oss")).toBe(true);
    expect(cloudRegistry.forId("oss")?.services.length).toBe(OSS_SERVICE_MAP.size);
  });

  it("uses the same CloudFamilyDefinition shape as denser families", () => {
    expect(ossFamily.categories).toHaveLength(2);
    expect(ossElements.every((element) => element.family === "oss")).toBe(true);
  });

  it("offers Redis and Kafka to the palette and LLM validators", () => {
    for (const category of OSS_CATEGORIES) {
      expect(isRegisteredElementType(category.id)).toBe(true);
      expect(isValidNodeType(category.id)).toBe(true);
    }
    expect(OSS_SERVICE_MAP.has("redis")).toBe(true);
    expect(OSS_SERVICE_MAP.has("kafka")).toBe(true);
  });

  it("exports via the image floor", () => {
    const datastore = getElement("oss-datastore")!;
    const component = datastore.model.createComponent(
      { id: "el-1", name: "cache", description: "", parentId: null },
      { serviceId: "redis" },
    );
    const node = datastore.export.drawio.toExportNode(component, {
      id: "el-1",
      parentId: null,
      x: 0,
      y: 0,
      width: 160,
      height: 80,
    });
    expect(node.kind).toBe("image");
  });

  it("has a data URI for every catalog icon", () => {
    for (const service of OSS_SERVICE_MAP.values()) {
      expect(ossIconDataUri(service.iconName), service.iconName).toBeTruthy();
    }
  });
});

import { describe, expect, it } from "vitest";
import { cloudRegistry } from "@/features/cloud";
import { getElement, isRegisteredElementType } from "@/features/elements/element.registry";
import { isValidNodeType } from "@/features/llm/component-catalog";
import { searchElements } from "@/features/llm/element-catalog-query";
import i18n from "@/infrastructure/i18n";
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
    if (node.kind === "image") {
      expect(node.cloudServiceId).toBe("redis");
    }
  });

  it("writes cloudServiceId from ElementCreateOptions.serviceId without casting", () => {
    const datastore = getElement("oss-datastore")!;
    const component = datastore.model.createComponent(
      { id: "el-1", name: "cache", description: "", parentId: null },
      { serviceId: "redis" },
    );
    expect(component).toMatchObject({
      type: "oss-datastore",
      cloudServiceId: "redis",
    });
    expect("serviceId" in component ? component.serviceId : undefined).toBeUndefined();
  });

  it("has a data URI for every catalog icon", () => {
    for (const service of OSS_SERVICE_MAP.values()) {
      expect(ossIconDataUri(service.iconName), service.iconName).toBeTruthy();
    }
  });
});

describe("service-level descriptions reach the LLM catalog", () => {
  it("gives Redis its own description instead of the category line", () => {
    const hit = searchElements({ query: "redis", familyId: "oss" }).results.find(
      (row) => row.serviceId === "redis",
    );

    expect(hit).toBeDefined();
    expect(hit!.description).toContain("In-memory key-value store");
    // The regression this guards: every service used to inherit the category's
    // sentence, so Redis and Kafka read identically to the model.
    expect(hit!.description).not.toBe(i18n.t("elements.oss.categories.oss-datastore.description"));
  });

  it("gives Kafka a different description from Redis", () => {
    const rows = searchElements({ query: "oss", familyId: "oss" }).results;
    const redis = rows.find((row) => row.serviceId === "redis");
    const kafka = rows.find((row) => row.serviceId === "kafka");

    expect(redis?.description).toBeTruthy();
    expect(kafka?.description).toBeTruthy();
    expect(redis!.description).not.toBe(kafka!.description);
  });

  it("falls back to the category description when a service declares none", () => {
    // AWS declares no per-service keys, so it still inherits — proving the
    // fallback path, not just the populated one.
    const hit = searchElements({ query: "lambda", familyId: "aws" }).results.find(
      (row) => row.serviceId === "lambda",
    );

    expect(hit).toBeDefined();
    expect(hit!.description).toBe(i18n.t("elements.aws.categories.aws-compute.description"));
  });
});

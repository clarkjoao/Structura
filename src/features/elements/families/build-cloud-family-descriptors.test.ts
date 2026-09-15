import { afterEach, describe, expect, it } from "vitest";
import { Cloud } from "lucide-react";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import type { Component } from "@/features/diagram/model/component.types";
import { buildCloudFamilyDescriptors } from "./build-cloud-family-descriptors";
import type { CloudFamilyDefinition } from "./cloud-family.types";
import { clearFamilyIconResolvers, iconResolverForFamily } from "./family-icon-resolvers";

/**
 * A minimal family that compiles against real `ElementTypeId`s without
 * registering anything. Uses existing i18n keys so a later `registerElement`
 * call in other suites would still pass locale validation.
 */
function makeFixtureFamily(overrides: Partial<CloudFamilyDefinition> = {}): CloudFamilyDefinition {
  return {
    id: "gcp",
    labelKey: "canvasToolbar.gcpServices",
    paletteCategoryId: "gcp",
    categories: [
      {
        id: "gcp-compute",
        labelKey: "canvasToolbar.gcpServices",
        descriptionKey: "elements.json-viewer.description",
        accent: { kind: "token", cssVar: "--gcp-compute" },
      },
      {
        id: "gcp-storage",
        labelKey: "canvasToolbar.gcpServices",
        descriptionKey: "elements.json-viewer.description",
        accent: { kind: "token", cssVar: "--gcp-storage" },
      },
    ],
    services: [
      {
        id: "computeengine",
        name: "Compute Engine",
        iconName: "computeengine-icon",
        categoryId: "gcp-compute",
      },
      {
        id: "cloudrun",
        name: "Cloud Run",
        iconName: "cloudrun-icon",
        categoryId: "gcp-compute",
      },
      {
        id: "gcs",
        name: "Cloud Storage",
        iconName: "gcs-icon",
        categoryId: "gcp-storage",
      },
    ],
    icons: {
      resolve: () => null,
      Fallback: Cloud,
    },
    card: {
      component: () => null,
      handles: SINGLE_PAIR_HANDLES,
      buildData: () => ({ fixture: true }),
    },
    export: {
      toExportNode: (comp, base) => ({
        ...base,
        kind: "passthrough",
        name: comp.name,
        originType: comp.type,
        originLabel: "GCP",
      }),
    },
    defaultSize: { width: 180, height: 80 },
    patchableKeys: ["gcpService", "technology", "customColor"],
    attachService: (base, categoryId, serviceId) => {
      if (categoryId !== "gcp-compute" && categoryId !== "gcp-storage") {
        throw new Error(
          `fixture attachService got unexpected category "${categoryId}"; expected "gcp-compute" | "gcp-storage"`,
        );
      }
      return { ...base, type: categoryId, gcpService: serviceId };
    },
    ...overrides,
  };
}

afterEach(() => {
  clearFamilyIconResolvers();
});

describe("buildCloudFamilyDescriptors", () => {
  it("emits one descriptor per category", () => {
    const descriptors = buildCloudFamilyDescriptors(makeFixtureFamily());

    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(["gcp-compute", "gcp-storage"]);
    expect(descriptors.every((descriptor) => descriptor.family === "gcp")).toBe(true);
  });

  it("remembers the family's icon resolver for palette.icon lookups", () => {
    const family = makeFixtureFamily();
    buildCloudFamilyDescriptors(family);

    expect(iconResolverForFamily("gcp")).toBe(family.icons);
  });

  it("turns services into palette variants carrying serviceId", () => {
    const [compute] = buildCloudFamilyDescriptors(makeFixtureFamily());

    expect(compute.palette.variants?.map((variant) => variant.id)).toEqual([
      "computeengine",
      "cloudrun",
    ]);
    expect(compute.palette.variants?.[0]?.createOptions).toEqual({
      serviceId: "computeengine",
    });
    expect(compute.palette.variants?.[0]?.icon).toEqual({
      kind: "family",
      iconName: "computeengine-icon",
    });
  });

  it("writes the category accent onto the palette (replaces border maps)", () => {
    const [compute, storage] = buildCloudFamilyDescriptors(makeFixtureFamily());

    expect(compute.palette.accent).toEqual({ kind: "token", cssVar: "--gcp-compute" });
    expect(storage.palette.accent).toEqual({ kind: "token", cssVar: "--gcp-storage" });
  });

  it("uses the category id as the React Flow type and role card", () => {
    const [compute] = buildCloudFamilyDescriptors(makeFixtureFamily());

    expect(compute.canvas.rfType).toBe("gcp-compute");
    expect(compute.canvas.role).toBe("card");
    expect(compute.canvas.derivesSize).toBe(true);
  });

  it("delegates component construction to attachService", () => {
    const [compute] = buildCloudFamilyDescriptors(makeFixtureFamily());
    const created = compute.model.createComponent(
      { id: "el-1", name: "Run", description: "", parentId: null },
      { serviceId: "cloudrun" },
    );

    expect(created).toMatchObject({
      id: "el-1",
      type: "gcp-compute",
      gcpService: "cloudrun",
    });
  });

  it("shares the family's export mapping across every category", () => {
    const family = makeFixtureFamily();
    const descriptors = buildCloudFamilyDescriptors(family);
    const base = { id: "n1", parentId: null, x: 0, y: 0, width: 10, height: 10 };
    const comp: Component = {
      id: "n1",
      name: "X",
      description: "",
      parentId: null,
      type: "gcp-compute",
    };

    for (const descriptor of descriptors) {
      expect(descriptor.export.drawio.toExportNode(comp, base)).toEqual(
        family.export.toExportNode(comp, base),
      );
    }
  });

  it("refuses a service that points at an unknown category", () => {
    expect(() =>
      buildCloudFamilyDescriptors(
        makeFixtureFamily({
          services: [
            {
              id: "orphan",
              name: "Orphan",
              iconName: "x",
              categoryId: "gcp-ai",
            },
          ],
        }),
      ),
    ).toThrow(/unknown categoryId "gcp-ai"/);
  });

  it("refuses an empty categories list", () => {
    expect(() =>
      buildCloudFamilyDescriptors(makeFixtureFamily({ categories: [], services: [] })),
    ).toThrow(/categories is empty/);
  });

  it("offers the category itself when it has no services", () => {
    const [compute] = buildCloudFamilyDescriptors(
      makeFixtureFamily({
        services: [],
      }),
    );

    expect(compute.palette.variants).toBeUndefined();
    expect(compute.palette.icon).toEqual({ kind: "family", iconName: "gcp" });
  });
});

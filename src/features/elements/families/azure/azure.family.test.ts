import { describe, expect, it } from "vitest";
import { iconResolverForFamily } from "../family-icon-resolvers";
import { azureElements, azureFamily } from "./azure.family";

describe("azure family", () => {
  it("produces one descriptor per catalog category", () => {
    expect(azureElements).toHaveLength(azureFamily.categories.length);
    expect(azureElements.every((element) => element.family === "azure")).toBe(true);
  });

  it("remembers the Azure icon resolver for palette.icon lookups", () => {
    expect(iconResolverForFamily("azure")).toBe(azureFamily.icons);
  });

  it("exports through passthrough (no sync SVG pack)", () => {
    const [compute] = azureElements;
    const node = compute.export.drawio.toExportNode(
      {
        id: "n1",
        name: "Functions",
        description: "",
        parentId: null,
        type: "azure-compute",
        azureService: "functions",
      },
      { id: "n1", parentId: null, x: 0, y: 0, width: 180, height: 80 },
    );

    expect(node).toMatchObject({
      kind: "passthrough",
      originType: "azure-compute",
      name: "Functions",
    });
  });

  it("writes azureService from ElementCreateOptions.serviceId", () => {
    const [compute] = azureElements;
    const created = compute.model.createComponent(
      { id: "el-1", name: "Fn", description: "", parentId: null },
      { serviceId: "functions" },
    );

    expect(created).toMatchObject({
      type: "azure-compute",
      azureService: "functions",
    });
  });
});

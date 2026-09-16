import { describe, expect, it } from "vitest";
import { C4_TYPES } from "@/features/diagram/model/component-type-constants";
import { buildCardNodeData } from "@/features/canvas/nodes/CardNode/buildCardNodeData";
import { emptyNodeBuildContext } from "../../node-build-context.fixture";
import { buildC4Descriptors, c4Elements } from "./c4.family";

describe("buildC4Descriptors", () => {
  it("declares exactly the four C4 Model types", () => {
    expect(c4Elements.map((element) => element.id).sort()).toEqual([...C4_TYPES].sort());
  });

  it("is a structural family, not a degenerate cloud family", () => {
    for (const element of c4Elements) {
      expect(element.family).toBe("c4");
      expect(element.palette.variants).toBeUndefined();
      expect(element.model.patchableKeys).not.toContain("cloudServiceId");
      expect(element.model.patchableKeys).not.toContain("serviceId");
    }
  });

  it("gives each type its own React Flow type while sharing the card builders", () => {
    const descriptors = buildC4Descriptors();
    const rfTypes = descriptors.map((element) => element.canvas.rfType);
    expect(new Set(rfTypes).size).toBe(4);
    for (const element of descriptors) {
      expect(element.canvas.rfType).toBe(element.id);
      expect(element.canvas.role).toBe("card");
      expect(element.canvas.buildData).toBe(buildCardNodeData);
    }
  });

  it("creates a typed C4 component with no cloud service field", () => {
    const person = c4Elements.find((element) => element.id === "person")!;
    const built = person.model.createComponent(
      { id: "el-1", name: "Customer", description: "", parentId: null },
      {},
    );
    expect(built).toEqual({
      id: "el-1",
      name: "Customer",
      description: "",
      parentId: null,
      type: "person",
    });
    expect("cloudServiceId" in built).toBe(false);
  });

  it("exports a C4 draw.io node with subtype = type id", () => {
    const container = c4Elements.find((element) => element.id === "container")!;
    const comp = container.model.createComponent(
      { id: "el-1", name: "BFF", description: "edge", parentId: null },
      {},
    );
    Object.assign(comp, { technology: "Node.js" });
    const node = container.export.drawio.toExportNode(comp, {
      id: "el-1",
      parentId: null,
      x: 0,
      y: 0,
      width: 180,
      height: 80,
    });
    expect(node).toMatchObject({
      kind: "c4",
      subtype: "container",
      name: "BFF",
      description: "edge",
      technology: "Node.js",
    });
  });

  it("passes technology through buildCardNodeData for every C4 type", () => {
    for (const element of c4Elements) {
      const comp = {
        ...element.model.createComponent(
          { id: "el-1", name: "N", description: "", parentId: null },
          {},
        ),
        technology: "Go",
      };
      const data = element.canvas.buildData?.(comp, emptyNodeBuildContext());
      expect(data?.technology, element.id).toBe("Go");
    }
  });
});

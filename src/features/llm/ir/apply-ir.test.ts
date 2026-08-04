import { describe, expect, it } from "vitest";
import { PanelKind } from "@/features/diagram/enums";
import { buildGeneratedGraphInputs } from "./apply-ir";
import type { IRLayoutBox } from "@/features/canvas/layout/irLayoutEngine";
import type { DiagramIR } from "./ir.types";

const NO_ORIGIN = { x: 0, y: 0 };

function boxesFrom(entries: Record<string, IRLayoutBox>): Map<string, IRLayoutBox> {
  return new Map(Object.entries(entries));
}

const awsIR: DiagramIR = {
  type: "aws-deployment",
  nodes: [
    { id: "vpc", semanticType: "aws-vpc", name: "VPC", parentId: null, tier: "edge" },
    { id: "az", semanticType: "aws-az", name: "AZ-a", parentId: "vpc", tier: "compute" },
    {
      id: "subnet",
      semanticType: "aws-private-subnet",
      name: "Private",
      parentId: "az",
      tier: "compute",
    },
    { id: "ecs", semanticType: "aws-compute", name: "ECS", parentId: "subnet", tier: "compute" },
  ],
  edges: [],
};

const awsBoxes = boxesFrom({
  vpc: { x: 10, y: 20, width: 900, height: 400 },
  az: { x: 40, y: 40, width: 800, height: 300 },
  subnet: { x: 40, y: 40, width: 700, height: 200 },
  ecs: { x: 40, y: 40, width: 180, height: 80 },
});

describe("buildGeneratedGraphInputs — type mapping", () => {
  it("maps AWS boundaries to the matching panel kinds", () => {
    const { nodes } = buildGeneratedGraphInputs(awsIR, awsBoxes, NO_ORIGIN);
    const byId = new Map(nodes.map((node) => [node.externalId, node]));

    expect(byId.get("vpc")).toMatchObject({ type: "panel", panelKind: PanelKind.Vpc });
    expect(byId.get("az")).toMatchObject({ type: "panel", panelKind: PanelKind.AvailabilityZone });
    expect(byId.get("subnet")).toMatchObject({
      type: "panel",
      panelKind: PanelKind.PrivateSubnet,
    });
    expect(byId.get("ecs")).toMatchObject({ type: "aws-compute" });
  });

  it("turns any node with children into a panel so React Flow nests it", () => {
    const ir: DiagramIR = {
      type: "c4-container",
      nodes: [
        { id: "sys", semanticType: "container", name: "System", parentId: null, tier: "compute" },
        { id: "api", semanticType: "container", name: "API", parentId: "sys", tier: "compute" },
      ],
      edges: [],
    };
    const boxes = boxesFrom({
      sys: { x: 0, y: 0, width: 400, height: 200 },
      api: { x: 40, y: 40, width: 180, height: 80 },
    });

    const { nodes } = buildGeneratedGraphInputs(ir, boxes, NO_ORIGIN);
    const byId = new Map(nodes.map((node) => [node.externalId, node]));
    expect(byId.get("sys")).toMatchObject({ type: "panel", panelKind: PanelKind.Default });
    expect(byId.get("api")).toMatchObject({ type: "container" });
  });

  it("degrades a database node to a container and keeps its technology", () => {
    const ir: DiagramIR = {
      type: "c4-container",
      nodes: [
        {
          id: "db",
          semanticType: "database",
          name: "Orders DB",
          technology: "PostgreSQL",
          parentId: null,
          tier: "data",
        },
      ],
      edges: [],
    };
    const { nodes } = buildGeneratedGraphInputs(
      ir,
      boxesFrom({ db: { x: 0, y: 0, width: 180, height: 80 } }),
      NO_ORIGIN,
    );
    expect(nodes[0]).toMatchObject({ type: "container", technology: "PostgreSQL" });
  });
});

describe("buildGeneratedGraphInputs — geometry", () => {
  it("carries the containment chain through parentExternalId", () => {
    const { nodes } = buildGeneratedGraphInputs(awsIR, awsBoxes, NO_ORIGIN);
    const byId = new Map(nodes.map((node) => [node.externalId, node]));

    expect(byId.get("vpc")!.parentExternalId).toBeNull();
    expect(byId.get("az")!.parentExternalId).toBe("vpc");
    expect(byId.get("subnet")!.parentExternalId).toBe("az");
    expect(byId.get("ecs")!.parentExternalId).toBe("subnet");
  });

  it("offsets only root nodes by the viewport origin", () => {
    const { nodes } = buildGeneratedGraphInputs(awsIR, awsBoxes, { x: 500, y: 300 });
    const byId = new Map(nodes.map((node) => [node.externalId, node]));

    expect(byId.get("vpc")).toMatchObject({ x: 510, y: 320 });
    // Children stay relative to their parent, untouched by the origin.
    expect(byId.get("az")).toMatchObject({ x: 40, y: 40 });
    expect(byId.get("ecs")).toMatchObject({ x: 40, y: 40 });
  });

  it("sizes panels from the layout and leaves leaf nodes unsized", () => {
    const { nodes } = buildGeneratedGraphInputs(awsIR, awsBoxes, NO_ORIGIN);
    const byId = new Map(nodes.map((node) => [node.externalId, node]));

    expect(byId.get("subnet")).toMatchObject({ width: 700, height: 200 });
    expect(byId.get("ecs")!.width).toBeUndefined();
    expect(byId.get("ecs")!.height).toBeUndefined();
  });

  it("falls back to a spread position when a node has no layout box", () => {
    const { nodes } = buildGeneratedGraphInputs(awsIR, new Map(), NO_ORIGIN);
    const xs = nodes.map((node) => node.x);
    expect(new Set(xs).size).toBe(nodes.length);
  });
});

describe("buildGeneratedGraphInputs — edges", () => {
  it("maps edges and defaults a missing label to an empty string", () => {
    const ir: DiagramIR = {
      ...awsIR,
      edges: [
        { id: "e1", sourceId: "ecs", targetId: "vpc", label: "deploys into" },
        { id: "e2", sourceId: "vpc", targetId: "ecs" },
      ],
    };
    const { edges } = buildGeneratedGraphInputs(ir, awsBoxes, NO_ORIGIN);

    expect(edges).toEqual([
      { sourceExternalId: "ecs", targetExternalId: "vpc", label: "deploys into" },
      { sourceExternalId: "vpc", targetExternalId: "ecs", label: "" },
    ]);
  });
});

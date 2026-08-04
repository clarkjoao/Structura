import { describe, expect, it } from "vitest";
import { layoutIR } from "./irLayoutEngine";
import type { DiagramIR } from "@/features/llm/ir/ir.types";

/** vpc > az > private-subnet > {alb, ecs, rds}: three levels of containment. */
const nestedIR: DiagramIR = {
  type: "aws-deployment",
  nodes: [
    { id: "user", semanticType: "person", name: "User", parentId: null, tier: "external" },
    { id: "vpc", semanticType: "aws-vpc", name: "VPC", parentId: null, tier: "edge" },
    { id: "az", semanticType: "aws-az", name: "AZ-a", parentId: "vpc", tier: "compute" },
    {
      id: "subnet",
      semanticType: "aws-private-subnet",
      name: "Private",
      parentId: "az",
      tier: "compute",
    },
    { id: "alb", semanticType: "aws-networking", name: "ALB", parentId: "subnet", tier: "edge" },
    { id: "ecs", semanticType: "aws-compute", name: "ECS", parentId: "subnet", tier: "compute" },
    { id: "rds", semanticType: "aws-database", name: "RDS", parentId: "subnet", tier: "data" },
  ],
  edges: [
    { id: "e1", sourceId: "user", targetId: "alb" },
    { id: "e2", sourceId: "alb", targetId: "ecs" },
    { id: "e3", sourceId: "ecs", targetId: "rds" },
  ],
};

describe("layoutIR", () => {
  it("returns a box for every node", async () => {
    const { boxes } = await layoutIR(nestedIR);
    for (const node of nestedIR.nodes) {
      expect(boxes.has(node.id)).toBe(true);
    }
  });

  it("sizes each container to hold its children", async () => {
    const { boxes } = await layoutIR(nestedIR);
    const vpc = boxes.get("vpc");
    const az = boxes.get("az");
    const subnet = boxes.get("subnet");
    if (!vpc || !az || !subnet) throw new Error("missing container box");

    expect(vpc.width).toBeGreaterThan(az.width);
    expect(az.width).toBeGreaterThan(subnet.width);
    // Three 180px-wide leaves in a row, so the subnet has to be well past that.
    expect(subnet.width).toBeGreaterThan(540);
  });

  it("keeps every child inside its parent box, relative to the parent", async () => {
    const { boxes } = await layoutIR(nestedIR);
    const parentOf: Record<string, string> = {
      az: "vpc",
      subnet: "az",
      alb: "subnet",
      ecs: "subnet",
      rds: "subnet",
    };

    for (const [childId, parentId] of Object.entries(parentOf)) {
      const child = boxes.get(childId);
      const parent = boxes.get(parentId);
      if (!child || !parent) throw new Error(`missing box for ${childId}/${parentId}`);

      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.width);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.height);
    }
  });

  // The spec's §7 literal carried three keys ELK silently ignores. These assert
  // the corrected keys actually take effect, since a wrong key throws nothing.
  it("applies the 40px container padding (elk.padding)", async () => {
    const { boxes } = await layoutIR(nestedIR);
    const firstChild = boxes.get("az");
    if (!firstChild) throw new Error("missing box");
    // ELK's default padding is 12; anything below 40 means the value did not parse.
    expect(firstChild.x).to.be.at.least(40);
    expect(firstChild.y).to.be.at.least(40);
  });

  it("orders connected nodes along the flow direction", async () => {
    const { boxes } = await layoutIR(nestedIR);
    const alb = boxes.get("alb");
    const ecs = boxes.get("ecs");
    const rds = boxes.get("rds");
    if (!alb || !ecs || !rds) throw new Error("missing leaf box");

    // Siblings share a parent, so their x values are directly comparable.
    expect(alb.x).toBeLessThan(ecs.x);
    expect(ecs.x).toBeLessThan(rds.x);
  });

  it("lays out a flat diagram with no containment", async () => {
    const { boxes } = await layoutIR({
      type: "c4-context",
      nodes: [
        { id: "a", semanticType: "person", name: "A", parentId: null, tier: "external" },
        { id: "b", semanticType: "container", name: "B", parentId: null, tier: "compute" },
      ],
      edges: [{ id: "e", sourceId: "a", targetId: "b" }],
    });
    expect(boxes.size).toBe(2);
    expect(boxes.get("a")!.x).toBeLessThan(boxes.get("b")!.x);
  });

  it("gives an empty boundary a container-sized box", async () => {
    const { boxes } = await layoutIR({
      type: "aws-deployment",
      nodes: [
        {
          id: "vpc",
          semanticType: "aws-vpc",
          name: "Empty VPC",
          parentId: null,
          isBoundary: true,
          tier: "edge",
        },
        { id: "user", semanticType: "person", name: "User", parentId: null, tier: "external" },
      ],
      edges: [],
    });
    const vpc = boxes.get("vpc");
    const user = boxes.get("user");
    if (!vpc || !user) throw new Error("missing box");
    // Not collapsed to a leaf: it still has to read as a boundary on the canvas.
    expect(vpc.width).to.be.greaterThan(user.width);
    expect(vpc.height).to.be.greaterThan(user.height);
  });

  it("returns no boxes for an empty IR", async () => {
    const { boxes } = await layoutIR({ type: "c4-context", nodes: [], edges: [] });
    expect(boxes.size).toBe(0);
  });
});

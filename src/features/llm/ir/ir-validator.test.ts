import { describe, expect, it } from "vitest";
import { parseAndValidateIR, validateIR, type IRIssueCode } from "./ir-validator";
import type { DiagramIR } from "./ir.types";

function codesOf(result: ReturnType<typeof validateIR>): IRIssueCode[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

const validIR: DiagramIR = {
  type: "c4-container",
  nodes: [
    {
      id: "shop",
      semanticType: "container",
      name: "Shop",
      parentId: null,
      isBoundary: true,
      tier: "compute",
    },
    { id: "api", semanticType: "container", name: "API", parentId: "shop", tier: "compute" },
    { id: "db", semanticType: "database", name: "Orders DB", parentId: "shop", tier: "data" },
  ],
  edges: [{ id: "e1", sourceId: "api", targetId: "db", label: "reads/writes" }],
};

describe("validateIR — valid input", () => {
  it("accepts a schema-valid IR", () => {
    const result = validateIR(validIR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ir.nodes).toHaveLength(3);
    expect(result.ir.edges).toHaveLength(1);
  });

  it("keeps semanticType, tier and parentId on the normalized output", () => {
    const result = validateIR(validIR);
    if (!result.ok) throw new Error("expected valid IR");
    const api = result.ir.nodes.find((node) => node.id === "api");
    expect(api).toMatchObject({ semanticType: "container", tier: "compute", parentId: "shop" });
  });

  it("keeps and normalizes the awsService field", () => {
    const result = validateIR({
      type: "aws-deployment",
      nodes: [
        {
          id: "fn",
          semanticType: "aws-compute",
          name: "Handler",
          awsService: "  Lambda ",
          parentId: null,
          tier: "compute",
        },
      ],
      edges: [],
    });
    if (!result.ok) throw new Error("expected valid IR");
    expect(result.ir.nodes[0].awsService).toBe("lambda");
  });

  it("keeps the optional technology field and drops unknown extras", () => {
    const result = validateIR({
      type: "c4-context",
      nodes: [
        {
          id: "web",
          semanticType: "container",
          name: "Web",
          parentId: null,
          tier: "edge",
          technology: "React",
          color: "red",
        },
      ],
      edges: [],
    });
    if (!result.ok) throw new Error("expected valid IR");
    expect(result.ir.nodes[0].technology).toBe("React");
    expect(result.ir.nodes[0]).not.toHaveProperty("color");
  });

  it("treats a missing edges array as no edges", () => {
    const result = validateIR({
      type: "c4-context",
      nodes: [{ id: "a", semanticType: "person", name: "User", parentId: null, tier: "external" }],
    });
    if (!result.ok) throw new Error("expected valid IR");
    expect(result.ir.edges).toEqual([]);
  });
});

describe("validateIR — schema errors", () => {
  it("rejects an unknown diagram type", () => {
    const result = validateIR({ ...validIR, type: "c4-code" });
    expect(codesOf(result)).toContain("invalidDiagramType");
  });

  it("rejects a non-object payload", () => {
    expect(codesOf(validateIR("nope"))).toEqual(["notAnObject"]);
    expect(codesOf(validateIR([]))).toEqual(["notAnObject"]);
  });

  it("rejects nodes that are not an array", () => {
    expect(codesOf(validateIR({ type: "c4-context", nodes: {}, edges: [] }))).toContain(
      "nodesNotArray",
    );
  });

  it("reports an empty node list", () => {
    expect(codesOf(validateIR({ type: "c4-context", nodes: [], edges: [] }))).toContain(
      "emptyNodes",
    );
  });

  it("rejects an unknown semanticType", () => {
    const result = validateIR({
      type: "c4-context",
      nodes: [
        { id: "a", semanticType: "microservice", name: "A", parentId: null, tier: "compute" },
      ],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeInvalidSemanticType");
  });

  it("rejects an unknown tier", () => {
    const result = validateIR({
      type: "c4-context",
      nodes: [{ id: "a", semanticType: "container", name: "A", parentId: null, tier: "backend" }],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeInvalidTier");
  });

  it("rejects duplicate node ids", () => {
    const result = validateIR({
      type: "c4-context",
      nodes: [
        { id: "a", semanticType: "container", name: "A", parentId: null, tier: "compute" },
        { id: "a", semanticType: "container", name: "A again", parentId: null, tier: "compute" },
      ],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeDuplicateId");
  });

  it("collects every issue instead of stopping at the first", () => {
    const result = validateIR({
      type: "not-a-type",
      nodes: [{ id: "a", semanticType: "bogus", name: "", parentId: null, tier: "bogus" }],
      edges: [],
    });
    const codes = codesOf(result);
    expect(codes).toEqual(
      expect.arrayContaining([
        "invalidDiagramType",
        "nodeMissingName",
        "nodeInvalidSemanticType",
        "nodeInvalidTier",
      ]),
    );
  });
});

describe("validateIR — edge references", () => {
  it("rejects an edge whose source does not exist", () => {
    const result = validateIR({
      ...validIR,
      edges: [{ id: "e1", sourceId: "ghost", targetId: "db" }],
    });
    expect(codesOf(result)).toContain("edgeSourceNotFound");
  });

  it("rejects an edge whose target does not exist", () => {
    const result = validateIR({
      ...validIR,
      edges: [{ id: "e1", sourceId: "api", targetId: "ghost" }],
    });
    expect(codesOf(result)).toContain("edgeTargetNotFound");
  });

  it("rejects duplicate edge ids", () => {
    const result = validateIR({
      ...validIR,
      edges: [
        { id: "e1", sourceId: "api", targetId: "db" },
        { id: "e1", sourceId: "db", targetId: "api" },
      ],
    });
    expect(codesOf(result)).toContain("edgeDuplicateId");
  });
});

describe("validateIR — containment", () => {
  it("rejects a parentId that points to no node", () => {
    const result = validateIR({
      type: "c4-container",
      nodes: [
        { id: "a", semanticType: "container", name: "A", parentId: "ghost", tier: "compute" },
      ],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeParentNotFound");
  });

  it("rejects a node parented to itself", () => {
    const result = validateIR({
      type: "c4-container",
      nodes: [{ id: "a", semanticType: "container", name: "A", parentId: "a", tier: "compute" }],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeSelfParent");
  });

  it("rejects a containment cycle", () => {
    const result = validateIR({
      type: "c4-container",
      nodes: [
        { id: "a", semanticType: "container", name: "A", parentId: "c", tier: "compute" },
        { id: "b", semanticType: "container", name: "B", parentId: "a", tier: "compute" },
        { id: "c", semanticType: "container", name: "C", parentId: "b", tier: "compute" },
      ],
      edges: [],
    });
    expect(codesOf(result)).toContain("containmentCycle");
  });

  it("reports a cycle once, listing its members", () => {
    const result = validateIR({
      type: "c4-container",
      nodes: [
        { id: "a", semanticType: "container", name: "A", parentId: "b", tier: "compute" },
        { id: "b", semanticType: "container", name: "B", parentId: "a", tier: "compute" },
      ],
      edges: [],
    });
    if (result.ok) throw new Error("expected invalid IR");
    const cycles = result.issues.filter((issue) => issue.code === "containmentCycle");
    expect(cycles).toHaveLength(1);
    expect(String(cycles[0].params?.ids)).toContain("a");
    expect(String(cycles[0].params?.ids)).toContain("b");
  });

  it("treats a node that has children as a boundary, flag or no flag", () => {
    // Models routinely omit `isBoundary` on a C4 service that contains
    // components. Holding children is proof enough of being a container, so this
    // is normalized rather than rejected — refusing it threw away whole
    // diagrams that render perfectly well.
    const result = validateIR({
      type: "c4-container",
      nodes: [
        { id: "sys", semanticType: "container", name: "System", parentId: null, tier: "compute" },
        { id: "api", semanticType: "container", name: "API", parentId: "sys", tier: "compute" },
      ],
      edges: [],
    });
    if (!result.ok) throw new Error(`expected valid IR, got ${JSON.stringify(result.issues)}`);
    expect(result.ir.nodes.find((node) => node.id === "sys")?.isBoundary).toBe(true);
    // The leaf is untouched.
    expect(result.ir.nodes.find((node) => node.id === "api")?.isBoundary).toBeUndefined();
  });

  it("accepts the shape that failed in the field: services holding components", () => {
    const services = ["quoting", "underwriting", "policy", "billing", "claims", "documents"];
    const result = validateIR({
      type: "c4-container",
      nodes: [
        ...services.map((id) => ({
          id: `${id}-service`,
          semanticType: "container",
          name: id,
          parentId: null,
          tier: "compute",
        })),
        ...services.map((id) => ({
          id: `${id}-api`,
          semanticType: "component",
          name: `${id} API`,
          parentId: `${id}-service`,
          tier: "compute",
        })),
      ],
      edges: [],
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.issues)).toBe(true);
  });

  it("accepts an empty boundary", () => {
    const result = validateIR({
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
      ],
      edges: [],
    });
    expect(result.ok).toBe(true);
  });

  it("treats the VPC/AZ/subnet semanticTypes as boundaries without the flag", () => {
    const result = validateIR({
      type: "aws-deployment",
      nodes: [
        { id: "vpc", semanticType: "aws-vpc", name: "VPC", parentId: null, tier: "edge" },
        { id: "az", semanticType: "aws-az", name: "AZ", parentId: "vpc", tier: "compute" },
      ],
      edges: [],
    });
    if (!result.ok) throw new Error("expected valid IR");
    expect(result.ir.nodes.every((node) => node.isBoundary === true)).toBe(true);
  });

  it("rejects a non-boolean isBoundary", () => {
    const result = validateIR({
      type: "c4-container",
      nodes: [
        {
          id: "a",
          semanticType: "container",
          name: "A",
          parentId: null,
          isBoundary: "yes",
          tier: "compute",
        },
      ],
      edges: [],
    });
    expect(codesOf(result)).toContain("nodeInvalidBoundary");
  });

  it("accepts deep containment without flagging a cycle", () => {
    const result = validateIR({
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
        {
          id: "ecs",
          semanticType: "aws-compute",
          name: "ECS",
          parentId: "subnet",
          tier: "compute",
        },
      ],
      edges: [],
    });
    expect(result.ok).toBe(true);
  });
});

describe("parseAndValidateIR", () => {
  it("parses bare JSON", () => {
    expect(parseAndValidateIR(JSON.stringify(validIR)).ok).toBe(true);
  });

  it("parses JSON inside a ```json fence", () => {
    const raw = "```json\n" + JSON.stringify(validIR) + "\n```";
    expect(parseAndValidateIR(raw).ok).toBe(true);
  });

  it("parses JSON surrounded by prose", () => {
    const raw = `Here you go:\n${JSON.stringify(validIR)}\nHope this helps.`;
    expect(parseAndValidateIR(raw).ok).toBe(true);
  });

  it("reports malformed JSON instead of throwing", () => {
    expect(codesOf(parseAndValidateIR('{"type": "c4-context", nodes: ['))).toEqual(["invalidJson"]);
  });

  it("reports an empty response instead of throwing", () => {
    expect(codesOf(parseAndValidateIR("   "))).toEqual(["invalidJson"]);
  });
});

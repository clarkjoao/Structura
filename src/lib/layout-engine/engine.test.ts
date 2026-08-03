import { describe, it, expect } from "vitest";
import { layoutDiagram, type LayoutInput } from "./index";
import { LAYOUT } from "./constants";

/** A small C4-shaped diagram: actor -> gateway -> service -> database. */
const c4Diagram: LayoutInput = {
  nodes: [
    { id: "customer", type: "person", name: "Customer", tier: "external" },
    { id: "gateway", type: "system", name: "API Gateway", tier: "gateway", technology: "Kong" },
    {
      id: "orders",
      type: "container",
      name: "Order Service",
      tier: "application",
      technology: "Node.js",
    },
    { id: "db", type: "container", name: "Order DB", tier: "data", technology: "PostgreSQL" },
  ],
  connections: [
    { id: "c1", from: "customer", to: "gateway", intent: "call", label: "HTTPS" },
    { id: "c2", from: "gateway", to: "orders", intent: "call", label: "REST" },
    { id: "c3", from: "orders", to: "db", intent: "data-flow", label: "SQL" },
  ],
  primaryPath: ["customer", "gateway", "orders", "db"],
};

describe("layoutDiagram", () => {
  it("produces geometry for every node and edge", () => {
    const result = layoutDiagram(c4Diagram);

    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
  });

  it("gives every node a measured, non-zero size", () => {
    const result = layoutDiagram(c4Diagram);

    for (const node of result.nodes) {
      expect(node.width, node.id).toBeGreaterThanOrEqual(LAYOUT.NODE_MIN_W);
      expect(node.height, node.id).toBeGreaterThanOrEqual(LAYOUT.NODE_MIN_H);
    }
  });

  it("orders columns left to right by tier", () => {
    const result = layoutDiagram(c4Diagram);
    const xOf = (id: string) => result.nodes.find((n) => n.id === id)!.position.x;

    expect(xOf("customer")).toBeLessThan(xOf("gateway"));
    expect(xOf("gateway")).toBeLessThan(xOf("orders"));
    expect(xOf("orders")).toBeLessThan(xOf("db"));
  });

  it("leaves no overlapping nodes", () => {
    const result = layoutDiagram(c4Diagram);

    for (let i = 0; i < result.nodes.length; i += 1) {
      for (let j = i + 1; j < result.nodes.length; j += 1) {
        const a = result.nodes[i]!;
        const b = result.nodes[j]!;
        const overlaps =
          a.position.x < b.position.x + (b.width ?? 0) &&
          b.position.x < a.position.x + (a.width ?? 0) &&
          a.position.y < b.position.y + (b.height ?? 0) &&
          b.position.y < a.position.y + (a.height ?? 0);
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("snaps all positions to the grid", () => {
    const result = layoutDiagram(c4Diagram);

    for (const node of result.nodes) {
      expect(node.position.x % LAYOUT.GRID, node.id).toBe(0);
      expect(node.position.y % LAYOUT.GRID, node.id).toBe(0);
    }
  });

  it("marks connections along the primary path", () => {
    const result = layoutDiagram(c4Diagram);

    for (const edge of result.edges) {
      expect(edge.data?.isPrimaryPath, edge.id).toBe(true);
    }
  });

  it("emphasises primary-path nodes without being told twice", () => {
    const result = layoutDiagram(c4Diagram);

    for (const node of result.nodes) {
      expect(node.data.emphasis, node.id).toBe("primary");
    }
  });

  it("is deterministic across runs", () => {
    const first = layoutDiagram(c4Diagram);
    const second = layoutDiagram(c4Diagram);

    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });

  it("is independent of input node ordering", () => {
    const forward = layoutDiagram(c4Diagram);
    const shuffled = layoutDiagram({ ...c4Diagram, nodes: [...c4Diagram.nodes].reverse() });

    for (const node of forward.nodes) {
      const other = shuffled.nodes.find((n) => n.id === node.id)!;
      expect(other.position, node.id).toEqual(node.position);
    }
  });

  it("runs headless — no DOM, no canvas", () => {
    // The default measurer must not require a browser.
    expect(() => layoutDiagram(c4Diagram)).not.toThrow();
  });
});

describe("boundaries become React Flow parents", () => {
  const withBoundary: LayoutInput = {
    nodes: [
      { id: "a", type: "container", name: "Service A", tier: "application" },
      { id: "b", type: "container", name: "Service B", tier: "application" },
    ],
    boundaries: [{ id: "vpc", name: "Production VPC", kind: "aws-vpc", contains: ["a", "b"] }],
  };

  it("emits the boundary as a panel node", () => {
    const result = layoutDiagram(withBoundary);
    const panel = result.nodes.find((n) => n.id === "vpc")!;

    expect(panel.type).toBe("panel");
    expect(panel.width).toBeGreaterThan(0);
    expect(panel.height).toBeGreaterThan(0);
  });

  it("parents members to the boundary with relative coordinates", () => {
    const result = layoutDiagram(withBoundary);
    const member = result.nodes.find((n) => n.id === "a")!;

    expect(member.parentId).toBe("vpc");
    // Relative to the parent, so it must not carry the absolute offset.
    expect(member.position.x).toBeGreaterThanOrEqual(0);
    expect(member.position.y).toBeGreaterThanOrEqual(0);
  });

  it("lists parents before children, as React Flow requires", () => {
    const result = layoutDiagram(withBoundary);
    const panelIndex = result.nodes.findIndex((n) => n.id === "vpc");
    const memberIndex = result.nodes.findIndex((n) => n.id === "a");

    expect(panelIndex).toBeLessThan(memberIndex);
  });

  it("keeps members inside the boundary box", () => {
    const result = layoutDiagram(withBoundary);
    const panel = result.nodes.find((n) => n.id === "vpc")!;

    for (const id of ["a", "b"]) {
      const member = result.nodes.find((n) => n.id === id)!;
      expect(member.position.x).toBeGreaterThanOrEqual(0);
      expect(member.position.x + (member.width ?? 0)).toBeLessThanOrEqual(panel.width ?? 0);
      expect(member.position.y + (member.height ?? 0)).toBeLessThanOrEqual(panel.height ?? 0);
    }
  });

  it("spans multiple tiers when members cross tier boundaries", () => {
    // A VPC containing services in both "application" and "data" tiers — the boundary
    // frame must cover the full column range, not just the nodes inside it.
    const vpcDiagram: LayoutInput = {
      nodes: [
        { id: "svc", type: "container", name: "Order Service", tier: "application" },
        { id: "db", type: "container", name: "Order DB", tier: "data" },
        { id: "cache", type: "container", name: "Redis", tier: "data" },
      ],
      boundaries: [
        {
          id: "vpc",
          name: "Production VPC",
          kind: "aws-vpc",
          contains: ["svc", "db", "cache"],
        },
      ],
    };
    const result = layoutDiagram(vpcDiagram);
    const panel = result.nodes.find((n) => n.id === "vpc")!;

    // The panel must be wider than a single node — it spans two tier columns.
    expect(panel.width!).toBeGreaterThan(400);
  });
});

describe("explicit failure instead of silent fallback", () => {
  it("fails on a connection to an unknown node", () => {
    const result = layoutDiagram({
      nodes: [{ id: "a", type: "system", name: "A", tier: "application" }],
      connections: [{ id: "c1", from: "a", to: "ghost", intent: "call" }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.code === "layout/unknown-endpoint")).toBe(true);
    // No geometry at all — a partial diagram would look like success.
    expect(result.nodes).toHaveLength(0);
  });

  it("fails on a boundary listing an unknown member", () => {
    const result = layoutDiagram({
      nodes: [{ id: "a", type: "system", name: "A", tier: "application" }],
      boundaries: [{ id: "b1", name: "Zone", kind: "trust-zone", contains: ["a", "ghost"] }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.code === "layout/unknown-member")).toBe(true);
  });

  it("fails on an empty diagram", () => {
    const result = layoutDiagram({ nodes: [] });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.code === "layout/empty")).toBe(true);
  });

  it("names the offending ids so the caller can act on the IR", () => {
    const result = layoutDiagram({
      nodes: [{ id: "a", type: "system", name: "A", tier: "application" }],
      connections: [{ id: "c1", from: "a", to: "ghost", intent: "call" }],
    });

    const failure = result.failures.find((f) => f.code === "layout/unknown-endpoint")!;
    expect(failure.nodeIds).toContain("ghost");
    expect(failure.message).toContain("ghost");
  });
});

describe("edge anchors", () => {
  it("spreads anchors when several edges share a node side", () => {
    const result = layoutDiagram({
      nodes: [
        { id: "hub", type: "system", name: "Hub", tier: "gateway" },
        { id: "a", type: "system", name: "A", tier: "application" },
        { id: "b", type: "system", name: "B", tier: "application" },
        { id: "c", type: "system", name: "C", tier: "application" },
      ],
      connections: [
        { id: "e1", from: "hub", to: "a", intent: "call" },
        { id: "e2", from: "hub", to: "b", intent: "call" },
        { id: "e3", from: "hub", to: "c", intent: "call" },
      ],
    });

    const anchors = result.edges
      .map((edge) => (edge.data as { sourceAnchor?: { y: number } }).sourceAnchor?.y)
      .filter((y): y is number => y !== undefined);

    expect(anchors).toHaveLength(3);
    expect(new Set(anchors).size).toBe(3);
  });
});

describe("cross-cutting band", () => {
  it("places cross-cutting services below the main flow", () => {
    const result = layoutDiagram({
      nodes: [
        { id: "api", type: "system", name: "API", tier: "application" },
        { id: "logs", type: "system", name: "CloudWatch", tier: "cross-cutting" },
        { id: "auth", type: "system", name: "Cognito", tier: "cross-cutting" },
      ],
    });

    const api = result.nodes.find((n) => n.id === "api")!;
    const logs = result.nodes.find((n) => n.id === "logs")!;

    expect(logs.position.y).toBeGreaterThan(api.position.y + (api.height ?? 0));
  });
});

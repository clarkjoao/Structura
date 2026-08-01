/**
 * Boundary stress tests.
 *
 * Container and component diagrams are where boundaries stop being decoration: a system
 * boundary wrapping four containers, a VPC inside an account, a container boundary holding
 * components. Slice 0 built the pass against simple cases; these push it.
 *
 * Everything runs through the full engine rather than the pass alone, because boundary
 * geometry is derived from node positions and those come from the earlier passes.
 */

import { describe, it, expect } from "vitest";
import { layoutDiagram, approximateMeasureText, type LayoutInput } from "../index";
import type { LayoutBoundary, LayoutNode, LayoutState } from "../types";

function run(input: LayoutInput) {
  return layoutDiagram(input, { measureText: approximateMeasureText });
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Every member must sit fully inside its boundary. */
function assertContainsMembers(state: LayoutState): void {
  for (const boundary of state.boundaries.values()) {
    for (const nodeId of boundary.contains) {
      const node = state.nodes.get(nodeId);
      if (!node) continue;
      expect(
        node.x >= boundary.x &&
          node.y >= boundary.y &&
          node.x + node.width <= boundary.x + boundary.width &&
          node.y + node.height <= boundary.y + boundary.height,
        `"${node.name}" escaped boundary "${boundary.name}"`,
      ).toBe(true);
    }
  }
}

/** Every nested boundary must sit fully inside its parent. */
function assertNestingHolds(state: LayoutState): void {
  for (const child of state.boundaries.values()) {
    if (!child.parentBoundaryId) continue;
    const parent = state.boundaries.get(child.parentBoundaryId);
    if (!parent) continue;
    expect(
      child.x >= parent.x &&
        child.y >= parent.y &&
        child.x + child.width <= parent.x + parent.width &&
        child.y + child.height <= parent.y + parent.height,
      `"${child.name}" escaped parent "${parent.name}"`,
    ).toBe(true);
  }
}

/** Boundaries that are not related by nesting must not overlap. */
function assertNoUnrelatedBoundaryOverlap(state: LayoutState): void {
  const list = [...state.boundaries.values()];
  const isAncestor = (maybeAncestor: LayoutBoundary, node: LayoutBoundary): boolean => {
    let current = node.parentBoundaryId;
    while (current) {
      if (current === maybeAncestor.id) return true;
      current = state.boundaries.get(current)?.parentBoundaryId;
    }
    return false;
  };

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]!;
      const b = list[j]!;
      if (isAncestor(a, b) || isAncestor(b, a)) continue;
      expect(rectsOverlap(a, b), `"${a.name}" overlaps "${b.name}"`).toBe(false);
    }
  }
}

function assertNoNodeOverlap(state: LayoutState): void {
  const nodes: LayoutNode[] = [...state.nodes.values()];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      expect(
        rectsOverlap(nodes[i]!, nodes[j]!),
        `"${nodes[i]!.name}" overlaps "${nodes[j]!.name}"`,
      ).toBe(false);
    }
  }
}

describe("a boundary spanning several tiers", () => {
  /** The standard C4 container shape: one system boundary over most of the diagram. */
  const systemBoundary: LayoutInput = {
    nodes: [
      { id: "customer", type: "person", name: "Customer", tier: "external" },
      { id: "web", type: "container", name: "Web App", tier: "client" },
      { id: "api", type: "container", name: "API", tier: "gateway" },
      { id: "svc", type: "container", name: "Order Service", tier: "application" },
      { id: "db", type: "container", name: "Database", tier: "data" },
    ],
    boundaries: [
      {
        id: "system",
        name: "E-commerce Platform",
        kind: "system",
        contains: ["web", "api", "svc", "db"],
      },
    ],
    connections: [
      { id: "e1", from: "customer", to: "web", intent: "call" },
      { id: "e2", from: "web", to: "api", intent: "call" },
      { id: "e3", from: "api", to: "svc", intent: "call" },
      { id: "e4", from: "svc", to: "db", intent: "data-flow" },
    ],
    primaryPath: ["customer", "web", "api", "svc", "db"],
  };

  it("wraps members across four columns", () => {
    const { state } = run(systemBoundary);
    assertContainsMembers(state);
  });

  it("leaves the external actor outside the system boundary", () => {
    const { state } = run(systemBoundary);
    const boundary = state.boundaries.get("system")!;
    const customer = state.nodes.get("customer")!;

    // A person outside the system must not be swallowed by its boundary box.
    expect(customer.x + customer.width).toBeLessThanOrEqual(boundary.x);
  });
});

describe("sibling boundaries", () => {
  /** Two systems side by side, each wrapping its own service and store. */
  const twoSystems: LayoutInput = {
    nodes: [
      { id: "svc-a", type: "container", name: "Service A", tier: "application" },
      { id: "db-a", type: "container", name: "Store A", tier: "data" },
      { id: "svc-b", type: "container", name: "Service B", tier: "application" },
      { id: "db-b", type: "container", name: "Store B", tier: "data" },
    ],
    boundaries: [
      { id: "sys-a", name: "System A", kind: "system", contains: ["svc-a", "db-a"] },
      { id: "sys-b", name: "System B", kind: "system", contains: ["svc-b", "db-b"] },
    ],
    connections: [
      { id: "e1", from: "svc-a", to: "db-a", intent: "data-flow" },
      { id: "e2", from: "svc-b", to: "db-b", intent: "data-flow" },
    ],
  };

  it("keeps two systems from overlapping", () => {
    const { state } = run(twoSystems);
    assertNoUnrelatedBoundaryOverlap(state);
  });

  it("keeps each system's members inside it", () => {
    const { state } = run(twoSystems);
    assertContainsMembers(state);
  });

  it("does not interleave members of different systems", () => {
    // Service A above Service B implies Store A above Store B; otherwise the two
    // boundaries cross over each other even if their boxes happen not to intersect.
    const { state } = run(twoSystems);
    const svcA = state.nodes.get("svc-a")!;
    const svcB = state.nodes.get("svc-b")!;
    const dbA = state.nodes.get("db-a")!;
    const dbB = state.nodes.get("db-b")!;

    expect(Math.sign(svcA.y - svcB.y)).toBe(Math.sign(dbA.y - dbB.y));
  });

  it("handles three sibling boundaries", () => {
    const { state } = run({
      nodes: ["a", "b", "c"].flatMap((key) => [
        {
          id: `svc-${key}`,
          type: "container" as const,
          name: `Service ${key}`,
          tier: "application" as const,
        },
        {
          id: `db-${key}`,
          type: "container" as const,
          name: `Store ${key}`,
          tier: "data" as const,
        },
      ]),
      boundaries: ["a", "b", "c"].map((key) => ({
        id: `sys-${key}`,
        name: `System ${key}`,
        kind: "system" as const,
        contains: [`svc-${key}`, `db-${key}`],
      })),
    });

    assertNoUnrelatedBoundaryOverlap(state);
    assertContainsMembers(state);
  });
});

describe("nested boundaries", () => {
  /** account > vpc > subnet, the AWS shape that drives container diagrams. */
  const threeLevels: LayoutInput = {
    nodes: [
      { id: "alb", type: "container", name: "Load Balancer", tier: "gateway" },
      { id: "svc", type: "container", name: "Service", tier: "application" },
      { id: "db", type: "container", name: "Database", tier: "data" },
    ],
    boundaries: [
      { id: "account", name: "Production Account", kind: "aws-account", contains: [] },
      { id: "vpc", name: "VPC", kind: "aws-vpc", contains: ["alb"], parentBoundaryId: "account" },
      {
        id: "subnet",
        name: "Private Subnet",
        kind: "aws-subnet",
        contains: ["svc", "db"],
        parentBoundaryId: "vpc",
      },
    ],
    connections: [
      { id: "e1", from: "alb", to: "svc", intent: "call" },
      { id: "e2", from: "svc", to: "db", intent: "data-flow" },
    ],
  };

  it("nests three levels correctly", () => {
    const { state } = run(threeLevels);
    assertNestingHolds(state);
    assertContainsMembers(state);
  });

  it("gives each level a distinct box", () => {
    const { state } = run(threeLevels);
    const account = state.boundaries.get("account")!;
    const vpc = state.boundaries.get("vpc")!;
    const subnet = state.boundaries.get("subnet")!;

    expect(account.width).toBeGreaterThan(vpc.width);
    expect(vpc.width).toBeGreaterThan(subnet.width);
  });

  it("keeps nesting intact when siblings reflow", () => {
    // Two VPCs in one account, each wrapping a service. If reflow moves one VPC, the
    // account computed before the reflow must still contain it.
    const { state } = run({
      nodes: [
        { id: "svc-a", type: "container", name: "Service A", tier: "application" },
        { id: "svc-b", type: "container", name: "Service B", tier: "application" },
      ],
      boundaries: [
        { id: "account", name: "Account", kind: "aws-account", contains: [] },
        {
          id: "vpc-a",
          name: "VPC A",
          kind: "aws-vpc",
          contains: ["svc-a"],
          parentBoundaryId: "account",
          orderIndex: 0,
        },
        {
          id: "vpc-b",
          name: "VPC B",
          kind: "aws-vpc",
          contains: ["svc-b"],
          parentBoundaryId: "account",
          orderIndex: 1,
        },
      ],
    });

    assertNestingHolds(state);
    assertNoUnrelatedBoundaryOverlap(state);
  });

  it("survives a deep chain", () => {
    const depth = 5;
    const boundaries = Array.from({ length: depth }, (_, i) => ({
      id: `b${i}`,
      name: `Level ${i}`,
      kind: "trust-zone" as const,
      contains: i === depth - 1 ? ["leaf"] : [],
      ...(i > 0 ? { parentBoundaryId: `b${i - 1}` } : {}),
    }));

    const { state } = run({
      nodes: [{ id: "leaf", type: "container", name: "Leaf", tier: "application" }],
      boundaries,
    });

    assertNestingHolds(state);
    assertContainsMembers(state);
  });
});

describe("boundaries and node placement together", () => {
  it("never leaves nodes overlapping after boundary reflow", () => {
    const { state } = run({
      nodes: [
        { id: "a1", type: "container", name: "A1", tier: "application" },
        { id: "a2", type: "container", name: "A2", tier: "application" },
        { id: "b1", type: "container", name: "B1", tier: "application" },
        { id: "b2", type: "container", name: "B2", tier: "application" },
      ],
      boundaries: [
        { id: "ba", name: "Group A", kind: "system", contains: ["a1", "a2"] },
        { id: "bb", name: "Group B", kind: "system", contains: ["b1", "b2"] },
      ],
    });

    assertNoNodeOverlap(state);
    assertContainsMembers(state);
    assertNoUnrelatedBoundaryOverlap(state);
  });

  it("keeps an unboundaried node out of someone else's box", () => {
    // A node with no boundary must not end up visually inside one, which would read as
    // membership it does not have.
    const { state } = run({
      nodes: [
        { id: "inside", type: "container", name: "Inside", tier: "application" },
        { id: "loose", type: "container", name: "Loose", tier: "application" },
      ],
      boundaries: [{ id: "box", name: "Box", kind: "system", contains: ["inside"] }],
    });

    const box = state.boundaries.get("box")!;
    const loose = state.nodes.get("loose")!;

    expect(rectsOverlap(box, loose), "unboundaried node sits inside a boundary").toBe(false);
  });

  it("is deterministic under nesting", () => {
    const input: LayoutInput = {
      nodes: [
        { id: "a", type: "container", name: "A", tier: "application" },
        { id: "b", type: "container", name: "B", tier: "data" },
      ],
      boundaries: [
        { id: "outer", name: "Outer", kind: "system", contains: [] },
        {
          id: "inner",
          name: "Inner",
          kind: "container",
          contains: ["a", "b"],
          parentBoundaryId: "outer",
        },
      ],
    };

    const first = run(input);
    const second = run(input);
    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });
});

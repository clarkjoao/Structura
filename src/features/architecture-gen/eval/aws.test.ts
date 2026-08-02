/**
 * AWS reference case tests — slice 3.
 *
 * Every case is a real AWS topology. Each is asserted to propose cleanly, keep boundaries
 * correct, stay on canvas, snap to the grid, and be deterministic.
 */

import { describe, it, expect } from "vitest";
import { AWS_CASES } from "./aws-cases";
import { ProposalSession } from "../session";
import { toLayoutInput } from "../ir";
import { layoutDiagram, approximateMeasureText, LAYOUT } from "@/lib/layout-engine";
import type { ArchitectureIr } from "../ir";
import type { LayoutState } from "@/lib/layout-engine/types";

/**
 * Warning budget as a function of graph topology.
 *
 * Cross-cutting edges are excluded — the layout engine suppresses them (layout-engine pass P6),
 * so counting them would artificially inflate the budget for simple cases.
 *
 * Formula: budget = 0.5 + 0.2 * edges
 *
 * See c4-container.test.ts for full documentation.
 */
function warningBudget(ir: ArchitectureIr): number {
  const edges = (ir.connections ?? []).length;
  return Math.ceil(1 + 0.25 * edges);
}

function caseById(id: string) {
  const found = AWS_CASES.find((testCase) => testCase.id === id);
  if (!found) throw new Error(`No case "${id}"`);
  return found;
}

function laidOut(id: string) {
  return layoutDiagram(toLayoutInput(caseById(id).ir), { measureText: approximateMeasureText });
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function assertMembersContained(state: LayoutState, label: string): void {
  for (const boundary of state.boundaries.values()) {
    for (const nodeId of boundary.contains) {
      const node = state.nodes.get(nodeId);
      if (!node) continue;
      expect(
        node.x >= boundary.x &&
          node.y >= boundary.y &&
          node.x + node.width <= boundary.x + boundary.width &&
          node.y + node.height <= boundary.y + boundary.height,
        `${label}: "${node.name}" escaped "${boundary.name}"`,
      ).toBe(true);
    }
  }
}

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

describe("AWS reference cases", () => {
  it("covers the right shapes", () => {
    expect(AWS_CASES).toHaveLength(10);

    const hasVpc = AWS_CASES.some((c) => c.ir.boundaries?.some((b) => b.kind === "aws-vpc"));
    expect(hasVpc).toBe(true);

    const hasEventBus = AWS_CASES.some((c) =>
      c.ir.nodes.some((n) => n.aws_service === "eventbridge" || n.aws_service === "sns"),
    );
    expect(hasEventBus).toBe(true);

    const hasCrossCutting = AWS_CASES.some((c) =>
      c.ir.nodes.some((n) => n.tier === "cross-cutting"),
    );
    expect(hasCrossCutting).toBe(true);
  });

  it.each(AWS_CASES)("$id proposes with no errors", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);
    expect(
      result.errors,
      `${testCase.id}: ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join(" | ")}`,
    ).toBe(0);
    expect(result.committable).toBe(true);
  });

  it.each(AWS_CASES)("$id stays within the warning budget", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);
    const max = warningBudget(testCase.ir);
    expect(
      result.warnings,
      `${testCase.id}: ${result.diagnostics.map((d) => d.code).join(", ")}`,
    ).toBeLessThanOrEqual(max);
  });

  it.each(AWS_CASES)("$id leaves no overlapping nodes", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });
    const nodes = [...state.nodes.values()];

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        expect(
          overlaps(nodes[i]!, nodes[j]!),
          `${testCase.id}: "${nodes[i]!.name}" overlaps "${nodes[j]!.name}"`,
        ).toBe(false);
      }
    }
  });

  it.each(AWS_CASES)("$id keeps boundary members contained", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });
    assertMembersContained(state, testCase.id);
  });

  it.each(AWS_CASES)("$id starts on canvas", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });

    for (const node of state.nodes.values()) {
      expect(node.x, `${testCase.id}: ${node.name}`).toBeGreaterThanOrEqual(0);
      expect(node.y, `${testCase.id}: ${node.name}`).toBeGreaterThanOrEqual(0);
    }
    for (const boundary of state.boundaries.values()) {
      expect(boundary.x, `${testCase.id}: ${boundary.name}`).toBeGreaterThanOrEqual(0);
      expect(boundary.y, `${testCase.id}: ${boundary.name}`).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(AWS_CASES)("$id snaps to the grid", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });

    for (const node of state.nodes.values()) {
      expect(node.x % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
      expect(node.y % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
    }
  });

  it.each(AWS_CASES)("$id is deterministic", (testCase) => {
    const input = toLayoutInput(testCase.ir);
    const first = layoutDiagram(input, { measureText: approximateMeasureText });
    const second = layoutDiagram(input, { measureText: approximateMeasureText });
    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });
});

describe("AWS boundary behaviour", () => {
  it("keeps account > VPC > subnet in correct nesting order", () => {
    const { state } = laidOut("vpc-with-boundaries");
    assertNestingHolds(state);

    const account = state.boundaries.get("account")!;
    const vpc = state.boundaries.get("vpc")!;
    const subnet = state.boundaries.get("private-subnet")!;

    expect(vpc.x).toBeGreaterThan(account.x);
    expect(vpc.y).toBeGreaterThan(account.y);
    expect(subnet.x).toBeGreaterThan(vpc.x);
    expect(subnet.y).toBeGreaterThan(vpc.y);
  });

  it("keeps public and private subnets in separate boxes", () => {
    const { state } = laidOut("vpc-with-nat-gateway");
    const publicSubnet = state.boundaries.get("public-subnet")!;
    const privateSubnet = state.boundaries.get("private-subnet")!;

    expect(overlaps(publicSubnet, privateSubnet)).toBe(false);
  });

  it("does not put the ALB inside a private subnet", () => {
    const { state } = laidOut("vpc-with-nat-gateway");
    const alb = state.nodes.get("alb")!;
    const publicSubnet = state.boundaries.get("public-subnet")!;
    const privateSubnet = state.boundaries.get("private-subnet")!;

    const inPublic = overlaps(alb, publicSubnet);
    const inPrivate = overlaps(alb, privateSubnet);
    expect(inPrivate && !inPublic, "ALB ended up in the private subnet").toBe(false);
  });
});

describe("AWS node tier placement", () => {
  it("puts a load balancer in the gateway tier", () => {
    const { state } = laidOut("three-tier-webapp");
    const alb = state.nodes.get("alb")!;
    const gatewayTier = state.columns.find((c) =>
      c.nodeIds.some((id) => state.nodes.get(id)?.name === "ALB"),
    );
    expect(gatewayTier).toBeDefined();
    expect(alb.tier).toBe("gateway");
  });

  it("puts SQS in the data tier", () => {
    const { state } = laidOut("event-driven-orders");
    const sqs = state.nodes.get("sqs")!;
    expect(sqs.tier).toBe("data");
  });

  it("puts Cognito in the cross-cutting tier", () => {
    const { state } = laidOut("full-stack-with-s3-and-cognito");
    const cognito = state.nodes.get("cognito")!;
    expect(cognito.tier).toBe("cross-cutting");
  });

  it("reads left to right along the primary path", () => {
    const { state } = laidOut("serverless-api");
    const ids = state.primaryPath;
    for (let i = 1; i < ids.length; i += 1) {
      const prev = state.nodes.get(ids[i - 1]!)!;
      const curr = state.nodes.get(ids[i]!)!;
      expect(curr.x, `${prev.name} → ${curr.name}`).toBeGreaterThan(prev.x);
    }
  });
});

describe("AWS cross-cutting with dependencies", () => {
  it("anchors cross-cutting services under their consumer", () => {
    const { state } = laidOut("with-monitoring");
    const ecs = state.nodes.get("ecs")!;
    const cloudwatch = state.nodes.get("cloudwatch")!;

    expect(cloudwatch.y).toBeGreaterThan(ecs.y + ecs.height);
    expect(cloudwatch.x).toBeGreaterThanOrEqual(ecs.x - ecs.width);
  });

  it("connects cross-cutting services with dependency edges", () => {
    const result = laidOut("with-monitoring");
    const depEdges = result.edges.filter(
      (edge) => (edge.data as { intent?: string })?.intent === "dependency",
    );
    expect(depEdges.length).toBeGreaterThan(0);
  });
});

describe("AWS SNS fan-out", () => {
  it("proposes the SNS-to-SQS pattern without edge crossings", () => {
    const result = new ProposalSession().propose(caseById("async-with-sns-sqs").ir);
    expect(result.errors).toBe(0);
  });
});

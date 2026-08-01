import { describe, it, expect } from "vitest";
import { C4_CONTAINER_CASES } from "./c4-container-cases";
import { ProposalSession } from "../session";
import { toLayoutInput } from "../ir";
import { layoutDiagram, approximateMeasureText, LAYOUT } from "@/lib/layout-engine";
import type { LayoutState } from "@/lib/layout-engine/types";

/** Slice-2 done criterion, same as slice 1: no errors, at most one warning. */
const MAX_WARNINGS = 1;

function caseById(id: string) {
  const found = C4_CONTAINER_CASES.find((testCase) => testCase.id === id);
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

describe("C4 container and component reference cases", () => {
  it("covers containers and components, plain and bounded", () => {
    expect(C4_CONTAINER_CASES).toHaveLength(10);

    const kinds = new Set(C4_CONTAINER_CASES.map((c) => c.ir.diagram_kind));
    expect(kinds).toContain("c4-container");
    expect(kinds).toContain("c4-component");

    // At least one case must exercise nesting, since that is the slice-2 risk.
    expect(
      C4_CONTAINER_CASES.some((c) =>
        c.ir.boundaries?.some((boundary) => boundary.parent_boundary_id),
      ),
    ).toBe(true);
  });

  it.each(C4_CONTAINER_CASES)("$id proposes with no errors", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);

    expect(
      result.errors,
      `${testCase.id}: ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join(" | ")}`,
    ).toBe(0);
    expect(result.committable).toBe(true);
  });

  it.each(C4_CONTAINER_CASES)("$id stays within the warning budget", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);

    expect(
      result.warnings,
      `${testCase.id}: ${result.diagnostics.map((d) => d.code).join(", ")}`,
    ).toBeLessThanOrEqual(MAX_WARNINGS);
  });

  it.each(C4_CONTAINER_CASES)("$id leaves no overlapping nodes", (testCase) => {
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

  it.each(C4_CONTAINER_CASES)("$id keeps boundary members contained", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });
    assertMembersContained(state, testCase.id);
  });

  it.each(C4_CONTAINER_CASES)("$id starts on canvas", (testCase) => {
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

  it.each(C4_CONTAINER_CASES)("$id snaps to the grid", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });

    for (const node of state.nodes.values()) {
      expect(node.x % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
      expect(node.y % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
    }
  });

  it.each(C4_CONTAINER_CASES)("$id is deterministic", (testCase) => {
    const input = toLayoutInput(testCase.ir);
    const first = layoutDiagram(input, { measureText: approximateMeasureText });
    const second = layoutDiagram(input, { measureText: approximateMeasureText });

    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });
});

describe("container-specific layout behaviour", () => {
  it("keeps the actor outside the system boundary", () => {
    const { state } = laidOut("system-boundary");
    const boundary = state.boundaries.get("shop")!;
    const customer = state.nodes.get("customer")!;

    expect(overlaps(boundary, customer), "customer swallowed by the system boundary").toBe(false);
  });

  it("spans the boundary across every column it owns", () => {
    const { state } = laidOut("system-boundary");
    const boundary = state.boundaries.get("shop")!;
    const web = state.nodes.get("web")!;
    const db = state.nodes.get("db")!;

    expect(boundary.x).toBeLessThanOrEqual(web.x);
    expect(boundary.x + boundary.width).toBeGreaterThanOrEqual(db.x + db.width);
  });

  it("spreads anchors when one container fans out to three stores", () => {
    const result = laidOut("fan-out-to-data");
    const fromOrders = result.edges
      .filter((edge) => edge.source === "orders")
      .map((edge) => (edge.data as { sourceAnchor?: { y: number } }).sourceAnchor?.y)
      .filter((y): y is number => y !== undefined);

    expect(fromOrders.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fromOrders).size).toBe(fromOrders.length);
  });

  it("does not interleave two sibling systems", () => {
    const { state } = laidOut("two-systems");
    const ordersApi = state.nodes.get("orders-api")!;
    const ordersDb = state.nodes.get("orders-db")!;
    const billingApi = state.nodes.get("billing-api")!;
    const billingDb = state.nodes.get("billing-db")!;

    // Whichever system sits on top, both its members must be on that side.
    expect(Math.sign(ordersApi.y - billingApi.y)).toBe(Math.sign(ordersDb.y - billingDb.y));
  });

  it("keeps sibling system boundaries apart", () => {
    const { state } = laidOut("two-systems");
    const orders = state.boundaries.get("orders")!;
    const billing = state.boundaries.get("billing")!;

    expect(overlaps(orders, billing), "sibling systems overlap").toBe(false);
  });

  it("nests account, VPC and subnet in order", () => {
    const { state } = laidOut("nested-vpc");
    const account = state.boundaries.get("account")!;
    const vpc = state.boundaries.get("vpc")!;
    const subnet = state.boundaries.get("subnet")!;

    const contains = (outer: typeof account, inner: typeof vpc) =>
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height;

    expect(contains(account, vpc), "VPC escaped the account").toBe(true);
    expect(contains(vpc, subnet), "subnet escaped the VPC").toBe(true);
  });

  it("anchors cross-cutting services under their consumer", () => {
    const { state } = laidOut("with-observability");
    const payments = state.nodes.get("payments")!;
    const metrics = state.nodes.get("metrics")!;

    // Below the flow…
    expect(metrics.y).toBeGreaterThan(payments.y + payments.height);
    // …and roughly beneath the thing that uses it, not parked at the left margin.
    expect(metrics.x).toBeGreaterThanOrEqual(payments.x - payments.width);
  });
});

describe("component-specific layout behaviour", () => {
  it("wraps components in their container boundary", () => {
    const { state } = laidOut("component-with-container-boundary");
    assertMembersContained(state, "component-with-container-boundary");
  });

  it("reads left to right along the component pipeline", () => {
    const { state } = laidOut("component-simple");
    const controller = state.nodes.get("controller")!;
    const domain = state.nodes.get("domain")!;
    const repository = state.nodes.get("repository")!;

    expect(controller.x).toBeLessThan(domain.x);
    expect(domain.x).toBeLessThan(repository.x);
  });

  it("puts both inbound adapters ahead of the domain core", () => {
    const { state } = laidOut("component-hexagonal");
    const domain = state.nodes.get("domain")!;

    for (const id of ["rest", "consumer"]) {
      expect(state.nodes.get(id)!.x, id).toBeLessThan(domain.x);
    }
    for (const id of ["carrier", "persistence"]) {
      expect(state.nodes.get(id)!.x, id).toBeGreaterThan(domain.x);
    }
  });

  it("stacks two adapters in the same tier without collision", () => {
    const { state } = laidOut("component-hexagonal");
    const rest = state.nodes.get("rest")!;
    const consumer = state.nodes.get("consumer")!;

    expect(overlaps(rest, consumer)).toBe(false);
    expect(rest.y).not.toBe(consumer.y);
  });
});

import { describe, it, expect } from "vitest";
import { C4_CONTEXT_CASES } from "./c4-context-cases";
import { ProposalSession } from "../session";
import { toLayoutInput } from "../ir";
import { layoutDiagram, approximateMeasureText, LAYOUT } from "@/lib/layout-engine";
import { MAX_PRIMARY_NODES } from "@/lib/layout-engine/constants";

/** The slice-1 done criterion: no errors, at most one warning. */
const MAX_WARNINGS = 1;

function laidOut(index: number) {
  return layoutDiagram(toLayoutInput(C4_CONTEXT_CASES[index]!.ir), {
    measureText: approximateMeasureText,
  });
}

describe("C4 context reference cases", () => {
  it("covers the range a context diagram has to handle", () => {
    expect(C4_CONTEXT_CASES).toHaveLength(5);
    const ids = C4_CONTEXT_CASES.map((c) => c.id);
    expect(ids).toContain("minimal");
    expect(ids).toContain("with-cross-cutting");
    expect(ids).toContain("at-the-composition-limit");
  });

  it.each(C4_CONTEXT_CASES)("$id proposes with no errors", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);

    expect(
      result.errors,
      `${testCase.id}: ${result.diagnostics.map((d) => d.message).join(" | ")}`,
    ).toBe(0);
    expect(result.committable).toBe(true);
  });

  it.each(C4_CONTEXT_CASES)("$id stays within the warning budget", (testCase) => {
    const result = new ProposalSession().propose(testCase.ir);

    expect(
      result.warnings,
      `${testCase.id}: ${result.diagnostics.map((d) => d.code).join(", ")}`,
    ).toBeLessThanOrEqual(MAX_WARNINGS);
  });

  it.each(C4_CONTEXT_CASES)("$id leaves no overlapping nodes", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });
    const nodes = [...state.nodes.values()];

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const overlaps =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlaps, `${testCase.id}: ${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it.each(C4_CONTEXT_CASES)("$id snaps every node to the grid", (testCase) => {
    const { state } = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });

    for (const node of state.nodes.values()) {
      expect(node.x % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
      expect(node.y % LAYOUT.GRID, `${testCase.id}: ${node.name}`).toBe(0);
    }
  });

  it.each(C4_CONTEXT_CASES)("$id is deterministic", (testCase) => {
    const first = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });
    const second = layoutDiagram(toLayoutInput(testCase.ir), {
      measureText: approximateMeasureText,
    });

    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });

  it.each(C4_CONTEXT_CASES)("$id stays inside the composition guidance", (testCase) => {
    const primary = testCase.ir.nodes.filter((node) => node.tier !== "cross-cutting");
    expect(primary.length, testCase.id).toBeLessThanOrEqual(MAX_PRIMARY_NODES);
  });
});

describe("context-specific layout behaviour", () => {
  it("reads left to right along the primary path", () => {
    const result = laidOut(1); // third-party-integrations
    const xOf = (id: string) => result.nodes.find((n) => n.id === id)!.position.x;

    expect(xOf("customer")).toBeLessThan(xOf("shop"));
  });

  it("keeps several actors in one tier from colliding", () => {
    const result = laidOut(2); // multiple-actors
    const actors = ["customer", "agent", "manager"].map((id) =>
      result.nodes.find((n) => n.id === id)!,
    );

    const ys = actors.map((a) => a.position.y).sort((p, q) => p - q);
    expect(new Set(ys).size).toBe(3);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThan(0);
    }
  });

  it("puts the cross-cutting band below the main flow", () => {
    const result = laidOut(3); // with-cross-cutting
    const payments = result.nodes.find((n) => n.id === "payments")!;
    const sso = result.nodes.find((n) => n.id === "sso")!;

    expect(sso.position.y).toBeGreaterThan(payments.position.y + (payments.height ?? 0));
  });

  it("does not warn about cross-cutting services that have a consumer", () => {
    const result = new ProposalSession().propose(C4_CONTEXT_CASES[3]!.ir);
    expect(result.diagnostics.some((d) => d.code === "c4/cross-cutting-no-entry")).toBe(false);
  });

  it("spreads edge anchors when many actors hit one system", () => {
    const result = laidOut(2);
    const anchors = result.edges
      .map((edge) => (edge.data as { targetAnchor?: { y: number } }).targetAnchor?.y)
      .filter((y): y is number => y !== undefined);

    // Three edges landing on the same side must not share a point.
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("widens spacing for the dense case", () => {
    const dense = laidOut(4); // at-the-composition-limit
    const sparse = laidOut(0); // minimal

    const spread = (result: ReturnType<typeof laidOut>) => {
      const xs = result.nodes.map((n) => n.position.x);
      return Math.max(...xs) - Math.min(...xs);
    };

    expect(spread(dense)).toBeGreaterThan(spread(sparse));
  });

  it("measures every node rather than assuming a default size", () => {
    const result = laidOut(1);
    const widths = new Set(result.nodes.map((n) => n.width));

    // Different labels produce different widths; a single width would mean nothing measured.
    expect(widths.size).toBeGreaterThan(1);
  });
});

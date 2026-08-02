import { describe, it, expect } from "vitest";
import { validateIr, validateGeometry, sortByRepairOrder, categoryOf } from "./index";
import { layoutDiagram, type LayoutInput } from "../layout-engine";
import type { Diagnostic } from "./types";
import type { LayoutState } from "../layout-engine/types";

/** Every fix must be expressible as an IR edit — never a coordinate. */
function assertNoPixelTalk(diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    for (const fix of diagnostic.supportedFixes) {
      expect(fix.description, `${diagnostic.code} fix`).not.toMatch(/\b\d+\s*(px|pixels?)\b/i);
      expect(fix.description, `${diagnostic.code} fix`).not.toMatch(
        /\bmove\b.*\b\d+\b.*\b(up|down|left|right)\b/i,
      );
    }
  }
}

describe("structural validation (stage 1, pre-layout)", () => {
  it("reports a connection pointing at a missing node", () => {
    const report = validateIr({
      nodes: [{ id: "a", name: "A", tier: "application" }],
      connections: [{ id: "c1", from: "a", to: "ghost" }],
    });

    const found = report.diagnostics.find((d) => d.code === "ir/unknown-node-ref")!;
    expect(found.severity).toBe("error");
    expect(found.message).toContain("ghost");
    expect(report.errors).toBe(1);
  });

  it("reports duplicate ids across element kinds", () => {
    const report = validateIr({
      nodes: [{ id: "dup", name: "A", tier: "application" }],
      boundaries: [{ id: "dup", name: "Zone", contains: [] }],
    });

    expect(report.diagnostics.some((d) => d.code === "ir/duplicate-id")).toBe(true);
  });

  it("detects a boundary cycle without hanging", () => {
    const report = validateIr({
      nodes: [],
      boundaries: [
        { id: "b1", name: "One", contains: [], parent_boundary_id: "b2" },
        { id: "b2", name: "Two", contains: [], parent_boundary_id: "b1" },
      ],
    });

    const cycle = report.diagnostics.find((d) => d.code === "ir/boundary-cycle")!;
    expect(cycle.severity).toBe("error");
    expect(cycle.subject.ids.length).toBeGreaterThanOrEqual(2);
  });

  it("reports the same cycle once, not once per member", () => {
    const report = validateIr({
      nodes: [],
      boundaries: [
        { id: "b1", name: "One", contains: [], parent_boundary_id: "b2" },
        { id: "b2", name: "Two", contains: [], parent_boundary_id: "b1" },
      ],
    });

    expect(report.diagnostics.filter((d) => d.code === "ir/boundary-cycle")).toHaveLength(1);
  });

  it("reports a node claimed by two boundaries", () => {
    const report = validateIr({
      nodes: [{ id: "a", name: "Service A", tier: "application" }],
      boundaries: [
        { id: "b1", name: "Zone 1", contains: ["a"] },
        { id: "b2", name: "Zone 2", contains: ["a"] },
      ],
    });

    const found = report.diagnostics.find((d) => d.code === "ir/node-in-two-boundaries")!;
    expect(found.message).toContain("Service A");
  });

  it("passes a clean IR", () => {
    const report = validateIr({
      nodes: [
        { id: "a", name: "A", tier: "application" },
        { id: "b", name: "B", tier: "data" },
      ],
      connections: [{ id: "c1", from: "a", to: "b" }],
    });

    expect(report.errors).toBe(0);
  });

  it("keeps every fix at the IR level", () => {
    const report = validateIr({
      nodes: [{ id: "a", name: "A", tier: "application" }],
      connections: [{ id: "c1", from: "a", to: "ghost" }],
      boundaries: [{ id: "b1", name: "Empty", contains: ["missing"] }],
    });

    assertNoPixelTalk(report.diagnostics);
  });
});

/** Lays a diagram out and returns the engine state for geometric validation. */
function laidOut(input: LayoutInput): LayoutState {
  return layoutDiagram(input).state;
}

describe("geometric validation (stage 2, post-layout)", () => {
  it("passes a well-formed diagram with no errors", () => {
    const state = laidOut({
      nodes: [
        { id: "customer", type: "person", name: "Customer", tier: "external" },
        { id: "api", type: "system", name: "API", tier: "gateway" },
        { id: "db", type: "container", name: "Database", tier: "data" },
      ],
      connections: [
        { id: "c1", from: "customer", to: "api", intent: "call" },
        { id: "c2", from: "api", to: "db", intent: "data-flow" },
      ],
      primaryPath: ["customer", "api", "db"],
    });

    const report = validateGeometry(state);
    expect(report.errors).toBe(0);
  });

  it("flags an empty boundary", () => {
    const state = laidOut({
      nodes: [{ id: "a", type: "system", name: "A", tier: "application" }],
      boundaries: [{ id: "b1", name: "Unused Zone", kind: "trust-zone", contains: [] }],
    });

    const report = validateGeometry(state);
    const found = report.diagnostics.find((d) => d.code === "boundary/empty")!;
    expect(found.severity).toBe("warning");
    expect(found.message).toContain("Unused Zone");
  });

  it("flags an orphan node", () => {
    const state = laidOut({
      nodes: [
        { id: "a", type: "system", name: "Connected", tier: "application" },
        { id: "b", type: "system", name: "Lonely", tier: "data" },
        { id: "c", type: "system", name: "Other", tier: "gateway" },
      ],
      connections: [{ id: "c1", from: "a", to: "c", intent: "call" }],
    });

    const report = validateGeometry(state);
    const found = report.diagnostics.find((d) => d.code === "flow/orphan-node")!;
    expect(found.message).toContain("Lonely");
  });

  it("does not call a cross-cutting service an orphan", () => {
    // Cross-cutting nodes are deliberately unconnected; that is the convention, not a defect.
    const state = laidOut({
      nodes: [
        { id: "a", type: "system", name: "API", tier: "application" },
        { id: "logs", type: "system", name: "CloudWatch", tier: "cross-cutting" },
      ],
    });

    const report = validateGeometry(state);
    const orphans = report.diagnostics.filter((d) => d.code === "flow/orphan-node");
    expect(orphans.every((d) => !d.subject.ids.includes("logs"))).toBe(true);
  });

  it("flags a cross-cutting service nothing points at", () => {
    const state = laidOut({
      nodes: [
        { id: "a", type: "system", name: "API", tier: "application" },
        { id: "logs", type: "system", name: "CloudWatch", tier: "cross-cutting" },
      ],
    });

    const report = validateGeometry(state);
    expect(report.diagnostics.some((d) => d.code === "c4/cross-cutting-no-entry")).toBe(true);
  });

  it("flags a main flow that doubles back", () => {
    const state = laidOut({
      nodes: [
        { id: "db", type: "container", name: "Database", tier: "data" },
        { id: "api", type: "system", name: "API", tier: "gateway" },
      ],
      connections: [{ id: "c1", from: "db", to: "api", intent: "call", isPrimaryPath: true }],
    });

    const report = validateGeometry(state);
    const found = report.diagnostics.find((d) => d.code === "flow/non-monotonic")!;
    expect(found.message).toContain("Database");
    expect(found.evidence?.fromTier).toBe("data");
  });

  it("flags a diagram past the primary-element limit", () => {
    const nodes = Array.from({ length: 15 }, (_, i) => ({
      id: `n${i}`,
      type: "system" as const,
      name: `Service ${i}`,
      tier: "application" as const,
    }));

    const report = validateGeometry(laidOut({ nodes }));
    const found = report.diagnostics.find((d) => d.code === "c4/too-many-primary")!;
    expect(found.evidence?.count).toBe(15);
  });

  it("computes a readability score, lower being better", () => {
    const clean = validateGeometry(
      laidOut({
        nodes: [
          { id: "a", type: "system", name: "A", tier: "external" },
          { id: "b", type: "system", name: "B", tier: "application" },
        ],
        connections: [{ id: "c1", from: "a", to: "b", intent: "call" }],
      }),
    );

    expect(clean.readability.throughVertexRoutes).toBe(0);
    expect(clean.readability.edgeCrossings).toBe(0);
    expect(clean.readability.score).toBeGreaterThan(0); // edge length only
  });

  it("penalises an edge crossing a node far more than edge length", () => {
    // Three nodes in one tier, with the middle one between the endpoints.
    const state = laidOut({
      nodes: [
        { id: "a", type: "system", name: "A", tier: "application" },
        { id: "middle", type: "system", name: "Middle", tier: "application" },
        { id: "c", type: "system", name: "C", tier: "application" },
      ],
      connections: [{ id: "c1", from: "a", to: "c", intent: "call" }],
    });

    const report = validateGeometry(state);
    if (report.readability.throughVertexRoutes > 0) {
      expect(report.readability.score).toBeGreaterThanOrEqual(20);
      expect(report.diagnostics.some((d) => d.code === "edge/crosses-node")).toBe(true);
    }
  });

  it("keeps every geometric fix at the IR level too", () => {
    const nodes = Array.from({ length: 15 }, (_, i) => ({
      id: `n${i}`,
      type: "system" as const,
      name: `Service ${i}`,
      tier: "application" as const,
    }));

    const report = validateGeometry(
      laidOut({
        nodes,
        boundaries: [{ id: "b1", name: "Empty", kind: "trust-zone", contains: [] }],
      }),
    );

    expect(report.diagnostics.length).toBeGreaterThan(0);
    assertNoPixelTalk(report.diagnostics);
  });

  it("names real elements in messages, so the model can act on them", () => {
    const report = validateGeometry(
      laidOut({
        nodes: [
          { id: "n1", type: "system", name: "Payment Gateway", tier: "application" },
          { id: "n2", type: "system", name: "Ledger", tier: "data" },
        ],
      }),
    );

    for (const diagnostic of report.diagnostics) {
      expect(diagnostic.message).not.toMatch(/^undefined/);
      expect(diagnostic.message.length).toBeGreaterThan(10);
    }
  });

  it("runs headless", () => {
    expect(() =>
      validateGeometry(laidOut({ nodes: [{ id: "a", type: "system", name: "A", tier: "data" }] })),
    ).not.toThrow();
  });
});

describe("repair order", () => {
  it("maps codes to categories", () => {
    expect(categoryOf("ir/duplicate-id")).toBe("ir");
    expect(categoryOf("node/overlap")).toBe("node");
    expect(categoryOf("edge/crosses-node")).toBe("edge");
    expect(categoryOf("c4/too-many-primary")).toBe("c4");
    expect(categoryOf("nonsense")).toBe("ir");
  });

  it("puts structural problems before geometric ones", () => {
    const diagnostics: Diagnostic[] = [
      {
        code: "label/collision",
        severity: "warning",
        class: "geometry",
        message: "",
        subject: { kind: "label", ids: [] },
        supportedFixes: [],
      },
      {
        code: "ir/duplicate-id",
        severity: "error",
        class: "ir",
        message: "",
        subject: { kind: "node", ids: [] },
        supportedFixes: [],
      },
      {
        code: "node/overlap",
        severity: "error",
        class: "geometry",
        message: "",
        subject: { kind: "node", ids: [] },
        supportedFixes: [],
      },
    ];

    expect(sortByRepairOrder(diagnostics).map((d) => d.code)).toEqual([
      "ir/duplicate-id",
      "node/overlap",
      "label/collision",
    ]);
  });

  it("puts errors before warnings within a category", () => {
    const diagnostics: Diagnostic[] = [
      {
        code: "node/warn",
        severity: "warning",
        class: "geometry",
        message: "",
        subject: { kind: "node", ids: [] },
        supportedFixes: [],
      },
      {
        code: "node/err",
        severity: "error",
        class: "geometry",
        message: "",
        subject: { kind: "node", ids: [] },
        supportedFixes: [],
      },
    ];

    expect(sortByRepairOrder(diagnostics)[0]!.severity).toBe("error");
  });
});

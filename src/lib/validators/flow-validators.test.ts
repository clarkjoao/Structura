/**
 * Flow and composition validators, exercised the way container and component diagrams hit
 * them: a main flow that doubles back, and a diagram that has outgrown its level.
 *
 * Slice 0 covered these with minimal fixtures. These use realistic shapes, because the
 * interesting failures are the false positives — a validator that fires on a legitimate
 * diagram is worse than one that misses, since it trains the model to ignore diagnostics.
 */

import { describe, it, expect } from "vitest";
import { layoutDiagram, approximateMeasureText, type LayoutInput } from "@/lib/layout-engine";
import { validateGeometry } from "./index";

function report(input: LayoutInput) {
  return validateGeometry(layoutDiagram(input, { measureText: approximateMeasureText }).state);
}

function codes(input: LayoutInput): string[] {
  return report(input).diagnostics.map((d) => d.code);
}

describe("flow/non-monotonic", () => {
  it("stays quiet on a flow that runs forward", () => {
    expect(
      codes({
        nodes: [
          { id: "user", type: "person", name: "User", tier: "external" },
          { id: "web", type: "container", name: "Web", tier: "client" },
          { id: "api", type: "container", name: "API", tier: "gateway" },
          { id: "svc", type: "container", name: "Service", tier: "application" },
          { id: "db", type: "container", name: "Database", tier: "data" },
        ],
        connections: [
          { id: "e1", from: "user", to: "web", intent: "call" },
          { id: "e2", from: "web", to: "api", intent: "call" },
          { id: "e3", from: "api", to: "svc", intent: "call" },
          { id: "e4", from: "svc", to: "db", intent: "data-flow" },
        ],
        primaryPath: ["user", "web", "api", "svc", "db"],
      }),
    ).not.toContain("flow/non-monotonic");
  });

  it("flags a main flow that runs backwards", () => {
    const result = report({
      nodes: [
        { id: "db", type: "container", name: "Database", tier: "data" },
        { id: "svc", type: "container", name: "Service", tier: "application" },
      ],
      connections: [{ id: "e1", from: "db", to: "svc", intent: "call", isPrimaryPath: true }],
    });

    const found = result.diagnostics.find((d) => d.code === "flow/non-monotonic")!;
    expect(found.message).toContain("Database");
    expect(found.message).toContain("Service");
    expect(found.evidence?.fromTier).toBe("data");
    expect(found.evidence?.toTier).toBe("application");
  });

  it("ignores a backwards edge that is NOT on the main flow", () => {
    // A callback, a cache invalidation, an async ack — these legitimately point backwards
    // and must not be reported, or the model learns to distrust the diagnostic.
    expect(
      codes({
        nodes: [
          { id: "api", type: "container", name: "API", tier: "gateway" },
          { id: "svc", type: "container", name: "Service", tier: "application" },
          { id: "cache", type: "container", name: "Cache", tier: "data" },
        ],
        connections: [
          { id: "e1", from: "api", to: "svc", intent: "call" },
          { id: "e2", from: "svc", to: "cache", intent: "data-flow" },
          // Invalidation runs data -> gateway, deliberately not on the primary path.
          { id: "e3", from: "cache", to: "api", intent: "event" },
        ],
        primaryPath: ["api", "svc", "cache"],
      }),
    ).not.toContain("flow/non-monotonic");
  });

  it("allows a main-flow edge within one tier", () => {
    // Two services in the application tier calling each other is forward-ish, not backwards.
    expect(
      codes({
        nodes: [
          { id: "a", type: "container", name: "Service A", tier: "application" },
          { id: "b", type: "container", name: "Service B", tier: "application" },
        ],
        connections: [{ id: "e1", from: "a", to: "b", intent: "call", isPrimaryPath: true }],
      }),
    ).not.toContain("flow/non-monotonic");
  });

  it("offers reversing the edge as a fix, since the direction is often the real error", () => {
    const result = report({
      nodes: [
        { id: "db", type: "container", name: "Database", tier: "data" },
        { id: "svc", type: "container", name: "Service", tier: "application" },
      ],
      connections: [{ id: "e1", from: "db", to: "svc", intent: "call", isPrimaryPath: true }],
    });

    const found = result.diagnostics.find((d) => d.code === "flow/non-monotonic")!;
    expect(found.supportedFixes.map((f) => f.action)).toContain("reverse-edge");
  });
});

describe("c4/too-many-primary", () => {
  it("stays quiet at the limit", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      type: "container" as const,
      name: `Service ${i}`,
      tier: "application" as const,
    }));

    expect(codes({ nodes })).not.toContain("c4/too-many-primary");
  });

  it("fires one past it", () => {
    const nodes = Array.from({ length: 13 }, (_, i) => ({
      id: `n${i}`,
      type: "container" as const,
      name: `Service ${i}`,
      tier: "application" as const,
    }));

    const found = report({ nodes }).diagnostics.find((d) => d.code === "c4/too-many-primary")!;
    expect(found.evidence?.count).toBe(13);
    expect(found.evidence?.limit).toBe(12);
  });

  it("does not count cross-cutting services toward the limit", () => {
    // Ten primary plus six supporting services is a legible diagram, not an overloaded one.
    const nodes = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`,
        type: "container" as const,
        name: `Service ${i}`,
        tier: "application" as const,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `cc${i}`,
        type: "container" as const,
        name: `Support ${i}`,
        tier: "cross-cutting" as const,
      })),
    ];

    expect(codes({ nodes })).not.toContain("c4/too-many-primary");
  });

  it("suggests splitting by level rather than deleting content", () => {
    const nodes = Array.from({ length: 15 }, (_, i) => ({
      id: `n${i}`,
      type: "container" as const,
      name: `Service ${i}`,
      tier: "application" as const,
    }));

    const found = report({ nodes }).diagnostics.find((d) => d.code === "c4/too-many-primary")!;
    const descriptions = found.supportedFixes.map((f) => f.description).join(" ");
    expect(descriptions).toMatch(/split/i);
  });
});

describe("the two together on a realistic container diagram", () => {
  /** A full container diagram: no errors, and neither validator should fire. */
  const containerDiagram: LayoutInput = {
    nodes: [
      { id: "customer", type: "person", name: "Customer", tier: "external" },
      { id: "spa", type: "container", name: "Web SPA", technology: "React", tier: "client" },
      { id: "bff", type: "container", name: "BFF", technology: "Node.js", tier: "gateway" },
      {
        id: "orders",
        type: "container",
        name: "Order Service",
        technology: "Go",
        tier: "application",
      },
      {
        id: "catalog",
        type: "container",
        name: "Catalog Service",
        technology: "Go",
        tier: "application",
      },
      { id: "orderdb", type: "container", name: "Order DB", technology: "Postgres", tier: "data" },
      {
        id: "catalogdb",
        type: "container",
        name: "Catalog DB",
        technology: "Postgres",
        tier: "data",
      },
      { id: "metrics", type: "container", name: "Prometheus", tier: "cross-cutting" },
    ],
    boundaries: [
      {
        id: "shop",
        name: "Shop Platform",
        kind: "system",
        contains: ["spa", "bff", "orders", "catalog", "orderdb", "catalogdb"],
      },
    ],
    connections: [
      { id: "e1", from: "customer", to: "spa", intent: "call", label: "Uses" },
      { id: "e2", from: "spa", to: "bff", intent: "call", label: "REST" },
      { id: "e3", from: "bff", to: "orders", intent: "call" },
      { id: "e4", from: "bff", to: "catalog", intent: "call" },
      { id: "e5", from: "orders", to: "orderdb", intent: "data-flow" },
      { id: "e6", from: "catalog", to: "catalogdb", intent: "data-flow" },
      { id: "e7", from: "orders", to: "metrics", intent: "dependency" },
    ],
    primaryPath: ["customer", "spa", "bff", "orders", "orderdb"],
  };

  it("produces no errors", () => {
    expect(report(containerDiagram).errors).toBe(0);
  });

  it("triggers neither flow nor composition warnings", () => {
    const found = codes(containerDiagram);
    expect(found).not.toContain("flow/non-monotonic");
    expect(found).not.toContain("c4/too-many-primary");
    expect(found).not.toContain("flow/orphan-node");
  });
});

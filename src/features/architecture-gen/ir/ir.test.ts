import { describe, it, expect } from "vitest";
import {
  parseArchitectureIr,
  architectureIrSchema,
  tiersFor,
  toLayoutInput,
  toStructuralInput,
  architectureIrJsonSchema,
  proposeArchitectureParameters,
  type ArchitectureIr,
} from "./index";
import { layoutDiagram } from "@/lib/layout-engine";
import { validateIr } from "@/lib/validators";

const validIr: ArchitectureIr = {
  schema_version: 1,
  diagram_kind: "c4-container",
  meta: {
    title: "Checkout",
    primary_path: ["customer", "api", "orders"],
  },
  nodes: [
    { id: "customer", type: "person", name: "Customer", tier: "external" },
    { id: "api", type: "system", name: "API Gateway", tier: "gateway", technology: "Kong" },
    { id: "orders", type: "container", name: "Order Service", tier: "application" },
  ],
  connections: [
    { id: "c1", from: "customer", to: "api", intent: "call", label: "HTTPS" },
    { id: "c2", from: "api", to: "orders", intent: "call" },
  ],
};

describe("IR schema", () => {
  it("accepts a well-formed IR", () => {
    const result = parseArchitectureIr(validIr);
    expect(result.ok).toBe(true);
  });

  it("carries no geometry fields at all", () => {
    // The model must never be able to express a coordinate; that is the whole design.
    const schema = JSON.stringify(architectureIrJsonSchema());
    for (const banned of ['"x"', '"y"', '"width"', '"height"', '"position"']) {
      expect(schema, `schema must not expose ${banned}`).not.toContain(banned);
    }
  });

  it("rejects unknown geometry passed anyway", () => {
    const result = architectureIrSchema.safeParse({
      ...validIr,
      nodes: [{ ...validIr.nodes[0]!, x: 100, y: 200 }, ...validIr.nodes.slice(1)],
    });

    expect(result.success).toBe(false);
  });

  it("returns field-level issues instead of throwing", () => {
    const result = parseArchitectureIr({ schema_version: 1, diagram_kind: "c4-context" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toHaveProperty("path");
    expect(result.issues[0]).toHaveProperty("message");
  });

  it("requires kebab-case ids and says so", () => {
    const result = parseArchitectureIr({
      ...validIr,
      nodes: [{ ...validIr.nodes[0]!, id: "Not Valid ID" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes("kebab-case"))).toBe(true);
  });

  it("rejects an unknown tier", () => {
    const result = parseArchitectureIr({
      ...validIr,
      nodes: [{ ...validIr.nodes[0]!, tier: "middleware" }],
    });
    expect(result.ok).toBe(false);
  });

  it("requires at least one node", () => {
    expect(parseArchitectureIr({ ...validIr, nodes: [] }).ok).toBe(false);
  });

  it("has no crosses_boundary or is_cross_cutting on connections", () => {
    // The engine derives the first from geometry; the second is a property of the node's
    // tier. Accepting either here would allow contradictory states.
    const schema = JSON.stringify(architectureIrJsonSchema());
    expect(schema).not.toContain("crosses_boundary");
    expect(schema).not.toContain("is_cross_cutting");
  });
});

describe("tier derivation", () => {
  it("derives tiers from the nodes when meta.tiers is absent", () => {
    // Tiers are the union of tiers actually used by nodes, ordered canonically.
    const tiers = tiersFor(validIr);
    expect(tiers).toEqual(["external", "gateway", "application"]);
  });

  it("honours an explicit tier order when meta.tiers is provided", () => {
    const custom = { ...validIr, meta: { ...validIr.meta, tiers: ["external", "data"] as const } };
    expect(tiersFor({ ...custom, meta: { ...custom.meta, tiers: ["external", "data"] } })).toEqual([
      "external",
      "data",
    ]);
  });

  it("includes every tier that appears in any node", () => {
    // A c4-container with "backend" tier but no meta.tiers should still work (A.3).
    const ir = {
      ...validIr,
      nodes: [
        ...validIr.nodes,
        { id: "worker", type: "system", name: "Worker", tier: "backend" as const },
      ],
    };
    const tiers = tiersFor(ir);
    expect(tiers).toContain("backend");
  });
});

describe("adapters", () => {
  it("maps the IR onto layout input without inventing geometry", () => {
    const input = toLayoutInput(validIr);

    expect(input.nodes).toHaveLength(3);
    expect(input.primaryPath).toEqual(["customer", "api", "orders"]);
    // Tiers are derived from the nodes, so they match the fixture's tier list.
    expect(input.tiers).toEqual(["external", "gateway", "application"]);
    for (const node of input.nodes) {
      expect(node).not.toHaveProperty("x");
      expect(node).not.toHaveProperty("y");
    }
  });

  it("feeds the layout engine end to end", () => {
    const result = layoutDiagram(toLayoutInput(validIr));

    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it("projects onto structural validator input", () => {
    const report = validateIr(toStructuralInput(validIr));
    expect(report.errors).toBe(0);
  });

  it("surfaces a bad reference through the structural validators", () => {
    const broken: ArchitectureIr = {
      ...validIr,
      connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" }],
    };

    const report = validateIr(toStructuralInput(broken));
    expect(report.errors).toBeGreaterThan(0);
    expect(report.diagnostics[0]!.code).toBe("ir/unknown-node-ref");
  });

  it("maps snake_case IR fields to the engine's camelCase", () => {
    const withBoundary: ArchitectureIr = {
      ...validIr,
      boundaries: [
        {
          id: "vpc",
          name: "VPC",
          kind: "aws-vpc",
          contains: ["orders"],
          order_index: 2,
        },
      ],
    };

    const input = toLayoutInput(withBoundary);
    expect(input.boundaries?.[0]?.orderIndex).toBe(2);
  });
});

describe("derived tool schema", () => {
  it("emits JSON Schema for the tool surface", () => {
    const schema = proposeArchitectureParameters();

    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["ir"]);
    expect(schema.properties).toHaveProperty("ir");
  });

  it("carries the field descriptions the model reads", () => {
    const schema = JSON.stringify(architectureIrJsonSchema());
    expect(schema).toContain("kebab-case");
    expect(schema).toContain("happy path");
  });

  it("is generated from Zod, not maintained separately", () => {
    // Adding a field to the Zod schema must show up here without another edit.
    expect(JSON.stringify(architectureIrJsonSchema())).toContain("density_hint");
  });
});

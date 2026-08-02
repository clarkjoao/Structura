import { describe, it, expect } from "vitest";
import { ProposalSession, MAX_ROUNDS, STALL_LIMIT } from "./session";
import type { ArchitectureIr } from "./ir";
import { ALL_TOOLS, WRITE_TOOL_NAMES } from "@/features/llm/tools";
import { ARCHITECTURE_TOOLS, isArchitectureTool } from "@/features/llm/tools-architecture";

const cleanIr: ArchitectureIr = {
  schema_version: 1,
  diagram_kind: "c4-container",
  meta: { title: "Checkout", primary_path: ["customer", "api", "db"] },
  nodes: [
    { id: "customer", type: "person", name: "Customer", tier: "external" },
    { id: "api", type: "system", name: "API", tier: "gateway" },
    { id: "db", type: "container", name: "Database", tier: "data" },
  ],
  connections: [
    { id: "c1", from: "customer", to: "api", intent: "call" },
    { id: "c2", from: "api", to: "db", intent: "data-flow" },
  ],
};

describe("propose", () => {
  it("accepts a clean IR and marks it committable", () => {
    const result = new ProposalSession().propose(cleanIr);

    expect(result.status).toBe("ok");
    expect(result.committable).toBe(true);
    expect(result.errors).toBe(0);
  });

  it("returns counts, never coordinates", () => {
    const result = new ProposalSession().propose(cleanIr);

    expect(result.preview).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      boundaryCount: 0,
      tiersUsed: expect.arrayContaining(["external", "gateway", "data"]),
    });
    // The model has no use for geometry, and exposing it invites hand-tuning.
    expect(JSON.stringify(result)).not.toMatch(/"[xy]":/);
  });

  it("does not touch the store — commit is the only mutation", () => {
    const session = new ProposalSession();
    session.propose(cleanIr);
    // Nothing to assert on the store because propose never reaches it; the geometry is
    // held in the session until commit hands it over.
    expect(session.commit()).toBeDefined();
  });

  it("rejects a schema-invalid payload with field-level issues", () => {
    const result = new ProposalSession().propose({ schema_version: 1 });

    expect(result.status).toBe("schema-invalid");
    expect(result.committable).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects an IR carrying coordinates", () => {
    const result = new ProposalSession().propose({
      ...cleanIr,
      nodes: [{ ...cleanIr.nodes[0]!, x: 10, y: 20 }, ...cleanIr.nodes.slice(1)],
    });

    expect(result.status).toBe("schema-invalid");
  });

  it("stops at structural errors before running the engine", () => {
    const result = new ProposalSession().propose({
      ...cleanIr,
      connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" }],
    });

    expect(result.status).toBe("has-errors");
    expect(result.irErrors).toBeGreaterThan(0);
    expect(result.committable).toBe(false);
    expect(result.diagnostics[0]!.code).toBe("ir/unknown-node-ref");
  });

  it("reports warnings but still allows a commit", () => {
    const result = new ProposalSession().propose({
      ...cleanIr,
      nodes: [
        ...cleanIr.nodes,
        { id: "orphan", type: "system", name: "Orphan", tier: "cross-cutting" },
      ],
    });

    expect(result.status).toBe("has-warnings");
    expect(result.committable).toBe(true);
    expect(result.warnings).toBeGreaterThan(0);
  });

  it("accepts a node in any tier without needing to declare meta.tiers", () => {
    // A.3: tiers are now derived from the nodes in the IR, so "backend" in a c4-container
    // no longer requires explicit declaration. The engine will create a "backend" column.
    const result = new ProposalSession().propose({
      ...cleanIr,
      nodes: [...cleanIr.nodes, { id: "worker", type: "system", name: "Worker", tier: "backend" }],
    });

    // No IR errors — the layout engine accepts the tier.
    expect(result.status).not.toBe("schema-invalid");
    expect(result.irErrors).toBe(0);
    expect(result.committable).toBe(true);
  });

  it("accepts that same tier once it is declared in meta.tiers", () => {
    const result = new ProposalSession().propose({
      ...cleanIr,
      meta: {
        ...cleanIr.meta,
        tiers: ["external", "gateway", "application", "backend", "data"],
      },
      nodes: [...cleanIr.nodes, { id: "worker", type: "system", name: "Worker", tier: "backend" }],
    });

    expect(result.status).not.toBe("layout-failed");
  });

  it("reports the readability score alongside diagnostics", () => {
    const result = new ProposalSession().propose(cleanIr);
    expect(result.readabilityScore).toBeGreaterThanOrEqual(0);
  });

  it("keeps every fix in IR terms", () => {
    const result = new ProposalSession().propose({
      ...cleanIr,
      nodes: [
        ...cleanIr.nodes,
        { id: "orphan", type: "system", name: "Orphan", tier: "cross-cutting" },
      ],
    });

    for (const diagnostic of result.diagnostics) {
      for (const fix of diagnostic.supportedFixes) {
        expect(fix.description).not.toMatch(/\b\d+\s*(px|pixels?)\b/i);
      }
    }
  });
});

describe("commitability by diagnostic class", () => {
  it("returns committable=true when only geometry issues are present", () => {
    // An IR with edge/crosses-node but no IR errors is committable.
    // Geometry issues are the engine's responsibility, not the model's.
    const result = new ProposalSession().propose(cleanIr);

    expect(result.committable).toBe(true);
    expect(result.irErrors).toBe(0);
  });

  it("returns committable=false when an IR-class error is present", () => {
    // A reference to a non-existent node is an IR-class error and blocks commit.
    const result = new ProposalSession().propose({
      ...cleanIr,
      connections: [{ id: "c1", from: "customer", to: "ghost-node", intent: "call" as const }],
    });

    expect(result.committable).toBe(false);
    expect(result.irErrors).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.class === "ir")).toBe(true);
  });

  it("accepts any tier without declaring meta.tiers (A.3)", () => {
    // A c4-container with tier "backend" — which is not in c4-container defaults —
    // must succeed without declaring meta.tiers. Tiers are derived from nodes.
    const result = new ProposalSession().propose({
      ...cleanIr,
      nodes: [
        ...cleanIr.nodes,
        { id: "worker", type: "system", name: "Worker", tier: "backend" as const },
      ],
    });

    expect(result.irErrors).toBe(0);
    expect(result.committable).toBe(true);
  });
});

describe("round limits", () => {
  const brokenIr = {
    ...cleanIr,
    connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" as const }],
  };

  it("gives up after MAX_ROUNDS when errors persist", () => {
    const session = new ProposalSession();

    // Each round has a different error count, so the stall rule does not fire first.
    session.propose({
      ...brokenIr,
      connections: [
        { id: "c1", from: "customer", to: "ghost1", intent: "call" as const },
        { id: "c2", from: "customer", to: "ghost2", intent: "call" as const },
        { id: "c3", from: "customer", to: "ghost3", intent: "call" as const },
      ],
    });
    session.refine({
      ...brokenIr,
      connections: [
        { id: "c1", from: "customer", to: "ghost1", intent: "call" as const },
        { id: "c2", from: "customer", to: "ghost2", intent: "call" as const },
      ],
    });
    const third = session.refine(brokenIr);

    expect(third.round).toBe(MAX_ROUNDS);
    expect(third.exhausted?.reason).toBe("max-rounds");
  });

  it("gives up early when rounds stop improving", () => {
    const session = new ProposalSession();

    // Same error count every time: the model is circling, more rounds only cost tokens.
    session.propose(brokenIr);
    session.refine(brokenIr);
    const third = session.refine(brokenIr);

    expect(third.exhausted).toBeDefined();
    expect(["no-improvement", "max-rounds"]).toContain(third.exhausted!.reason);
  });

  it("does not mark a successful round exhausted", () => {
    const session = new ProposalSession();
    session.propose(brokenIr);
    const fixed = session.refine(cleanIr);

    expect(fixed.committable).toBe(true);
    expect(fixed.exhausted).toBeUndefined();
  });

  it("counts rounds across propose and refine alike", () => {
    const session = new ProposalSession();
    expect(session.propose(cleanIr).round).toBe(1);
    expect(session.refine(cleanIr).round).toBe(2);
    expect(session.roundCount).toBe(2);
  });

  it("tolerates STALL_LIMIT non-improving rounds before stopping", () => {
    expect(STALL_LIMIT).toBeLessThanOrEqual(MAX_ROUNDS);
  });
});

describe("commit", () => {
  it("returns the geometry of the last clean proposal", () => {
    const session = new ProposalSession();
    session.propose(cleanIr);

    const committed = session.commit()!;
    expect(committed.nodes).toHaveLength(3);
    expect(committed.edges).toHaveLength(2);
  });

  it("returns nothing when no proposal was clean", () => {
    const session = new ProposalSession();
    session.propose({
      ...cleanIr,
      connections: [{ id: "c1", from: "a", to: "b", intent: "call" }],
    });

    expect(session.commit()).toBeUndefined();
  });

  it("prefers the latest clean proposal after a correction", () => {
    const session = new ProposalSession();
    session.propose(cleanIr);
    session.refine({
      ...cleanIr,
      nodes: [...cleanIr.nodes, { id: "cache", type: "container", name: "Cache", tier: "data" }],
      connections: [
        ...cleanIr.connections!,
        { id: "c3", from: "api", to: "cache", intent: "call" },
      ],
    });

    expect(session.commit()!.nodes).toHaveLength(4);
  });
});

describe("tool surface", () => {
  it("exposes propose, refine and commit", () => {
    expect(ARCHITECTURE_TOOLS.map((tool) => tool.name)).toEqual([
      "propose_architecture",
      "refine_architecture",
      "commit_architecture",
    ]);
  });

  it("puts the architecture tools ahead of the pointwise editors", () => {
    const names = ALL_TOOLS.map((tool) => tool.name);
    expect(names.indexOf("propose_architecture")).toBeLessThan(names.indexOf("add_node"));
  });

  it("no longer accepts a position on add_node", () => {
    const addNode = ALL_TOOLS.find((tool) => tool.name === "add_node")!;
    const properties = (addNode.parametersSchema as { properties: Record<string, unknown> })
      .properties;

    expect(properties).not.toHaveProperty("position");
  });

  it("exposes no coordinate anywhere in the tool surface", () => {
    const serialised = JSON.stringify(ALL_TOOLS);
    expect(serialised).not.toContain('"position"');
    expect(serialised).not.toMatch(/"x":\s*\{/);
    expect(serialised).not.toMatch(/"y":\s*\{/);
  });

  it("treats only commit as a write", () => {
    expect(isArchitectureTool("propose_architecture")).toBe(true);
    expect(WRITE_TOOL_NAMES).toContain("commit_architecture");
    expect(WRITE_TOOL_NAMES).not.toContain("propose_architecture");
    expect(WRITE_TOOL_NAMES).not.toContain("refine_architecture");
  });

  it("keeps read tools and insert_pattern untouched", () => {
    const names = ALL_TOOLS.map((tool) => tool.name);
    for (const kept of [
      "get_diagram_summary",
      "get_node_details",
      "get_project_metadata",
      "get_tags",
      "list_patterns",
      "insert_pattern",
    ]) {
      expect(names, kept).toContain(kept);
    }
  });

  it("tells the model auto_layout is not a fallback", () => {
    const autoLayout = ALL_TOOLS.find((tool) => tool.name === "auto_layout")!;
    expect(autoLayout.description).toMatch(/explicitly asks/i);
    expect(autoLayout.description).toMatch(/not a fallback/i);
  });
});

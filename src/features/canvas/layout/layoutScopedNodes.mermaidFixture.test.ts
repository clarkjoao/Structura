import { describe, expect, it } from "vitest";
import { parseMermaidFlowchart } from "@/features/diagram/utils/import-mermaid-flowchart";
import { parseMermaidSequence } from "@/features/diagram/utils/import-mermaid-sequence";
import { fixture } from "@/lib/export-service/__fixtures__/load";
import type { Component, Connection } from "@/features/diagram";
import type { AppliedLayout } from "./applyLayout";
import { layoutScopedNodes } from "./layoutScopedNodes";

/** Mermaid fixtures (src/lib/export-service/__fixtures__/mermaid) through the import pipeline. */

const origin = { x: 0, y: 0 };
const byName = (cs: Component[], name: string) => cs.find((c) => c.name === name)!;
const record = <T extends { id: string }>(items: T[]) =>
  Object.fromEntries(items.map((i) => [i.id, i])) as Record<string, T>;

describe("mermaid fixtures", () => {
  it("flowchart.mmd: nodes, labels and edges", () => {
    const plan = parseMermaidFlowchart(fixture("mermaid/flowchart.mmd"), {}, {}, origin);
    expect(plan.errors).toEqual([]);
    expect(plan.newComponents.map((c) => c.name).sort()).toEqual([
      "Client",
      "Database",
      "Gateway",
      "Orders",
      "Reject",
    ]);
    expect(plan.newConnections).toHaveLength(4);
    const labels = plan.newConnections.map((c) => c.label).filter(Boolean);
    expect(labels.sort()).toEqual(["no", "yes"]);
    expect(plan.layouts.map((l) => l.elementId).sort()).toEqual(
      plan.newComponents.map((c) => c.id).sort(),
    );
  });

  it("flowchart header direction: TD reads top-to-bottom, LR left-to-right", () => {
    const td = parseMermaidFlowchart(fixture("mermaid/flowchart.mmd"), {}, {}, origin);
    const lr = parseMermaidFlowchart(fixture("mermaid/flowchart-subgraph.mmd"), {}, {}, origin);
    expect(td.direction).toBe("TB");
    expect(lr.direction).toBe("LR");
  });

  it("flowchart-subgraph.mmd: the subgraph becomes a panel holding its nodes", () => {
    const plan = parseMermaidFlowchart(fixture("mermaid/flowchart-subgraph.mmd"), {}, {}, origin);
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    const panel = byName(plan.newComponents, "Backend");
    expect(panel.type).toBe("panel");
    expect(byName(plan.newComponents, "API").parentId).toBe(panel.id);
    expect(byName(plan.newComponents, "Worker").parentId).toBe(panel.id);
    expect(byName(plan.newComponents, "User").parentId).toBeNull();
    expect(plan.newConnections).toHaveLength(2);
  });

  it("sequence.mmd and sequence-box.mmd: participants, calls and the box as a panel", () => {
    const simple = parseMermaidSequence(fixture("mermaid/sequence.mmd"), {}, {}, origin);
    expect(simple.errors).toEqual([]);
    expect(simple.newComponents.map((c) => c.name).sort()).toEqual(["Service", "User"]);
    expect(simple.newConnections.map((c) => c.label)).toEqual(["request"]);

    const boxed = parseMermaidSequence(fixture("mermaid/sequence-box.mmd"), {}, {}, origin);
    expect(boxed.errors).toEqual([]);
    // Calls become connections; the reply ("ok") is a response step on the same connection.
    expect(boxed.newConnections.map((c) => c.label)).toEqual(["save", "insert"]);
    expect(Object.values(boxed.steps).map((s) => s.note)).toEqual(["save", "insert", "ok"]);
    const box = byName(boxed.newComponents, "Backend");
    expect(box.type).toBe("panel");
    expect(byName(boxed.newComponents, "Database").parentId).toBe(box.id);
    expect(byName(boxed.newComponents, "Service").parentId).toBe(box.id);
    expect(byName(boxed.newComponents, "User").parentId).toBeNull();
  });

  it("not-mermaid.mmd is reported, not imported", () => {
    const flow = parseMermaidFlowchart(fixture("mermaid/not-mermaid.mmd"), {}, {}, origin);
    expect(flow.newComponents).toEqual([]);
    expect(flow.errors.length).toBeGreaterThan(0);
    const seq = parseMermaidSequence(fixture("mermaid/not-mermaid.mmd"), {}, {}, origin);
    expect(seq.newComponents).toEqual([]);
    expect(seq.errors.length).toBeGreaterThan(0);
  });
});

describe("scoped layout after a mermaid import", () => {
  // 322f0d25: the Mermaid/flow import's scoped layout read hook values captured before the import
  // wrote its elements, found none of them and silently did nothing. The layout must be handed the
  // components the import just created; given the stale (empty) ones it lays out nothing.
  it("lays out every imported node when given the fresh components, none when given stale ones", async () => {
    const plan = parseMermaidFlowchart(fixture("mermaid/flowchart.mmd"), {}, {}, origin);
    const nodeIds = plan.newComponents.map((c) => c.id);
    const connectionIds = plan.newConnections.map((c) => c.id);
    const nodeLayouts = Object.fromEntries(plan.layouts.map((l) => [l.elementId, l]));
    const applied: AppliedLayout[][] = [];
    const base = {
      nodeIds,
      connectionIds,
      nodeLayouts,
      anchor: origin,
      activeDiagramId: null,
      direction: plan.direction,
      applyAutoLayout: (layouts: AppliedLayout[]) => void applied.push(layouts),
    };

    const stale = await layoutScopedNodes({
      ...base,
      components: {} as Record<string, Component>,
      connections: {} as Record<string, Connection>,
    });
    expect(stale).toBe(false);
    expect(applied).toHaveLength(0);

    const fresh = await layoutScopedNodes({
      ...base,
      components: record(plan.newComponents),
      connections: record(plan.newConnections),
    });
    expect(fresh).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0]!.map((l) => l.elementId).sort()).toEqual([...nodeIds].sort());
  });

  it("sizes a subgraph panel to contain its members after the scoped layout", async () => {
    const plan = parseMermaidFlowchart(fixture("mermaid/flowchart-subgraph.mmd"), {}, {}, origin);
    const applied: AppliedLayout[][] = [];
    const ok = await layoutScopedNodes({
      nodeIds: plan.newComponents.map((c) => c.id),
      connectionIds: plan.newConnections.map((c) => c.id),
      nodeLayouts: Object.fromEntries(plan.layouts.map((l) => [l.elementId, l])),
      anchor: origin,
      activeDiagramId: null,
      direction: plan.direction,
      applyAutoLayout: (layouts: AppliedLayout[]) => void applied.push(layouts),
      components: record(plan.newComponents),
      connections: record(plan.newConnections),
    });
    expect(ok).toBe(true);
    const out = new Map(applied[0]!.map((l) => [l.elementId, l]));
    const panel = out.get(byName(plan.newComponents, "Backend").id)!;
    for (const name of ["API", "Worker"]) {
      const child = out.get(byName(plan.newComponents, name).id)!;
      // Children are positioned relative to the panel.
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + (child.width ?? 0)).toBeLessThanOrEqual(panel.width ?? 0);
      expect(child.y + (child.height ?? 0)).toBeLessThanOrEqual(panel.height ?? 0);
    }
  });
});

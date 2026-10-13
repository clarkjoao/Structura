import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { fixtureDiagram } from "../test-utils/fixture-host";
import {
  createMentionRegistry,
  findMatch,
  MentionProviderRegistry,
  nodesProvider,
  type MentionSearchData,
} from "./providers";

function data(selectionIds: string[] = []): MentionSearchData {
  const components: Record<string, Component> = Object.fromEntries(
    [
      "Order Service",
      "RDS Orders",
      "Order Queue",
      "Payments",
      "Order Cache",
      "Order API",
      "Ordinal",
    ].map((name, index) => [
      `n${index}`,
      {
        id: `n${index}`,
        type: index === 1 ? ("system" as const) : ("container" as const),
        name,
        description: "",
        parentId: null,
      },
    ]),
  );
  const diagram = fixtureDiagram(components, {
    e1: { id: "e1", sourceId: "n0", targetId: "n1", label: "reads orders" },
  });
  diagram.snapshot.flows = {
    f1: {
      id: "f1",
      name: "Order checkout",
      mermaid: "",
      diagramId: diagram.id,
      steps: { s1: { id: "s1", type: "action" }, s2: { id: "s2", type: "action" } },
    },
  };
  return { diagram, selectionIds, translate: (key, params) => i18n.t(key, params) };
}

describe("mention providers", () => {
  it("lists Selection, Nodes, Edges, Flows and Diagram sections for an empty query", () => {
    const sections = createMentionRegistry().search("", data(["n3"]));
    expect(sections.map((section) => section.providerId)).toEqual([
      "selection",
      "nodes",
      "edges",
      "flows",
      "diagram",
    ]);
    expect(sections[0]?.items[0]?.ref).toEqual({
      kind: "selection",
      nodeIds: ["n3"],
      label: "Payments",
    });
  });

  it("filters by label, ranks prefix matches first and highlights the match", () => {
    const nodes = createMentionRegistry()
      .search("ord", data())
      .find((section) => section.providerId === "nodes");
    // Prefix matches first (alphabetical), then the ones that only contain the query.
    expect(nodes?.items.map((item) => item.label)).toEqual([
      "Order API",
      "Order Cache",
      "Order Queue",
      "Order Service",
      "Ordinal",
    ]);
    const rds = nodesProvider.search("ord", data()).find((item) => item.label === "RDS Orders");
    expect(rds?.match).toEqual({ start: 4, end: 7 });
  });

  it("caps each section and reports the total", () => {
    const nodes = createMentionRegistry()
      .search("ord", data())
      .find((section) => section.providerId === "nodes");
    expect(nodes?.items).toHaveLength(5);
    expect(nodes?.total).toBe(6);
  });

  it("matches nodes on their type as well", () => {
    const found = nodesProvider.search("system", data());
    expect(found.map((item) => item.label)).toEqual(["RDS Orders"]);
    expect(found[0]?.match).toBeNull();
  });

  it("describes edges, flows and the diagram with secondary text", () => {
    const sections = createMentionRegistry().search("", data());
    const byId = Object.fromEntries(sections.map((section) => [section.providerId, section]));
    expect(byId.edges?.items[0]).toMatchObject({
      label: "reads orders",
      secondary: "Order Service → RDS Orders",
    });
    expect(byId.flows?.items[0]?.secondary).toBe(
      i18n.t("llmChat.mention.secondary.steps", { count: 2 }),
    );
    expect(byId.diagram?.items[0]?.ref).toMatchObject({ kind: "diagram", id: "fixture" });
  });

  it("skips selected ids that are no longer in the diagram, and has no sections without a diagram", () => {
    expect(createMentionRegistry().search("", data(["gone"]))[0]?.providerId).toBe("nodes");
    const empty = createMentionRegistry().search("", { ...data(), diagram: null });
    expect(empty).toEqual([]);
  });

  it("refuses a duplicate provider", () => {
    const registry = new MentionProviderRegistry();
    registry.register(nodesProvider);
    expect(() => registry.register(nodesProvider)).toThrow(/already registered/);
  });

  it("findMatch is case-insensitive", () => {
    expect(findMatch("Order API", "API")).toEqual({ start: 6, end: 9 });
    expect(findMatch("Order API", "")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { sumWorkspaceStats } from "./workspaceStats";

function stubDiagram(
  overrides: Partial<Diagram> & {
    components?: number;
    connections?: number;
    flows?: number;
  },
): Diagram {
  const { components = 0, connections = 0, flows = 0, ...rest } = overrides;
  const componentEntries = Object.fromEntries(
    Array.from({ length: components }, (_, i) => [`c${i}`, { id: `c${i}`, name: `C${i}` }]),
  );
  const connectionEntries = Object.fromEntries(
    Array.from({ length: connections }, (_, i) => [`e${i}`, { id: `e${i}` }]),
  );
  const flowEntries = Object.fromEntries(
    Array.from({ length: flows }, (_, i) => [`f${i}`, { id: `f${i}`, name: `F${i}`, steps: {} }]),
  );
  return {
    id: rest.id ?? "d1",
    name: rest.name ?? "Diagram",
    level: rest.level ?? "context",
    folderId: rest.folderId ?? null,
    createdAt: rest.createdAt ?? 0,
    updatedAt: rest.updatedAt ?? 0,
    snapshot: {
      components: componentEntries as Diagram["snapshot"]["components"],
      connections: connectionEntries as Diagram["snapshot"]["connections"],
      flows: flowEntries as Diagram["snapshot"]["flows"],
      ...(rest.snapshot ?? {}),
    },
    ...rest,
  } as Diagram;
}

describe("sumWorkspaceStats", () => {
  it("returns zeros for an empty list", () => {
    expect(sumWorkspaceStats([])).toEqual({
      diagramCount: 0,
      componentCount: 0,
      flowCount: 0,
    });
  });

  it("sums diagrams, components, and flows across the list", () => {
    const diagrams = [
      stubDiagram({ id: "a", components: 2, connections: 1, flows: 1 }),
      stubDiagram({ id: "b", components: 3, connections: 0, flows: 2 }),
    ];
    expect(sumWorkspaceStats(diagrams)).toEqual({
      diagramCount: 2,
      componentCount: 5,
      flowCount: 3,
    });
  });
});

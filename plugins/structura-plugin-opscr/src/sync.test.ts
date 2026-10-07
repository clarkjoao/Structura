import { describe, expect, it } from "vitest";
import type { ImporterGraph } from "./generated/opscr-mapping";
import { canvasLayout, emptyBinding, planSync, type BindingState } from "./sync";
import type { DiagramSnapshot, PluginComponentSnapshot } from "./types/plugin.types";

const graph = (
  over: Record<string, Partial<ImporterGraph["components"][number]> | null> = {},
): ImporterGraph => {
  const components: ImporterGraph["components"] = [
    {
      key: "ApplicationService/orders",
      name: "orders",
      type: "panel",
      description: "",
      x: 40,
      y: 40,
      width: 400,
      height: 300,
    },
    {
      key: "Application/api",
      name: "api",
      type: "aws-compute",
      description: "API",
      cloudServiceId: "lambda",
      technology: "Lambda",
      parentKey: "ApplicationService/orders",
      x: 40,
      y: 40,
    },
    {
      key: "Database/db",
      name: "db",
      type: "aws-database",
      description: "",
      cloudServiceId: "dynamodb",
      x: 600,
      y: 40,
    },
  ];
  return {
    components: components
      .filter((c) => over[c.key] !== null)
      .map((c) => ({ ...c, ...(over[c.key] ?? {}) })),
    connections: [{ source: "Application/api", target: "Database/db", label: "writes" }],
  };
};

/** A diagram as applyChanges would have produced it, with ids "id:<key>". */
function diagramFor(
  binding: BindingState,
  g: ImporterGraph,
  edits: (c: PluginComponentSnapshot[]) => void = () => {},
): DiagramSnapshot {
  const components: PluginComponentSnapshot[] = g.components
    .filter((c) => binding.ids[c.key])
    .map((c) => ({
      id: binding.ids[c.key]!,
      type: c.type,
      label: c.name,
      description: c.description,
      parentId: c.parentKey ? binding.ids[c.parentKey]! : null,
      position: { x: c.x, y: c.y },
      size: c.width !== undefined ? { width: c.width, height: c.height! } : null,
      tags: [],
      serviceId: null,
    }));
  edits(components);
  return {
    id: "d",
    name: "d",
    level: "container",
    description: null,
    components,
    connections: Object.values(binding.connections).map((id) => ({
      id,
      sourceId: "",
      targetId: "",
      label: "writes",
      description: null,
      technology: null,
    })),
  } as unknown as DiagramSnapshot;
}

/** Applies a plan the way the host would, minting "id:<key>" ids. */
function apply(g: ImporterGraph, binding: BindingState, diagram: DiagramSnapshot) {
  const plan = planSync(g, binding, diagram);
  const idsByKey = Object.fromEntries((plan.changes.add ?? []).map((c) => [c.key, `id:${c.key}`]));
  const connectionIds = (plan.changes.connect ?? []).map((_, i) => `conn:${i}:${Math.random()}`);
  return { plan, next: plan.commit({ idsByKey, connectionIds }) };
}

describe("planSync", () => {
  it("adds everything on the first sync, parents addressed by key", () => {
    const { plan, next } = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph()));
    expect(plan.changes.add!.map((c) => c.key)).toEqual([
      "ApplicationService/orders",
      "Application/api",
      "Database/db",
    ]);
    expect(plan.changes.add![1]!.parentKey).toBe("ApplicationService/orders");
    expect(plan.changes.connect).toEqual([
      { source: "Application/api", target: "Database/db", label: "writes" },
    ]);
    expect(Object.keys(next.ids)).toHaveLength(3);
  });

  it("does nothing when nothing changed", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const plan = planSync(graph(), first, diagramFor(first, graph()));
    expect(plan.empty).toBe(true);
  });

  it("updates text in place and removes what the YAML dropped", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const edited = graph({ "Application/api": { description: "Orders API" }, "Database/db": null });
    edited.connections = [];
    const plan = planSync(edited, first, diagramFor(first, graph()));
    expect(plan.changes.update).toEqual([
      expect.objectContaining({ id: "id:Application/api", description: "Orders API" }),
    ]);
    expect(plan.changes.remove).toEqual(["id:Database/db"]);
    expect(plan.changes.add).toEqual([]);
  });

  it("re-adds an element the user deleted on the canvas", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const diagram = diagramFor(first, graph(), (cs) =>
      cs.splice(
        cs.findIndex((c) => c.id === "id:Database/db"),
        1,
      ),
    );
    const plan = planSync(graph(), first, diagram);
    expect(plan.changes.add!.map((c) => c.key)).toEqual(["Database/db"]);
    expect(plan.changes.connect).toEqual([
      { source: "id:Application/api", target: "Database/db", label: "writes" },
    ]);
  });

  it("re-adds an element whose type changed, with its descendants", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const plan = planSync(
      graph({ "ApplicationService/orders": { type: "container" } }),
      first,
      diagramFor(first, graph()),
    );
    expect(plan.changes.remove!.sort()).toEqual([
      "id:Application/api",
      "id:ApplicationService/orders",
    ]);
    expect(plan.changes.add!.map((c) => c.key)).toEqual([
      "ApplicationService/orders",
      "Application/api",
    ]);
  });

  it("grows a panel the stable layout enlarged, at its current position", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const diagram = diagramFor(first, graph(), (cs) => (cs[0]!.position = { x: 7, y: 9 }));
    const plan = planSync(
      graph({ "ApplicationService/orders": { width: 500, height: 300 } }),
      first,
      diagram,
    );
    expect(plan.changes.move).toEqual([
      { id: "id:ApplicationService/orders", x: 7, y: 9, width: 500, height: 300 },
    ]);
  });
});

describe("canvasLayout", () => {
  it("reads the boxes of the elements the binding created, as the canvas has them", () => {
    const first = apply(graph(), emptyBinding(), diagramFor(emptyBinding(), graph())).next;
    const diagram = diagramFor(first, graph(), (cs) => (cs[2]!.position = { x: 999, y: 5 }));
    const { boxes } = canvasLayout(first, diagram);
    expect(boxes.get("Database/db")).toEqual({ x: 999, y: 5, width: 180, height: 80 });
    expect(boxes.get("ApplicationService/orders")).toMatchObject({ width: 400, height: 300 });
  });
});

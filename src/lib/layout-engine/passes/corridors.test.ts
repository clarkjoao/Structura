import { describe, it, expect } from "vitest";
import { layoutDiagram, approximateMeasureText, type LayoutInput } from "../index";
import { validateGeometry } from "@/lib/validators";

function run(input: LayoutInput) {
  return layoutDiagram(input, { measureText: approximateMeasureText });
}

/** The hexagonal shape: one node per column across four columns, with a skip edge. */
const hexagonal: LayoutInput = {
  nodes: [
    { id: "rest", type: "component", name: "REST Adapter", tier: "gateway" },
    { id: "domain", type: "component", name: "Domain", tier: "application" },
    { id: "carrier", type: "component", name: "Carrier Adapter", tier: "backend" },
    { id: "persistence", type: "component", name: "Persistence Adapter", tier: "data" },
  ],
  connections: [
    { id: "c1", from: "rest", to: "domain", intent: "call" },
    { id: "c2", from: "domain", to: "carrier", intent: "call" },
    // Skips the backend column, so without a corridor it runs through Carrier Adapter.
    { id: "c3", from: "domain", to: "persistence", intent: "data-flow" },
  ],
};

describe("routing corridors", () => {
  it("stops a skip edge running through the node in between", () => {
    const report = validateGeometry(run(hexagonal).state);
    expect(report.diagnostics.map((d) => d.code)).not.toContain("edge/crosses-node");
  });

  it("moves the blocker off the shared centre line", () => {
    const { state } = run(hexagonal);
    const domain = state.nodes.get("domain")!;
    const carrier = state.nodes.get("carrier")!;

    // Every column held one node, so all three centres coincided before this pass.
    const centre = (n: typeof domain) => n.y + n.height / 2;
    expect(centre(carrier)).not.toBe(centre(domain));
  });

  it("moves the blocker, never an endpoint", () => {
    // Moving an endpoint would change which row the reader associates it with, so the two
    // ends of the skip edge must stay on the line the rest of the flow sits on, and only
    // the node in between leaves it.
    const { state } = run(hexagonal);
    const centre = (id: string) => {
      const node = state.nodes.get(id)!;
      return node.y + node.height / 2;
    };

    expect(centre("domain")).toBe(centre("rest"));
    expect(centre("persistence")).toBe(centre("domain"));
    expect(centre("carrier")).toBeLessThan(centre("domain"));
  });

  it("leaves diagrams without skip edges untouched", () => {
    const straight: LayoutInput = {
      nodes: [
        { id: "a", type: "container", name: "A", tier: "gateway" },
        { id: "b", type: "container", name: "B", tier: "application" },
        { id: "c", type: "container", name: "C", tier: "data" },
      ],
      connections: [
        { id: "c1", from: "a", to: "b", intent: "call" },
        { id: "c2", from: "b", to: "c", intent: "call" },
      ],
    };

    const { state } = run(straight);
    const ys = [...state.nodes.values()].map((n) => n.y + n.height / 2);
    // A clean chain keeps its shared centre line.
    expect(new Set(ys).size).toBe(1);
  });

  it("does not disturb a column holding several nodes", () => {
    // A node placed relative to siblings must not be nudged out of that arrangement.
    const { state } = run({
      nodes: [
        { id: "src", type: "container", name: "Source", tier: "gateway" },
        { id: "mid1", type: "container", name: "Mid One", tier: "application" },
        { id: "mid2", type: "container", name: "Mid Two", tier: "application" },
        { id: "dst", type: "container", name: "Dest", tier: "data" },
      ],
      connections: [{ id: "c1", from: "src", to: "dst", intent: "call" }],
    });

    const mid1 = state.nodes.get("mid1")!;
    const mid2 = state.nodes.get("mid2")!;
    expect(mid1.y).not.toBe(mid2.y);
  });

  it("ignores the cross-cutting band, which has its own convention", () => {
    const { state } = run({
      nodes: [
        { id: "a", type: "container", name: "A", tier: "gateway" },
        { id: "b", type: "container", name: "B", tier: "application" },
        { id: "c", type: "container", name: "C", tier: "data" },
        { id: "logs", type: "container", name: "Logs", tier: "cross-cutting" },
      ],
      connections: [
        { id: "c1", from: "a", to: "c", intent: "call" },
        { id: "c2", from: "c", to: "logs", intent: "dependency" },
      ],
    });

    // The band still sits below everything.
    const logs = state.nodes.get("logs")!;
    for (const id of ["a", "b", "c"]) {
      expect(logs.y).toBeGreaterThan(state.nodes.get(id)!.y);
    }
  });

  it("keeps the result deterministic", () => {
    const first = run(hexagonal);
    const second = run(hexagonal);
    expect(second.nodes.map((n) => [n.id, n.position])).toEqual(
      first.nodes.map((n) => [n.id, n.position]),
    );
  });

  it("leaves no overlaps behind", () => {
    const { state } = run(hexagonal);
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
        expect(overlaps, `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it("keeps everything on canvas", () => {
    // The nudge moves a node upward, which could push the diagram above the origin.
    const { state } = run(hexagonal);
    for (const node of state.nodes.values()) {
      expect(node.y, node.name).toBeGreaterThanOrEqual(0);
    }
  });
});

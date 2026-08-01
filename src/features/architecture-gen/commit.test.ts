import { describe, it, expect, beforeEach } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { ArchitectureToolExecutor } from "./execute";
import { toStorePayload } from "./commit";
import { ProposalSession } from "./session";
import type { ArchitectureIr } from "./ir";

const ir: ArchitectureIr = {
  schema_version: 1,
  diagram_kind: "c4-container",
  meta: { title: "Checkout", primary_path: ["customer", "api", "db"] },
  nodes: [
    { id: "customer", type: "person", name: "Customer", tier: "external" },
    { id: "api", type: "container", name: "API", technology: "Kong", tier: "gateway" },
    { id: "db", type: "container", name: "Database", technology: "Postgres", tier: "data" },
  ],
  connections: [
    { id: "c1", from: "customer", to: "api", intent: "call", label: "HTTPS" },
    { id: "c2", from: "api", to: "db", intent: "data-flow" },
  ],
};

const withBoundary: ArchitectureIr = {
  ...ir,
  boundaries: [{ id: "vpc", name: "Production VPC", kind: "aws-vpc", contains: ["api", "db"] }],
};

/** Isolated store per test, so commits cannot leak between cases. */
let store: ReturnType<typeof createTestDiagramStore>;
let diagramId: string;

/** Executor bound to the test store rather than the app singleton. */
function makeExecutor(): ArchitectureToolExecutor {
  return new ArchitectureToolExecutor((payload) => store.getState().applyArchitecture(payload));
}

function activeDiagram() {
  return store.getState().diagrams[diagramId];
}

function componentCount(): number {
  return Object.keys(activeDiagram()?.snapshot.components ?? {}).length;
}

beforeEach(() => {
  store = createTestDiagramStore();
  diagramId = store.getState().addDiagram("Test diagram", "context").id;
  store.getState().openDiagram(diagramId);
});

describe("toStorePayload", () => {
  it("carries the engine's geometry through unchanged", () => {
    const layout = new ProposalSession().propose(ir);
    expect(layout.status).toBe("ok");

    const session = new ProposalSession();
    session.propose(ir);
    const state = session.commit()!.state;
    const payload = toStorePayload(state);

    for (const node of payload.nodes) {
      const original = state.nodes.get(node.irId) ?? state.boundaries.get(node.irId)!;
      expect(node.x).toBe(original.x);
      expect(node.y).toBe(original.y);
      expect(node.width).toBe(original.width);
      expect(node.height).toBe(original.height);
    }
  });

  it("emits boundaries before the nodes that name them", () => {
    const session = new ProposalSession();
    session.propose(withBoundary);
    const payload = toStorePayload(session.commit()!.state);

    const boundaryIndex = payload.nodes.findIndex((node) => node.irId === "vpc");
    const memberIndex = payload.nodes.findIndex((node) => node.irId === "api");

    expect(boundaryIndex).toBeGreaterThanOrEqual(0);
    expect(boundaryIndex).toBeLessThan(memberIndex);
  });
});

describe("commit_architecture reaches the store", () => {
  it("applies a proposed diagram to the canvas", () => {
    const executor = makeExecutor();
    const before = componentCount();

    const proposed = executor.execute("propose_architecture", { ir });
    expect(proposed.ok).toBe(true);
    // Proposing must not have touched anything.
    expect(componentCount()).toBe(before);

    const committed = executor.execute("commit_architecture", {});
    expect(committed.ok).toBe(true);
    expect(componentCount()).toBe(before + 3);
  });

  it("writes the engine's positions, not defaults", () => {
    const executor = makeExecutor();
    executor.execute("propose_architecture", { ir });
    executor.execute("commit_architecture", {});

    const layouts = Object.values(activeDiagram()!.nodeLayouts);
    expect(layouts.length).toBeGreaterThanOrEqual(3);

    // Distinct x positions: the nodes were placed in tier columns, not stacked at an origin.
    const xs = new Set(layouts.map((layout) => layout.x));
    expect(xs.size).toBeGreaterThan(1);

    // Every node carries a measured size.
    for (const layout of layouts) {
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBeGreaterThan(0);
    }
  });

  it("creates the connections too", () => {
    const executor = makeExecutor();
    executor.execute("propose_architecture", { ir });
    const result = executor.execute("commit_architecture", {});

    expect(result.applied?.connectionCount).toBe(2);
    expect(Object.keys(activeDiagram()!.snapshot.connections)).toHaveLength(2);
  });

  it("parents members to their boundary", () => {
    const executor = makeExecutor();
    executor.execute("propose_architecture", { ir: withBoundary });
    executor.execute("commit_architecture", {});

    const components = Object.values(activeDiagram()!.snapshot.components);
    const panel = components.find((component) => component.type === "panel")!;
    const api = components.find((component) => component.name === "API")!;

    expect(panel).toBeDefined();
    expect(api.parentId).toBe(panel.id);
  });

  it("is one undo, not one per node", () => {
    const executor = makeExecutor();
    const before = componentCount();

    executor.execute("propose_architecture", { ir });
    executor.execute("commit_architecture", {});
    expect(componentCount()).toBe(before + 3);

    // A single history entry for the whole diagram: the user undoes "the assistant drew
    // this", not three separate additions.
    store.getState().undo();
    expect(componentCount()).toBe(before);
  });

  it("refuses to commit when nothing passed validation", () => {
    const executor = makeExecutor();
    const before = componentCount();

    executor.execute("propose_architecture", {
      ir: { ...ir, connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" }] },
    });
    const committed = executor.execute("commit_architecture", {});

    expect(committed.ok).toBe(false);
    expect(committed.summary).toContain("propose_architecture first");
    expect(componentCount()).toBe(before);
  });

  it("commits the corrected proposal after a refine", () => {
    const executor = makeExecutor();
    const before = componentCount();

    executor.execute("propose_architecture", {
      ir: { ...ir, connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" }] },
    });
    const refined = executor.execute("refine_architecture", { ir });
    expect(refined.ok).toBe(true);

    executor.execute("commit_architecture", {});
    expect(componentCount()).toBe(before + 3);
  });

  it("tells the model what to do next", () => {
    const executor = makeExecutor();

    const clean = executor.execute("propose_architecture", { ir });
    expect(clean.summary).toContain("commit_architecture");

    const broken = makeExecutor().execute("propose_architecture", {
      ir: { ...ir, connections: [{ id: "c1", from: "customer", to: "ghost", intent: "call" }] },
    });
    expect(broken.summary).toContain("refine_architecture");
    expect(broken.summary).toContain("ghost");
  });

  it("reports an unknown tool rather than throwing", () => {
    const result = makeExecutor().execute("not_a_tool", {});
    expect(result.ok).toBe(false);
  });

  it("starts clean after reset", () => {
    const executor = makeExecutor();
    executor.execute("propose_architecture", { ir });
    executor.reset();

    const committed = executor.execute("commit_architecture", {});
    expect(committed.ok).toBe(false);
  });
});

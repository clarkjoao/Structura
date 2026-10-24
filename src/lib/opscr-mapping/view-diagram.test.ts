import { describe, expect, it } from "vitest";
import { buildViewDiagram, type ResolvedViewInput } from "./view-diagram";
import { toImporterGraph } from "./importer-graph";
import { placeView, toLayoutGraph } from "./layout";
import {
  layoutFor,
  parseLayoutFiles,
  serializeLayoutFile,
  serializeLayoutFiles,
  updateLayoutFile,
} from "./layout-file";
import type { OpscrWorkspaceInput } from "./types";

const m = (kind: string, name: string, spec: Record<string, unknown> = {}) => ({
  kind,
  metadata: { name },
  spec,
});

const workspace: OpscrWorkspaceInput = {
  manifests: [
    m("BoundedContext", "shop", { description: "The shop" }),
    m("Person", "customer", { description: "Buys things" }),
    m("Application", "web", { provider: "ECS", description: "Pages" }),
    m("Component", "cart", { technology: "NestJS", description: "Cart rules" }),
    m("DeploymentNode", "priv", { type: "privateSubnet" }),
    m("DeploymentNode", "az", { type: "availabilityZone" }),
  ],
};

const context: ResolvedViewInput = {
  name: "ctx",
  type: "SystemContext",
  scope: "BoundedContext/shop",
  nodes: [
    { id: "BoundedContext/shop", kind: "BoundedContext", name: "shop", parent: null, collapsed: true, drillDown: "containers" },
    { id: "Person/customer", kind: "Person", name: "customer", parent: null, collapsed: false },
  ],
  edges: [{ from: "Person/customer", to: "BoundedContext/shop", type: "calls", descriptions: ["Orders", "Browses"] }],
};

describe("buildViewDiagram", () => {
  it("draws a collapsed system as a system box and a person as a person", () => {
    const view = buildViewDiagram(workspace, context);
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    expect(byId.get("BoundedContext/shop")).toMatchObject({
      element: { type: "system" },
      isBoundary: false,
      drillDown: "containers",
    });
    expect(byId.get("Person/customer")?.element).toEqual({ type: "person" });
    expect(view.edges).toEqual([
      { id: "ctx:Person/customer|BoundedContext/shop|calls", sourceId: "Person/customer", targetId: "BoundedContext/shop", type: "calls", description: "Orders; Browses" },
    ]);
  });

  it("draws the scope as a panel when it holds boxes", () => {
    const view = buildViewDiagram(workspace, {
      name: "containers",
      type: "Container",
      scope: "BoundedContext/shop",
      nodes: [
        { id: "BoundedContext/shop", kind: "BoundedContext", name: "shop", parent: null, collapsed: false },
        { id: "Application/web", kind: "Application", name: "web", parent: "BoundedContext/shop", collapsed: false },
      ],
      edges: [],
    });
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    expect(byId.get("BoundedContext/shop")).toMatchObject({ element: { type: "panel" }, isBoundary: true });
    expect(byId.get("Application/web")).toMatchObject({
      parentId: "BoundedContext/shop",
      element: { type: "aws-compute", catalogServiceId: "ecs" },
    });
  });

  it("lists a parent before its children, whatever order opscr sent", () => {
    const view = buildViewDiagram(workspace, {
      name: "containers",
      type: "Container",
      scope: "BoundedContext/shop",
      nodes: [
        { id: "Application/web", kind: "Application", name: "web", parent: "BoundedContext/shop", collapsed: false },
        { id: "BoundedContext/shop", kind: "BoundedContext", name: "shop", parent: null, collapsed: false },
      ],
      edges: [],
    });
    expect(view.nodes.map((n) => n.id)).toEqual(["BoundedContext/shop", "Application/web"]);
  });

  it("maps deployment nodes to panel kinds and components to components", () => {
    const view = buildViewDiagram(workspace, {
      name: "prod",
      type: "Deployment",
      scope: "BoundedContext/shop",
      nodes: [
        { id: "DeploymentNode/az", kind: "DeploymentNode", name: "az", parent: null, collapsed: false },
        { id: "DeploymentNode/priv", kind: "DeploymentNode", name: "priv", parent: "DeploymentNode/az", collapsed: false },
        { id: "Component/cart", kind: "Component", name: "cart", parent: "DeploymentNode/priv", collapsed: false },
      ],
      edges: [],
    });
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    expect(byId.get("DeploymentNode/az")?.element).toEqual({ type: "panel", panelKind: "availability-zone" });
    expect(byId.get("DeploymentNode/priv")?.element).toEqual({ type: "panel", panelKind: "private-subnet" });
    expect(byId.get("Component/cart")?.element).toEqual({ type: "component", technology: "NestJS" });
  });

  it("skips boxes and lines whose manifest is not in the workspace", () => {
    const view = buildViewDiagram(workspace, {
      ...context,
      nodes: [...context.nodes, { id: "Person/ghost", kind: "Person", name: "ghost", parent: null, collapsed: false }],
      edges: [...context.edges, { from: "Person/ghost", to: "BoundedContext/shop", type: "calls", descriptions: [] }],
    });
    expect(view.nodes.map((n) => n.id)).not.toContain("Person/ghost");
    expect(view.edges).toHaveLength(1);
  });

  it("goes through layout and the importer graph, carrying panel kind and the linked view", () => {
    const view = buildViewDiagram(workspace, context);
    const graph = toLayoutGraph(view);
    const boxes = new Map(graph.nodes.map((n, i) => [n.id, { x: i * 300, y: 0, width: n.width, height: n.height }]));
    const out = toImporterGraph(placeView(view, { boxes, edgeRoutes: new Map() }));
    expect(out.components.find((c) => c.key === "BoundedContext/shop")).toMatchObject({ type: "system", linkedView: "containers" });
    expect(out.connections).toEqual([{ source: "Person/customer", target: "BoundedContext/shop", label: "calls" }]);
  });
});

describe("layout sidecar version 2", () => {
  const box = { x: 10.4, y: 20, width: 180, height: 80 };

  it("keeps one set of boxes per view and round-trips", () => {
    const text = serializeLayoutFiles(
      new Map([
        ["b", new Map([["Application/web", box]])],
        ["a", new Map([["Application/web", { ...box, x: 99 }]])],
      ]),
    );
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    const parsed = parseLayoutFiles(text)!;
    expect(parsed.base).toBeNull();
    expect(parsed.views.get("a")!.boxes.get("Application/web")).toEqual({ x: 99, y: 20, width: 180, height: 80 });
    expect(parsed.views.get("b")!.boxes.get("Application/web")).toEqual({ x: 10, y: 20, width: 180, height: 80 });
    expect(serializeLayoutFiles(new Map([...parsed.views].map(([k, v]) => [k, v.boxes])))).toBe(text);
  });

  it("reads a version 1 file as the default diagram's layout", () => {
    const v1 = serializeLayoutFile(new Map([["Application/web", box]]));
    const parsed = parseLayoutFiles(v1)!;
    expect(parsed.base!.boxes.get("Application/web")).toEqual({ x: 10, y: 20, width: 180, height: 80 });
    expect(parsed.views.size).toBe(0);
  });

  it("returns null for an unreadable file", () => {
    expect(parseLayoutFiles("{not json")).toBeNull();
  });

  it("keeps the default diagram's boxes beside the views", () => {
    const text = serializeLayoutFiles(new Map([["a", new Map([["Application/web", box]])]]), new Map([["Domain/d", box]]));
    const parsed = parseLayoutFiles(text)!;
    expect(parsed.base!.boxes.get("Domain/d")).toBeDefined();
    expect(parsed.views.get("a")!.boxes.size).toBe(1);
    expect(layoutFor(text, undefined)!.boxes.get("Domain/d")).toBeDefined();
    expect(layoutFor(text, "a")!.boxes.get("Application/web")).toBeDefined();
    expect(layoutFor(text, "missing")).toBeNull();
  });
});

describe("updateLayoutFile", () => {
  const box = { x: 1, y: 2, width: 180, height: 80 };
  const boxes = (key: string) => new Map([[key, box]]);

  it("stays a version 1 file while there are no views", () => {
    expect(updateLayoutFile(undefined, undefined, boxes("A/a"))).toBe(serializeLayoutFile(boxes("A/a")));
  });

  it("adds a view without losing the default diagram's boxes", () => {
    const v1 = serializeLayoutFile(boxes("A/a"));
    const next = updateLayoutFile(v1, "ctx", boxes("B/b"));
    expect(layoutFor(next, undefined)!.boxes.has("A/a")).toBe(true);
    expect(layoutFor(next, "ctx")!.boxes.has("B/b")).toBe(true);
  });

  it("rewriting the default diagram keeps the views", () => {
    const withView = updateLayoutFile(serializeLayoutFile(boxes("A/a")), "ctx", boxes("B/b"));
    const next = updateLayoutFile(withView, undefined, boxes("C/c"));
    expect(layoutFor(next, undefined)!.boxes.has("C/c")).toBe(true);
    expect(layoutFor(next, undefined)!.boxes.has("A/a")).toBe(false);
    expect(layoutFor(next, "ctx")!.boxes.has("B/b")).toBe(true);
  });

  it("rewriting one view keeps the others", () => {
    const two = updateLayoutFile(updateLayoutFile(undefined, "a", boxes("A/a")), "b", boxes("B/b"));
    const next = updateLayoutFile(two, "a", boxes("C/c"));
    expect(layoutFor(next, "a")!.boxes.has("C/c")).toBe(true);
    expect(layoutFor(next, "b")!.boxes.has("B/b")).toBe(true);
  });
});

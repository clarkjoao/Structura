import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTechnicalView } from "./technical-view";
import type { OpscrManifestInput, OpscrWorkspaceInput } from "./types";

const m = (kind: string, name: string, spec: Record<string, unknown> = {}): OpscrManifestInput => ({
  kind,
  metadata: { name },
  spec,
});

type End = [kind: string, id: string];
const edge = (from: End, type: string, to: End, description?: string) => ({
  from: { kind: from[0], id: from[1] },
  to: { kind: to[0], id: to[1] },
  type,
  ...(description ? { description } : {}),
});

const relationship = (name: string, ...edges: ReturnType<typeof edge>[]) =>
  m("Relationship", name, { edges });

const view = (...manifests: OpscrManifestInput[]) => buildTechnicalView({ manifests });
const parentOf = (v: ReturnType<typeof view>, id: string) =>
  v.nodes.find((n) => n.id === id)?.parentId;

describe("buildTechnicalView", () => {
  it("identifies elements by Kind/name, the same on every projection", () => {
    const manifests = [m("Database", "orders-db", { provider: "DynamoDB" })];
    expect(view(...manifests).nodes.map((n) => n.id)).toEqual(["Database/orders-db"]);
    expect(view(...manifests)).toEqual(view(...manifests));
  });

  it("nests an Application in its bounded context instead of drawing belongsTo", () => {
    const v = view(
      m("ApplicationService", "orders"),
      m("Application", "orders-api", { provider: "Lambda" }),
      relationship(
        "r",
        edge(["Application", "orders-api"], "belongsTo", ["ApplicationService", "orders"]),
      ),
    );
    expect(parentOf(v, "Application/orders-api")).toBe("ApplicationService/orders");
    expect(v.edges).toEqual([]);
  });

  it("nests a bounded context in the Domain of its Subdomain, without drawing the Subdomain", () => {
    const v = view(
      m("Domain", "commerce"),
      m("Subdomain", "ordering"),
      m("ApplicationService", "orders"),
      relationship(
        "r",
        edge(["ApplicationService", "orders"], "belongsTo", ["Subdomain", "ordering"]),
        edge(["Subdomain", "ordering"], "belongsTo", ["Domain", "commerce"]),
      ),
    );
    expect(parentOf(v, "ApplicationService/orders")).toBe("Domain/commerce");
    expect(v.nodes.map((n) => n.id)).not.toContain("Subdomain/ordering");
    expect(v.omitted).toEqual([{ kind: "Subdomain", name: "ordering" }]);
  });

  it("keeps an empty bounded context as a boundary", () => {
    const [node] = view(m("ApplicationService", "orders")).nodes;
    expect(node).toMatchObject({ isBoundary: true, parentId: null, element: { type: "panel" } });
  });

  it("lists business and organization Kinds as omitted, and never draws Relationships", () => {
    const v = view(
      m("BusinessCapability", "order-fulfillment"),
      m("Squad", "checkout"),
      relationship("r"),
    );
    expect(v.nodes).toEqual([]);
    expect(v.omitted).toEqual([
      { kind: "BusinessCapability", name: "order-fulfillment" },
      { kind: "Squad", name: "checkout" },
    ]);
  });

  it("draws a flow edge in its opscr direction, with its type", () => {
    const v = view(
      m("Application", "orders-api"),
      m("Database", "orders-db"),
      relationship(
        "orders",
        edge(
          ["Application", "orders-api"],
          "writes",
          ["Database", "orders-db"],
          "Creates the order",
        ),
      ),
    );
    expect(v.edges).toEqual([
      {
        id: "orders#0",
        sourceId: "Application/orders-api",
        targetId: "Database/orders-db",
        type: "writes",
        description: "Creates the order",
      },
    ]);
  });

  it("drops and reports an edge to a Kind that is not drawn", () => {
    const v = view(
      m("BusinessRule", "order-integrity"),
      m("Application", "orders-api"),
      relationship(
        "r",
        edge(["BusinessRule", "order-integrity"], "appliesTo", ["Application", "orders-api"]),
      ),
    );
    expect(v.edges).toEqual([]);
    expect(v.dropped).toEqual([
      {
        relationship: "r",
        index: 0,
        from: "BusinessRule/order-integrity",
        to: "Application/orders-api",
        type: "appliesTo",
        reason: "not-drawn",
      },
    ]);
  });

  it("drops and reports an edge to a manifest that does not exist", () => {
    const v = view(
      m("Application", "orders-api"),
      relationship("r", edge(["Application", "orders-api"], "writes", ["Database", "ghost"])),
    );
    expect(v.edges).toEqual([]);
    expect(v.dropped.map((d) => d.reason)).toEqual(["missing"]);
  });

  it("keeps the first parent and reports a second one", () => {
    const v = view(
      m("ApplicationService", "a"),
      m("ApplicationService", "b"),
      m("Application", "api"),
      relationship(
        "r",
        edge(["Application", "api"], "belongsTo", ["ApplicationService", "a"]),
        edge(["Application", "api"], "belongsTo", ["ApplicationService", "b"]),
      ),
    );
    expect(parentOf(v, "Application/api")).toBe("ApplicationService/a");
    expect(v.dropped.map((d) => [d.index, d.reason])).toEqual([[1, "second-parent"]]);
  });

  it("breaks a containment cycle so no element is its own ancestor", () => {
    const v = view(
      m("ApplicationService", "a"),
      m("Domain", "x"),
      relationship(
        "r",
        edge(["ApplicationService", "a"], "belongsTo", ["Domain", "x"]),
        edge(["Domain", "x"], "belongsTo", ["ApplicationService", "a"]),
      ),
    );
    const byId = new Map(v.nodes.map((n) => [n.id, n]));
    for (const node of v.nodes) {
      const seen = new Set([node.id]);
      for (let p = node.parentId; p; p = byId.get(p)?.parentId ?? null) {
        expect(seen.has(p), `${node.id} is its own ancestor`).toBe(false);
        seen.add(p);
      }
    }
    expect(v.dropped.map((d) => d.reason)).toEqual(["cycle"]);
  });

  it("ignores malformed edges and specs instead of throwing", () => {
    expect(() =>
      view(
        m("Relationship", "bad", {
          edges: [null, 1, { from: "x" }, { from: {}, to: {}, type: 3 }],
        }),
        m("Relationship", "worse", { edges: "nope" }),
        m("Database", "db", { provider: ["x"] }),
      ),
    ).not.toThrow();
  });
});

describe("the opscr sample", () => {
  const sample = JSON.parse(
    readFileSync(`${__dirname}/__fixtures__/sample.workspace.json`, "utf8"),
  ) as OpscrWorkspaceInput;
  const v = buildTechnicalView(sample);
  const children = (id: string) =>
    v.nodes
      .filter((n) => n.parentId === id)
      .map((n) => n.id)
      .sort();

  it("draws the two domains with their bounded contexts and applications", () => {
    expect(
      v.nodes
        .filter((n) => n.parentId === null && n.kind === "Domain")
        .map((n) => n.id)
        .sort(),
    ).toEqual(["Domain/commerce", "Domain/finance"]);
    expect(children("Domain/commerce")).toEqual([
      "ApplicationService/catalog",
      "ApplicationService/orders",
    ]);
    expect(children("Domain/finance")).toEqual(["ApplicationService/payments"]);
    expect(children("ApplicationService/orders")).toEqual([
      "Application/order-tracker",
      "Application/orders-api",
    ]);
  });

  it("maps the sample's providers to catalog services", () => {
    const element = (id: string) => v.nodes.find((n) => n.id === id)?.element;
    expect(element("Database/orders-db")).toMatchObject({
      type: "aws-database",
      cloudServiceId: "dynamodb",
    });
    expect(element("Queue/payment-requests")).toMatchObject({
      type: "aws-integration",
      cloudServiceId: "sqs",
    });
  });

  it("draws every flow edge between drawn elements and accounts for every other edge", () => {
    const relationshipEdges = sample.manifests
      .filter((m) => m.kind === "Relationship")
      .flatMap((m) => m.spec["edges"] as Array<{ type: string }>);
    const containment = relationshipEdges.filter((e) => e.type === "belongsTo").length;
    expect(v.edges.length + v.dropped.length + containment).toBe(relationshipEdges.length);
    expect(v.dropped.every((d) => d.reason === "not-drawn")).toBe(true);
    expect(v.edges.map((e) => e.type)).toContain("triggers");
  });

  it("omits the business and organization layer", () => {
    expect(v.omitted.map((o) => o.kind).sort()).toEqual([
      "BusinessCapability",
      "BusinessRule",
      "Squad",
      "Subdomain",
      "Subdomain",
      "Subdomain",
    ]);
  });
});

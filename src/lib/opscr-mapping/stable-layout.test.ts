import { describe, expect, it } from "vitest";
import type { ViewBox, ViewLayoutResult } from "./layout";
import { stabilizeLayout } from "./stable-layout";
import { buildTechnicalView } from "./technical-view";
import type { OpscrManifestInput } from "./types";

const m = (kind: string, name: string, spec: Record<string, unknown> = {}): OpscrManifestInput => ({
  kind,
  metadata: { name },
  spec,
});
const belongs = (from: [string, string], to: [string, string]) => ({
  from: { kind: from[0], id: from[1] },
  to: { kind: to[0], id: to[1] },
  type: "belongsTo",
});

const result = (boxes: Record<string, ViewBox>): ViewLayoutResult => ({
  boxes: new Map(Object.entries(boxes)),
  edgeRoutes: new Map(),
});
const box = (x: number, y: number, width = 180, height = 80): ViewBox => ({ x, y, width, height });
const overlap = (a: ViewBox, b: ViewBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** orders panel with one app; the edit adds a second app inside it and a root database. */
const before = buildTechnicalView({
  manifests: [
    m("ApplicationService", "orders"),
    m("Application", "api"),
    m("Relationship", "r", {
      edges: [belongs(["Application", "api"], ["ApplicationService", "orders"])],
    }),
  ],
});
const after = buildTechnicalView({
  manifests: [
    m("ApplicationService", "orders"),
    m("Application", "api"),
    m("Application", "worker"),
    m("Database", "db"),
    m("Relationship", "r", {
      edges: [
        belongs(["Application", "api"], ["ApplicationService", "orders"]),
        belongs(["Application", "worker"], ["ApplicationService", "orders"]),
      ],
    }),
  ],
});

const previous = result({
  "ApplicationService/orders": box(100, 100, 260, 160),
  "Application/api": box(40, 40),
});

describe("stabilizeLayout", () => {
  it("returns the fresh layout when there is nothing to keep", () => {
    const fresh = result({ "Application/api": box(1, 2) });
    expect(stabilizeLayout(before, fresh, undefined)).toBe(fresh);
  });

  it("keeps every surviving element where it was, whatever the engine says now", () => {
    // The engine moved everything (as a full relayout does).
    const fresh = result({
      "ApplicationService/orders": box(500, 500, 260, 300),
      "Application/api": box(40, 160),
      "Application/worker": box(40, 40),
      "Database/db": box(900, 0),
    });
    const boxes = stabilizeLayout(after, fresh, previous).boxes;
    expect(boxes.get("ApplicationService/orders")).toMatchObject({ x: 100, y: 100 });
    expect(boxes.get("Application/api")).toMatchObject({ x: 40, y: 40, width: 180, height: 80 });
  });

  it("moves nothing when only text changed", () => {
    const fresh = result({
      "ApplicationService/orders": box(0, 0, 300, 300),
      "Application/api": box(80, 90),
    });
    const boxes = stabilizeLayout(before, fresh, previous).boxes;
    expect(boxes.get("ApplicationService/orders")).toEqual(box(100, 100, 260, 160));
    expect(boxes.get("Application/api")).toEqual(box(40, 40));
  });

  it("places a new element relative to its nearest surviving sibling, overlapping none", () => {
    // The engine puts worker exactly where api was kept: it must move off it.
    const fresh = result({
      "ApplicationService/orders": box(100, 100, 260, 300),
      "Application/api": box(40, 160),
      "Application/worker": box(40, 160),
      "Database/db": box(900, 0),
    });
    const boxes = stabilizeLayout(after, fresh, previous).boxes;
    const api = boxes.get("Application/api")!;
    const worker = boxes.get("Application/worker")!;
    expect(overlap(api, worker)).toBe(false);
    expect(worker.x).toBe(api.x);
  });

  it("grows a panel to hold its children and never shrinks it", () => {
    const fresh = result({
      "ApplicationService/orders": box(100, 100, 10, 10),
      "Application/api": box(40, 40),
      "Application/worker": box(40, 400),
      "Database/db": box(900, 0),
    });
    const boxes = stabilizeLayout(after, fresh, previous).boxes;
    const panel = boxes.get("ApplicationService/orders")!;
    for (const id of ["Application/api", "Application/worker"]) {
      const child = boxes.get(id)!;
      expect(child.x + child.width).toBeLessThanOrEqual(panel.width);
      expect(child.y + child.height).toBeLessThanOrEqual(panel.height);
    }
    expect(panel.width).toBeGreaterThanOrEqual(260);
  });
});

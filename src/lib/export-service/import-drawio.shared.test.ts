import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram, NodeLayout } from "@/features/diagram";
import "@/features/elements/bootstrap";
import { exportDrawio } from "./export-drawio";
import { parseDrawioXml } from "./import-drawio";

const item = (id: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "container",
    ...extra,
  }) as unknown as Component;

function exported(components: Record<string, Component>, connections: Record<string, Connection>) {
  const layouts: Record<string, NodeLayout> = {};
  Object.keys(components).forEach((id, index) => {
    layouts[id] = { elementId: id, x: index * 260, y: 0, width: 200, height: 80 };
  });
  const diagram = {
    id: "d",
    name: "Shared",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts: layouts,
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
  return exportDrawio(diagram, {});
}

describe("importing what Structura exported of a shared element", () => {
  it("badge mode: the element comes back shared, with the edges its object carried", () => {
    const xml = exported(
      {
        auth: item("auth", { name: "Auth", shared: { mode: "badge" } }),
        orders: item("orders", { name: "Orders" }),
        billing: item("billing", { name: "Billing" }),
      },
      {
        e1: { id: "e1", sourceId: "orders", targetId: "auth", label: "gRPC" },
        e2: { id: "e2", sourceId: "billing", targetId: "auth", label: "HTTP" },
      },
    );
    const back = parseDrawioXml(xml, { x: 0, y: 0 }, {});
    const byName = Object.fromEntries(back.components.map((c) => [c.name, c]));
    expect(byName.Auth).toMatchObject({ shared: { mode: "badge" } });
    // The badges are drawings, not elements.
    expect(back.components.map((c) => c.name).sort()).toEqual(["Auth", "Billing", "Orders"]);
    expect(
      back.connections.map((c) => [
        byNameOf(back.components, c.sourceId),
        byNameOf(back.components, c.targetId),
      ]),
    ).toEqual([
      ["Orders", "Auth"],
      ["Billing", "Auth"],
    ]);
  });

  it("ref mode: a reference comes back standing for the imported original", () => {
    const xml = exported(
      {
        auth: item("auth", { name: "Auth", shared: { mode: "ref" } }),
        orders: item("orders", { name: "Orders" }),
        r1: item("r1", { name: "Auth", type: "shared-ref", refOf: "auth" }),
      },
      { e1: { id: "e1", sourceId: "orders", targetId: "r1", label: "gRPC" } },
    );
    const back = parseDrawioXml(xml, { x: 0, y: 0 }, {});
    const auth = back.components.find((c) => c.name === "Auth" && c.type === "container")!;
    const ref = back.components.find((c) => c.type === "shared-ref") as
      { refOf: string } | undefined;
    expect(auth).toMatchObject({ shared: { mode: "ref" } });
    expect(ref?.refOf).toBe(auth.id);
    expect(back.connections).toHaveLength(1);
  });
});

function byNameOf(components: Component[], id: string): string | undefined {
  return components.find((c) => c.id === id)?.name;
}

import { describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import { structuralSignature } from "./structuralSignature";

const component = (
  id: string,
  parentId: string | null,
  type: Component["type"] = "container",
  extra: Record<string, unknown> = {},
): Component => ({ id, name: id, description: "", parentId, type, ...extra }) as Component;

const connection = (id: string, sourceId: string, targetId: string, label = ""): Connection =>
  ({ id, sourceId, targetId, label }) as Connection;

function snapshot(components: Component[], connections: Connection[]) {
  return {
    components: Object.fromEntries(components.map((c) => [c.id, c])),
    connections: Object.fromEntries(connections.map((c) => [c.id, c])),
  };
}

const base = () =>
  snapshot(
    [component("p", null, "panel"), component("a", "p"), component("b", null)],
    [connection("ab", "a", "b", "calls")],
  );

describe("structuralSignature", () => {
  const before = structuralSignature(base());

  it("changes when an element is added or removed", () => {
    const added = base();
    added.components.c = component("c", null);
    expect(structuralSignature(added)).not.toBe(before);

    const removed = base();
    delete removed.components.b;
    expect(structuralSignature(removed)).not.toBe(before);
  });

  it("changes when a connection is added, removed or reconnected", () => {
    const added = base();
    added.connections.ba = connection("ba", "b", "a");
    expect(structuralSignature(added)).not.toBe(before);

    const reconnected = base();
    reconnected.connections.ab = connection("ab", "a", "p");
    expect(structuralSignature(reconnected)).not.toBe(before);
  });

  it("changes when an element moves into another parent, or a panel collapses", () => {
    const reparented = base();
    reparented.components.b = component("b", "p");
    expect(structuralSignature(reparented)).not.toBe(before);

    const collapsed = base();
    collapsed.components.p = component("p", null, "panel", { collapsed: true });
    expect(structuralSignature(collapsed)).not.toBe(before);
  });

  it("stays the same for a rename, a label edit or a restyle", () => {
    const edited = base();
    edited.components.a = { ...component("a", "p"), name: "Renamed", description: "new" };
    edited.connections.ab = connection("ab", "a", "b", "writes to");
    expect(structuralSignature(edited)).toBe(before);
  });

  it("does not depend on enumeration order, and ignores free text", () => {
    const reordered = snapshot(
      [component("b", null), component("a", "p"), component("p", null, "panel")],
      [connection("ab", "a", "b")],
    );
    expect(structuralSignature(reordered)).toBe(before);

    const withText = base();
    withText.components.t = component("t", null, "text");
    expect(structuralSignature(withText)).toBe(before);
  });
});
